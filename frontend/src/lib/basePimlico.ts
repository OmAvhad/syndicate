import { createWalletClient, encodeFunctionData, erc20Abi, formatEther, http, parseEther, toHex, type Address, type Hex } from 'viem'
import { createBundlerClient, entryPoint08Address, getUserOperationHash, toSimple7702SmartAccount } from 'viem/account-abstraction'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import api from './api'
import { BASE_MAINNET_RPC, baseMainnetPublicClient as client, BASE_USDC, BASE_WETH, baseTradeStorageKey, ensureBaseMainnetNetwork, type BaseBurnerAccount } from './baseBurner'

type Progress = (message: string) => void
export function readBaseTrade(address: Address): Record<string, string> {
  return JSON.parse(localStorage.getItem(baseTradeStorageKey(address)) || '{}')
}
export function saveBaseTrade(address: Address, patch: Record<string, string>) {
  const key = baseTradeStorageKey(address)
  const value = JSON.stringify({ ...readBaseTrade(address), ...patch })
  localStorage.setItem(key, value)
  if (localStorage.getItem(key) !== value) throw new Error('Cannot save trade recovery state. Stopping before submission.')
}
async function confirmed(hash: Hex) {
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 })
  if (receipt.status !== 'success') throw new Error(`Base transaction reverted: ${hash}`)
  return receipt
}
export async function baseBundler(burner: BaseBurnerAccount) {
  const session = await api.post('/api/pool/session', { sender: burner.address, chainId: base.id })
  const url = new URL(session.data.path, api.defaults.baseURL || window.location.origin).href
  const owner = privateKeyToAccount(burner.privateKey)
  const account = await toSimple7702SmartAccount({ client, owner })
  const bundler = createBundlerClient({ account, chain: base, client, transport: http(url, { retryCount: 0 }) })
  if (!(await bundler.getSupportedEntryPoints()).some(address => address.toLowerCase() === entryPoint08Address.toLowerCase())) throw new Error('Pimlico does not expose EntryPoint 0.8 on this Base endpoint.')
  return { bundler, account, owner, url }
}

/** Public Base demo funding. No shielded balance or sponsored gas is claimed. */
export async function fundBaseTrade(burner: BaseBurnerAccount, linkedWallet: Address, token: Address, amount: bigint, progress: Progress) {
  if (![BASE_USDC.toLowerCase(), BASE_WETH.toLowerCase()].includes(token.toLowerCase()) || amount <= 0n) throw new Error('Invalid Base trade asset or amount.')
  progress('Preparing the funding route and fresh burner. Confirm actual Base funding in your wallet.')
  // Check bundler access before asking the user to move funds.
  await baseBundler(burner)
  await ensureBaseMainnetNetwork()
  const accounts = await window.ethereum!.request({ method: 'eth_requestAccounts' }) as Address[]
  if (accounts[0]?.toLowerCase() !== linkedWallet.toLowerCase()) throw new Error('Select your linked profile wallet in MetaMask before funding this trade.')
  const send = async (key: string, tx: { to: Address; data?: Hex; value?: Hex }) => {
    const saved = readBaseTrade(burner.address)
    if (saved[key]) { await confirmed(saved[key] as Hex); return }
    if (await window.ethereum!.request({ method: 'eth_chainId' }) !== '0x2105') throw new Error('Switch MetaMask to Base mainnet.')
    const selected = await window.ethereum!.request({ method: 'eth_accounts' }) as Address[]
    if (selected[0]?.toLowerCase() !== linkedWallet.toLowerCase()) throw new Error('MetaMask account changed. Restore the linked wallet.')
    const hash = await window.ethereum!.request({ method: 'eth_sendTransaction', params: [{ from: linkedWallet, chainId: '0x2105', ...tx }] }) as Hex
    saveBaseTrade(burner.address, { [key]: hash })
    await confirmed(hash)
  }
  const pending = readBaseTrade(burner.address)
  for (const key of ['fundingEthHash', 'fundingTokenHash']) if (pending[key]) await confirmed(pending[key] as Hex)
  const balance = await client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [burner.address] })
  const deficit = amount > balance ? amount - balance : 0n
  if (deficit && token.toLowerCase() === BASE_USDC.toLowerCase()) {
    const source = await client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [linkedWallet] })
    if (source < deficit) throw new Error('Your original wallet has insufficient Base USDC for this trade.')
  }
  const eth = await client.getBalance({ address: burner.address })
  const gasReserve = parseEther('0.00005')
  const nativeForWrap = token.toLowerCase() === BASE_WETH.toLowerCase() ? deficit : 0n
  const neededEth = gasReserve + nativeForWrap
  if (eth < neededEth) {
    const topup = neededEth - eth
    const sourceEth = await client.getBalance({ address: linkedWallet })
    if (sourceEth < topup + parseEther('0.00001')) throw new Error(`Original wallet needs at least ${formatEther(topup + parseEther('0.00001'))} Base ETH for funding and transfer gas.`)
    progress(`Confirm burner funding in MetaMask: ${formatEther(topup)} Base ETH for preparation and gas.`)
    await send('fundingEthHash', { to: burner.address, value: toHex(topup) })
  }
  if (deficit && token.toLowerCase() === BASE_USDC.toLowerCase()) {
    const source = await client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [linkedWallet] })
    if (source < deficit) throw new Error('Your original wallet has insufficient Base USDC for this trade.')
    progress('Confirm USDC funding of the fresh burner in MetaMask.')
    await send('fundingTokenHash', { to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [burner.address, deficit] }) })
  }
  progress('Burner funding confirmed. Preparing its locally signed Pimlico UserOperation…')
}

