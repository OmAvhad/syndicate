import { createPublicClient, encodeFunctionData, erc20Abi, formatUnits, http, parseUnits, type Address, type Hex } from 'viem'
import { sepolia } from 'viem/chains'
import { sepoliaTransport } from '../sepoliaRpc'
import { cacheBalance, invalidateCachedBalance, readCachedBalance } from './balanceCache'
import { MnemonicKeystore } from '@kohaku-eth/plugins'
import { viem } from '@kohaku-eth/provider/viem'
import { chainConfig, createRailgunPlugin, ensureInitialized, type RailgunPlugin } from '@kohaku-eth/railgun'
import {
  createWallet, PoolDatabase, POOL_CHAIN_ID, readDeposits, readWallet, saveDeposits,
  saveWallet, withPoolLock, type DepositRecord, type PoolScope,
} from './storage'

export const POOL_TOKENS = {
  ETH: { decimals: 18, address: null },
  WETH: { decimals: 18, address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14' as Address },
  USDC: { decimals: 6, address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238' as Address },
} as const
export type PoolToken = keyof typeof POOL_TOKENS
export interface PoolView { address: string; balances: { symbol: string; amount: string; notes: number }[]; syncedAt: string }
export const poolPublicClient = createPublicClient({
  chain: sepolia,
  transport: sepoliaTransport(),
})
const publicClient = poolPublicClient

export function parseDepositAmount(symbol: PoolToken, input: string): bigint {
  const decimals = POOL_TOKENS[symbol]?.decimals
  if (decimals === undefined || !/^\d+(\.\d+)?$/.test(input) || (input.split('.')[1]?.length ?? 0) > decimals) {
    throw new Error(`Enter a positive amount with at most ${decimals ?? 0} decimal places.`)
  }
  const amount = parseUnits(input, decimals)
  if (amount <= 0n || amount >= 2n ** 128n) throw new Error('Amount is outside the supported range.')
  return amount
}

async function withPlugin<T>(scope: PoolScope, action: (plugin: RailgunPlugin) => Promise<T>): Promise<T> {
  const wallet = readWallet(scope)
  if (!wallet) throw new Error('Create or restore your shielded wallet first.')
  const db = await PoolDatabase.open(scope)
  try {
    // Persist a write before accepting a deposit, so denied/quota-limited storage fails early.
    await db.set('syndicate:storage-check', 'ok')
    await ensureInitialized()
    const plugin = await createRailgunPlugin({
      network: { fetch: globalThis.fetch.bind(globalThis) }, storage: db,
      keystore: new MnemonicKeystore(wallet.mnemonic), provider: viem(publicClient),
    }, { keyIndex: wallet.keyIndex, subsquid: true, poi: false, logLevel: 'Off' })
    const address = await plugin.instanceId()
    if (wallet.shieldedAddress && wallet.shieldedAddress !== address) throw new Error('Shielded wallet address does not match the saved recovery keys.')
    saveWallet(scope, { ...wallet, shieldedAddress: address })
    return await action(plugin)
  } finally { db.close() }
}

export async function initializePool(scope: PoolScope): Promise<string> {
  return withPoolLock(scope, async () => {
    createWallet(scope)
    return withPlugin(scope, plugin => plugin.instanceId())
  })
}

async function reconcileDeposits(scope: PoolScope): Promise<void> {
  const records = readDeposits(scope)
  for (const record of records) {
    for (const tx of record.transactions.filter(t => t.status === 'pending')) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash })
        tx.status = receipt.status === 'success' ? 'confirmed' : 'reverted'
      } catch (error) {
        // A missing receipt remains pending. Connectivity errors must not mark it failed.
        if (!(error instanceof Error) || error.name !== 'TransactionReceiptNotFoundError') throw error
      }
    }
    if (record.transactions.some(t => t.status === 'reverted')) record.status = 'interrupted'
    else if (record.transactions.some(t => t.status === 'pending')) record.status = 'pending'
    else if (record.status === 'pending' && record.transactions.filter(t => t.kind === 'deposit' && t.status === 'confirmed').length === record.expectedDepositTransactions) record.status = 'confirmed'
    else if (record.status === 'preparing' || record.status === 'pending') record.status = 'interrupted'
  }
  saveDeposits(scope, records)
}

async function readView(plugin: RailgunPlugin): Promise<PoolView> {
  // notes() already synchronizes and returns unspent notes. Calling balance()
  // first repeats the entire sync; derive both totals and counts from one read.
  const notes = await plugin.notes()
  return {
    address: await plugin.instanceId(), syncedAt: new Date().toISOString(),
    balances: (['WETH', 'USDC'] as const).map(symbol => {
      const token = POOL_TOKENS[symbol]
      const amount = notes.filter(b => b.asset.__type === 'erc20' && b.asset.contract.toLowerCase() === token.address)
        .reduce((sum, item) => sum + item.amount, 0n)
      return { symbol, amount: formatUnits(amount, token.decimals), notes: notes.filter(n => n.asset.__type === 'erc20' && n.asset.contract.toLowerCase() === token.address).length }
    }),
  }
}

