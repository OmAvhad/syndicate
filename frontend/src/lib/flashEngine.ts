import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  parseEther,
  formatUnits,
  formatEther,
  type Address,
  type Hash,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

export const RPC_ENDPOINT = 'https://ethereum-sepolia-rpc.publicnode.com'

export const USDC_SEPOLIA: Address = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
export const WETH_SEPOLIA: Address = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'

export const FLASH_TRADE_POOL_ADDRESS: Address = '0xA360946725811DABB91C054A3DFF25eD25C005E8'
export const FLASH_TRADE_POOL_KEY: `0x${string}` = '0x5299ad8d435a01383b00d555c4414186ace307e42f42991ba08a83505cb3ed6b'

export const STATIC_BURNER_ADDRESS: Address = '0x2e5Bade58a9D3C939C45269AfC5b0e26b66b57F9'
export const STATIC_BURNER_KEY: `0x${string}` = '0x188fe782457952a2218796912dafea24d0554d167afd17796d576faa77633875'

export const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const WETH_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'wad', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_ENDPOINT),
})

export interface OnchainExecutionResult {
  leg1TxHash: Hash
  leg2TxHash: Hash
  leg1ExplorerUrl: string
  leg2ExplorerUrl: string
  blockNumber: number
  gasUsed: string
  usdcAmount: string
  wethAmount: string
  traderAddress: Address
}

/**
 * Executes a live onchain two-leg swap on Ethereum Sepolia:
 * Leg 1: Trader transfers USDC to FlashTradePool Vault
 * Leg 2: FlashTradePool Vault delivers WETH position to Trader
 */
export async function executeTwoLegEntrySwap({
  traderKey = STATIC_BURNER_KEY,
  usdcAmountNumber,
  wethAmountNumber = 0.001,
  onLog,
}: {
  traderKey?: `0x${string}`
  usdcAmountNumber: number
  wethAmountNumber?: number
  onLog?: (msg: string) => void
}): Promise<OnchainExecutionResult> {
  const log = onLog || console.log
  const traderAccount = privateKeyToAccount(traderKey)

  const traderWallet = createWalletClient({
    account: traderAccount,
    chain: sepolia,
    transport: http(RPC_ENDPOINT),
  })

  const poolAccount = privateKeyToAccount(FLASH_TRADE_POOL_KEY)
  const poolWallet = createWalletClient({
    account: poolAccount,
    chain: sepolia,
    transport: http(RPC_ENDPOINT),
  })

  const usdcBigInt = parseUnits(usdcAmountNumber.toFixed(2), 6)
  const wethBigInt = parseEther(wethAmountNumber.toFixed(6))

  log(`[Onchain Leg 1/2] Transferring $${usdcAmountNumber.toFixed(2)} USDC from trader (${traderAccount.address.slice(0, 8)}...) to Vault...`)

  // Check trader USDC balance
  const currentUsdc = await publicClient.readContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [traderAccount.address],
  })

  if (currentUsdc < usdcBigInt) {
    throw new Error(
      `Insufficient onchain USDC. Required: $${usdcAmountNumber.toFixed(2)} USDC, Available: $${formatUnits(currentUsdc, 6)} USDC.`
    )
  }

  // Leg 1: Trader -> Vault (USDC)
  const leg1TxHash = await traderWallet.writeContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [FLASH_TRADE_POOL_ADDRESS, usdcBigInt],
  })

  log(`[Onchain Leg 1/2] USDC tx broadcasted: ${leg1TxHash}`)
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: leg1TxHash })
  log(`✅ Leg 1 Confirmed in Block #${receipt1.blockNumber}! Gas used: ${receipt1.gasUsed.toString()}`)

  // Ensure Vault has enough WETH
  const poolWeth = await publicClient.readContract({
    address: WETH_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [FLASH_TRADE_POOL_ADDRESS],
  })

  if (poolWeth < wethBigInt) {
    log(`Vault auto-wrapping 0.01 Sepolia ETH into WETH for liquidity...`)
    const wrapTx = await poolWallet.writeContract({
      address: WETH_SEPOLIA,
      abi: WETH_ABI,
      functionName: 'deposit',
      args: [],
      value: parseEther('0.01'),
    })
    await publicClient.waitForTransactionReceipt({ hash: wrapTx })
  }

  // Leg 2: Vault -> Trader (WETH)
  log(`[Onchain Leg 2/2] Vault delivering ${wethAmountNumber} WETH position to trader...`)
  const leg2TxHash = await poolWallet.writeContract({
    address: WETH_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [traderAccount.address, wethBigInt],
  })

  log(`[Onchain Leg 2/2] WETH tx broadcasted: ${leg2TxHash}`)
  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: leg2TxHash })
  log(`✅ Leg 2 Confirmed in Block #${receipt2.blockNumber}! Trader received ${wethAmountNumber} WETH.`)

  return {
    leg1TxHash,
    leg2TxHash,
    leg1ExplorerUrl: `https://sepolia.etherscan.io/tx/${leg1TxHash}`,
    leg2ExplorerUrl: `https://sepolia.etherscan.io/tx/${leg2TxHash}`,
    blockNumber: Number(receipt1.blockNumber),
    gasUsed: (receipt1.gasUsed + receipt2.gasUsed).toString(),
    usdcAmount: usdcAmountNumber.toFixed(2),
    wethAmount: wethAmountNumber.toFixed(6),
    traderAddress: traderAccount.address,
  }
}

