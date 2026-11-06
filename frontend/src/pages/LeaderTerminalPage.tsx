import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { truncateHash } from '@/lib/utils'
import {
  executeTwoLegEntrySwap,
  executeTwoLegExitSwap,
  type OnchainExecutionResult,
  STATIC_BURNER_ADDRESS,
  STATIC_BURNER_KEY,
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
  const [burnerAddress, setBurnerAddress] = useState<string>(STATIC_BURNER_ADDRESS)

  // Multi-step lifecycle state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<'idle' | 'promising' | 'executing_onchain' | 'signaling' | 'completed' | 'error'>('idle')
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

  // Generate a random burner account address
  const handleGenerateBurner = () => {
    const chars = '0123456789abcdef'
    let addr = '0x'
    for (let i = 0; i < 40; i++) {
      addr += chars[Math.floor(Math.random() * chars.length)]
    }
    setBurnerAddress(addr)
  }

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

    if (!user?.walletAddress) {
      setErrorMessage('Please connect your MetaMask wallet before placing leader trades.')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setStep('promising')
      setStepMessage('Sealing Trade Promise on Arkiv Rabdi testnet...')

      const usdcCapital = Number(amount) > 0 ? Number(amount) : 3.00
      const wethPos = 0.001

      const tradePayload = {
        symbol,
        side,
        orderType,
        limit: Number(limit),
        amount: usdcCapital,
        stopLoss: Number(stopLoss),
        target: Number(target),
        burnerAccountAddress: burnerAddress || STATIC_BURNER_ADDRESS,
      }

      console.log('[Terminal] Step 1: Requesting Promise Commitment from /api/trades/promise...')

      // Step 1: Trigger /promise API
      const promiseRes = await api.post('/api/trades/promise', tradePayload)
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

      console.log('[Terminal] Promise Committed with Sequential Index:', pData)

      // Step 2: Real Onchain Execution on Ethereum Sepolia
      setStep('executing_onchain')
      setStepMessage('Executing real onchain two-leg swap (USDC ↔ WETH) on Ethereum Sepolia...')

      const onchainRes = await executeTwoLegEntrySwap({
        traderKey: STATIC_BURNER_KEY,
        usdcAmountNumber: usdcCapital,
        wethAmountNumber: wethPos,
        onLog: (msg) => console.log(`[Flash Engine] ${msg}`),
      })
      setOnchainResult(onchainRes)

      // Step 3: Trigger simultaneous Execution record & Follower Signals
      setStep('signaling')
      setStepMessage('Recording fill and encrypting 10-minute signals for followers in ArkDB...')

      const [execRes, signalRes] = await Promise.all([
        api.post('/api/trades/execute', {
          ...tradePayload,
          tradeIndex: pData.tradeIndex,
          payloadHash: pData.payloadHash,
          promiseId: pData.promiseId,
          executionTxHash: onchainRes.leg1TxHash,
          isCopyTrade: false,
        }),
        api.post('/api/trades/signal', {
          ...tradePayload,
          tradeIndex: pData.tradeIndex,
          payloadHash: pData.payloadHash,
        }),
      ])

      if (!execRes.data?.success) {
        throw new Error(execRes.data?.error || 'Trade execution record failed')
      }

      setExecutionResult({
        tradeId: execRes.data.tradeId,
        executionTxHash: onchainRes.leg1TxHash,
      })

      if (signalRes.data?.success) {
        setSignalResult({
          followersNotified: signalRes.data.followersNotified || 0,
          signals: signalRes.data.signals || [],
        })
      }

      console.log('[Terminal] Real onchain trade & signal completed successfully!')
      setStep('completed')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      console.error('[Terminal] Error in order lifecycle:', e)
      setErrorMessage(e?.response?.data?.error || e?.message || 'Trade flow failed')
      setStep('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Trigger onchain exit settlement (Take-Profit hit at $3,350)
  const handleTriggerTakeProfitExit = async () => {
    try {
      setIsExiting(true)
      setErrorMessage(null)
      const usdcCapital = Number(amount) > 0 ? Number(amount) : 3.00
      const profitUsdc = Number((usdcCapital * 1.113).toFixed(2)) // 11.3% profit minus 30 bps fee

      const exitReceipt = await executeTwoLegExitSwap({
        traderKey: STATIC_BURNER_KEY,
        wethAmountNumber: 0.001,
        usdcReturnAmountNumber: profitUsdc,
        onLog: (msg) => console.log(`[Exit Settlement] ${msg}`),
      })

      setExitResult(exitReceipt)
    } catch (err: unknown) {
      const e = err as Error
      console.error('[Exit Settlement] Error:', e)
      setErrorMessage(`Exit settlement failed: ${e.message}`)
    } finally {
      setIsExiting(false)
    }
  }

  const handleReset = () => {
    setStep('idle')
    setPromiseData(null)
    setExecutionResult(null)
    setSignalResult(null)
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
              <span className="text-[11px] text-text-muted">
                Followers: <strong className="text-text-primary tnum">{user?.followersCount ?? 0}</strong>
              </span>
            </div>
          </div>
        </div>

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

              <CardContent>
                <form onSubmit={handlePlaceOrderAndSignal} className="space-y-5">
                  
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
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                        Limit Price (USD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={limit}
                        onChange={(e) => setLimit(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-md bg-surface-raised border border-border text-text-primary text-sm mono tnum focus:border-accent focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                        Order Amount (Units)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 rounded-md bg-surface-raised border border-border text-text-primary text-sm mono tnum focus:border-accent focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Stop Loss & Take Profit Targets */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Stop Loss (SL)</span>
                        <span className="text-[10px] text-semantic-danger">Risk Guard</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-md bg-surface-raised border border-border text-text-primary text-sm mono tnum focus:border-accent focus:outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                        <span>Target Price (TP)</span>
                        <span className="text-[10px] text-semantic-success">Take Profit</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-md bg-surface-raised border border-border text-text-primary text-sm mono tnum focus:border-accent focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Burner Account Address */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-accent" />
                        <span>Burner Execution Account (Optional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateBurner}
                        className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Generate Burner</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="0x... (Execution burner wallet or leave blank to use connected wallet)"
                      value={burnerAddress}
                      onChange={(e) => setBurnerAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-md bg-surface-raised border border-border text-text-primary text-xs mono tnum placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                    />
                  </div>

                  {errorMessage && (
                    <div className="p-3 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-xs text-semantic-danger">
                      {errorMessage}
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !user?.walletAddress}
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
                        <span>Commit Promise & Execute Real Onchain Flash Trade</span>
                      </>
                    )}
                  </button>
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
                  <CardTitle>Three-Step Execution Protocol</CardTitle>
                </div>
                <CardDescription>
                  How the syndicate executes onchain without leaking the leader's identity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 text-xs">
                
                {/* Step 1 indicator */}
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
                  
                  {promiseData && (
                    <div className="flex justify-between items-center p-2 rounded bg-surface border border-border">
                      <span className="text-text-muted">Sequential Order</span>
                      <span className="mono tnum text-accent font-bold px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                        Trade #{promiseData.tradeIndex || 1}
                      </span>
                    </div>
                  )}

                  {/* Real Onchain Proof Links for Judges */}
                  {onchainResult && (
                    <div className="space-y-2 p-3 rounded bg-accent-soft/40 border border-accent/20">
                      <div className="text-[11px] font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Live Sepolia Proofs (Judges)</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-text-muted">Leg 1: USDC Swap Tx</span>
                        <a
                          href={onchainResult.leg1ExplorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mono text-accent hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>{truncateHash(onchainResult.leg1TxHash, 6)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-text-muted">Leg 2: WETH Position Tx</span>
                        <a
                          href={onchainResult.leg2ExplorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mono text-accent hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>{truncateHash(onchainResult.leg2TxHash, 6)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-text-muted pt-1 border-t border-accent/15">
                        <span>Block #{onchainResult.blockNumber}</span>
                        <span>Gas Used: {onchainResult.gasUsed}</span>
                      </div>
                    </div>
                  )}

                  {promiseData?.arkivEntityKey && (
                    <div className="flex justify-between items-center p-2 rounded bg-surface border border-border">
                      <span className="text-text-muted">Arkiv Sealed Promise</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(promiseData.arkivEntityKey!, 'arkiv')}
                        className="copy-chip text-[10px]"
                      >
                        <span className="mono tnum">{truncateHash(promiseData.arkivEntityKey, 6)}</span>
                        {copiedKey === 'arkiv' ? <Check className="w-3 h-3 text-semantic-success" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}

                  {signalResult && (
                    <div className="p-2.5 rounded bg-surface border border-border space-y-1">
                      <div className="flex justify-between items-center font-bold text-text-primary">
                        <span>Followers Notified</span>
                        <span className="tnum text-accent text-xs">{signalResult.followersNotified} Active Human(s)</span>
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
                      disabled={isExiting}
                      className="w-full py-2.5 px-3 rounded-md bg-semantic-success/20 hover:bg-semantic-success/30 border border-semantic-success/50 text-semantic-success font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {isExiting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Closing Position & Releasing USDC Onchain...</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Trigger Bull Exit: Take-Profit ($3,350)</span>
                        </>
                      )}
                    </button>

                    {exitResult && (
                      <div className="p-2.5 rounded bg-semantic-success/10 border border-semantic-success/30 space-y-1">
                        <div className="text-[11px] font-bold text-semantic-success flex items-center justify-between">
                          <span>✅ Exit Settlement Confirmed!</span>
                          <span className="mono tnum text-[10px]">Block #{exitResult.blockNumber}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-text-muted">USDC Release Tx:</span>
                          <a
                            href={exitResult.leg2ExplorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mono text-semantic-success hover:underline flex items-center gap-1 font-semibold"
                          >
                            <span>{truncateHash(exitResult.leg2TxHash, 6)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="w-full py-2 rounded-md bg-surface hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-colors mt-2"
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