const balanceRequests = new Map<string, Promise<PoolView>>()
export function syncPool(scope: PoolScope, options: { force?: boolean } = {}): Promise<PoolView> {
  const key = `${scope.userId}:${scope.walletAddress.toLowerCase()}`
  const pending = balanceRequests.get(key)
  if (pending) return pending
  const cached = readCachedBalance(scope)
  if (!options.force && cached && Date.now() - Date.parse(cached.syncedAt) < 30_000) return Promise.resolve(cached)
  const request = withPoolLock(scope, async () => {
    await reconcileDeposits(scope)
    const result = await withPlugin(scope, readView)
    cacheBalance(scope, result)
    return result
  }).finally(() => { balanceRequests.delete(key) })
  balanceRequests.set(key, request)
  return request
}

async function assertFundingWallet(scope: PoolScope): Promise<void> {
  const ethereum = window.ethereum
  if (!ethereum) throw new Error('Install MetaMask to deposit funds.')
  const accounts = await ethereum.request({ method: 'eth_accounts' }) as string[]
  if (accounts[0]?.toLowerCase() !== scope.walletAddress.toLowerCase()) throw new Error('Select the linked funding wallet in MetaMask, then retry.')
  if (await ethereum.request({ method: 'eth_chainId' }) !== '0xaa36a7') throw new Error('Switch MetaMask to Ethereum Sepolia (11155111).')
  // Stop stale operations after logout or when WalletConnectButton updates the profile.
  const user = JSON.parse(localStorage.getItem('world-id-user') || 'null')
  if (user?.id !== scope.userId || user?.walletAddress?.toLowerCase() !== scope.walletAddress.toLowerCase()) {
    throw new Error('Your signed-in account changed. Reopen the dashboard before depositing.')
  }
}

export async function depositToPool(scope: PoolScope, symbol: PoolToken, input: string, progress: (message: string) => void): Promise<void> {
  const amount = parseDepositAmount(symbol, input)
  return withPoolLock(scope, async () => {
    const ethereum = window.ethereum
    if (!ethereum) throw new Error('Install MetaMask to deposit funds.')
    progress('Connect the funding wallet in MetaMask…')
    await ethereum.request({ method: 'eth_requestAccounts' })
    if (await ethereum.request({ method: 'eth_chainId' }) !== '0xaa36a7') {
      progress('Switch to Ethereum Sepolia in MetaMask…')
      await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] })
    }
    await assertFundingWallet(scope)
    invalidateCachedBalance(scope)
    await reconcileDeposits(scope)
    if (readDeposits(scope).some(r => r.transactions.some(t => t.status === 'pending'))) {
      throw new Error('An earlier transaction is still pending. Refresh its status before depositing again.')
    }
    await withPlugin(scope, async plugin => {
      progress('Creating encrypted commitment notes…')
      const token = POOL_TOKENS[symbol]
      const calls = await plugin.prepareShield({
        asset: token.address ? { __type: 'erc20', contract: token.address } : { __type: 'native' }, amount,
      })
      if (!calls.length) throw new Error('The pool returned no deposit transaction.')
      const config = chainConfig(BigInt(POOL_CHAIN_ID))
      if (!config) throw new Error('Sepolia pool configuration is unavailable.')
      const allowed = [config.railgunSmartWallet, config.relayAdaptContract].map(a => a.toLowerCase())
      if (calls.some(call => !allowed.includes(call.to.toLowerCase()))) throw new Error('Unexpected deposit contract; deposit stopped.')
      const record: DepositRecord = {
        id: crypto.randomUUID(), symbol, amount: input, createdAt: new Date().toISOString(), expectedDepositTransactions: calls.length, status: 'preparing', transactions: [],
      }
      const records = readDeposits(scope)
      records.unshift(record)
      saveDeposits(scope, records)

      async function send(to: Address, data: Hex, value: bigint, kind: 'approval' | 'deposit') {
        await assertFundingWallet(scope)
        progress(kind === 'approval' ? 'Approve the token allowance in MetaMask…' : 'Confirm the pool deposit in MetaMask…')
        const hash = await ethereum!.request({ method: 'eth_sendTransaction', params: [{
          from: scope.walletAddress, to, data, value: `0x${value.toString(16)}`, chainId: '0xaa36a7',
        }] }) as Hex
        const tx: DepositRecord['transactions'][number] = { hash, kind, status: 'pending' }
        record.transactions.push(tx)
        record.status = 'pending'
        saveDeposits(scope, records)
        progress(kind === 'approval' ? 'Approval submitted. Waiting for confirmation…' : 'Deposit submitted. Waiting for confirmation…')
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 })
        tx.status = receipt.status === 'success' ? 'confirmed' : 'reverted'
        saveDeposits(scope, records)
        if (receipt.status !== 'success') throw new Error(`${kind === 'approval' ? 'Approval' : 'Deposit'} reverted. No success has been recorded.`)
      }

      try {
        if (token.address) {
          const allowance = await publicClient.readContract({ address: token.address, abi: erc20Abi,
            functionName: 'allowance', args: [scope.walletAddress as Address, config.railgunSmartWallet] })
          if (allowance < amount) {
            await send(token.address, encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [config.railgunSmartWallet, amount] }), 0n, 'approval')
          }
        }
        for (const call of calls) await send(call.to as Address, call.data as Hex, BigInt(call.value ?? 0), 'deposit')
        record.status = 'confirmed'
        saveDeposits(scope, records)
        progress('Deposit confirmed. Refresh your private balance to discover the new notes; indexing may take a few minutes.')
      } catch (error) {
        record.status = record.transactions.some(t => t.status === 'pending') ? 'pending' : 'interrupted'
        saveDeposits(scope, records)
        throw error
      }
    })
  })
}
