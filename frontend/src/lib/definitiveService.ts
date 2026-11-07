import {
  type Address,
  type Hex,
  parseUnits,
  erc20Abi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { prepareBaseUserOperation, readBaseTrade, saveBaseTrade } from './basePimlico'
import {
  baseTradeKeyForSigning,
  BASE_WETH,
  BASE_USDC,
  baseMainnetPublicClient,
} from './baseBurner'

export const DEFINITIVE_API_URL = 'https://flash.definitive.fi/v1'
export const DEFINITIVE_API_KEY = 'dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b'

// Official Base Mainnet Definitive Contracts
export const DEFINITIVE_ALLOWANCE_CONTRACT: Address = '0x5d00000873b6BF41539e6f5365B0Ff7d3c368f78'
export const DEFINITIVE_VAULT_CONTRACT: Address = '0x1074393effFCf1A15e306cD3931F48eDA9ABcd55'

export interface BracketLevels { referencePrice: number; takeProfit: string; stopLoss: string }
export interface DefinitiveQuoteParams {
  bracketLevels?: BracketLevels
  targetAsset: Address
  contraAsset: Address
  side: 'buy' | 'sell'
  qty: string
  funderAddress: Address
}

export interface DefinitiveQuoteResponse {
  demoLevels?: BracketLevels
  attachedBracket?: { evm: { orderTypedData: string; permitTypedData?: string | null }; salt: string; deadline: string; signedMaxFromAmount: string }
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
  signProtection?: (typedData: string) => Promise<Hex>
  protectedQuote?: DefinitiveQuoteResponse
  quoteId: string
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

/**
 * Fetches an official Definitive Flash execution quote on Base Mainnet.
 */
export async function fetchDefinitiveQuote(
  params: DefinitiveQuoteParams
): Promise<DefinitiveQuoteResponse> {
  const res = await fetch(`${DEFINITIVE_API_URL}/quote`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
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
      evmUsePermit2: false,
      forceMinimalAllowance: false,
      ...(params.bracketLevels ? { attachedBracket: { takeProfit: { notionalPrice: params.bracketLevels.takeProfit }, stopLoss: { notionalPrice: params.bracketLevels.stopLoss } } } : {}),
      qty: params.qty,
      funderAddress: params.funderAddress,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || `Quote request failed with status ${res.status}`)
  }
  if (params.side === 'buy' && !params.bracketLevels) {
    const referencePrice = Number(data.to?.notional) / Number(data.to?.amount)
    if (!Number.isFinite(referencePrice) || referencePrice <= 0) throw new Error('Live reference price unavailable.')
    return fetchDefinitiveQuote({ ...params, bracketLevels: { referencePrice, takeProfit: (referencePrice * 1.0005).toFixed(4), stopLoss: (referencePrice * 0.9995).toFixed(4) } })
  }
  if (params.bracketLevels && !data.attachedBracket?.evm?.orderTypedData) throw new Error('Definitive did not return protective-order signing data.')
  return { ...data, demoLevels: params.bracketLevels } as DefinitiveQuoteResponse
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
  validateBaseOrder(parsed, account.address)

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
 * 2. Checks token allowance to DefinitiveFlashAllowance contract (0x5d00...8f78). If insufficient, approves the quoted input and a bounded protective allowance through Pimlico.
 */
export async function prepareBurnerForDefinitiveTrade(
  burnerPk: Hex,
  tokenAddress: Address,
  requiredAmountWei: bigint,
  protectionAmount?: bigint
): Promise<{ wrapped?: bigint; approved?: boolean; userOpHash?: Hex; transactionHash?: Hex }> {
  return prepareBaseUserOperation(burnerPk, tokenAddress, requiredAmountWei, protectionAmount)
}

/**
 * Submits the signed order to Definitive Flash solver network.
 */
export async function submitDefinitiveOrder(
  params: DefinitiveOrderParams
): Promise<DefinitiveOrderResponse> {
  const saved = readBaseTrade(params.funderAddress)
  if (saved.orderId) return waitForDefinitiveFill(saved.orderId, params.funderAddress)
  if (saved.orderSubmissionStarted) throw new Error('An order submission is unresolved. Do not submit another trade; inspect the saved signed order and Definitive order history.')
  const quote = params.protectedQuote
  let attachedBracket: Record<string, string | { notionalPrice: string }> | undefined
  if (params.side === 'buy') {
    if (!quote?.attachedBracket || !quote.demoLevels) throw new Error('A signed protective order is required for the quick-exit BUY demo.')
    const b = quote.attachedBracket
    const keyRecord = localStorage.getItem(baseTradeKeyForSigning(params.funderAddress))
    if (!keyRecord && !params.signProtection) throw new Error('Order signing wallet is unavailable.')
    const parsed = JSON.parse(b.evm.orderTypedData)
    validateBaseOrder(parsed, params.funderAddress)
    if (parsed.message.fromToken.toLowerCase() !== BASE_WETH.toLowerCase() || parsed.message.toToken.toLowerCase() !== BASE_USDC.toLowerCase() || BigInt(parsed.message.fromAmount) !== parseUnits(b.signedMaxFromAmount, 18)) throw new Error('Protective-order assets or amount mismatch.')
    const allowance = await baseMainnetPublicClient.readContract({ address: BASE_WETH, abi: erc20Abi, functionName: 'allowance', args: [params.funderAddress, DEFINITIVE_ALLOWANCE_CONTRACT] })
    if (allowance < BigInt(parsed.message.fromAmount)) throw new Error('Protective WETH allowance is insufficient. Trading stopped.')
    attachedBracket = { takeProfit: { notionalPrice: quote.demoLevels.takeProfit }, stopLoss: { notionalPrice: quote.demoLevels.stopLoss }, salt: b.salt, deadline: b.deadline, signedMaxFromAmount: b.signedMaxFromAmount, userSignature: params.signProtection ? await params.signProtection(b.evm.orderTypedData) : await signDefinitiveOrder(keyRecord as Hex, b.evm.orderTypedData) }
  }
  saveBaseTrade(params.funderAddress, { orderSubmissionStarted: new Date().toISOString(), signedOrder: JSON.stringify(params) })
  const res = await fetch(`${DEFINITIVE_API_URL}/order`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      'Content-Type': 'application/json',
      'x-definitive-api-key': DEFINITIVE_API_KEY,
    },
    body: JSON.stringify({
      ...(attachedBracket ? { attachedBracket } : {}),
      quoteId: params.quoteId,
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
  if (!data.orderId) throw new Error('Definitive did not return an order ID. Check the saved submission before retrying.')
  saveBaseTrade(params.funderAddress, { orderId: data.orderId })
  return waitForDefinitiveFill(data.orderId, params.funderAddress)
}


function validateBaseOrder(parsed: any, burner: Address) {
  const eq = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase()
  const m = parsed.message
  if (Number(parsed.domain?.chainId) !== base.id || !eq(parsed.domain?.verifyingContract, DEFINITIVE_ALLOWANCE_CONTRACT) || parsed.primaryType !== 'FlashOrder') throw new Error('Unexpected Definitive signing domain.')
  if (!eq(m?.swapper, burner) || !eq(m?.recipient, burner) || !eq(m?.vault, DEFINITIVE_VAULT_CONTRACT)) throw new Error('Quote signer, recipient or vault mismatch.')
  if (BigInt(m.deadline) <= BigInt(Math.floor(Date.now() / 1000) + 15)) throw new Error('Quote expired. Refresh before signing.')
}
export function quoteInput(quote: DefinitiveQuoteResponse, burner: Address, side: 'BUY' | 'SELL', qty: string) {
  const parsed = JSON.parse(quote.evm.orderTypedData)
  validateBaseOrder(parsed, burner)
  const token = side === 'BUY' ? BASE_USDC : BASE_WETH
  const output = side === 'BUY' ? BASE_WETH : BASE_USDC
  const amount = parseUnits(qty, side === 'BUY' ? 6 : 18)
  if (parsed.message.fromToken.toLowerCase() !== token.toLowerCase() || parsed.message.toToken.toLowerCase() !== output.toLowerCase() || BigInt(parsed.message.fromAmount) !== amount) throw new Error('Quote assets or spending amount do not match this trade.')
  return { token, amount }
}
export async function waitForDefinitiveFill(orderId: string, funder: Address): Promise<DefinitiveOrderResponse> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await fetch(`${DEFINITIVE_API_URL}/orders/${encodeURIComponent(orderId)}?funderAddress=${funder}`, { signal: AbortSignal.timeout(20000), headers: { 'x-definitive-api-key': DEFINITIVE_API_KEY } })
    if (!response.ok) throw new Error(`Order ${orderId} was submitted; confirmation is unavailable. Retry to resume, without placing another order.`)
    const result = await response.json()
    const status = result.order?.status || ''
    const hashes = [...new Set<string>((result.fills || []).map((fill: { transactionId: string }) => fill.transactionId).filter((hash: string) => /^0x[0-9a-f]{64}$/i.test(hash)))]
    if (hashes.length && (status === 'ORDER_STATUS_FILLED' || result.order?.closeReason === 'REASON_FULLY_FILLED')) {
      if (hashes.length !== 1) throw new Error('This order has multiple fill transactions. Retain the order ID for reconciliation; automatic recording stopped.')
      const receipt = await baseMainnetPublicClient.waitForTransactionReceipt({ hash: hashes[0] as Hex })
      if (receipt.status !== 'success') throw new Error('Definitive settlement reverted.')
      saveBaseTrade(funder, { fillTxHash: hashes[0], ...(result.order?.attachedBracket?.bracketOrderId ? { bracketOrderId: result.order.attachedBracket.bracketOrderId } : {}) })
      return { orderId, status, txHash: hashes[0] }
    }
    if (/REJECTED|CANCELLED|EXPIRED|FAILED|TERMINATED/.test(status)) throw new Error(`Definitive order ${orderId}: ${status}. Inspect fills before starting another trade.`)
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  throw new Error(`Order ${orderId} is still pending. Retry to resume confirmation; your burner and order ID are saved.`)
}