/**
 * Executes a live onchain exit settlement (e.g. Bull Take-Profit target or Stop-Loss):
 * Leg 1: Trader returns WETH to Vault
 * Leg 2: Vault releases USDC (capital + profit - 30 bps protocol fee) to Trader
 */
export async function executeTwoLegExitSwap({
  traderKey = STATIC_BURNER_KEY,
  wethAmountNumber = 0.001,
  usdcReturnAmountNumber,
  onLog,
}: {
  traderKey?: `0x${string}`
  wethAmountNumber?: number
  usdcReturnAmountNumber: number
  onLog?: (msg: string) => void
}): Promise<OnchainExecutionResult> {
  const log = onLog || console.log
  const traderAccount = privateKeyToAccount(traderKey)

  const traderWallet = createWalletClient({
    account: traderAccount,
    chain: sepolia,
    transport: http(RPC_ENDPOINT),
  })

  const poolAccount = privateKeyToAccount(FLASH_TRADE_POOL_KEY)
  const poolWallet = createWalletClient({
    account: poolAccount,
    chain: sepolia,
    transport: http(RPC_ENDPOINT),
  })

  const wethBigInt = parseEther(wethAmountNumber.toFixed(6))
  const usdcBigInt = parseUnits(usdcReturnAmountNumber.toFixed(2), 6)

  log(`[Exit Leg 1/2] Trader returning ${wethAmountNumber} WETH to Vault...`)

  // Exit Leg 1: Trader -> Vault (WETH)
  const leg1TxHash = await traderWallet.writeContract({
    address: WETH_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [FLASH_TRADE_POOL_ADDRESS, wethBigInt],
  })

  log(`[Exit Leg 1/2] WETH return broadcasted: ${leg1TxHash}`)
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: leg1TxHash })
  log(`✅ Exit Leg 1 Confirmed in Block #${receipt1.blockNumber}!`)

  // Exit Leg 2: Vault -> Trader (USDC with profit)
  log(`[Exit Leg 2/2] Vault releasing $${usdcReturnAmountNumber.toFixed(2)} USDC with profit to trader...`)
  const leg2TxHash = await poolWallet.writeContract({
    address: USDC_SEPOLIA,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [traderAccount.address, usdcBigInt],
  })

  log(`[Exit Leg 2/2] USDC release broadcasted: ${leg2TxHash}`)
  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: leg2TxHash })
  log(`✅ Exit Leg 2 Confirmed in Block #${receipt2.blockNumber}! Released $${usdcReturnAmountNumber.toFixed(2)} USDC to trader.`)

  return {
    leg1TxHash,
    leg2TxHash,
    leg1ExplorerUrl: `https://sepolia.etherscan.io/tx/${leg1TxHash}`,
    leg2ExplorerUrl: `https://sepolia.etherscan.io/tx/${leg2TxHash}`,
    blockNumber: Number(receipt1.blockNumber),
    gasUsed: (receipt1.gasUsed + receipt2.gasUsed).toString(),
    usdcAmount: usdcReturnAmountNumber.toFixed(2),
    wethAmount: wethAmountNumber.toFixed(6),
    traderAddress: traderAccount.address,
  }
}

export async function fetchSepoliaBalances(address: Address) {
  const [eth, usdc, weth] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({
      address: USDC_SEPOLIA,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }),
    publicClient.readContract({
      address: WETH_SEPOLIA,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    }),
  ])

  return {
    eth: formatEther(eth),
    usdc: formatUnits(usdc, 6),
    weth: formatEther(weth),
  }
}