export async function prepareBaseUserOperation(burnerPk: Hex, token: Address, amount: bigint, protectionAmount?: bigint): Promise<{ wrapped?: bigint; approved?: boolean; userOpHash?: Hex; transactionHash?: Hex }> {
  const owner = privateKeyToAccount(burnerPk)
  const burner = { address: owner.address, privateKey: burnerPk }
  const { bundler, account, url } = await baseBundler(burner)
  let saved = readBaseTrade(owner.address)
  const submitPrepared = async (signed: any) => {
    const expectedHash = getUserOperationHash({ chainId: base.id, entryPointAddress: entryPoint08Address, entryPointVersion: '0.8', userOperation: signed })
    saveBaseTrade(owner.address, { preparationUserOpHash: expectedHash })
    const existing = await bundler.getUserOperationReceipt({ hash: expectedHash }).catch(() => null)
    if (existing) {
      if (!existing.success) throw new Error('Saved Pimlico operation reverted. Inspect it before recovery.')
      return existing
    }
    try {
      const hash = await bundler.sendUserOperation(signed)
      if (hash.toLowerCase() !== expectedHash.toLowerCase()) throw new Error('Pimlico returned an unexpected UserOperation hash.')
    } catch (error) {
      const included = await bundler.getUserOperationReceipt({ hash: expectedHash }).catch(() => null)
      if (!included) throw error
      if (!included.success) throw new Error('Pimlico preparation reverted.')
      return included
    }
    const receipt = await bundler.waitForUserOperationReceipt({ hash: expectedHash, timeout: 180_000 })
    if (!receipt.success) throw new Error('Pimlico preparation reverted; trading stopped.')
    return receipt
  }
  if (saved.preparationOperation) {
    const signed = JSON.parse(saved.preparationOperation, (_, v) => typeof v === 'string' && /^bigint:\d+$/.test(v) ? BigInt(v.slice(7)) : v)
    const receipt = await submitPrepared(signed)
    return { approved: true, userOpHash: receipt.userOpHash, transactionHash: receipt.receipt.transactionHash }
  }
  const balance = await client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner.address] })
  const wrapped = token.toLowerCase() === BASE_WETH.toLowerCase() && amount > balance ? amount - balance : 0n
  if (!wrapped && balance < amount) throw new Error('Burner has insufficient trade tokens.')
  const calls: { to: Address; data: Hex; value?: bigint }[] = []
  if (wrapped) calls.push({ to: BASE_WETH, data: '0xd0e30db0', value: wrapped })
  // Exact allowance, matching the quote's actual input token.
  calls.push({ to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: ['0x5d00000873b6BF41539e6f5365B0Ff7d3c368f78', amount] }) })
  if (protectionAmount) calls.push({ to: BASE_WETH, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: ['0x5d00000873b6BF41539e6f5365B0Ff7d3c368f78', protectionAmount * 2n] }) })
  const wallet = createWalletClient({ account: owner, chain: base, transport: http(BASE_MAINNET_RPC) })
  const authorization = await account.isDeployed() ? undefined : await wallet.signAuthorization({ contractAddress: account.authorization!.address })
  const gas = await api.post(url, { jsonrpc: '2.0', id: 1, method: 'pimlico_getUserOperationGasPrice', params: [] })
  if (gas.data.error || !gas.data.result?.fast) throw new Error(gas.data.error?.message || 'Pimlico gas estimate unavailable.')
  const fees = gas.data.result.fast
  const operation = await bundler.prepareUserOperation({ calls, authorization, maxFeePerGas: BigInt(fees.maxFeePerGas), maxPriorityFeePerGas: BigInt(fees.maxPriorityFeePerGas) })
  const requiredGas = (operation.callGasLimit + operation.verificationGasLimit + operation.preVerificationGas) * operation.maxFeePerGas
  if (await client.getBalance({ address: owner.address }) < wrapped + requiredGas + parseEther('0.000005')) throw new Error(`Burner needs more Base ETH. Pimlico maximum execution budget: ${formatEther(requiredGas)} ETH plus wrapped principal and fee headroom.`)
  // Save the signed operation before broadcasting; retries use identical bytes/hash.
  saved = readBaseTrade(owner.address)
  const signed = saved.preparationOperation ? JSON.parse(saved.preparationOperation, (_, v) => typeof v === 'string' && /^bigint:\d+$/.test(v) ? BigInt(v.slice(7)) : v) : { ...operation, signature: await account.signUserOperation(operation) }
  saveBaseTrade(owner.address, { preparationOperation: JSON.stringify(signed, (_, v) => typeof v === 'bigint' ? `bigint:${v}` : v) })
  const receipt = await submitPrepared(signed)
  const hash = receipt.userOpHash
  const allowance = await client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [owner.address, '0x5d00000873b6BF41539e6f5365B0Ff7d3c368f78'] })
  if (allowance < amount) throw new Error('Pimlico receipt did not produce the required allowance.')
  return { wrapped: wrapped || undefined, approved: true, userOpHash: hash, transactionHash: receipt.receipt.transactionHash }
}
