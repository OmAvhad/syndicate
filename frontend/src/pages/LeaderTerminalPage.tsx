import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatEther, parseUnits } from 'viem'
import type { PoolView } from '@/lib/shielded/pool'
import type { FundingQuote, TradingBurner } from '@/lib/shielded/tradeFunding'
import { scopeKey } from '@/lib/shielded/storage'
import { readCachedBalance } from '@/lib/shielded/balanceCache'
import { artifactsReady, prepareArtifacts, requireArtifactsReady, artifactTotalBytes } from '@/lib/shielded/artifactFetch'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { truncateHash } from '@/lib/utils'
import { logJudgeEvent } from '@/lib/judgeLogger'
import { closeTrade, usdc } from '@/lib/tradeJournal'
import {
  executeTwoLegEntrySwap,
  executeTwoLegExitSwap,
  type OnchainExecutionResult,
  fetchSepoliaBalances,
  FLASH_TRADE_POOL_ADDRESS,
} from '@/lib/flashEngine'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Radio,
  Clock,
  Sparkles,
  Loader2,
  Check,
  Copy,
  ExternalLink,
  Flame,
  Key,
  Layers,
  Database,
  RefreshCw,
  Zap,
  Download,
  Terminal,
} from 'lucide-react'

const SYMBOLS = [
  { label: 'ETH/USDC', name: 'Ethereum Sepolia', price: 3000.0 },
  { label: 'BTC/USDT', name: 'Bitcoin', price: 92450.0 },
  { label: 'SOL/USDT', name: 'Solana', price: 188.25 },
  { label: 'BASE/USDT', name: 'Base Native', price: 4.85 },
  { label: 'WLD/USDT', name: 'Worldcoin', price: 2.15 },
]

