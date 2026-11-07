import { BASE_FOLLOWER_WALLET, beginDirectBaseTrade, selectedBaseWallet, prepareDirectBaseTrade, signBaseWalletOrder } from '@/lib/directBaseWallet'
import BaseTradeStatus from './BaseTradeStatus'
import { useState, useEffect, useCallback } from 'react'
import { parseUnits, formatEther } from 'viem'
import { useSignals, TradeSignalItem } from '@/context/SignalContext'
import { truncateHash } from '@/lib/utils'
import { logJudgeEvent } from '@/lib/judgeLogger'
import { useAuth } from '@/context/AuthContext'
import { readBaseTrade, saveBaseTrade } from '@/lib/basePimlico'
import { closeTrade, usdc } from '@/lib/tradeJournal'
import { Link } from 'react-router-dom'
import {
  executeTwoLegEntrySwap,
  executeTwoLegExitSwap,
  type OnchainExecutionResult,
  fetchSepoliaBalances,
  FOLLOWER_BURNER_KEY,
  FOLLOWER_BURNER_ADDRESS,
} from '@/lib/flashEngine'
import {
  fetchBaseMainnetBalances,
  BASE_MAINNET_EXPLORER,
  BASE_WETH,
  BASE_USDC,
  type BaseBurnerBalances,
} from '@/lib/baseBurner'
import {
  quoteInput,
  waitForDefinitiveFill,
  fetchDefinitiveQuote,
  submitDefinitiveOrder,
} from '@/lib/definitiveService'
import {
  TrendingUp,
  Clock,
  Check,
  AlertCircle,
  Loader2,
  Copy,
  ExternalLink,
  ShieldCheck,
  X,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Terminal,
  Download,
  Flame,
  Wallet,
  Lock,
  KeyRound,
} from 'lucide-react'

interface CopyTradeModalProps {
  signal: TradeSignalItem
  onClose: () => void
}

interface FollowerLogItem {
  time: string
  type: 'info' | 'success' | 'warn' | 'onchain'
  message: string
  link?: { label: string; url: string }
}

