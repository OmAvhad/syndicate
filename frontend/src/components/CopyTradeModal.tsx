import { useState, useEffect } from 'react'
import { useSignals, TradeSignalItem } from '@/context/SignalContext'
import { truncateHash } from '@/lib/utils'
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
  Lock,
  Unlock,
  KeyRound,
} from 'lucide-react'

interface CopyTradeModalProps {
  signal: TradeSignalItem
  onClose: () => void
}

export default function CopyTradeModal({ signal, onClose }: CopyTradeModalProps) {
  const { executeCopyTrade, decryptSignal } = useSignals()

  // Follower can adjust order amount as required in spec.md
  const [amount, setAmount] = useState(signal.amount ? String(signal.amount) : '1')
  const [isExecuting, setIsExecuting] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [executionReceipt, setExecutionReceipt] = useState<{ tradeId: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Update amount once decrypted if signal.amount was previously null
  useEffect(() => {
    if (signal.amount && amount === '1') {
      setAmount(String(signal.amount))
    }
  }, [signal.amount, amount])

  const isEncrypted = Boolean(signal.requiresMetaMaskDecrypt && !signal.isDecrypted)

  const handleDecrypt = async () => {
    setIsDecrypting(true)
    setErrorMessage(null)
    const res = await decryptSignal(signal.signalId)
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

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isEncrypted) {
      setErrorMessage('Please decrypt the signal with MetaMask before placing your trade')
      return
    }

    setIsExecuting(true)
    setErrorMessage(null)

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0')
      setIsExecuting(false)
      return
    }

    const res = await executeCopyTrade(signal.signalId, numAmount)
    setIsExecuting(false)

    if (res.success && res.tradeId) {
      setExecutionReceipt({ tradeId: res.tradeId })
    } else {
      setErrorMessage(res.error || 'Failed to execute copy trade order')
    }
  }

  const isBuy = signal.side === 'BUY' || signal.side === 'LONG'

  return (
    <div className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="surface p-6 sm:p-8 max-w-lg w-full rounded-xl border border-border-strong shadow-[0_20px_50px_rgba(0,0,0,0.7)] animate-slideUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-sm bg-accent flex items-center justify-center text-text-inverse shadow-sm">
              <TrendingUp className="w-4 h-4 stroke-[2.2]" />
            </span>
            <div>
              <h3 className="text-base font-bold text-text-primary">
                Execute Copy Trade
              </h3>
              <p className="text-[11px] text-text-muted">
                Leader Signal from <strong className="text-text-primary">@{signal.leaderUsername}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1.5 rounded-sm hover:bg-surface-raised transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {executionReceipt ? (
          /* Execution Success State */
          <div className="space-y-5 text-center py-4 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-semantic-success/20 text-semantic-success flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div>
              <h4 className="text-base font-bold text-text-primary">Copy Trade Executed!</h4>
              <p className="text-xs text-text-secondary mt-1">
                Your order for <strong className="text-text-primary">{amount} {signal.symbol}</strong> has been filled at the signal price.
              </p>
            </div>

            <div className="p-4 rounded-md bg-surface-raised border border-border text-xs text-left space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Execution Order ID</span>
                <span className="mono tnum text-text-primary font-semibold">{executionReceipt.tradeId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Status</span>
                <span className="text-semantic-success font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" />
                  FILLED
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Price</span>
                <span className="mono tnum text-accent font-semibold">${signal.limit}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-md bg-accent text-text-inverse text-xs font-bold hover:bg-[#d4f885] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* Form & Confirmation State */
          <form onSubmit={handleExecute} className="space-y-5">
            
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
            {signal.requiresMetaMaskDecrypt && (
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
                      onClick={handleDecrypt}
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
              </div>
            )}

            {/* Signal Details Summary Grid */}
            <div className="p-4 rounded-md bg-surface-raised border border-border space-y-2.5 text-xs">
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
                    ArkDB Key (10-min TTL)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="copy-chip text-[10px]"
                    title="Copy ArkDB Entity Key"
                  >
                    <span className="mono tnum">{truncateHash(signal.arkivEntityKey, 8)}</span>
                    {copied ? <Check className="w-2.5 h-2.5 text-semantic-success" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                </div>
              )}
            </div>

            {/* Custom Amount Field (per spec.md: follower can change amount) */}
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Your Order Size / Amount</span>
                <span className="text-[11px] text-accent">Adjustable for your risk</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={isEncrypted}
                className="w-full px-3.5 py-2.5 rounded-md bg-surface-raised border border-border text-text-primary text-sm mono tnum focus:border-accent focus:outline-none transition-colors disabled:opacity-50"
              />
              <p className="text-[11px] text-text-muted mt-1">
                {isEncrypted
                  ? 'Decrypt the trade signal to see the leader recommended size and set your position.'
                  : `Leader recommended size: ${signal.amount ?? 'N/A'} units. Customize as desired.`}
              </p>
            </div>

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
                className="flex-1 py-2.5 rounded-md bg-surface-raised hover:bg-surface-hover border border-border text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>

              {isEncrypted ? (
                <button
                  type="button"
                  onClick={handleDecrypt}
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
                      <span>Executing Trade...</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>Execute Copy Order</span>
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

