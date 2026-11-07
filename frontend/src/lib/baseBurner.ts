import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  formatUnits,
  parseEther,
  toHex,
  type Address,
  type Hex,
} from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'

export const BASE_MAINNET_CHAIN_ID = 8453
export const BASE_MAINNET_CHAIN_ID_HEX = '0x2105' // 8453 in hex
export const BASE_MAINNET_RPC = 'https://mainnet.base.org'
export const BASE_MAINNET_EXPLORER = 'https://basescan.org'

export const BASE_WETH: Address = '0x4200000000000000000000000000000000000006'
export const BASE_USDC: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

const STORAGE_KEY_BURNER = 'syndicate_base_mainnet_burner_pk'

export const baseMainnetPublicClient = createPublicClient({
  chain: base,
  transport: http(BASE_MAINNET_RPC),
})

export interface BaseBurnerAccount {
  address: Address
  privateKey: Hex
}

export interface BaseBurnerBalances {
  eth: string
  usdc: string
  ethRaw: bigint
  usdcRaw: bigint
}

/**
 * Ensures MetaMask is connected to Base Mainnet (8453)
 */
export async function ensureBaseMainnetNetwork(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed.')
  }

  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
  if (currentChainId === BASE_MAINNET_CHAIN_ID_HEX || currentChainId === '0x2105') {
    return true
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_MAINNET_CHAIN_ID_HEX }],
    })
    return true
  } catch (err: unknown) {
    const e = err as { code?: number }
    if (e?.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BASE_MAINNET_CHAIN_ID_HEX,
            chainName: 'Base',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [BASE_MAINNET_RPC],
            blockExplorerUrls: [BASE_MAINNET_EXPLORER],
          },
        ],
      })
      return true
    }
    throw err
  }
}

/**
 * Gets or creates a local ephemeral burner for Base Mainnet.
 */
export function getOrCreateBaseBurner(): BaseBurnerAccount {
  let pk = localStorage.getItem(STORAGE_KEY_BURNER) as Hex | null
  if (!pk || !pk.startsWith('0x') || pk.length !== 66) {
    pk = generatePrivateKey()
    localStorage.setItem(STORAGE_KEY_BURNER, pk)
  }
  const account = privateKeyToAccount(pk)
  return {
    address: account.address,
    privateKey: pk,
  }
}

/**
 * Rotates and mints a completely fresh Base Mainnet burner keypair.
 */
export function rotateBaseBurner(): BaseBurnerAccount {
  const pk = generatePrivateKey()
  localStorage.setItem(STORAGE_KEY_BURNER, pk)
  const account = privateKeyToAccount(pk)
  return {
    address: account.address,
    privateKey: pk,
  }
}

/**
 * Fetches live Base Mainnet balances for an address.
 */
export async function fetchBaseMainnetBalances(address: Address): Promise<BaseBurnerBalances> {
  const [ethBalance, usdcBalance] = await Promise.all([
    baseMainnetPublicClient.getBalance({ address }).catch(() => 0n),
    baseMainnetPublicClient
      .readContract({
        address: BASE_USDC,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [address],
      })
      .catch(() => 0n),
  ])

  return {
    eth: Number(formatEther(ethBalance)).toFixed(5),
    usdc: Number(formatUnits(usdcBalance, 6)).toFixed(2),
    ethRaw: ethBalance,
    usdcRaw: usdcBalance,
  }
}

/**
 * Prompts user's MetaMask on Base Mainnet to send a specified ETH amount to the burner.
 */
export async function fundBaseBurnerFromMetaMask(
  targetBurnerAddress: Address,
  amountEth: string
): Promise<string> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not detected.')
  }

  await ensureBaseMainnetNetwork()

  const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[]
  const from = accounts[0]
  if (!from) throw new Error('No MetaMask account selected.')

  const valueWei = parseEther(amountEth)
  const txHash = (await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: targetBurnerAddress,
        value: toHex(valueWei),
      },
    ],
  })) as string

  // Wait for confirmation on Base Mainnet (~2 seconds)
  await baseMainnetPublicClient.waitForTransactionReceipt({ hash: txHash as Hex })
  return txHash
}

/**
 * Sweeps residual ETH from the ephemeral burner back to the primary wallet.
 */
export async function sweepBaseBurnerToMainWallet(
  burnerPk: Hex,
  recipientAddress: Address
): Promise<string> {
  const burnerAccount = privateKeyToAccount(burnerPk)
  const currentBal = await baseMainnetPublicClient.getBalance({ address: burnerAccount.address })

  // Standard Base transfer gas is 21,000 units (~0.000002 ETH on Base)
  const gasPrice = await baseMainnetPublicClient.getGasPrice().catch(() => 50000000n) // ~0.05 gwei
  const gasCost = 21000n * (gasPrice * 12n / 10n) // 20% margin

  if (currentBal <= gasCost) {
    throw new Error(`Insufficient burner balance to cover sweep gas (${formatEther(currentBal)} ETH available).`)
  }

  const amountToSend = currentBal - gasCost

  const walletClient = createWalletClient({
    account: burnerAccount,
    chain: base,
    transport: http(BASE_MAINNET_RPC),
  })

  const txHash = await walletClient.sendTransaction({
    to: recipientAddress,
    value: amountToSend,
  })

  await baseMainnetPublicClient.waitForTransactionReceipt({ hash: txHash })
  return txHash
}