export default function LeaderTerminalPage() {
  const { user } = useAuth()

  // Form State
  const [symbol, setSymbol] = useState('ETH/USDC')
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [orderType, setOrderType] = useState<'BRACKET' | 'LIMIT' | 'MARKET'>('BRACKET')
  const [limit, setLimit] = useState('3000')
  const [amount, setAmount] = useState('3.00')
  const [stopLoss, setStopLoss] = useState('2800')
  const [target, setTarget] = useState('3350')
  const [burnerAddress, setBurnerAddress] = useState<string>('')
  const burnerRef = useRef<TradingBurner | null>(null)
  const submittingRef = useRef(false)
  const scope = user?.walletAddress ? { userId: user.id, walletAddress: user.walletAddress } : null
  const [privateView, setPrivateView] = useState<PoolView | null>(null)
  const [fundingQuote, setFundingQuote] = useState<FundingQuote | null>(null)
  const [poolError, setPoolError] = useState('')
  const [poolLoading, setPoolLoading] = useState(false)
  const [rpcStatus, setRpcStatus] = useState('')
  useEffect(() => {
    const handler = (event: Event) => setRpcStatus((event as CustomEvent<string>).detail)
    window.addEventListener('syndicate:rpc-status', handler)
    return () => window.removeEventListener('syndicate:rpc-status', handler)
  }, [])
  const [shortfall, setShortfall] = useState<string | null>(null)
  const [fundingEvidence, setFundingEvidence] = useState<{ operation?: string; transaction?: string }>({})
  const [proofReady, setProofReady] = useState(false)
  const [proofPreparing, setProofPreparing] = useState(false)
  const [proofMessage, setProofMessage] = useState('Checking proof files…')
  useEffect(() => {
    let active = true
    void artifactsReady().then(ready => {
      if (active) { setProofReady(ready); setProofMessage(ready ? 'Proof files ready on this device.' : 'Prepare proof files once before trading.') }
    }).catch(error => { if (active) setProofMessage(error.message) })
    return () => { active = false }
  }, [])
  const prepareProofFiles = async () => {
    setProofPreparing(true); setProofReady(false)
    setProofMessage('Preparing proof files…')
    try {
      await prepareArtifacts((loaded, total, files) => setProofMessage(`Preparing proof files: ${Math.round(loaded / total * 100)}% · ${files}/75 files · ${(loaded / 1048576).toFixed(1)} MiB cached`))
      setProofReady(true); setProofMessage('Proof files ready on this device. Trading uses the cached files.')
    } catch (error) { setProofMessage((error as Error).message) }
    finally { setProofPreparing(false) }
  }
  const refreshPrivate = useCallback(async (force = false) => {
    if (!user?.walletAddress) return
    setPoolLoading(true); setPoolError('')
    const currentScope = { userId: user.id, walletAddress: user.walletAddress }
    setPrivateView(readCachedBalance(currentScope))
    try {
      const pool = await import('@/lib/shielded/pool')
      const view = await pool.syncPool(currentScope, { force })
      setPrivateView(view)
    } catch (error) { setPoolError((error as Error).message) }
    finally { setPoolLoading(false) }
  }, [user?.id, user?.walletAddress])
  useEffect(() => { void refreshPrivate() }, [refreshPrivate])
  useEffect(() => {
    let cancelled = false
    setFundingQuote(null)
    const timer = setTimeout(async () => {
      try {
        const service = await import('@/lib/shielded/tradeFunding')
        const quote = await service.quoteTradeFunding(amount)
        if (!cancelled) setFundingQuote(quote)
      } catch (error) { if (!cancelled) setPoolError((error as Error).message) }
    }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [amount])
  useEffect(() => {
    if (!privateView || !fundingQuote) { setShortfall(null); return }
    let cancelled = false
    void import('@/lib/shielded/tradeFunding').then(service => {
      const usdc = parseUnits(privateView.balances.find(b => b.symbol === 'USDC')?.amount || '0', 6)
      const weth = parseUnits(privateView.balances.find(b => b.symbol === 'WETH')?.amount || '0', 18)
      if (!cancelled) setShortfall(service.fundingShortfall(fundingQuote, usdc, weth))
    })
    return () => { cancelled = true }
  }, [privateView, fundingQuote])
  useEffect(() => {
    burnerRef.current = null
    setBurnerAddress('')
    if (!scope) return
    let cancelled = false
    void import('@/lib/shielded/tradeFunding').then(service => {
      const saved = service.loadTradingBurner(scope)
      if (cancelled || !saved) return
      burnerRef.current = saved
      setBurnerAddress(saved.address)
      setAmount(saved.quote.capital)
      const inputs = JSON.parse(saved.inputs)
      setSymbol(inputs.symbol); setSide(inputs.side); setOrderType(inputs.orderType)
      setLimit(inputs.limit); setStopLoss(inputs.stopLoss); setTarget(inputs.target)
      if (saved.entry) setOnchainResult(saved.entry)
      if (saved.tradeId && saved.entry) setExecutionResult({ tradeId: saved.tradeId, executionTxHash: saved.entry.leg1TxHash })
      if (saved.promise) setPromiseData(saved.promise)
      if (saved.stage === 'open') setStep('completed')
      setFundingEvidence({ operation: saved.userOpHash, transaction: saved.fundingTxHash })
    }).catch(error => { if (!cancelled) setPoolError(error.message) })
    return () => { cancelled = true }
  }, [user?.id, user?.walletAddress])

  // Live Onchain Balances (Burner & Vault)
  const [burnerBalances, setBurnerBalances] = useState<{ eth: string; usdc: string; weth: string } | null>(null)
  const [vaultBalances, setVaultBalances] = useState<{ eth: string; usdc: string; weth: string } | null>(null)
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)

  const loadBalances = useCallback(async () => {
    try {
      setIsLoadingBalances(true)
      const targetBurner = (burnerAddress && burnerAddress.startsWith('0x') && burnerAddress.length === 42)
        ? (burnerAddress as `0x${string}`)
        : null

      const [bBal, vBal] = await Promise.all([
        targetBurner ? fetchSepoliaBalances(targetBurner) : Promise.resolve({ eth: '0', usdc: '0', weth: '0' }),
        fetchSepoliaBalances(FLASH_TRADE_POOL_ADDRESS),
      ])
      setBurnerBalances(bBal)
      setVaultBalances(vBal)
    } catch (err) {
      console.warn('Failed to fetch onchain balances:', err)
    } finally {
      setIsLoadingBalances(false)
    }
  }, [burnerAddress])

  useEffect(() => {
    loadBalances()
  }, [loadBalances])

  // Multi-step lifecycle state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<'idle' | 'funding' | 'promising' | 'executing_onchain' | 'signaling' | 'completed' | 'error'>('idle')
  const [stepMessage, setStepMessage] = useState<string>('')
  const [promiseData, setPromiseData] = useState<{ promiseId: string; payloadHash: string; tradeIndex?: number; arkivEntityKey?: string } | null>(null)
  const [onchainResult, setOnchainResult] = useState<OnchainExecutionResult | null>(null)
  const [executionResult, setExecutionResult] = useState<{ tradeId: string; executionTxHash: string } | null>(null)
  const [signalResult, setSignalResult] = useState<{ followersNotified: number; signals: Array<{ signalId: string; arkivEntityKey: string }> } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Exit trigger state
  const [isExiting, setIsExiting] = useState(false)
  const [exitResult, setExitResult] = useState<OnchainExecutionResult | null>(null)
  const [terminalFollowers, setTerminalFollowers] = useState<any[]>([])

  useEffect(() => {
    api.get('/api/followers')
      .then(res => {
        if (res.data?.success) setTerminalFollowers(res.data.followers || [])
      })
      .catch(() => {})
  }, [])

  // Interactive Live Execution Logs & Audit Trail
  interface TerminalLogItem {
    time: string
    type: 'info' | 'success' | 'warn' | 'onchain'
    message: string
    link?: { label: string; url: string }
  }
  const [tradeLogs, setTradeLogs] = useState<TerminalLogItem[]>([])

  const addTradeLog = useCallback((type: TerminalLogItem['type'], message: string, link?: { label: string; url: string }) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setTradeLogs(prev => [...prev, { time, type, message, link }])
  }, [])


  // Quick fill price based on selected symbol
  const handleSelectSymbol = (sym: string) => {
    setSymbol(sym)
    const found = SYMBOLS.find((s) => s.label === sym)
    if (found) {
      setLimit(String(found.price))
      if (side === 'BUY') {
        setStopLoss(String(Number((found.price * 0.96).toFixed(2))))
        setTarget(String(Number((found.price * 1.08).toFixed(2))))
      } else {
        setStopLoss(String(Number((found.price * 1.04).toFixed(2))))
        setTarget(String(Number((found.price * 0.92).toFixed(2))))
      }
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(id)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Core Execution Flow:
  // 1. Trigger /promise API with hashed payload & sequential Trade #N (Anchored in Arkiv)
  // 2. Execute Real Onchain Two-Leg Atomic Swap on Ethereum Sepolia
  // 3. Trigger simultaneous Execution record & Follower Encrypted Signals (10-min Arkiv TTL)
  const handlePlaceOrderAndSignal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scope || !navigator.locks) { setErrorMessage('Link your wallet and use a browser with Web Locks support.'); return }
    await navigator.locks.request(`${scopeKey(scope)}:leader-execution`, { mode: 'exclusive', ifAvailable: true }, async lock => {
      if (!lock) { setErrorMessage('This leader trade is already running in another tab.'); return }
      await executeLeaderFlow(e)
    })
  }
  const executeLeaderFlow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return

    if (!user?.walletAddress) {
      setErrorMessage('Please connect your MetaMask wallet before placing leader trades.')
      return
    }

    try {
      submittingRef.current = true
      setIsSubmitting(true)
      setErrorMessage(null)
      setTradeLogs([])
      setStep('funding')
      setStepMessage('Checking shielded funds and creating a local burner…')

      const funding = await import('@/lib/shielded/tradeFunding')
      const currentScope = { userId: user.id, walletAddress: user.walletAddress }
      const inputs = JSON.stringify({ symbol, side, orderType, limit, amount, stopLoss, target })
      let burner = burnerRef.current || funding.loadTradingBurner(currentScope)
      if (burner && burner.stage === 'closed') burner = null
      if (burner && burner.inputs !== inputs) throw new Error('A saved trade already has a burner. Restore its original parameters to resume funding; its key has been retained.')
      if (burner?.stage === 'open') throw new Error('This position is already open. Use its exit control before starting a new position.')
      if (burner?.stage === 'entry-pending') throw new Error('An entry may already be submitted. Inspect this burner on Etherscan before retrying; automatic duplicate execution is blocked.')
      if (!burner) {
        await requireArtifactsReady()
        const quote = await funding.quoteTradeFunding(amount)
        burner = funding.createTradingBurner(currentScope, inputs, quote)
      }
      burnerRef.current = burner
      setBurnerAddress(burner.address)
      await funding.fundTradingBurner(currentScope, burner, message => { setStepMessage(message); setFundingQuote({ ...burner.quote }); addTradeLog('info', message) })
      funding.assertTradeScope(currentScope)
      setFundingEvidence({ operation: burner.userOpHash, transaction: burner.fundingTxHash })
      addTradeLog('success', `Burner ${burner.address} funded through Pimlico.`, burner.fundingTxHash ? { label: 'Funding receipt', url: `https://sepolia.etherscan.io/tx/${burner.fundingTxHash}` } : undefined)
      setStep('promising')
      setStepMessage('Funding confirmed. Sealing the trade promise…')

      const usdcCapital = Number(amount) > 0 ? Number(amount) : 3.00
      const wethPos = 0.001

      addTradeLog('info', `Initializing ${side} order: ${symbol} @ $${limit} (Capital: $${usdcCapital.toFixed(2)} USDC, SL: $${stopLoss}, TP: $${target})`)

      const tradePayload = {
        symbol,
        side,
        orderType,
        limit: Number(limit),
        amount: usdcCapital,
        stopLoss: Number(stopLoss),
        target: Number(target),
        burnerAccountAddress: burner.address,
      }

      console.log('[Terminal] Step 1: Requesting Promise Commitment from /api/trades/promise...')
      addTradeLog('info', `Sealing sequential Trade Promise on Arkiv Rabdi testnet...`)

      // Step 1: Trigger /promise API
      const promiseRes = burner.promise ? { data: { success: true, ...burner.promise } } : await api.post('/api/trades/promise', tradePayload)
      if (!promiseRes.data?.success) {
        throw new Error(promiseRes.data?.error || 'Failed to seal trade promise')
      }

      const pData = {
        promiseId: promiseRes.data.promiseId,
        payloadHash: promiseRes.data.payloadHash,
        tradeIndex: promiseRes.data.tradeIndex || 1,
        arkivEntityKey: promiseRes.data.arkivEntityKey,
      }
      setPromiseData(pData)
      burner.promise = pData
      funding.saveTradingBurner(currentScope, burner)

      console.log('[Terminal] Promise Committed with Sequential Index:', pData)
      if (pData.arkivEntityKey) {
        addTradeLog(
          'success',
          `Trade #${pData.tradeIndex} Promise sealed on Arkiv (Key: ${truncateHash(pData.arkivEntityKey, 6)})`,
          { label: 'Rabdi Explorer', url: `https://rabdi.explorer.arkiv.network/entity/${pData.arkivEntityKey}` }
        )
      } else {
        addTradeLog('success', `Trade #${pData.tradeIndex} Promise sealed in ArkDB (30-day epoch)`)
      }

      // Log Promise Event for Judges
      logJudgeEvent({
        category: 'PROMISE',
        title: `Trade #${pData.tradeIndex} Sealed Promise Committed on Arkiv`,
        details: {
          tradeIndex: pData.tradeIndex,
          promiseId: pData.promiseId,
          symbol: tradePayload.symbol,
          side: tradePayload.side,
          limitPrice: `$${tradePayload.limit}`,
          amountUSDC: `$${tradePayload.amount.toFixed(2)}`,
          stopLoss: `$${tradePayload.stopLoss}`,
          takeProfit: `$${tradePayload.target}`,
          burnerWallet: tradePayload.burnerAccountAddress,
          payloadHash: pData.payloadHash,
          arkivEntityKey: pData.arkivEntityKey || 'Pending',
          retention: '30 Days (Audit Epoch)',
        },
        links: pData.arkivEntityKey ? [
          { label: `Arkiv Rabdi Explorer (Entity: ${pData.arkivEntityKey})`, url: `https://rabdi.explorer.arkiv.network/entity/${pData.arkivEntityKey}` },
          { label: `Rabdi Entity Explorer Table`, url: `https://rabdi.explorer.arkiv.network/entity-explorer` },
        ] : [],
      })

      // Step 2: Real Onchain Execution on Ethereum Sepolia
      setStep('executing_onchain')
      setStepMessage('Executing real onchain two-leg swap (USDC ↔ WETH) on Ethereum Sepolia...')
      addTradeLog('onchain', `Executing two-leg transfer demo on Ethereum Sepolia via burner ${truncateHash(burner.address, 6)}...`)
      funding.assertTradeScope(currentScope)
      burner.stage = 'entry-pending'
      funding.saveTradingBurner(currentScope, burner)

      const onchainRes = await executeTwoLegEntrySwap({
        traderKey: burner.privateKey,
        usdcAmountNumber: usdcCapital,
        wethAmountNumber: wethPos,
        onLog: (msg) => {
          console.log(`[Flash Engine] ${msg}`)
          if (msg.includes('Leg 1: USDC transfer mined')) {
            addTradeLog('onchain', `Leg 1: Transferred $${usdcCapital.toFixed(2)} USDC to FlashTradePool Vault`)
          } else if (msg.includes('Leg 2: WETH position delivered')) {
            addTradeLog('onchain', `Leg 2: Delivered ${wethPos} WETH position to Burner`)
          }
        },
      })
      setOnchainResult(onchainRes)
      burner.entry = onchainRes
      burner.stage = 'open'
      funding.saveTradingBurner(currentScope, burner)

      addTradeLog(
        'onchain',
        `Sepolia Swaps Mined: Block #${onchainRes.blockNumber} (Gas Used: ${onchainRes.gasUsed})`,
        { label: 'Etherscan Leg 1', url: onchainRes.leg1ExplorerUrl }
      )

      // Calculate Target & Stop PnL
      const targetGainUsdc = Number((usdcCapital * (Number(target) - Number(limit)) / Number(limit)).toFixed(2))
      const targetGainPct = Number((((Number(target) - Number(limit)) / Number(limit)) * 100).toFixed(2))
      const stopLossRiskUsdc = Number((usdcCapital * (Number(limit) - Number(stopLoss)) / Number(limit)).toFixed(2))
      const stopLossRiskPct = Number((((Number(limit) - Number(stopLoss)) / Number(limit)) * 100).toFixed(2))

      // Log Onchain Trade for Judges
      logJudgeEvent({
        category: 'ONCHAIN_TRADE',
        title: `Trade #${pData.tradeIndex} Atomic Flash Swap Mined on Ethereum Sepolia`,
        details: {
          tradeIndex: pData.tradeIndex,
          burnerAddress: onchainRes.traderAddress,
          usdcSpent: `$${onchainRes.usdcAmount} USDC`,
          wethPositionDelivered: `${onchainRes.wethAmount} WETH`,
          entryPrice: `$${limit}`,
          takeProfitTarget: `$${target} (+${targetGainPct}% / +$${targetGainUsdc} USDC)`,
          stopLossTarget: `$${stopLoss} (-${stopLossRiskPct}% / -$${stopLossRiskUsdc} USDC)`,
          unrealizedPnL: 'Not calculated: no live mark-price feed',
          blockNumber: onchainRes.blockNumber,
          gasUsed: onchainRes.gasUsed,
          settlementVault: '0xA360946725811DABB91C054A3DFF25eD25C005E8 (FlashTradePool)',
        },
        links: [
          { label: `Etherscan Leg 1 (USDC Transfer: ${truncateHash(onchainRes.leg1TxHash, 6)})`, url: onchainRes.leg1ExplorerUrl },
          { label: `Etherscan Leg 2 (WETH Delivery: ${truncateHash(onchainRes.leg2TxHash, 6)})`, url: onchainRes.leg2ExplorerUrl },
        ],
      })

      // Step 3: Trigger simultaneous Execution record & Follower Signals
      setStep('signaling')
      setStepMessage('Recording fill and encrypting 10-minute signals for followers in ArkDB...')
      addTradeLog('info', `Encrypting 10-minute signals with active followers' public keys...`)

      const [execRes, signalRes] = await Promise.all([
        api.post('/api/trades/execute', {
          ...tradePayload,
          tradeIndex: pData.tradeIndex,
          payloadHash: pData.payloadHash,
          promiseId: pData.promiseId,
          executionTxHash: onchainRes.leg1TxHash,
          entryDeliveryTxHash: onchainRes.leg2TxHash,
          isCopyTrade: false,
        }),
        api.post('/api/trades/signal', {
          ...tradePayload,
          tradeIndex: pData.tradeIndex,
          payloadHash: pData.payloadHash,
          promiseId: pData.promiseId,
        }),
      ])

      if (!execRes.data?.success) {
        throw new Error(execRes.data?.error || 'Trade execution record failed')
      }

      setExecutionResult({
        tradeId: execRes.data.tradeId,
        executionTxHash: onchainRes.leg1TxHash,
      })
      burner.tradeId = execRes.data.tradeId
      funding.saveTradingBurner(currentScope, burner)
      window.dispatchEvent(new Event('syndicate:trades-changed'))

      addTradeLog('success', `Order fill recorded in protocol state (orderType: BRACKET)`)

      if (signalRes.data?.success) {
        setSignalResult({
          followersNotified: signalRes.data.followersNotified || 0,
          signals: signalRes.data.signals || [],
        })

        addTradeLog('success', `Dispatched signals to ${signalRes.data.followersNotified || 0} active followers via WebSockets & ArkDB (TTL 10m)`)

        // Log Signal Dispatch for Judges
        logJudgeEvent({
          category: 'ARKIV_SIGNAL',
          title: `Trade #${pData.tradeIndex} Encrypted Signals Dispatched via WebSockets & ArkDB`,
          details: {
            tradeIndex: pData.tradeIndex,
            followersNotified: signalRes.data.followersNotified || 0,
            ttl: '600 Seconds (10 Minutes)',
            expiresAt: signalRes.data.expiresAt,
            channel: 'WebSockets (/ws) + Arkiv Rabdi Entity',
          },
        })
      }

      console.log('[Terminal] Real onchain trade & signal completed successfully!')
      setStep('completed')
      await loadBalances()
      setTimeout(() => { loadBalances() }, 2500)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      console.error('[Terminal] Error in order lifecycle:', e)
      if (e?.message?.toLowerCase().includes('proof file')) {
        setProofReady(false)
        setProofMessage(e.message)
      }
      setErrorMessage(e?.response?.data?.error || e?.message || 'Trade flow failed')
      addTradeLog('warn', `Error: ${e?.response?.data?.error || e?.message || 'Trade flow failed'}`)
      setStep('error')
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleLeaderExit = async (exit: 'tp' | 'sl') => {
    if (isExiting || exitResult) return
    setIsExiting(true); setErrorMessage(null)
    try {
      const tradeId = executionResult?.tradeId || burnerRef.current?.tradeId
      if (!scope || !tradeId || !burnerRef.current) throw new Error('Open Trade History and recover this local entry before exiting.')
      const settled = await closeTrade(scope, tradeId, exit, message => addTradeLog('onchain', message))
      setExitResult(settled.receipt)
      burnerRef.current.stage = 'closed'
      const funding = await import('@/lib/shielded/tradeFunding')
      funding.saveTradingBurner(scope, burnerRef.current)
      addTradeLog('success', `Exit confirmed. Realized P/L: ${usdc(settled.trade.realizedPnlUnits)} USDC before native gas.`, { label: 'USDC payout', url: settled.receipt.leg2ExplorerUrl })
      await loadBalances()
    } catch (error) { setErrorMessage((error as Error).message) }
    finally { setIsExiting(false) }
  }
  const handleTriggerTakeProfitExit = () => handleLeaderExit('tp')
  const handleTriggerStopLossExit = () => handleLeaderExit('sl')

  const handleReset = () => {
    if (burnerRef.current && burnerRef.current.stage !== 'closed') {
      setErrorMessage('This burner still has a pending funding operation or open position. Its saved keys and state must be recovered before starting another trade.')
      return
    }
    burnerRef.current = null
    setBurnerAddress('')
    if (scope) localStorage.removeItem(`${scopeKey(scope)}:active-trade`)
    setStep('idle')
    setPromiseData(null)
    setOnchainResult(null)
    setExecutionResult(null)
    setSignalResult(null)
    setExitResult(null)
    setTradeLogs([])
    setErrorMessage(null)
  }

  return (
    <div className="pt-20 pb-16 px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="surface p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-sm bg-accent flex items-center justify-center text-text-inverse shadow-sm">
                  <TrendingUp className="w-4 h-4 stroke-[2.2]" />
                </span>
                <span className="meta-label">Decentralized Copy Trading Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
                Leader Order Terminal
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
                Place spot/perpetual orders with cryptographic promises. Once executed, signals are 
                <strong className="text-accent"> encrypted by follower public keys</strong> and anchored in <strong className="text-accent">ArkDB</strong> with a strict 10-minute TTL.
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
              <span className="meta-label">Protocol Status</span>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-raised border border-border text-xs">
                <span className="w-2 h-2 rounded-full bg-semantic-success animate-pulse" />
                <span className="text-text-primary font-semibold">ArkDB 10m TTL Active</span>
              </div>
              <div className="text-[11px] text-text-muted text-right space-y-1">
                <div>Followers: <strong className="text-text-primary tnum">{terminalFollowers.length || user?.followersCount || 0}</strong></div>
                {terminalFollowers.length > 0 && terminalFollowers.length < 3 && (
                  <div className="space-y-0.5 animate-fadeIn">
                    {terminalFollowers.map((f, i) => {
                      const addr = f.followerPublicKey || f.followerId?.walletAddress
                      const handle = f.followerId?.username ? `@${f.followerId.username}` : `Human #${i + 1}`
                      return (
                        <div key={f._id} className="text-[10px] mono flex items-center justify-end gap-1.5 bg-surface-raised px-2 py-0.5 rounded border border-border">
                          <span className="font-bold text-text-primary">{handle}:</span>
                          <span className="text-accent font-bold">{truncateHash(addr, 6)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Your shielded trading balance</CardTitle><CardDescription>Ethereum Sepolia · USDC capital and WETH for withdrawal fees and the burner's native gas reserve.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border bg-surface-raised p-3 space-y-2">
              <p className="text-sm font-semibold">Proof files · {proofReady ? 'Ready' : proofPreparing ? 'Preparing' : 'Preparation required'}</p>
              <p role="status" aria-live="polite" className="text-xs text-text-secondary">{proofMessage}</p>
              {!proofReady && <button type="button" onClick={() => void prepareProofFiles()} disabled={proofPreparing || isSubmitting} className="text-xs text-accent disabled:opacity-50">{proofPreparing ? 'Preparing…' : `Prepare proof files (${(artifactTotalBytes / 1048576).toFixed(0)} MiB, once)`}</button>}
              <p className="text-xs text-text-muted">Public proving files are served by this app and saved in your browser. Keep this page open during preparation. They contain no wallet secrets.</p>
            </div>
            <div className="flex flex-wrap gap-6 items-center">
              {['USDC', 'WETH'].map(token => <div key={token}><p className="text-xs text-text-muted">Private {token}</p><p className="mono tnum text-lg">{privateView?.balances.find(b => b.symbol === token)?.amount ?? '—'}</p></div>)}
              <button type="button" disabled={poolLoading || isSubmitting} onClick={() => void refreshPrivate(true)} className="text-accent text-xs disabled:opacity-50">{poolLoading ? 'Synchronizing notes…' : 'Refresh private balance'}</button>
              <Link to="/" className="text-accent text-xs underline">Top up on dashboard</Link>
            </div>
            {privateView && <p className="text-xs text-text-muted">Last synchronized: {new Date(privateView.syncedAt).toLocaleString()}{poolLoading ? ' · Updating in background…' : ''}. Funding always rechecks spendable notes.</p>}
            {fundingQuote && <p className="text-xs text-text-secondary">Estimated requirement: {(Number(fundingQuote.grossUsdc) / 1e6).toFixed(6)} USDC + {formatEther(BigInt(fundingQuote.requiredWeth))} WETH. Includes {formatEther(BigInt(fundingQuote.nativeReserve))} ETH for entry/exit gas and a {formatEther(BigInt(fundingQuote.feeReserve))} WETH withdrawal reserve. Pimlico checks the operation estimate before submission.</p>}
            {shortfall && <p role="alert" className="rounded-md p-3 border border-semantic-warning/40 text-semantic-warning text-sm">{shortfall} <Link to="/" className="underline">Please top up.</Link></p>}
            {poolError && <p role="alert" className="text-semantic-warning text-xs">{poolError}</p>}
            {rpcStatus && <p role="status" className="text-semantic-warning text-xs">{rpcStatus}</p>}
            <p className="text-xs text-text-muted">On submit, a fresh burner is saved locally, signs its own funding UserOperation and receives funds through Pimlico. The promise is created after funding confirmation. Gas reserves are estimates; unused funds remain in the burner.</p>
            {fundingEvidence.operation && <p className="mono text-xs break-all">Funding UserOperation: {fundingEvidence.operation}</p>}
            {fundingEvidence.transaction && <a href={`https://sepolia.etherscan.io/tx/${fundingEvidence.transaction}`} target="_blank" rel="noopener noreferrer" className="text-accent text-xs underline">View confirmed funding transaction</a>}
          </CardContent>
        </Card>
        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Column 1: Order Placement Form (7 cols) */}
          <div className="lg:col-span-7">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-accent animate-pulse" />
                    <CardTitle>Place Trade & Dispatch Signal</CardTitle>
                  </div>
                  <Badge variant="accent">Promise & ArkDB</Badge>
                </div>
                <CardDescription>
                  Enter trade parameters. Your order will be hashed, promised, executed, and broadcasted to your verified followers.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">

                {/* Live Onchain Balances Bar */}
                <div className="p-3.5 rounded-lg bg-surface-raised border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-semantic-success animate-pulse" />
                      <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                        Burner Wallet Balances (Sepolia Testnet)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={loadBalances}
                      disabled={isLoadingBalances}
                      className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingBalances ? 'animate-spin' : ''}`} />
                      <span>{isLoadingBalances ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded bg-surface border border-border">
                      <div className="text-[10px] text-text-muted uppercase font-semibold">USDC Trading Capital</div>
                      <div className="mono tnum text-xs font-bold text-accent">
                        {burnerBalances ? `$${parseFloat(burnerBalances.usdc).toFixed(2)} USDC` : 'Loading...'}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-surface border border-border">
                      <div className="text-[10px] text-text-muted uppercase font-semibold">WETH Position</div>
                      <div className="mono tnum text-xs font-bold text-text-primary">
                        {burnerBalances ? `${parseFloat(burnerBalances.weth).toFixed(4)} WETH` : 'Loading...'}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-surface border border-border">
                      <div className="text-[10px] text-text-muted uppercase font-semibold">ETH (Gas Reserve)</div>
                      <div className="mono tnum text-xs font-bold text-text-secondary">
                        {burnerBalances ? `${parseFloat(burnerBalances.eth).toFixed(4)} ETH` : 'Loading...'}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-text-muted flex justify-between items-center pt-1 px-1 border-t border-border/60">
                    <span>FlashTradePool Vault Reserves:</span>
                    <span className="mono font-semibold text-text-secondary">
                      {vaultBalances ? `$${parseFloat(vaultBalances.usdc).toFixed(2)} USDC • ${parseFloat(vaultBalances.weth).toFixed(4)} WETH` : 'Loading...'}
                    </span>
                  </div>
                </div>

                <form onSubmit={handlePlaceOrderAndSignal}>
                <fieldset disabled={isSubmitting} className="space-y-5">
                  
                  {/* Symbol Quick Pills */}
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                      Market Symbol
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {SYMBOLS.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => handleSelectSymbol(s.label)}
                          className={`py-2 px-2.5 rounded-md text-xs font-semibold border transition-all text-center ${
                            symbol === s.label
                              ? 'bg-accent-soft border-accent text-accent'
                              : 'bg-surface-raised border-border text-text-secondary hover:text-text-primary hover:border-border-strong'
                          }`}
                        >
                          <div className="font-bold">{s.label.split('/')[0]}</div>
                          <div className="text-[10px] text-text-muted mono tnum">${s.price}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Side: BUY (Long) vs SELL (Short) */}
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                      Order Direction
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSide('BUY')
                          handleSelectSymbol(symbol)
                        }}
                        className={`py-3 px-4 rounded-md text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                          side === 'BUY'
                            ? 'bg-semantic-success/15 border-semantic-success text-semantic-success shadow-[0_0_12px_rgba(121,217,154,0.15)]'
                            : 'bg-surface-raised border-border text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                        <span>BUY / LONG</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSide('SELL')
                          handleSelectSymbol(symbol)
                        }}
                        className={`py-3 px-4 rounded-md text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                          side === 'SELL'
                            ? 'bg-semantic-danger/15 border-semantic-danger text-semantic-danger shadow-[0_0_12px_rgba(240,127,127,0.15)]'
                            : 'bg-surface-raised border-border text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                        <span>SELL / SHORT</span>
                      </button>
                    </div>
                  </div>

                  {/* Limit Price & Amount Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Limit Price</span>
                        <span className="text-[10px] text-text-muted">USDC per 1 ETH</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs text-text-muted font-bold">$</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={limit}
                          onChange={(e) => setLimit(e.target.value)}
                          required
                          className="w-full pl-8 pr-16 py-2.5 rounded-md bg-surface-raised border border-border text-text-primary text-sm mono tnum focus:border-accent focus:outline-none transition-colors"
                        />
                        <span className="absolute right-3.5 top-2.5 text-xs text-text-muted font-bold">USDC</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Trading Capital (USDC)</span>
                        <span className="text-[10px] text-accent font-bold">Currency: USDC</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs text-text-muted font-bold">$</span>
                        <input
                          type="number"
                          step="0.10"
                          min="0.10"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          required
                          className="w-full pl-8 pr-16 py-2.5 rounded-md bg-surface-raised border border-border text-text-primary text-sm mono tnum focus:border-accent focus:outline-none transition-colors"
                          placeholder="3.00"
                        />
                        <span className="absolute right-3.5 top-2.5 text-xs text-accent font-bold">USDC</span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1.5 flex justify-between">
                        <span>Capital: <strong className="text-text-primary font-bold">${amount} USDC</strong></span>
                        <span>Acquiring: <strong className="text-accent mono font-bold">~0.001 WETH</strong></span>
                      </p>
                    </div>
                  </div>

                  {/* Stop Loss & Take Profit Targets */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Stop Loss (SL)</span>
                        <span className="text-[10px] text-semantic-danger font-semibold">Exit Protection</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs text-text-muted font-bold">$</span>
                        <input
                          type="number"
                          step="1"
                          value={stopLoss}
                          onChange={(e) => setStopLoss(e.target.value)}
                          className="w-full pl-8 pr-16 py-2.5 rounded-md bg-surface-raised border border-border text-text-primary text-sm mono tnum focus:border-accent focus:outline-none transition-colors"
                        />
                        <span className="absolute right-3.5 top-2.5 text-xs text-semantic-danger font-bold">USDC</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Target Price (TP)</span>
                        <span className="text-[10px] text-semantic-success font-semibold">Take Profit</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs text-text-muted font-bold">$</span>
                        <input
                          type="number"
                          step="1"
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                          className="w-full pl-8 pr-16 py-2.5 rounded-md bg-surface-raised border border-border text-text-primary text-sm mono tnum focus:border-accent focus:outline-none transition-colors"
                        />
                        <span className="absolute right-3.5 top-2.5 text-xs text-semantic-success font-bold">USDC</span>
                      </div>
                    </div>
                  </div>

                  {/* Burner Account Address */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="block text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-accent" />
                        <span>Local per-trade burner</span>
                      </p>
                    </div>
                    <div className="rounded-md bg-surface-raised border border-border px-3.5 py-3 space-y-2" role="status" aria-live="polite">
                      <p className="text-xs text-text-secondary">{burnerAddress ? 'This trade’s burner was created and saved on this device.' : 'A new burner will be created automatically when you submit this trade. Its address will appear here.'}</p>
                      {burnerAddress && <p className="mono tnum text-xs text-accent break-all select-all">{burnerAddress}</p>}
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="p-3 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-xs text-semantic-danger">
                      {errorMessage}
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !user?.walletAddress || (!proofReady && !burnerRef.current?.userOpHash && !burnerRef.current?.signedOperation) || (!burnerRef.current && (!privateView || !fundingQuote || !!shortfall))}
                    className="w-full py-3.5 px-4 rounded-md font-bold text-xs text-text-inverse bg-accent hover:bg-[#d4f885] active:translate-y-0 transition-all duration-fast flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_14px_rgba(198,243,106,0.2)]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-text-inverse" />
                        <span>{stepMessage || 'Executing Real Onchain Swap & Dispatching Signals...'}</span>
                      </>
                    ) : (
                      <>
                        <Radio className="w-4 h-4 text-text-inverse stroke-[2.2]" />
                        <span>Fund Burner, Commit Promise & Execute Trade</span>
                      </>
                    )}
                  </button>
                </fieldset>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Column 2: Protocol Lifecycle & Commitment Audit (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Protocol Architecture Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <CardTitle>Funding & Execution Protocol</CardTitle>
                </div>
                <CardDescription>
                  How the syndicate executes onchain without leaking the leader's identity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 text-xs">
                
                {/* Step 1 indicator */}
                <div className={`p-3.5 rounded-md border ${step === 'funding' ? 'border-accent bg-accent-soft' : 'border-border bg-surface-raised'}`}>
                  <p className="font-semibold mb-1">0. Fund a fresh local burner through Pimlico</p>
                  <p className="text-[11px]">The recipient burner signs the UserOperation. The pool supplies USDC and native gas; shielded WETH pays the withdrawal fee.</p>
                  {step === 'funding' && <p role="status" className="text-xs text-accent mt-2">{stepMessage}</p>}
                </div>
                <div className={`p-3.5 rounded-md border transition-all ${
                  step === 'promising'
                    ? 'bg-accent-soft border-accent text-text-primary'
                    : step === 'executing_onchain' || step === 'signaling' || step === 'completed'
                    ? 'bg-surface-raised border-semantic-success/40 text-text-secondary'
                    : 'bg-surface-raised border-border text-text-muted'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-accent" />
                      1. Sequential Cryptographic Promise
                    </span>
                    {step === 'promising' && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />}
                    {(step === 'executing_onchain' || step === 'signaling' || step === 'completed') && (
                      <Check className="w-3.5 h-3.5 text-semantic-success stroke-[2.5]" />
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Trade parameters are hashed and sealed with a sequential counter (Trade #N) anchored on Arkiv with 30-day retention.
                  </p>
                </div>

                {/* Step 2 indicator */}
                <div className={`p-3.5 rounded-md border transition-all ${
                  step === 'executing_onchain'
                    ? 'bg-accent-soft border-accent text-text-primary'
                    : step === 'signaling' || step === 'completed'
                    ? 'bg-surface-raised border-semantic-success/40 text-text-secondary'
                    : 'bg-surface-raised border-border text-text-muted'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-accent" />
                      2. Real Onchain Sepolia Flash Swap
                    </span>
                    {step === 'executing_onchain' && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />}
                    {(step === 'signaling' || step === 'completed') && (
                      <Check className="w-3.5 h-3.5 text-semantic-success stroke-[2.5]" />
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Two-leg atomic swap: Burner transfers USDC to FlashTradePool Vault; Vault delivers WETH position to Burner.
                  </p>
                </div>

                {/* Step 3 indicator */}
                <div className={`p-3.5 rounded-md border transition-all ${
                  step === 'signaling'
                    ? 'bg-accent-soft border-accent text-text-primary'
                    : step === 'completed'
                    ? 'bg-surface-raised border-semantic-success/40 text-text-secondary'
                    : 'bg-surface-raised border-border text-text-muted'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-accent" />
                      3. Encrypted Signals on ArkDB (10m TTL)
                    </span>
                    {step === 'signaling' && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />}
                    {step === 'completed' && <Check className="w-3.5 h-3.5 text-semantic-success stroke-[2.5]" />}
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Signals encrypted for active followers, stored in ArkDB with 10-minute expiry, and broadcasted via WebSockets.
                  </p>
                </div>

              </CardContent>
            </Card>

            {/* Execution Audit Card (Shown upon completion) */}
            {step === 'completed' && (
              <Card className="border-semantic-success/40 bg-surface-raised animate-fadeIn">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-semantic-success stroke-[3]" />
                      <CardTitle className="text-semantic-success">Onchain Trade Filled & Sealed</CardTitle>
                    </div>
                    <Badge variant="success">Confirmed Onchain</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3.5 text-xs">
                  
                  {/* Sequential Order & Arkiv Sealed Entity */}
                  {promiseData && (
                    <div className="flex justify-between items-center p-2.5 rounded bg-surface border border-border">
                      <span className="text-text-primary font-bold">Sequential Order</span>
                      <span className="mono tnum text-accent font-black px-2.5 py-0.5 rounded bg-accent/10 border border-accent/30">
                        Trade #{promiseData.tradeIndex || 1}
                      </span>
                    </div>
                  )}

                  {/* Real Onchain Proof Links for Judges (Ultra High Contrast Dark Text) */}
                  {onchainResult && (
                    <div className="space-y-2.5 p-3.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 shadow-sm text-zinc-950 dark:text-zinc-100">
                      <div className="text-xs font-black text-zinc-950 dark:text-white uppercase tracking-wider flex items-center justify-between pb-1.5 border-b border-zinc-300 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-emerald-600 dark:text-accent fill-emerald-500/20" />
                          <span className="font-extrabold text-zinc-950 dark:text-white">Live Sepolia Proofs (Judges)</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                          VERIFIED ONCHAIN
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center text-[12px]">
                        <span className="text-zinc-900 dark:text-zinc-200 font-bold">Leg 1: USDC Swap Tx</span>
                        <a
                          href={onchainResult.leg1ExplorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mono text-blue-700 hover:text-blue-950 dark:text-accent dark:hover:underline flex items-center gap-1 font-bold underline underline-offset-2"
                        >
                          <span>{truncateHash(onchainResult.leg1TxHash, 6)}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <div className="flex justify-between items-center text-[12px]">
                        <span className="text-zinc-900 dark:text-zinc-200 font-bold">Leg 2: WETH Position Tx</span>
                        <a
                          href={onchainResult.leg2ExplorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mono text-blue-700 hover:text-blue-950 dark:text-accent dark:hover:underline flex items-center gap-1 font-bold underline underline-offset-2"
                        >
                          <span>{truncateHash(onchainResult.leg2TxHash, 6)}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-zinc-900 dark:text-zinc-300 font-semibold pt-1.5 border-t border-zinc-300 dark:border-zinc-800">
                        <span>Block #{onchainResult.blockNumber}</span>
                        <span>Gas Used: {onchainResult.gasUsed}</span>
                      </div>
                    </div>
                  )}

                  {onchainResult && <div className="p-3.5 rounded-md bg-surface-raised border border-border space-y-2 text-sm">
                    <p className="font-semibold">Position & realized result</p>
                    <p>Entry: {onchainResult.usdcAmount} USDC � Position: {onchainResult.wethAmount} WETH</p>
                    {exitResult ? <><p>Confirmed payout: {exitResult.usdcAmount} USDC</p><p>Realized P/L: {(Number(exitResult.usdcAmount) - Number(onchainResult.usdcAmount)).toFixed(6)} USDC before native gas.</p></> : <p className="text-text-muted">Position open. Live unrealized P/L is unavailable.</p>}
                    <Link to="/history" className="text-accent underline text-xs">Full receipts, gas and promise claim</Link>
                  </div>}

                  {/* Interactive Terminal Audit Logs (High Contrast Dark Box) */}
                  {tradeLogs.length > 0 && (
                    <div className="p-3.5 rounded-lg bg-zinc-950 text-zinc-100 border border-zinc-800 shadow-md font-mono text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800 text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-accent" />
                          <span className="text-white font-bold">Execution Logs & Audit Trail</span>
                        </div>
                        <span className="text-accent">{tradeLogs.length} Events</span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {tradeLogs.map((log, i) => (
                          <div key={i} className="flex items-start gap-1.5 leading-relaxed">
                            <span className="text-zinc-500 shrink-0 font-normal">[{log.time}]</span>
                            <div className="flex-1">
                              <span
                                className={
                                  log.type === 'success'
                                    ? 'text-emerald-400 font-semibold'
                                    : log.type === 'onchain'
                                    ? 'text-accent font-semibold'
                                    : log.type === 'warn'
                                    ? 'text-amber-400 font-semibold'
                                    : 'text-zinc-300'
                                }
                              >
                                {log.message}
                              </span>
                              {log.link && (
                                <a
                                  href={log.link.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ml-2 inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300 underline font-medium"
                                >
                                  <span>{log.link.label}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {promiseData?.arkivEntityKey && (
                    <div className="flex justify-between items-center p-2.5 rounded bg-surface border border-border">
                      <div className="flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-accent" />
                        <span className="text-text-primary font-bold">Arkiv Sealed Entity</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://rabdi.explorer.arkiv.network/entity/${promiseData.arkivEntityKey}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mono text-blue-700 hover:text-blue-900 dark:text-accent dark:hover:underline flex items-center gap-1 font-bold text-[11px] underline underline-offset-2"
                          title="View entity on Arkiv Rabdi Explorer"
                        >
                          <span>{truncateHash(promiseData.arkivEntityKey, 6)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href="https://rabdi.explorer.arkiv.network/entity-explorer"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-surface hover:bg-surface-hover border border-border text-text-secondary hover:text-text-primary"
                          title="Browse all entities on Rabdi Entity Explorer"
                        >
                          Explorer
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(promiseData.arkivEntityKey!, 'arkiv')}
                          className="copy-chip text-[10px]"
                          title="Copy Arkiv Entity Key"
                        >
                          {copiedKey === 'arkiv' ? <Check className="w-3 h-3 text-semantic-success" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {signalResult && (
                    <div className="p-2.5 rounded bg-surface border border-border space-y-1">
                      <div className="flex justify-between items-center font-bold text-text-primary">
                        <span>Followers Notified</span>
                        <span className="tnum text-accent text-xs font-black">{signalResult.followersNotified} Active Human(s)</span>
                      </div>
                    </div>
                  )}

                  {/* Interactive Exit Settlement Trigger */}
                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-text-primary">Simulate Market Trigger</span>
                      <span className="text-[10px] text-semantic-success font-semibold">Active: 0.001 WETH</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleTriggerTakeProfitExit}
                      disabled={isExiting || Boolean(exitResult)}
                      className="w-full py-2.5 px-3 rounded-md bg-semantic-success/20 hover:bg-semantic-success/30 border border-semantic-success/50 text-semantic-success font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {isExiting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Closing Position & Releasing USDC Onchain...</span>
                        </>
                      ) : exitResult ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-semantic-success" />
                          <span>Position Closed</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Trigger Bull Exit: Take-Profit (${target})</span>
                        </>
                      )}
                    </button>

                    <button type="button" onClick={handleTriggerStopLossExit} disabled={isExiting || Boolean(exitResult)} className="w-full py-2.5 px-3 rounded-md bg-semantic-danger/15 border border-semantic-danger/50 text-semantic-danger font-bold text-xs disabled:opacity-50">Trigger Bear Exit: Stop-Loss (${stopLoss})</button>
                    <Link to="/history" className="block text-xs text-accent underline">View history, realized P/L & Claim Promise</Link>
                    {exitResult && (
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-zinc-950 dark:text-zinc-100 space-y-1.5 shadow-sm">
                        <div className="text-[11px] font-black text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
                          <span>✅ Exit Settlement Confirmed Onchain!</span>
                          <span className="mono tnum text-[10px] font-bold">Block #{exitResult.blockNumber}</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className="text-zinc-900 dark:text-zinc-200 font-bold">USDC Release Tx:</span>
                          <a
                            href={exitResult.leg2ExplorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mono text-blue-700 hover:text-blue-900 dark:text-accent font-bold underline underline-offset-2 flex items-center gap-1"
                          >
                            <span>{truncateHash(exitResult.leg2TxHash, 6)}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Judge Report Export Button */}
                  <button
                    type="button"
                    onClick={() => window.downloadJudgeLogs && window.downloadJudgeLogs()}
                    className="w-full py-2.5 px-3 rounded-md bg-accent-soft hover:bg-accent/20 border border-accent/40 text-accent font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors mt-2"
                    title="Downloads output.md containing all onchain transactions, blocks, and Arkiv keys"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download output.md (Judge Proofs)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="w-full py-2 rounded-md bg-surface hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-colors mt-1"
                  >
                    Place Another Order
                  </button>
                </CardContent>
              </Card>
            )}

          </div>

        </div>
      </div>
    </div>
  )
}

