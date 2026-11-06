import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, RefreshCw, ShieldCheck, Upload, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Badge } from './ui/Badge'
import { createWallet, exportPoolBackup, importPoolBackup, readDeposits, readWallet, withPoolLock, type DepositRecord, type LocalPoolWallet, type PoolScope } from '@/lib/shielded/storage'
import type { PoolToken, PoolView } from '@/lib/shielded/pool'
import { readCachedBalance } from '@/lib/shielded/balanceCache'

function messageOf(error: unknown): string {
  if (typeof error === 'object' && error && 'code' in error && error.code === 4001) return 'Request cancelled in MetaMask. Your saved shielded wallet is unchanged.'
  return error instanceof Error ? error.message : 'The request failed. Please try again.'
}

// Remounted for each identity/wallet scope by Dashboard; no balances cross accounts.
export default function ShieldedPoolCard({ userId, walletAddress }: { userId: string; walletAddress?: string | null }) {
  const scope: PoolScope | null = walletAddress ? { userId, walletAddress } : null
  const [wallet, setWallet] = useState<LocalPoolWallet | null>(null)
  const [view, setView] = useState<PoolView | null>(null)
  const [records, setRecords] = useState<DepositRecord[]>([])
  const [symbol, setSymbol] = useState<PoolToken>('ETH')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [backupNotice, setBackupNotice] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const inFlight = useRef(false)

  function reloadLocal() {
    if (!scope || !mounted.current) return
    setWallet(readWallet(scope))
    setRecords(readDeposits(scope))
  }
  useEffect(() => {
    mounted.current = true
    try {
      reloadLocal()
      if (scope) {
        setView(readCachedBalance(scope))
        if (readCachedBalance(scope)) void refresh(false)
      }
    }
    catch (e) { setStorageError(true); setError(messageOf(e)) }
    return () => { mounted.current = false }
  }, [userId, walletAddress])

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setError(''); setStatus('')
    try { await action() }
    catch (e) { if (mounted.current) { setError(messageOf(e)); setStatus('') } }
    finally {
      inFlight.current = false
      if (mounted.current) {
        setBusy(false)
        try { reloadLocal() } catch (e) { setStorageError(true); setError(messageOf(e)) }
      }
    }
  }

  function onProgress(message: string) { if (mounted.current) { setStatus(message); reloadLocal() } }

  async function setup() {
    if (!scope) return
    await run(async () => {
      // Save the seed before any RPC call; a failed initialization must never rotate it.
      await withPoolLock(scope, async () => { createWallet(scope) })
      reloadLocal()
      onProgress('Opening your private wallet…')
      const pool = await import('@/lib/shielded/pool')
      await pool.initializePool(scope)
      onProgress('Your shielded wallet is saved on this device. Back it up before loading funds.')
    })
  }

  async function refresh(force = true) {
    if (!scope) return
    await run(async () => {
      onProgress('Synchronizing encrypted notes. The first sync can take several minutes…')
      const pool = await import('@/lib/shielded/pool')
      const result = await pool.syncPool(scope, { force })
      if (mounted.current) setView(result)
      onProgress('Private balances synchronized. Recently confirmed deposits may still be indexing.')
    })
  }

  async function deposit(event: React.FormEvent) {
    event.preventDefault()
    if (!scope) return
    await run(async () => {
      const pool = await import('@/lib/shielded/pool')
      await pool.depositToPool(scope, symbol, amount.trim(), onProgress)
      if (mounted.current) { setAmount(''); setView(null) }
    })
  }

  async function downloadBackup() {
    if (!scope) return
    await run(async () => {
      const raw = await exportPoolBackup(scope)
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `syndicate-shielded-sepolia-${scope.walletAddress.slice(2, 10)}.json`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      if (mounted.current) { setBackupNotice(false); setStatus('Backup downloaded. Keep this file private; it can spend your shielded funds.') }
    })
  }

  return (
    <Card className="mb-8" aria-labelledby="shielded-pool-title">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle id="shielded-pool-title" className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-accent" />Your shielded funds</CardTitle>
          <Badge variant="muted">Ethereum Sepolia · Testnet</Badge>
        </div>
        <CardDescription>Load funds now and keep them private for later trades. Available to both leaders and followers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!scope ? (
          <p className="text-sm text-text-secondary">Link your MetaMask wallet using the wallet card below to create your shielded wallet.</p>
        ) : (
          <>
            <p className="text-xs text-text-muted break-all">Funding wallet: <span className="mono text-text-secondary">{walletAddress}</span></p>
            {!wallet ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={busy || storageError} onClick={setup}><Wallet className="w-4 h-4" />Create shielded wallet</Button>
                <Button variant="outline" disabled={busy || storageError} onClick={() => fileInput.current?.click()}><Upload className="w-4 h-4" />Restore backup</Button>
                <p className="text-xs text-text-muted w-full">Already deposited on another device? Restore that wallet’s backup to access those funds.</p>
              </div>
            ) : (
              <>
                <div className="rounded-md bg-surface-raised border border-border p-4 space-y-3">
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">Your private receiving address</span>
                    <Button size="sm" variant="ghost" disabled={!wallet.shieldedAddress} onClick={async () => {
                      try { await navigator.clipboard.writeText(wallet.shieldedAddress!); setCopied(true) }
                      catch { setError('Could not copy the address.') }
                    }}>{copied ? 'Copied' : 'Copy address'}</Button>
                  </div>
                  <p className="mono text-xs break-all text-text-secondary">{wallet.shieldedAddress || 'Keys saved. Open the wallet to finish initialization.'}</p>
                  {!wallet.shieldedAddress && <Button size="sm" disabled={busy} onClick={setup}>Open shielded wallet</Button>}
                  <div className="flex flex-wrap gap-6 items-center">
                    {(['WETH', 'USDC'] as const).map(token => {
                      const balance = view?.balances.find(b => b.symbol === token)
                      return <div key={token}><p className="text-xs text-text-muted">Private {token}</p><p className="text-lg tnum font-semibold text-text-primary">{balance?.amount ?? '—'}</p><p className="text-xs text-text-muted">{balance ? `${balance.notes} unspent notes` : 'Refresh to sync'}</p></div>
                    })}
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => void refresh()}><RefreshCw className="w-3.5 h-3.5" />Refresh balance</Button>
                  </div>
                  {view && <p className="text-xs text-text-muted">Last sync: {new Date(view.syncedAt).toLocaleString()}</p>}
                </div>
                <form onSubmit={deposit} className="space-y-3">
                  <fieldset disabled={busy || storageError || !wallet.shieldedAddress} className="grid grid-cols-1 sm:grid-cols-[130px_1fr_auto] gap-3 items-end">
                    <div className="space-y-1.5">
                      <label htmlFor="pool-asset" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Asset</label>
                      <select id="pool-asset" value={symbol} onChange={e => setSymbol(e.target.value as PoolToken)} className="w-full px-3 py-2.5 rounded-md border border-border bg-surface-raised text-text-primary focus:outline-none focus:border-accent">
                        <option value="ETH">ETH</option><option value="USDC">USDC</option><option value="WETH">WETH</option>
                      </select>
                    </div>
                    <Input id="pool-amount" label="Amount to deposit" inputMode="decimal" placeholder={symbol === 'USDC' ? '10.00' : '0.01'} value={amount} onChange={e => setAmount(e.target.value)} required autoComplete="off" />
                    <Button type="submit" disabled={!amount.trim()}><Wallet className="w-4 h-4" />Load funds</Button>
                  </fieldset>
                  <p className="text-xs text-text-muted">MetaMask will request approval and a deposit on Ethereum Sepolia. ETH is wrapped and appears as private WETH. Pool fees may reduce the credited amount.</p>
                </form>
                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-xs text-text-muted">Recovery keys and private notes stay in this browser. Back them up before clearing browser data. This testnet wallet stores secrets locally without encryption.</p>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setBackupNotice(v => !v)}><Download className="w-3.5 h-3.5" />Back up shielded wallet</Button>
                  {backupNotice && <div className="p-3 rounded-md border border-semantic-warning/30 bg-semantic-warning/10 space-y-2">
                    <p className="text-xs text-text-secondary">The backup contains spending keys and private notes. Anyone with this file can access your shielded funds. Save it somewhere private.</p>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={downloadBackup}>Download private backup</Button>
                  </div>}
                </div>
              </>
            )}
            <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Restore shielded wallet backup" onChange={event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              void run(async () => {
                await importPoolBackup(scope, await file.text())
                onProgress('Wallet restored. Refresh the balance to synchronize private notes.')
              })
            }} />
          </>
        )}
        <div role="status" aria-live="polite" className="text-sm text-text-secondary flex items-start gap-2">
          {busy && <Loader2 className="w-4 h-4 shrink-0 animate-spin motion-reduce:animate-none mt-0.5" />}{status || (busy ? 'Working…' : '')}
        </div>
        {error && <p role="alert" className="text-sm text-semantic-danger break-words">{error}</p>}
        {records.length > 0 && <div className="border-t border-border pt-4 space-y-3">
          <h4 className="text-xs font-semibold text-text-primary">Recent deposits</h4>
          {records.slice(0, 5).map(record => <div key={record.id} className="text-xs space-y-1">
            <div className="flex flex-wrap justify-between gap-2"><span className="tnum">{record.amount} {record.symbol} · {new Date(record.createdAt).toLocaleString()}</span><span className={record.status === 'confirmed' ? 'text-semantic-success' : 'text-text-muted'}>{record.status === 'confirmed' ? 'Deposit confirmed' : record.status}</span></div>
            {record.transactions.map(tx => <a key={tx.hash} href={`https://sepolia.etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="block text-accent break-all hover:underline">{tx.kind} · {tx.status} · {tx.hash.slice(0, 12)}…{tx.hash.slice(-8)}</a>)}
          </div>)}
        </div>}
      </CardContent>
    </Card>
  )
}
