import { formatUnits } from 'viem'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { usdc, type TradeRecord } from '@/lib/tradeJournal'

export default function BaseTradeStatus({ tradeId }: { tradeId: string }) {
  const [trade, setTrade] = useState<TradeRecord | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    let polling = false
    let closed = false
    const refresh = async () => {
      if (polling || closed) return
      polling = true
      try {
        const response = await api.post(`/api/trades/${tradeId}/sync-base`)
        if (!disposed) { setTrade(response.data.trade); setError(''); closed = response.data.trade.status === 'CLOSED' }
      } catch { if (!disposed) setError('Live order status is temporarily unavailable. Your order remains with Definitive; check history to retry.') }
      finally { polling = false }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 12000)
    return () => { disposed = true; clearInterval(timer) }
  }, [tradeId])
  return <div className="rounded-lg border border-border p-3 text-sm space-y-2" role="status">
    <p className="font-semibold">{trade?.status === 'CLOSED' ? 'Protective exit settled on Base' : trade?.side === 'SELL' ? 'Base sell settled' : 'Definitive live position'}</p>
    {trade?.entryUsdcUnits && trade.wethUnits && <p>Verified settlement: {usdc(trade.entryUsdcUnits)} USDC / {formatUnits(BigInt(trade.wethUnits), 18)} WETH.</p>}
    {trade?.side === 'BUY' && <p>Take profit: ${trade.target} · Stop loss: ${trade.stopLoss}. {trade.bracketOrderId ? 'Protective order active.' : 'Checking protective order activation…'}</p>}
    {trade?.bracketOrderId && <p className="text-xs break-all">Protective order: {trade.bracketOrderId}</p>}
    {trade?.status === 'CLOSED' && <p>Payout: {usdc(trade.exitUsdcUnits)} USDC · Realized P/L: <strong>{usdc(trade.realizedPnlUnits)} USDC</strong> before wallet gas.</p>}
    {error && <p className="text-semantic-warning text-xs">{error}</p>}
    <Link to="/history" className="text-accent underline">History, receipts & Claim Promise</Link>
  </div>
}
