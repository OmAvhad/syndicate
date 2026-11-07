import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { getOrCreateBaseBurner, getBaseTradeBurner, baseTradeKeyForSigning, baseTradeStorageKey, BASE_USDC, BASE_WETH } from '../src/lib/baseBurner'
import { fetchDefinitiveQuote, quoteInput, DEFINITIVE_ALLOWANCE_CONTRACT, DEFINITIVE_VAULT_CONTRACT } from '../src/lib/definitiveService'
import { saveBaseTrade } from '../src/lib/basePimlico'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) })
  localStorage.setItem('world-id-user', JSON.stringify({ id: 'leader', walletAddress: '0x1111111111111111111111111111111111111111' }))
})
afterEach(() => vi.unstubAllGlobals())

describe('Base trade recovery and quote safety', () => {
  it('retains the same burner for retries and archives its key when the next trade begins', () => {
    const first = getBaseTradeBurner()
    expect(getBaseTradeBurner().address).toBe(first.address)
    saveBaseTrade(first.address, { recorded: 'true', orderId: 'order-1' })
    const next = getBaseTradeBurner()
    expect(next.address).not.toBe(first.address)
    expect(localStorage.getItem(baseTradeKeyForSigning(first.address))).toBe(first.privateKey)
    expect(JSON.parse(localStorage.getItem(baseTradeStorageKey(first.address))!).orderId).toBe('order-1')
    localStorage.setItem('world-id-user', JSON.stringify({ id: 'follower', walletAddress: '0x2222222222222222222222222222222222222222' }))
    expect(getOrCreateBaseBurner().address).not.toBe(next.address)
  })

  it('requires the actual USDC input and rejects wrong-chain or excessive spending quotes', () => {
    const burner = getBaseTradeBurner()
    const typed = { domain: { chainId: 8453, verifyingContract: DEFINITIVE_ALLOWANCE_CONTRACT }, primaryType: 'FlashOrder', message: { swapper: burner.address, recipient: burner.address, vault: DEFINITIVE_VAULT_CONTRACT, deadline: String(Math.floor(Date.now() / 1000) + 300), fromToken: BASE_USDC, toToken: BASE_WETH, fromAmount: '500000' } }
    const quote = { evm: { orderTypedData: JSON.stringify(typed) } } as Parameters<typeof quoteInput>[0]
    expect(quoteInput(quote, burner.address, 'BUY', '0.50')).toEqual({ token: BASE_USDC, amount: 500000n })
    typed.message.fromAmount = '550000'
    quote.evm.orderTypedData = JSON.stringify(typed)
    expect(() => quoteInput(quote, burner.address, 'BUY', '0.50')).toThrow('spending amount')
    typed.domain.chainId = 1
    quote.evm.orderTypedData = JSON.stringify(typed)
    expect(() => quoteInput(quote, burner.address, 'BUY', '0.50')).toThrow('domain')
  })

  it('derives tight protective prices from live reference value and requests a real attached pair', async () => {
    const requests: Record<string, any>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body)
      requests.push(body)
      return { ok: true, json: async () => ({ from: { amount: '0.5' }, to: { amount: '0.0002', notional: '0.4' }, ...(body.attachedBracket ? { attachedBracket: { evm: { orderTypedData: '{}' } } } : {}) }) }
    }))
    const quote = await fetchDefinitiveQuote({ targetAsset: BASE_WETH, contraAsset: BASE_USDC, side: 'buy', qty: '0.50', funderAddress: getBaseTradeBurner().address })
    expect(quote.demoLevels).toEqual({ referencePrice: 2000, takeProfit: '2001.0000', stopLoss: '1999.0000' })
    expect(requests[1].attachedBracket).toEqual({ takeProfit: { notionalPrice: '2001.0000' }, stopLoss: { notionalPrice: '1999.0000' } })
    expect(requests[1].qty).toBe('0.50')
    expect(requests[1].evmUsePermit2).toBe(false)
  })
})
