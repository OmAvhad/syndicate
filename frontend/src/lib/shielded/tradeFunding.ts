import { formatEther, parseEther, parseUnits, type Address, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { MnemonicKeystore } from '@kohaku-eth/plugins'
import { Bundler, RailgunBuilder, RailgunSigner, Signer, SimpleSmartAccount, UtxoSyncer, chainConfig, ensureInitialized, buildUnshieldExecutionCalls, type Eip1193Provider, type SignedUserOperation } from '@kohaku-eth/railgun'
import api from '../api'
import { invalidateCachedBalance } from './balanceCache'
import { installArtifactFetch, requireArtifactsReady } from './artifactFetch'
import { withProverErrorBoundary } from './proverBoundary'
import { POOL_TOKENS, poolPublicClient } from './pool'
import { PoolDatabase, POOL_CHAIN_ID, readWallet, scopeKey, withPoolLock, type PoolScope } from './storage'

export interface FundingQuote {
  capital: string; grossUsdc: string; nativeReserve: string; feeReserve: string; requiredWeth: string
}
export interface TradingBurner {
  id: string; address: Address; privateKey: Hex; createdAt: string; inputs: string
  quote: FundingQuote; stage: 'created' | 'signed' | 'submitted' | 'funded' | 'entry-pending' | 'open' | 'closed'
  signedOperation?: SignedUserOperation; userOpHash?: Hex; fundingTxHash?: Hex
  promise?: { promiseId: string; payloadHash: string; tradeIndex: number; arkivEntityKey?: string }
  entry?: import('../flashEngine').OnchainExecutionResult
  tradeId?: string
}
export function loadTradingBurner(scope: PoolScope): TradingBurner | null {
  const value = localStorage.getItem(`${scopeKey(scope)}:active-trade`)
  if (!value) return null
  const record = JSON.parse(value) as TradingBurner
  if (privateKeyToAccount(record.privateKey).address.toLowerCase() !== record.address.toLowerCase()) throw new Error('Saved burner key does not match its address.')
  return record
}
export function saveTradingBurner(scope: PoolScope, record: TradingBurner) {
  const raw = JSON.stringify(record)
  localStorage.setItem(`${scopeKey(scope)}:trade:${record.id}`, raw)
  localStorage.setItem(`${scopeKey(scope)}:active-trade`, raw)
  if (localStorage.getItem(`${scopeKey(scope)}:active-trade`) !== raw) throw new Error('Unable to save burner recovery data. Funding stopped.')
}
export function createTradingBurner(scope: PoolScope, inputs: string, quote: FundingQuote): TradingBurner {
  const key = generatePrivateKey()
  const record: TradingBurner = { id: crypto.randomUUID(), address: privateKeyToAccount(key).address, privateKey: key, inputs, quote, stage: 'created', createdAt: new Date().toISOString() }
  saveTradingBurner(scope, record)
  return record
}
export function grossForUnshield(net: bigint, bps: number): bigint {
  const denominator = 10_000n - BigInt(bps)
  return (net * 10_000n + denominator - 1n) / denominator
}
export async function quoteTradeFunding(capital: string): Promise<FundingQuote> {
  if (!/^\d+(\.\d{1,2})?$/.test(capital) || parseUnits(capital, 6) <= 0n) throw new Error('Enter positive USDC capital with at most two decimal places.')
  await ensureInitialized()
  const config = chainConfig(BigInt(POOL_CHAIN_ID))!
  const gasPrice = await poolPublicClient.getGasPrice()
  // Reserve for the burner's ERC20 entry + exit and volatility/headroom.
  const nativeReserve = gasPrice * 350_000n * 2n > parseEther('0.0003') ? gasPrice * 350_000n * 2n : parseEther('0.0003')
  // Conservative withdrawal budget. Actual SDK estimate is checked before submission.
  const feeReserve = gasPrice * 1_500_000n * 2n > parseEther('0.003') ? gasPrice * 1_500_000n * 2n : parseEther('0.003')
  return { capital, grossUsdc: grossForUnshield(parseUnits(capital, 6), config.unshieldFeeBps).toString(), nativeReserve: nativeReserve.toString(), feeReserve: feeReserve.toString(), requiredWeth: (grossForUnshield(nativeReserve, config.unshieldFeeBps) + feeReserve).toString() }
}
export function fundingShortfall(quote: FundingQuote, usdc: bigint, weth: bigint): string | null {
  if (usdc < BigInt(quote.grossUsdc)) return `Shielded USDC is insufficient. Top up to cover ${Number(quote.grossUsdc) / 1e6} USDC including the pool withdrawal fee.`
  if (weth < BigInt(quote.requiredWeth)) return `Shielded WETH is insufficient. Top up ETH/WETH to cover approximately ${formatEther(BigInt(quote.requiredWeth))} WETH for native trade gas, the withdrawal fee reserve and pool fees.`
  return null
}
export function applyEstimatedFee(quote: FundingQuote, maxCost: bigint, unshieldFeeBps: number): FundingQuote {
  if (maxCost <= 0n) throw new Error('Pimlico returned an invalid zero withdrawal fee estimate.')
  // The pinned Kohaku SDK returns when its fee note is within 1% above maxCost.
  // ceil(maxCost / 0.99) covers that already-proved fee note; it is not a new charge.
  const feeReserve = (maxCost * 100n + 98n) / 99n
  return { ...quote, feeReserve: feeReserve.toString(), requiredWeth: (grossForUnshield(BigInt(quote.nativeReserve), unshieldFeeBps) + feeReserve).toString() }
}
export function assertTradeScope(scope: PoolScope) {
  const user = JSON.parse(localStorage.getItem('world-id-user') || 'null')
  if (user?.id !== scope.userId || user?.walletAddress?.toLowerCase() !== scope.walletAddress.toLowerCase()) {
    throw new Error('Your signed-in wallet changed. Reopen this trade with its original account to resume.')
  }
}

const rpc = poolPublicClient.request as unknown as (args: { method: string; params?: unknown[] }) => Promise<unknown>
export const fundingProvider: Eip1193Provider = {
  getChainId: async () => BigInt(await poolPublicClient.getChainId()),
  getBlockNumber: () => poolPublicClient.getBlockNumber(),
  getGasPrice: () => poolPublicClient.getGasPrice(),
  getTransactionCount: async (address, block) => BigInt(await poolPublicClient.getTransactionCount({ address, ...(block === undefined ? {} : { blockNumber: BigInt(block) }) })),
  ethCall: async (to, data) => (await poolPublicClient.call({ to, data })).data ?? '0x',
  estimateGas: (to, from, data) => poolPublicClient.estimateGas({ to, account: from, data }),
  getLogs: async (address, signature, from, to) => {
    const logs = await rpc({ method: 'eth_getLogs', params: [{ address, ...(signature ? { topics: [signature] } : {}), ...(from !== undefined ? { fromBlock: `0x${from.toString(16)}` } : {}), ...(to !== undefined ? { toBlock: `0x${to.toString(16)}` } : {}) }] }) as { blockNumber: Hex; transactionHash: Hex; address: Address; topics: Hex[]; data: Hex }[]
    return logs.map(log => ({ ...log, blockNumber: Number(BigInt(log.blockNumber)), blockTimestamp: null }))
  },
}

async function bundlerSession(address: Address): Promise<Bundler> {
  const result = await api.post('/api/pool/session', { sender: address })
  // Fail before expensive proving if the proxy/Pimlico connection is unavailable.
  const check = await api.post(result.data.path, { jsonrpc: '2.0', id: 1, method: 'pimlico_getUserOperationGasPrice', params: [] })
  if (check.data.error || !check.data.result) throw new Error(check.data.error?.message || 'Pimlico connection check failed. Retry before building the proof.')
  return Bundler.pimlico(new URL(result.data.path, api.defaults.baseURL || window.location.origin).href)
}

export async function fundTradingBurner(scope: PoolScope, record: TradingBurner, progress: (message: string) => void): Promise<TradingBurner> {
  return withPoolLock(scope, async () => {
    assertTradeScope(scope)
    if (['funded', 'entry-pending', 'open', 'closed'].includes(record.stage)) return record
    if (!record.signedOperation && !record.userOpHash) await requireArtifactsReady()
    installArtifactFetch()
    await ensureInitialized()
    const bundler = await bundlerSession(record.address)
    if (!record.signedOperation && !record.userOpHash) {
      record.quote = await quoteTradeFunding(record.quote.capital)
      saveTradingBurner(scope, record)
      const wallet = readWallet(scope)
      if (!wallet) throw new Error('Restore your shielded wallet on the dashboard first.')
      const config = chainConfig(BigInt(POOL_CHAIN_ID))!
      const db = await PoolDatabase.open(scope)
      try {
        const keystore = new MnemonicKeystore(wallet.mnemonic)
        const signer = RailgunSigner.privateKey(await keystore.deriveAt(RailgunSigner.spendingKeyPath(wallet.keyIndex)), await keystore.deriveAt(RailgunSigner.viewingKeyPath(wallet.keyIndex)), BigInt(POOL_CHAIN_ID))
        if (wallet.shieldedAddress && signer.address !== wallet.shieldedAddress) throw new Error('Shielded spending keys do not match the saved wallet.')
        const database = { get: (key: string) => db.get(`${POOL_CHAIN_ID}:${key}`), set: (key: string, value: string) => db.set(`${POOL_CHAIN_ID}:${key}`, value), delete: (key: string) => db.set(`${POOL_CHAIN_ID}:${key}`, '') }
        const provider = await new RailgunBuilder(config, fundingProvider).withDatabase(database)
          .withUtxoSyncer(UtxoSyncer.chained([UtxoSyncer.subsquid(config), UtxoSyncer.rpc(config, fundingProvider, 10n)])).build()
        await provider.register(signer)
        progress('Synchronizing private notes and checking capital plus fee reserves…')
        await provider.sync()
        const balances = await provider.balance(signer.address)
        const balance = (token: string) => balances.filter(b => b.asset.type === 'Erc20' && b.asset.value.toLowerCase() === token.toLowerCase()).reduce((sum, b) => sum + b.amount, 0n)
        const shortfall = fundingShortfall(record.quote, balance(POOL_TOKENS.USDC.address), balance(config.wrappedBaseToken))
        if (shortfall) throw new Error(shortfall)
        const builder = provider.transact()
          .unshield(signer, record.address, { type: 'Erc20', value: POOL_TOKENS.USDC.address }, BigInt(record.quote.grossUsdc))
          .unshield(signer, record.address, { type: 'Erc20', value: config.wrappedBaseToken }, grossForUnshield(BigInt(record.quote.nativeReserve), config.unshieldFeeBps))
        const calls = buildUnshieldExecutionCalls({ wrappedBaseToken: config.wrappedBaseToken, nativeAmount: BigInt(record.quote.nativeReserve), to: record.address })
        progress('Building withdrawal proof and estimating the Pimlico UserOperation…')
        const smartAccount = new SimpleSmartAccount(record.address, BigInt(POOL_CHAIN_ID), fundingProvider)
        const operation = await withProverErrorBoundary(() => provider.prepareUserOp(builder, bundler, smartAccount, signer, config.wrappedBaseToken, calls)).catch(error => {
          if (String(error).includes('Artifact loader error')) throw new Error('Proof files could not be read. Prepare proof files again and retry; your saved burner is retained and no funding operation has been submitted.')
          throw error
        })
        const op = operation.userOp
        const gas = ['callGasLimit', 'verificationGasLimit', 'preVerificationGas', 'paymasterVerificationGasLimit', 'paymasterPostOpGasLimit'].reduce((sum, field) => sum + BigInt((op as unknown as Record<string, string>)[field] || '0x0'), 0n)
        const estimatedMaxCost = gas * BigInt(op.maxFeePerGas)
        record.quote = applyEstimatedFee(record.quote, estimatedMaxCost, config.unshieldFeeBps)
        saveTradingBurner(scope, record)
        const availableWeth = balance(config.wrappedBaseToken)
        progress(`Pimlico withdrawal estimate: up to ${formatEther(estimatedMaxCost)} ETH; shielded fee allowance ${formatEther(BigInt(record.quote.feeReserve))} WETH. Total shielded WETH required including native trade gas: ${formatEther(BigInt(record.quote.requiredWeth))}; available: ${formatEther(availableWeth)}.`)
        if (availableWeth < BigInt(record.quote.requiredWeth)) {
          throw new Error(`Insufficient shielded WETH for the live withdrawal estimate and native trade gas. Required: ${formatEther(BigInt(record.quote.requiredWeth))} WETH; available: ${formatEther(availableWeth)} WETH; top up: ${formatEther(BigInt(record.quote.requiredWeth) - availableWeth)} WETH. ETH held outside the pool is not included.`)
        }
        if (op.sender.toLowerCase() !== record.address.toLowerCase()) throw new Error('UserOperation sender does not match the recipient burner.')
        progress('Signing the UserOperation and EIP-7702 authorization locally with the recipient burner…')
        assertTradeScope(scope)
        record.signedOperation = await operation.sign(Signer.privateKey(record.privateKey))
        record.stage = 'signed'
        saveTradingBurner(scope, record)
      } finally { db.close() }
    }
    if (!record.userOpHash) {
      assertTradeScope(scope)
      invalidateCachedBalance(scope)
      progress('Submitting the signed withdrawal to Pimlico…')
      record.userOpHash = await bundler.sendUserOperation(record.signedOperation!)
      record.stage = 'submitted'
      saveTradingBurner(scope, record)
    }
    progress(`Waiting for Pimlico funding confirmation (${record.userOpHash})…`)
    const receipt = await bundler.waitForReceipt(record.userOpHash)
    if (!receipt.success || receipt.sender.toLowerCase() !== record.address.toLowerCase()) throw new Error('Withdrawal UserOperation failed. Trading has not started; inspect the saved operation before recovery.')
    const txHash = receipt.receipt.transactionHash
    record.fundingTxHash = txHash
    saveTradingBurner(scope, record)
    const [usdc, eth] = await Promise.all([
      poolPublicClient.readContract({ address: POOL_TOKENS.USDC.address, abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address', name: 'owner' }], outputs: [{ type: 'uint256' }] }], functionName: 'balanceOf', args: [record.address] }),
      poolPublicClient.getBalance({ address: record.address }),
    ])
    if (usdc < parseUnits(record.quote.capital, 6) || eth < BigInt(record.quote.nativeReserve)) throw new Error('Funding was included but the required recipient balances are not available. Trading stopped; refresh before retrying.')
    record.stage = 'funded'
    delete record.signedOperation
    saveTradingBurner(scope, record)
    return record
  })
}
