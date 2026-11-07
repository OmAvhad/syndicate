import { createWalletClient, custom, erc20Abi, parseEther, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'
import { BASE_WETH, baseMainnetPublicClient, baseTradeStorageKey, ensureBaseMainnetNetwork } from './baseBurner'
import { readBaseTrade } from './basePimlico'
import api from './api'

export const BASE_LEADER_WALLET: Address = '0x4DF9aB442f076cf039B0C322Aae89Cc4990dE50D'
export const BASE_FOLLOWER_WALLET: Address = '0xd4F497e055fdd783767f55b92De0090a920E5fd9'
const allowanceContract = '0x5d00000873b6BF41539e6f5365B0Ff7d3c368f78' as const
export async function selectedBaseWallet(address: Address) {
  await ensureBaseMainnetNetwork()
  const accounts = await window.ethereum!.request({ method: 'eth_requestAccounts' }) as Address[]
  if (accounts[0]?.toLowerCase() !== address.toLowerCase()) throw new Error(`Select ${address} in MetaMask to execute this Base trade.`)
  return createWalletClient({ account: address, chain: base, transport: custom(window.ethereum!) })
}
export async function beginDirectBaseTrade(address: Address) {
  const saved = readBaseTrade(address)
  if (!saved.recorded) return
  if (saved.tradeId) {
    const { data } = await api.post(`/api/trades/${saved.tradeId}/sync-base`)
    if (data.trade?.side === 'BUY' && data.trade.status !== 'CLOSED') throw new Error('This wallet has an open protected position. Wait for its exit before starting another demo trade.')
  }
  const key = baseTradeStorageKey(address)
  localStorage.setItem(`${key}:completed:${saved.orderId || Date.now()}`, JSON.stringify(saved))
  localStorage.removeItem(key)
}
export async function signBaseWalletOrder(address: Address, typedData: string): Promise<Hex> {
  const wallet = await selectedBaseWallet(address)
  const parsed = JSON.parse(typedData)
  if (Number(parsed.domain?.chainId) !== base.id || parsed.domain.verifyingContract?.toLowerCase() !== allowanceContract.toLowerCase() || parsed.message?.swapper?.toLowerCase() !== address.toLowerCase() || parsed.message?.recipient?.toLowerCase() !== address.toLowerCase()) throw new Error('Unexpected Base order signer or domain.')
  const types = { ...parsed.types }; delete types.EIP712Domain
  return wallet.signTypedData({ ...parsed, types, domain: { ...parsed.domain, chainId: base.id } })
}
export async function prepareDirectBaseTrade(address: Address, token: Address, amount: bigint, protectionAmount?: bigint) {
  const wallet = await selectedBaseWallet(address)
  const confirmed = async (hash: Hex) => {
    const receipt = await baseMainnetPublicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error(`Base preparation reverted: ${hash}`)
  }
  let balance = await baseMainnetPublicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
  if (balance < amount && token.toLowerCase() === BASE_WETH.toLowerCase()) {
    const deficit = amount - balance
    if (await baseMainnetPublicClient.getBalance({ address }) < deficit + parseEther('0.00001')) throw new Error('The fixed wallet has insufficient Base ETH for wrapping and gas.')
    await confirmed(await wallet.writeContract({ address: BASE_WETH, abi: [{ type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] }], functionName: 'deposit', value: deficit }))
    balance = await baseMainnetPublicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
  }
  if (balance < amount) throw new Error('The fixed wallet has insufficient trade tokens. Fund this address externally before trading.')
  const approve = async (asset: Address, value: bigint) => {
    const allowance = await baseMainnetPublicClient.readContract({ address: asset, abi: erc20Abi, functionName: 'allowance', args: [address, allowanceContract] })
    if (allowance < value) await confirmed(await wallet.writeContract({ address: asset, abi: erc20Abi, functionName: 'approve', args: [allowanceContract, value] }))
  }
  await approve(token, amount)
  if (protectionAmount) await approve(BASE_WETH, protectionAmount * 2n)
}
