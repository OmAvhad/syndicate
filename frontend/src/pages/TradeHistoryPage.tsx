import { useCallback, useEffect, useState } from 'react'
import { formatEther } from 'viem'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { closeTrade, usdc, type TradeRecord } from '@/lib/tradeJournal'
import { scopeKey } from '@/lib/shielded/storage'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function TradeHistoryPage() {
  const { user } = useAuth()
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [claims, setClaims] = useState<Record<string, string | null>>({})
  const [claimError, setClaimError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const refresh = useCallback(async () => {
    try {
      const response = await api.get(`/api/trades/history?page=${page}`)
      const pending = response.data.trades.filter((t: TradeRecord) => t.network === 'BASE_MAINNET' && t.status === 'EXECUTED' && t.side === 'BUY')
      const updates = await Promise.allSettled(pending.map((t: TradeRecord) => api.post(`/api/trades/${t._id}/sync-base`)))
      const synced = new Map(updates.flatMap(result => result.status === 'fulfilled' ? [[result.value.data.trade._id, result.value.data.trade] as const] : []))
      setTrades(response.data.trades.map((t: TradeRecord) => synced.get(t._id) || t)); setTotal(response.data.total)
      if (updates.some(result => result.status === 'rejected')) setError('Some Base protective-order statuses are unavailable. Their last confirmed state is shown; refresh to retry.')
      setClaims({}); setClaimError('')
      const ids = response.data.trades.map((t: TradeRecord) => t._id).join(',')
      if (ids) {
        try { setClaims((await api.get(`/api/trades/claims/status?ids=${ids}`)).data.statuses) }
        catch { setClaimError('Arkiv status is unavailable. Claim buttons stay disabled until verified. Refresh to retry.') }
      }
    } catch (e) { setError((e as Error).message) }
  }, [page, user?.id])
  useEffect(() => { void refresh(); const changed = () => void refresh(); window.addEventListener('syndicate:trades-changed', changed); return () => window.removeEventListener('syndicate:trades-changed', changed) }, [refresh])
  const hasOpenBase = trades.some(t => t.network === 'BASE_MAINNET' && t.status === 'EXECUTED' && t.side === 'BUY')
  useEffect(() => { if (!hasOpenBase) return; const timer = setInterval(() => void refresh(), 15000); return () => clearInterval(timer) }, [hasOpenBase, refresh])
  async function act(id: string, action: () => Promise<unknown>) {
    if (busy) return
    setBusy(id); setError('')
    try { await action(); await refresh() }
    catch (e) { const x = e as { response?: { data?: { error?: string } }; message?: string }; setError(x.response?.data?.error || x.message || 'Operation failed; retain receipts and retry.') }
    finally { setBusy('') }
  }
  async function recoverLocalEntries() {
    if (!user?.walletAddress) throw new Error('Link the original funding wallet first.')
    const scope = { userId: user.id, walletAddress: user.walletAddress }
    const prefix = `${scopeKey(scope)}:trade:`
    for (const key of Object.keys(localStorage).filter(key => key.startsWith(prefix))) {
      const saved = JSON.parse(localStorage.getItem(key)!)
      if (!saved.entry || !saved.promise || saved.tradeId || saved.stage === 'closed') continue
      const result = await api.post('/api/trades/execute', { ...JSON.parse(saved.inputs), burnerAccountAddress: saved.address, ...saved.promise, executionTxHash: saved.entry.leg1TxHash, entryDeliveryTxHash: saved.entry.leg2TxHash, isCopyTrade: false })
      saved.tradeId = result.data.tradeId
      localStorage.setItem(key, JSON.stringify(saved))
      const activeKey = `${scopeKey(scope)}:active-trade`
      if (JSON.parse(localStorage.getItem(activeKey) || 'null')?.id === saved.id) localStorage.setItem(activeKey, JSON.stringify(saved))
    }
  }
  const realized = trades.filter(t => t.status === 'CLOSED' && t.realizedPnlUnits !== undefined).reduce((sum, t) => sum + BigInt(t.realizedPnlUnits!), 0n)
  return <div className="pt-24 pb-16 px-6 max-w-6xl mx-auto space-y-5">
    <Card><CardHeader><CardTitle>Trade history & results</CardTitle><CardDescription>Leader entries and follower copies. Realized USDC P/L comes from verified entry and exit transfers; native gas is shown separately. Base BUY positions use live Definitive protective orders. Sepolia bull/bear exits are manual scenarios.</CardDescription></CardHeader><CardContent className="space-y-3">
      <p className="tnum">Recorded realized P/L on this page: <strong>{usdc(realized.toString())} USDC</strong></p>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={!!busy} onClick={() => void act('refresh', refresh)}>Refresh history & Arkiv status</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => void act('recover', recoverLocalEntries)}>Recover local leader entries</Button><Link to="/trade" className="text-accent text-sm self-center">Trade terminal</Link></div>
      <p className="text-xs text-text-muted">Claim Promise publishes a verified result linked to its pre-trade Arkiv commitment. It is not a payout. Older records without receipts show no fabricated P/L.</p>
      {error && <p role="alert" className="text-semantic-danger text-sm">{error}</p>}{claimError && <p role="status" className="text-semantic-warning text-xs">{claimError}</p>}
    </CardContent></Card>
    {!trades.length && <p className="text-text-muted">No recorded trades on this page.</p>}
    {trades.map(trade => {
      const claimKnown = Object.prototype.hasOwnProperty.call(claims, trade._id)
      const claim = claims[trade._id]
      return <Card key={trade._id}><CardHeader><CardTitle>{trade.isCopyTrade ? 'Follower copy' : 'Leader trade'} #{trade.tradeIndex} · {trade.symbol}</CardTitle><CardDescription>{new Date(trade.createdAt).toLocaleString()} · {trade.status} · {trade.side}</CardDescription></CardHeader><CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm"><p>Entry: {trade.entryUsdcUnits ? usdc(trade.entryUsdcUnits) : trade.amount} USDC</p><p>Payout: {usdc(trade.exitUsdcUnits)} USDC</p><p>Realized P/L: <strong className={BigInt(trade.realizedPnlUnits || '0') < 0n ? 'text-semantic-danger' : 'text-semantic-success'}>{usdc(trade.realizedPnlUnits)} USDC</strong></p></div>
        <p className="text-xs text-text-muted">{trade.status === 'EXECUTED' ? 'Position open; live unrealized P/L is unavailable.' : trade.closedAt ? `Closed ${new Date(trade.closedAt).toLocaleString()} via ${trade.exitType === 'protective' ? 'Definitive protection' : trade.exitType === 'tp' ? 'bull' : 'bear'} scenario.` : ''} {trade.entryGasWei && `Settlement gas: ${formatEther(BigInt(trade.entryGasWei) + BigInt(trade.exitGasWei || '0'))} ETH.`}</p>
        <p className="mono text-xs break-all">Burner: {trade.burnerAccountAddress}</p>
        {!trade.receiptsVerified && <p className="text-semantic-warning text-xs">Legacy record: verified receipts are missing. Recover a local leader entry if its receipts remain on this device.</p>}
        <div className="flex flex-wrap gap-3 text-xs">{[trade.executionTxHash, trade.entryDeliveryTxHash, trade.exitReturnTxHash, trade.exitPayoutTxHash].filter((hash, index, hashes) => /^0x[0-9a-f]{64}$/i.test(hash || '') && hashes.indexOf(hash) === index).map((hash, index) => <a key={hash} href={`${trade.network === 'BASE_MAINNET' ? 'https://basescan.org' : 'https://sepolia.etherscan.io'}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="text-accent underline">{trade.network === 'BASE_MAINNET' ? index === 0 ? 'Entry settlement' : 'Protective exit' : ['Entry USDC', 'Entry WETH', 'Exit WETH', 'Exit payout'][index]} receipt</a>)}</div>
        <div className="flex flex-wrap gap-2">
          {trade.network !== 'BASE_MAINNET' && trade.status === 'EXECUTED' && trade.receiptsVerified && (['tp', 'sl'] as const).map(exit => <Button key={exit} size="sm" variant={exit === 'tp' ? 'secondary' : 'destructive'} disabled={!!busy || !user?.walletAddress} onClick={() => void act(trade._id, () => closeTrade({ userId: user!.id, walletAddress: user!.walletAddress! }, trade._id, exit))}>{busy === trade._id ? 'Processing…' : exit === 'tp' ? `Bull exit · $${trade.target}` : `Bear exit · $${trade.stopLoss}`}</Button>)}
          <Button size="sm" variant="outline" disabled={!!busy || !claimKnown || !!claim || trade.status !== 'CLOSED' || !trade.promiseId || !trade.receiptsVerified} onClick={() => void act(trade._id, () => api.post(`/api/trades/${trade._id}/claim`))}>{claim ? 'Promise claimed' : !claimKnown ? 'Checking Arkiv…' : 'Claim Promise'}</Button>
          {claim && <a className="text-accent text-xs underline self-center" href={`https://rabdi.explorer.arkiv.network/entity/${claim}`} target="_blank" rel="noopener noreferrer">View confirmed result claim</a>}
        </div>
        {!claim && <p className="text-xs text-text-muted">{!trade.promiseId ? 'No pre-trade promise is linked to this legacy record.' : trade.status !== 'CLOSED' ? 'Close the position to link its final result to the promise.' : 'Claim verifies the original commitment on Arkiv before publishing the result.'}</p>}
      </CardContent></Card>
    })}
    <div className="flex items-center gap-3"><Button variant="secondary" size="sm" disabled={page === 0 || !!busy} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-xs">Page {page + 1} · {total} trades</span><Button variant="secondary" size="sm" disabled={(page + 1) * 25 >= total || !!busy} onClick={() => setPage(p => p + 1)}>Next</Button></div>
  </div>
}