export default function CopyTradeModal({ signal, onClose }: CopyTradeModalProps) {
  const { user } = useAuth()
  const [realizedPnl, setRealizedPnl] = useState<string | null>(null)
  const { executeCopyTrade, decryptSignal } = useSignals()

  // Encrypted signals receive their default amount after decryption.
  const defaultAmount = signal.amount
    ? String(signal.amount)
    : signal.requiresMetaMaskDecrypt ? '' : '2.00'
  const [amount, setAmount] = useState(defaultAmount)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [onchainReceipt, setOnchainReceipt] = useState<OnchainExecutionResult | null>(null)
  const [executionReceipt, setExecutionReceipt] = useState<{ tradeId: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyLogs, setCopyLogs] = useState<FollowerLogItem[]>([])
  const [followerBalances, setFollowerBalances] = useState<{ usdc: string; weth: string; eth: string } | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  // Follower Exit Settlements (Bull TP / Bear SL)
  const [isExiting, setIsExiting] = useState(false)
  const [exitResult, setExitResult] = useState<OnchainExecutionResult | null>(null)
  const [exitType, setExitType] = useState<'tp' | 'sl' | null>(null)

  const isBaseMainnet = signal.network === 'BASE_MAINNET'
  const baseBurner = { address: BASE_FOLLOWER_WALLET }
  const [baseBalances, setBaseBalances] = useState<BaseBurnerBalances | null>(null)

  const loadBaseBalances = useCallback(async () => {
    if (!isBaseMainnet) return
    try {
      const b = await fetchBaseMainnetBalances(baseBurner.address)
      setBaseBalances(b)
    } catch (e) {
      console.warn('Failed to load follower base balances:', e)
    }
  }, [isBaseMainnet, baseBurner.address])

  useEffect(() => {
    loadBaseBalances()
  }, [loadBaseBalances])

  const loadFollowerBalance = useCallback(async () => {
    if (isBaseMainnet) return
    try {
      setIsLoadingBalance(true)
      const bals = await fetchSepoliaBalances(FOLLOWER_BURNER_ADDRESS)
      setFollowerBalances(bals)
    } catch (err) {
      console.warn('Failed to load follower balance:', err)
    } finally {
      setIsLoadingBalance(false)
    }
  }, [])

  useEffect(() => {
    loadFollowerBalance()
  }, [loadFollowerBalance])

  const addCopyLog = useCallback((type: FollowerLogItem['type'], message: string, link?: { label: string; url: string }) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setCopyLogs(prev => [...prev, { time, type, message, link }])
  }, [])

  // Update amount once decrypted if signal.amount was previously null
  useEffect(() => {
    if (signal.amount != null) {
      setAmount(current => current === '' ? String(signal.amount) : current)
    }
  }, [signal.amount])

  const isEncrypted = !signal.isDecrypted || signal.limit == null

  const handleDecrypt = async (refreshEncryption = false) => {
    setIsDecrypting(true)
    setErrorMessage(null)
    const res = await decryptSignal(signal.signalId, refreshEncryption)
    setIsDecrypting(false)
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to decrypt trade signal')
    }
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleCopyKey = () => {
    if (signal.arkivEntityKey) {
      navigator.clipboard.writeText(signal.arkivEntityKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const numAmount = Number(amount) || 0
  const entryPrice = signal.limit || 3000
  const calculatedWeth = Number((numAmount / entryPrice).toFixed(5)) || 0.0005
  const targetGainUsdc = Number(((numAmount * (Number(signal.target || 3350) - entryPrice)) / entryPrice).toFixed(2))
  const targetGainPct = Number((((Number(signal.target || 3350) - entryPrice) / entryPrice) * 100).toFixed(1))
  const stopLossRiskUsdc = Number(((numAmount * (entryPrice - Number(signal.stopLoss || 2800))) / entryPrice).toFixed(2))
  const stopLossRiskPct = Number((((entryPrice - Number(signal.stopLoss || 2800)) / entryPrice) * 100).toFixed(1))

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isEncrypted) {
      setErrorMessage('Please decrypt the signal with MetaMask before placing your trade')
      return
    }

    setIsExecuting(true)
    setErrorMessage(null)
    setCopyLogs([])

    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0')
      setIsExecuting(false)
      return
    }

    try {
      addCopyLog('info', `Initializing copy trade: ${signal.side} ${signal.symbol} @ $${signal.limit} (Capital: $${numAmount.toFixed(2)} USDC)`)

      if (isBaseMainnet) {
        if (!user?.walletAddress) throw new Error('Connect the follower funding wallet.')
        if (!navigator.locks) throw new Error('Web Locks support is required for safe trade retries.')
        return await navigator.locks.request(`syndicate:base-flow:${BASE_FOLLOWER_WALLET.toLowerCase()}`, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('A Base trade is already running in another tab.')
        const burner = { address: BASE_FOLLOWER_WALLET }
        await selectedBaseWallet(burner.address)
        await beginDirectBaseTrade(burner.address)
        const qty = String(numAmount)
        const side = signal.side === 'BUY' ? 'buy' : 'sell'
        let saved = readBaseTrade(burner.address)
        const inputs = JSON.stringify({ signalId: signal.signalId, qty, side })
        if (saved.inputs && saved.inputs !== inputs) throw new Error('Another trade is pending on this burner. Resume it before creating another.')
        saveBaseTrade(burner.address, { inputs })
        let quote = saved.quote && (saved.orderId || saved.orderSubmissionStarted) ? JSON.parse(saved.quote) : await fetchDefinitiveQuote({ targetAsset: BASE_WETH, contraAsset: BASE_USDC, side, qty, funderAddress: burner.address, bracketLevels: signal.side === 'BUY' ? { referencePrice: Number(signal.limit), takeProfit: String(signal.target), stopLoss: String(signal.stopLoss) } : undefined })
        if (!saved.orderId && !saved.orderSubmissionStarted) {
          const input = quoteInput(quote, burner.address, signal.side === 'BUY' ? 'BUY' : 'SELL', qty)
          addCopyLog('onchain', 'Confirm token approvals in MetaMask for the fixed follower wallet.')
          await prepareDirectBaseTrade(burner.address, input.token, input.amount, quote.attachedBracket ? parseUnits(quote.attachedBracket.signedMaxFromAmount, 18) : undefined)
          quote = await fetchDefinitiveQuote({ targetAsset: BASE_WETH, contraAsset: BASE_USDC, side, qty, funderAddress: burner.address, bracketLevels: quote.demoLevels })
          quoteInput(quote, burner.address, signal.side === 'BUY' ? 'BUY' : 'SELL', qty)
          saveBaseTrade(burner.address, { quote: JSON.stringify(quote) })
        }
        saved = readBaseTrade(burner.address)
        addCopyLog('onchain', 'Waiting for actual Definitive settlement...')
        const order = saved.orderId ? await waitForDefinitiveFill(saved.orderId, burner.address) : await submitDefinitiveOrder({ protectedQuote: quote, quoteId: quote.quoteId, targetAsset: BASE_WETH, contraAsset: BASE_USDC, side, qty, funderAddress: burner.address, signProtection: typed => signBaseWalletOrder(burner.address, typed), userSignature: await signBaseWalletOrder(burner.address, quote.evm.orderTypedData), evmOrderTypedData: quote.evm.orderTypedData })
        if (!order.txHash) throw new Error('No confirmed Base settlement returned.')
        const res = await executeCopyTrade(signal.signalId, numAmount, order.txHash, undefined, burner.address, order.orderId)
        if (!res.success || !res.tradeId) throw new Error(res.error || 'Fill recording failed. Retry to resume.')
        saveBaseTrade(burner.address, { recorded: 'true', tradeId: res.tradeId })
        setExecutionReceipt({ tradeId: res.tradeId })
        addCopyLog('success', 'Copy trade settled on Base and saved to history.', { label: 'Base settlement', url: `${BASE_MAINNET_EXPLORER}/tx/${order.txHash}` })
        await loadBaseBalances()
        return
        })
      }

      // 1. Execute Real Onchain Flash Swap on Ethereum Sepolia for Follower
      addCopyLog('onchain', `Executing atomic two-leg swap on Ethereum Sepolia via dedicated follower burner ${truncateHash(FOLLOWER_BURNER_ADDRESS, 6)}...`)
      console.log(`[Follower Copy] Executing onchain swap via burner ${FOLLOWER_BURNER_ADDRESS} for $${numAmount.toFixed(2)} USDC (~${calculatedWeth} WETH)...`)

      const onchainRes = await executeTwoLegEntrySwap({
        traderKey: FOLLOWER_BURNER_KEY,
        usdcAmountNumber: numAmount,
        wethAmountNumber: calculatedWeth,
        onLog: (msg) => {
          console.log(`[Follower Flash] ${msg}`)
          if (msg.includes('Leg 1: USDC transfer mined')) {
            addCopyLog('onchain', `Leg 1: Transferred $${numAmount.toFixed(2)} USDC to FlashTradePool Vault`)
          } else if (msg.includes('Leg 2: WETH position delivered')) {
            addCopyLog('onchain', `Leg 2: Delivered ${calculatedWeth} WETH position to follower burner`)
          }
        },
      })
      setOnchainReceipt(onchainRes)

      // Refresh follower balance after onchain trade
      setTimeout(() => {
        loadFollowerBalance()
      }, 2500)

      addCopyLog(
        'onchain',
        `Sepolia Swaps Mined: Block #${onchainRes.blockNumber} (Gas Used: ${onchainRes.gasUsed})`,
        { label: 'Etherscan Leg 1', url: onchainRes.leg1ExplorerUrl }
      )

      // 2. Record Copy Execution in Database
      const res = await executeCopyTrade(signal.signalId, numAmount, onchainRes.leg1TxHash, onchainRes.leg2TxHash, onchainRes.traderAddress)
      if (res.success && res.tradeId) {
        setExecutionReceipt({ tradeId: res.tradeId })
        addCopyLog('success', `Copy entry receipts verified and saved to history (ID: ${res.tradeId})`)
      } else {
        setExecutionReceipt({ tradeId: '' })
        setErrorMessage(`Transfers confirmed, but saving history failed: ${res.error || 'Unknown error'}. Retry saving below; do not execute the entry again.`)
      }

      // 3. Log Follower Copy Event for Judges
      logJudgeEvent({
        category: 'FOLLOWER_COPY',
        title: `Follower Copied Trade #${signal.tradeIndex || 1} on Ethereum Sepolia`,
        details: {
          tradeIndex: signal.tradeIndex || 1,
          signalId: signal.signalId,
          leaderUsername: signal.leaderUsername,
          symbol: signal.symbol,
          side: signal.side,
          orderType: signal.orderType || 'BRACKET',
          entryPrice: `$${signal.limit}`,
          copyCapitalUSDC: `$${numAmount.toFixed(2)} USDC`,
          wethPositionReceived: `${onchainRes.wethAmount} WETH`,
          takeProfitTarget: `$${signal.target} (+${targetGainPct}% / +$${targetGainUsdc} USDC)`,
          stopLossTarget: `$${signal.stopLoss} (-${stopLossRiskPct}% / -$${stopLossRiskUsdc} USDC)`,
          unrealizedPnL: 'Not calculated: no live mark-price feed',
          blockNumber: onchainRes.blockNumber,
          gasUsed: onchainRes.gasUsed,
          settlementVault: '0xA360946725811DABB91C054A3DFF25eD25C005E8 (FlashTradePool)',
          arkivSignalKey: signal.arkivEntityKey || 'N/A',
        },
        links: [
          { label: `Follower Leg 1 USDC Transfer (${truncateHash(onchainRes.leg1TxHash, 6)})`, url: onchainRes.leg1ExplorerUrl },
          { label: `Follower Leg 2 WETH Position (${truncateHash(onchainRes.leg2TxHash, 6)})`, url: onchainRes.leg2ExplorerUrl },
          ...(signal.arkivEntityKey ? [{ label: `Arkiv Signal Entity (${truncateHash(signal.arkivEntityKey, 6)})`, url: `https://rabdi.explorer.arkiv.network/entity/${signal.arkivEntityKey}` }] : []),
          { label: `Rabdi Entity Explorer Table`, url: `https://rabdi.explorer.arkiv.network/entity-explorer` },
        ],
      })
    } catch (err: unknown) {
      const e = err as Error
      console.error('[Follower Copy] Error:', e)
      setErrorMessage(e.message || 'Failed to execute copy trade onchain')
      addCopyLog('warn', `Execution error: ${e.message || 'Onchain swap failed'}`)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleExit = async (exit: 'tp' | 'sl') => {
    if (isExiting || exitResult) return
    setIsExiting(true); setExitType(exit); setErrorMessage(null)
    try {
      if (!user?.walletAddress || !executionReceipt?.tradeId) throw new Error('Save this copy to history before exiting.')
      const settled = await closeTrade({ userId: user.id, walletAddress: user.walletAddress }, executionReceipt.tradeId, exit, message => addCopyLog('onchain', message))
      setExitResult(settled.receipt)
      setRealizedPnl(usdc(settled.trade.realizedPnlUnits))
      addCopyLog('success', `Exit confirmed. Realized P/L: ${usdc(settled.trade.realizedPnlUnits)} USDC before native gas.`, { label: 'USDC payout receipt', url: settled.receipt.leg2ExplorerUrl })
      logJudgeEvent({ category: 'EXIT_SETTLEMENT', title: `Follower ${exit === 'tp' ? 'Bull' : 'Bear'} exit confirmed`, details: { tradeId: settled.trade._id, payoutUSDC: usdc(settled.trade.exitUsdcUnits), realizedPnlUSDC: usdc(settled.trade.realizedPnlUnits), executionMode: 'Manual two-transfer demo scenario' }, links: [{ label: 'Exit payout', url: settled.receipt.leg2ExplorerUrl }] })
      await loadFollowerBalance()
    } catch (error) { setErrorMessage((error as Error).message); addCopyLog('warn', (error as Error).message) }
    finally { setIsExiting(false) }
  }
  const handleTriggerTakeProfitExit = () => handleExit('tp')
  const handleTriggerStopLossExit = () => handleExit('sl')

  const isBuy = signal.side === 'BUY' || signal.side === 'LONG'

  return (
    <div role="dialog" aria-modal="true" aria-label={executionReceipt ? 'Copy trade successful' : 'Copy trade'} className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
      <div className="surface p-6 sm:p-7 max-w-lg w-full rounded-xl border border-border-strong shadow-[0_20px_50px_rgba(0,0,0,0.7)] animate-slideUp my-8 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-text-inverse shadow-sm">
              <TrendingUp className="w-5 h-5 stroke-[2.2]" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-extrabold text-text-primary">
                  Copy Trade #{signal.tradeIndex || 1}
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-accent/15 text-accent border border-accent/30">
                  {signal.orderType || 'BRACKET'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">
                Signal from <strong className="text-text-primary">@{signal.leaderUsername}</strong> • Ephemeral ArkDB
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1.5 rounded-sm hover:bg-surface-raised transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {executionReceipt ? (
          /* Execution Success State */
          <div className="space-y-4 text-center py-2 animate-fadeIn">
            <h4 className="text-lg font-bold text-semantic-success">Copy trade successful</h4>
            {isBaseMainnet && executionReceipt.tradeId && <BaseTradeStatus tradeId={executionReceipt.tradeId} />}
            {isBaseMainnet && <div className="text-sm space-y-2"><p>Real Base settlement confirmed. BUY trades use automatic Definitive take-profit / stop-loss orders at +/-0.05% from their live reference price.</p><p>Timing depends on market movement. Manual Sepolia exits are disabled for Base.</p>{readBaseTrade(baseBurner.address).fillTxHash && <a className="text-accent underline" target="_blank" rel="noopener noreferrer" href={`${BASE_MAINNET_EXPLORER}/tx/${readBaseTrade(baseBurner.address).fillTxHash}`}>View Base settlement</a>}</div>}
            {errorMessage && <p role="alert" className="text-sm text-semantic-danger">{errorMessage}</p>}
            {realizedPnl !== null && <p className="text-sm">Realized P/L: <strong>{realizedPnl} USDC</strong> before native gas.</p>}
            <Link to="/history" onClick={onClose} className="block text-sm text-accent underline">View history, P/L & Claim Promise</Link>
            {!executionReceipt.tradeId && onchainReceipt && <button type="button" disabled={isExecuting} className="text-xs text-accent underline" onClick={async () => {
              setIsExecuting(true)
              const result = await executeCopyTrade(signal.signalId, numAmount, onchainReceipt.leg1TxHash, onchainReceipt.leg2TxHash, onchainReceipt.traderAddress)
              if (result.success && result.tradeId) { setExecutionReceipt({ tradeId: result.tradeId }); setErrorMessage(null) }
              else setErrorMessage(result.error || 'History recording failed; retain receipts and retry.')
              setIsExecuting(false)
            }}>Retry saving confirmed entry to history</button>}
            <div className="w-12 h-12 rounded-full bg-semantic-success/20 text-semantic-success flex items-center justify-center mx-auto shadow-sm">
              <Check className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div>
              <h4 className="text-base font-extrabold text-text-primary">Copy Trade #{signal.tradeIndex || 1} Executed!</h4>
              <p className="text-xs text-text-secondary mt-1">
                Your copy of <strong className="text-text-primary">${numAmount.toFixed(2)} USDC</strong> completed its two transfers on Ethereum Sepolia.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-raised border border-border text-xs text-left space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Order Fill Status</span>
                <span className="text-semantic-success font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  ENTRY CONFIRMED
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Execution Order ID</span>
                <span className="mono tnum text-text-primary font-semibold">{executionReceipt.tradeId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Fill Price</span>
                <span className="mono tnum text-accent font-bold">${signal.limit} / ETH</span>
              </div>

              {/* Live Sepolia Proofs for Judges (Ultra High Contrast Dark Text) */}
              {onchainReceipt && (
                <div className="p-3.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 space-y-2 text-zinc-950 dark:text-zinc-100 shadow-sm">
                  <div className="text-[11px] font-black text-zinc-950 dark:text-white uppercase tracking-wider flex items-center justify-between pb-1 border-b border-zinc-300 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-accent fill-emerald-500/20" />
                      <span className="font-extrabold text-zinc-950 dark:text-white">Follower Sepolia Receipts (Judges)</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      MINED ONCHAIN
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-zinc-900 dark:text-zinc-200 font-bold">Leg 1: USDC Swap Tx</span>
                    <a
                      href={onchainReceipt.leg1ExplorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mono text-blue-700 hover:text-blue-900 dark:text-accent dark:hover:underline flex items-center gap-1 font-bold underline underline-offset-2"
                    >
                      <span>{truncateHash(onchainReceipt.leg1TxHash, 6)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-zinc-900 dark:text-zinc-200 font-bold">Leg 2: WETH Position Tx</span>
                    <a
                      href={onchainReceipt.leg2ExplorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mono text-blue-700 hover:text-blue-900 dark:text-accent dark:hover:underline flex items-center gap-1 font-bold underline underline-offset-2"
                    >
                      <span>{truncateHash(onchainReceipt.leg2TxHash, 6)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-zinc-900 dark:text-zinc-300 font-semibold pt-1 border-t border-zinc-300 dark:border-zinc-800">
                    <span>Block #{onchainReceipt.blockNumber}</span>
                    <span>Gas: {onchainReceipt.gasUsed}</span>
                  </div>
                </div>
              )}

              {!isBaseMainnet && <>
              {/* Trade PnL & Position Metrics for Follower */}
              <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 space-y-2 text-zinc-950 dark:text-zinc-100 shadow-sm">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-300 dark:border-zinc-800 text-[11px] font-black uppercase text-zinc-950 dark:text-white">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-accent" />
                    <span>Position PnL Metrics</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    ACTIVE
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-1.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    <div className="text-[9px] font-bold text-zinc-700 dark:text-zinc-400 uppercase">Capital</div>
                    <div className="font-black text-zinc-950 dark:text-white mono">${numAmount.toFixed(2)} USDC</div>
                  </div>
                  <div className="p-1.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    <div className="text-[9px] font-bold text-zinc-700 dark:text-zinc-400 uppercase">Acquired Position</div>
                    <div className="font-black text-zinc-950 dark:text-white mono">{calculatedWeth} WETH</div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-700 dark:text-zinc-400 font-medium">TP Target (@ ${signal.target}):</span>
                  <span className="mono font-bold text-emerald-700 dark:text-emerald-400">
                    +${targetGainUsdc.toFixed(2)} USDC (+{targetGainPct}%)
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-700 dark:text-zinc-400 font-medium">SL Risk (@ ${signal.stopLoss}):</span>
                  <span className="mono font-bold text-red-600 dark:text-red-400">
                    -${stopLossRiskUsdc.toFixed(2)} USDC (-{stopLossRiskPct}%)
                  </span>
                </div>
              </div>

              {/* Bull / Bear Move Exit Settlement Triggers for Follower */}
              <div className="p-3.5 rounded-lg bg-surface-raised border border-border space-y-2.5 text-left">
                <div className="flex items-center justify-between text-[11px] font-black uppercase text-text-primary">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-accent" />
                    <span>Onchain Exit Settlements</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-accent-soft text-accent">
                    {exitResult ? 'POSITION CLOSED' : 'MANUAL DEMO EXITS'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTriggerTakeProfitExit}
                    disabled={isBaseMainnet || isExiting || Boolean(exitResult) || !executionReceipt.tradeId}
                    className="py-2.5 px-2 rounded-md bg-semantic-success/20 hover:bg-semantic-success/30 border border-semantic-success/50 text-semantic-success font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isExiting && exitType === 'tp' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Closing...</span>
                      </>
                    ) : exitResult && exitType === 'tp' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Take-Profit Hit</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Bull exit (${signal.target})</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerStopLossExit}
                    disabled={isBaseMainnet || isExiting || Boolean(exitResult) || !executionReceipt.tradeId}
                    className="py-2.5 px-2 rounded-md bg-semantic-danger/15 hover:bg-semantic-danger/25 border border-semantic-danger/40 text-semantic-danger font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isExiting && exitType === 'sl' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Closing...</span>
                      </>
                    ) : exitResult && exitType === 'sl' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Stop-Loss Hit</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Bear exit (${signal.stopLoss})</span>
                      </>
                    )}
                  </button>
                </div>

                {exitResult && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-zinc-950 dark:text-zinc-100 space-y-1.5 shadow-sm animate-fadeIn">
                    <div className="text-[11px] font-black text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
                      <span>✅ Follower Exit Settled Onchain!</span>
                      <span className="mono tnum text-[10px] font-bold">Block #{exitResult.blockNumber}</span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-zinc-900 dark:text-zinc-200 font-bold">USDC Payout Tx:</span>
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

              </>}
              {/* Follower Execution Logs & Audit Trail */}
              {copyLogs.length > 0 && (
                <div className="p-3 rounded-lg bg-zinc-950 text-zinc-100 border border-zinc-800 shadow-md font-mono text-[10px] space-y-1">
                  <div className="flex items-center justify-between pb-1 border-b border-zinc-800 text-zinc-400 text-[9px] uppercase font-bold tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <Terminal className="w-3 h-3 text-accent" />
                      <span className="text-white font-bold">Follower Audit Trail</span>
                    </div>
                    <span className="text-accent">{copyLogs.length} Events</span>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {copyLogs.map((log, i) => (
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
                              className="ml-1.5 inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300 underline font-medium"
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
            </div>

            {/* Judge Report Export Button */}
            <button
              type="button"
              onClick={() => window.downloadJudgeLogs && window.downloadJudgeLogs()}
              className="w-full py-2.5 px-3 rounded-md bg-accent-soft hover:bg-accent/20 border border-accent/40 text-accent font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              title="Downloads output.md containing all onchain transactions, blocks, and Arkiv keys"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download output.md (Judge Proofs)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-md bg-accent text-text-inverse text-xs font-bold hover:bg-[#d4f885] transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          /* Form & Confirmation State */
          <form onSubmit={handleExecute} className="space-y-4">
            
            {/* Countdown Badge & ArkDB TTL */}
            <div className="flex items-center justify-between p-3 rounded-md bg-accent-soft border border-accent/25 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent animate-pulse" />
                <span className="font-semibold text-text-primary">Remaining TTL to Execute:</span>
              </div>
              <span className="mono tnum text-accent font-extrabold text-sm">
                {formatTimer(signal.remainingSeconds)}
              </span>
            </div>

            {/* Asymmetric Private-Key Decryption Banner if signal is encrypted */}
            {(signal.requiresMetaMaskDecrypt || isEncrypted) && (
              <div
                className={`p-3.5 rounded-md border text-xs transition-all ${
                  isEncrypted
                    ? 'bg-accent/10 border-accent/40 shadow-sm'
                    : 'bg-semantic-success/10 border-semantic-success/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {isEncrypted ? (
                      <Lock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-semantic-success shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold text-text-primary flex items-center gap-1.5">
                        <span>
                          {isEncrypted
                            ? 'Private-Key Encrypted Signal'
                            : 'Decrypted with MetaMask Private Key'}
                        </span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-surface border border-border text-text-secondary">
                          eth_decrypt
                        </span>
                      </div>
                      <p className="text-[11px] text-text-secondary mt-1">
                        {isEncrypted
                          ? 'This trade signal is encrypted with your Curve25519 public key. Decrypt it via MetaMask to view price, stop loss, and target.'
                          : 'Order parameters unlocked using your native MetaMask private key.'}
                      </p>
                    </div>
                  </div>

                  {isEncrypted && (
                    <button
                      type="button"
                      onClick={() => void handleDecrypt()}
                      disabled={isDecrypting}
                      className="shrink-0 py-1.5 px-3 rounded-sm bg-accent text-text-inverse font-bold text-xs hover:bg-[#d4f885] transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                    >
                      {isDecrypting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Decrypting...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>Decrypt Signal</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                {isEncrypted && <div className="mt-3 border-t border-border pt-3 space-y-2">
                  <p className="text-[11px] text-text-secondary">MetaMask unable to decrypt? Cancel its pending request, then refresh the encryption key. This re-encrypts your active signal without extending its expiry.</p>
                  <button type="button" disabled={isDecrypting} onClick={() => void handleDecrypt(true)} className="text-xs font-semibold text-accent underline disabled:opacity-50">Refresh encryption key & retry</button>
                </div>}
              </div>
            )}

            {/* Signal Details Summary Grid */}
            <div className="p-3.5 rounded-lg bg-surface-raised border border-border space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-text-muted uppercase tracking-wider font-semibold">Sequential Order</span>
                <span className="mono tnum text-accent font-bold px-2 py-0.5 rounded bg-accent/10 border border-accent/20">
                  Trade #{signal.tradeIndex || 1}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-muted uppercase tracking-wider font-semibold">Market Symbol</span>
                <strong className="text-text-primary text-sm">{signal.symbol}</strong>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-muted uppercase tracking-wider font-semibold">Direction</span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 ${
                    isBuy
                      ? 'bg-semantic-success/15 text-semantic-success'
                      : 'bg-semantic-danger/15 text-semantic-danger'
                  }`}
                >
                  {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {signal.side}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-muted uppercase tracking-wider font-semibold">Limit Price</span>
                {isEncrypted ? (
                  <span className="inline-flex items-center gap-1 text-accent font-semibold">
                    <Lock className="w-3 h-3" />
                    <span>Locked (MetaMask Encrypted)</span>
                  </span>
                ) : (
                  <span className="mono tnum font-bold text-text-primary">${signal.limit}</span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-muted uppercase tracking-wider font-semibold">Take Profit Target</span>
                {isEncrypted ? (
                  <span className="inline-flex items-center gap-1 text-text-muted font-medium">
                    <Lock className="w-3 h-3 text-accent" />
                    <span>Locked</span>
                  </span>
                ) : (
                  <span className="mono tnum text-semantic-success font-semibold">${signal.target}</span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-muted uppercase tracking-wider font-semibold">Stop Loss</span>
                {isEncrypted ? (
                  <span className="inline-flex items-center gap-1 text-text-muted font-medium">
                    <Lock className="w-3 h-3 text-accent" />
                    <span>Locked</span>
                  </span>
                ) : (
                  <span className="mono tnum text-semantic-danger font-semibold">${signal.stopLoss}</span>
                )}
              </div>

              {signal.arkivEntityKey && (
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-text-muted uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Database className="w-3 h-3 text-accent" />
                    Arkiv Signal Key
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://rabdi.explorer.arkiv.network/entity/${signal.arkivEntityKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mono text-blue-700 hover:text-blue-900 dark:text-accent dark:hover:underline flex items-center gap-1 font-bold text-[10px] underline underline-offset-2"
                      title="View entity on Arkiv Rabdi Explorer"
                    >
                      <span>{truncateHash(signal.arkivEntityKey, 8)}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <a
                      href="https://rabdi.explorer.arkiv.network/entity-explorer"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-surface hover:bg-surface-hover border border-border text-text-secondary hover:text-text-primary"
                      title="Browse on Rabdi Entity Explorer"
                    >
                      Explorer
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="copy-chip text-[10px]"
                      title="Copy Arkiv Entity Key"
                    >
                      {copied ? <Check className="w-2.5 h-2.5 text-semantic-success" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Follower Burner Account */}
            {isBaseMainnet ? (
              <div className="p-3 rounded-lg border border-border text-xs space-y-2"><p className="font-bold">Base follower trading wallet</p><a className="mono text-accent break-all" target="_blank" rel="noopener noreferrer" href={`${BASE_MAINNET_EXPLORER}/address/${BASE_FOLLOWER_WALLET}`}>{BASE_FOLLOWER_WALLET}</a><p className="text-text-muted">Select this account in MetaMask to approve tokens and sign the trade.</p></div>
            ) : (
              <div className="p-3 rounded-lg bg-surface-raised border border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-accent/10 text-accent">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-text-muted">Follower Burner Account</div>
                    <div className="mono font-bold text-text-primary text-[11px]">
                      {truncateHash(FOLLOWER_BURNER_ADDRESS, 6)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-text-muted">Available Balance</div>
                  <div className="mono font-extrabold text-accent text-sm">
                    {isLoadingBalance ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin inline text-accent" />
                    ) : (
                      `$${followerBalances?.usdc || '15.00'} USDC`
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Custom Amount Field with Quick Presets */}
            <fieldset disabled={isEncrypted} className="space-y-2 disabled:opacity-50">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center justify-between">
                <span>Your Copy Capital (USDC)</span>
                <span className="text-[11px] text-accent font-bold">Currency: $ USDC</span>
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
                  className="w-full pl-8 pr-16 py-2.5 rounded-md bg-surface-raised border border-border text-text-primary text-sm mono tnum focus:border-accent focus:outline-none transition-colors font-bold"
                  placeholder="2.00"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-accent font-bold">USDC</span>
              </div>

              {/* Quick Preset Amount Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-text-muted uppercase font-semibold mr-1">Presets:</span>
                {signal.amount && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(signal.amount))}
                    className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors cursor-pointer border ${
                      amount === String(signal.amount)
                        ? 'bg-accent text-text-inverse border-accent'
                        : 'bg-surface hover:bg-surface-hover text-text-secondary border-border'
                    }`}
                  >
                    100% (${signal.amount})
                  </button>
                )}
                {signal.amount && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(Number((Number(signal.amount) * 0.5).toFixed(2))))}
                    className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors cursor-pointer border ${
                      amount === String(Number((signal.amount * 0.5).toFixed(2)))
                        ? 'bg-accent text-text-inverse border-accent'
                        : 'bg-surface hover:bg-surface-hover text-text-secondary border-border'
                    }`}
                  >
                    50% (${(signal.amount * 0.5).toFixed(2)})
                  </button>
                )}
                {['1.00', '3.00', '5.00', '10.00'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors cursor-pointer border ${
                      amount === preset
                        ? 'bg-accent text-text-inverse border-accent'
                        : 'bg-surface hover:bg-surface-hover text-text-secondary border-border'
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>

              {/* Dynamic Projection Box */}
              {!isEncrypted && <div className="p-2.5 rounded-md bg-surface border border-border text-[11px] space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Estimated Position Size:</span>
                  <span className="mono font-bold text-accent">~{calculatedWeth} WETH</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Target Profit (@ ${signal.target}):</span>
                  <span className="mono font-bold text-emerald-600 dark:text-emerald-400">
                    +${targetGainUsdc.toFixed(2)} USDC (+{targetGainPct}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Stop Loss Risk (@ ${signal.stopLoss}):</span>
                  <span className="mono font-bold text-red-600 dark:text-red-400">
                    -${stopLossRiskUsdc.toFixed(2)} USDC (-{stopLossRiskPct}%)
                  </span>
                </div>
              </div>}
            </fieldset>

            {errorMessage && (
              <div className="p-3 rounded-md bg-semantic-danger/10 border border-semantic-danger/30 text-xs text-semantic-danger flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-md bg-surface-raised hover:bg-surface-hover border border-border text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {isEncrypted ? (
                <button
                  type="button"
                  onClick={() => void handleDecrypt()}
                  disabled={isDecrypting}
                  className="flex-1 py-2.5 rounded-md bg-accent hover:bg-[#d4f885] text-text-inverse text-xs font-bold transition-all shadow-[0_2px_14px_rgba(198,243,106,0.2)] disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isDecrypting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Confirm in MetaMask...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>Decrypt with MetaMask</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isExecuting || signal.remainingSeconds <= 0}
                  className="flex-1 py-2.5 rounded-md bg-accent hover:bg-[#d4f885] text-text-inverse text-xs font-bold transition-all shadow-[0_2px_14px_rgba(198,243,106,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing Two-Leg Swap...</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>Execute Copy (${numAmount.toFixed(2)} USDC)</span>
                    </>
                  )}
                </button>
              )}
            </div>

          </form>
        )}

      </div>
    </div>
  )
}


