import {
  createWalletClient,
  http,
  type Address,
  type Hex,
  maxUint256,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import {
  BASE_MAINNET_RPC,
  BASE_WETH,
  BASE_USDC,
  baseMainnetPublicClient,
} from './baseBurner'

export const DEFINITIVE_API_URL = 'https://flash.definitive.fi/v1'
export const DEFINITIVE_API_KEY = 'dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b'

// Official Base Mainnet Definitive Contracts
export const DEFINITIVE_ALLOWANCE_CONTRACT: Address = '0x5d00000873b6BF41539e6f5365B0Ff7d3c368f78'
export const DEFINITIVE_VAULT_CONTRACT: Address = '0x1074393effFCf1A15e306cD3931F48eDA9ABcd55'

export interface DefinitiveQuoteParams {
  targetAsset: Address
  contraAsset: Address
  side: 'buy' | 'sell'
  qty: string
  funderAddress: Address
}

export interface DefinitiveQuoteResponse {
  quoteId: string
  bridgeQuoteId: string | null
  orderType: string
  side: string
  targetAsset: string
  contraAsset: string
  from: {
    asset: string
    amount: string
    notional: string
  }
  to: {
    asset: string
    amount: string
    notional: string
  }
  fees: {
    estimatedFeeNotional: string
  }
  estimatedPriceImpact: string
  recommendedSlippage: string
  evm: {
    approveTx?: {
      to: string
      data: string
    }
    orderTypedData: string
  }
}

export interface DefinitiveOrderParams {
  targetAsset: Address
  contraAsset: Address
  side: 'buy' | 'sell'
  qty: string
  funderAddress: Address
  userSignature: Hex
  evmOrderTypedData: string
}

export interface DefinitiveOrderResponse {
  orderId?: string
  status?: string
  txHash?: string
  error?: {
    code: string
    message: string
  }
  [key: string]: unknown
}

const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
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

const WETH_ABI = [
  ...ERC20_ABI,
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
] as const

/**
 * Fetches an official Definitive Flash execution quote on Base Mainnet.
 */
export async function fetchDefinitiveQuote(
  params: DefinitiveQuoteParams
): Promise<DefinitiveQuoteResponse> {
  const res = await fetch(`${DEFINITIVE_API_URL}/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-definitive-api-key': DEFINITIVE_API_KEY,
    },
    body: JSON.stringify({
      targetAsset: params.targetAsset,
      contraAsset: params.contraAsset,
      targetChain: 'base',
      contraChain: 'base',
      side: params.side,
      orderType: 'market',
      qty: params.qty,
      funderAddress: params.funderAddress,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || `Quote request failed with status ${res.status}`)
  }
  return data as DefinitiveQuoteResponse
}

/**
 * Signs the Definitive Flash EIP-712 Order using the ephemeral burner account.
 */
export async function signDefinitiveOrder(
  burnerPk: Hex,
  orderTypedDataStr: string
): Promise<Hex> {
  const account = privateKeyToAccount(burnerPk)
  const parsed = JSON.parse(orderTypedDataStr)

  // Remove EIP712Domain from types for viem compatibility
  const types = { ...parsed.types }
  delete types.EIP712Domain

  const domain = {
    ...parsed.domain,
    chainId: Number(parsed.domain.chainId),
  }

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: parsed.primaryType,
    message: parsed.message,
  })

  return signature
}

/**
 * Prepares the burner wallet before trade execution:
 * 1. If source token is WETH, checks WETH balance. If ETH is present but WETH is insufficient, wraps ETH to WETH.
 * 2. Checks token allowance to DefinitiveFlashAllowance contract (0x5d00...8f78). If insufficient, approves max allowance.
 */
export async function prepareBurnerForDefinitiveTrade(
  burnerPk: Hex,
  tokenAddress: Address,
  requiredAmountWei: bigint
): Promise<{ wrapped?: bigint; approved?: boolean }> {
  const account = privateKeyToAccount(burnerPk)
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(BASE_MAINNET_RPC),
  })

  let wrapped: bigint | undefined
  let approved = false

  // 1. If token is WETH, check if we need to wrap ETH
  if (tokenAddress.toLowerCase() === BASE_WETH.toLowerCase()) {
    const currentWethBal = (await baseMainnetPublicClient.readContract({
      address: BASE_WETH,
      abi: WETH_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    }).catch(() => 0n)) as bigint

    if (currentWethBal < requiredAmountWei) {
      const deficit = requiredAmountWei - currentWethBal
      const ethBal = await baseMainnetPublicClient.getBalance({ address: account.address })
      
      // Leave 0.00003 ETH for gas buffer
      const gasBuffer = 30000000000000n
      if (ethBal > deficit + gasBuffer) {
        const wrapHash = await walletClient.writeContract({
          address: BASE_WETH,
          abi: WETH_ABI,
          functionName: 'deposit',
          value: deficit,
        })
        await baseMainnetPublicClient.waitForTransactionReceipt({ hash: wrapHash })
        wrapped = deficit
      }
    }
  }

  // 2. Check and approve allowance if needed
  const currentAllowance = (await baseMainnetPublicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, DEFINITIVE_ALLOWANCE_CONTRACT],
  }).catch(() => 0n)) as bigint

  if (currentAllowance < requiredAmountWei) {
    const approveHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [DEFINITIVE_ALLOWANCE_CONTRACT, maxUint256],
    })
    await baseMainnetPublicClient.waitForTransactionReceipt({ hash: approveHash })
    approved = true
  }

  return { wrapped, approved }
}

/**
 * Submits the signed order to Definitive Flash solver network.
 */
export async function submitDefinitiveOrder(
  params: DefinitiveOrderParams
): Promise<DefinitiveOrderResponse> {
  const res = await fetch(`${DEFINITIVE_API_URL}/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-definitive-api-key': DEFINITIVE_API_KEY,
    },
    body: JSON.stringify({
      targetChain: 'base',
      contraChain: 'base',
      targetAsset: params.targetAsset,
      contraAsset: params.contraAsset,
      side: params.side,
      qty: params.qty,
      orderType: 'market',
      funderAddress: params.funderAddress,
      userSignature: params.userSignature,
      evmOrderTypedData: params.evmOrderTypedData,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || `Order submission failed with status ${res.status}`)
  }
  return data as DefinitiveOrderResponse
}

