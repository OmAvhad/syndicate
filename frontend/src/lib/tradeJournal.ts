import { formatUnits, parseUnits, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import api from './api'
import { executeTwoLegExitSwap, FOLLOWER_BURNER_ADDRESS, FOLLOWER_BURNER_KEY, type OnchainExecutionResult } from './flashEngine'
import { scopeKey, type PoolScope } from './shielded/storage'

export interface TradeRecord {
  _id: string; network?: 'BASE_MAINNET' | 'SEPOLIA_TESTNET'; bracketOrderId?: string; isCopyTrade: boolean; tradeIndex: number; symbol: string; side: string; amount: number
  target: number; stopLoss: number; limit: number; status: string; createdAt: string; closedAt?: string
  burnerAccountAddress: string; executionTxHash: string; entryDeliveryTxHash?: string
  entryUsdcUnits?: string; wethUnits?: string; entryGasWei?: string; exitGasWei?: string
  exitUsdcUnits?: string; realizedPnlUnits?: string; exitType?: 'tp' | 'sl' | 'protective'; receiptsVerified?: boolean
  exitReturnTxHash?: string; exitPayoutTxHash?: string; promiseId?: string; claimEntityKey?: string
}
export const usdc = (units?: string) => units === undefined ? '—' : formatUnits(BigInt(units), 6)
export async function getTrade(id: string): Promise<TradeRecord> { return (await api.get(`/api/trades/${encodeURIComponent(id)}`)).data.trade }
export function scenarioPayout(trade: TradeRecord, exit: 'tp' | 'sl'): bigint {
  if (!trade.wethUnits || !trade.entryUsdcUnits) throw new Error('This legacy trade has no verified position quantities.')
  const price = exit === 'tp' ? trade.target : trade.stopLoss
  if (!price || price <= 0) throw new Error('No valid target was set for this exit.')
  const gross = BigInt(trade.wethUnits) * parseUnits(String(price), 6) / 10n ** 18n
  const fee = BigInt(trade.entryUsdcUnits) * 30n / 10_000n
  return gross > fee ? gross - fee : 0n
}
function executionKey(scope: PoolScope, trade: TradeRecord): Hex {
  if (trade.isCopyTrade && trade.burnerAccountAddress.toLowerCase() === FOLLOWER_BURNER_ADDRESS.toLowerCase()) return FOLLOWER_BURNER_KEY
  const prefix = `${scopeKey(scope)}:trade:`
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)!
    if (!key.startsWith(prefix)) continue
    const record = JSON.parse(localStorage.getItem(key)!)
    if (record.address?.toLowerCase() === trade.burnerAccountAddress.toLowerCase() && privateKeyToAccount(record.privateKey).address.toLowerCase() === trade.burnerAccountAddress.toLowerCase()) return record.privateKey
  }
  throw new Error('This device does not have this position’s burner key. Open it on the original browser or restore its burner records.')
}
export async function closeTrade(scope: PoolScope, tradeId: string, exitType: 'tp' | 'sl', log?: (message: string) => void): Promise<{ trade: TradeRecord; receipt: OnchainExecutionResult }> {
  if (!navigator.locks) throw new Error('A browser with Web Locks support is required.')
  return navigator.locks.request(`syndicate:exit:${scopeKey(scope)}:${tradeId}`, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) throw new Error('This exit is already running in another tab.')
    const trade = await getTrade(tradeId)
    if (trade.status === 'CLOSED') throw new Error('This position is already closed. Refresh history.')
    if (trade.network === 'BASE_MAINNET') throw new Error('Base positions use Definitive protective orders. Sepolia demo exits cannot close them.')
    const key = executionKey(scope, trade)
    const storageKey = `${scopeKey(scope)}:exit:${tradeId}`
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') || { exitType }
    if (saved.exitType !== exitType) throw new Error('An exit is already pending. Resume the same bull/bear exit to avoid duplicate settlement.')
    localStorage.setItem(storageKey, JSON.stringify(saved))
    const payout = scenarioPayout(trade, exitType)
    log?.(`Manual ${exitType === 'tp' ? 'bull' : 'bear'} scenario: expected payout ${usdc(payout.toString())} USDC after 30 bps retained by the demo vault.`)
    const receipt = await executeTwoLegExitSwap({ traderKey: key, wethUnits: BigInt(trade.wethUnits!), usdcReturnUnits: payout, wethAmountNumber: Number(formatUnits(BigInt(trade.wethUnits!), 18)), usdcReturnAmountNumber: Number(formatUnits(payout, 6)), onLog: log, resume: saved,
      onSubmitted: (leg, hash) => { saved[leg] = hash; localStorage.setItem(storageKey, JSON.stringify(saved)) },
    })
    const response = await api.post(`/api/trades/${tradeId}/exit`, { exitType, exitReturnTxHash: receipt.leg1TxHash, exitPayoutTxHash: receipt.leg2TxHash })
    for (const key of Object.keys(localStorage).filter(key => key.startsWith(`${scopeKey(scope)}:trade:`) || key === `${scopeKey(scope)}:active-trade`)) {
      const local = JSON.parse(localStorage.getItem(key) || 'null')
      if (local?.address?.toLowerCase() === trade.burnerAccountAddress.toLowerCase() && local.entry?.leg1TxHash === trade.executionTxHash) {
        local.stage = 'closed'; local.exit = receipt
        localStorage.setItem(key, JSON.stringify(local))
      }
    }
    // Retain checkpoints even after settlement for recovery and inspection.
    window.dispatchEvent(new Event('syndicate:trades-changed'))
    return { trade: response.data.trade, receipt }
  })
}
