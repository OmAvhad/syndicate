import { useSignals, TradeSignalItem } from '@/context/SignalContext'
import CopyTradeModal from './CopyTradeModal'
import {
  TrendingUp,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Radio,
  Database,
} from 'lucide-react'

export default function TradeSignalBanner() {
  const { signals, selectedSignal, openCopyModal, closeCopyModal, dismissSignal } = useSignals()

  if (signals.length === 0 && !selectedSignal) {
    return null
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <>
      {/* Floating Signal Notifications Stack (bottom right) */}
      <div className="fixed bottom-6 right-6 z-40 max-w-sm w-full space-y-3 pointer-events-none">
        {signals.map((sig: TradeSignalItem) => {
          const isBuy = sig.side === 'BUY' || sig.side === 'LONG'

          return (
            <div
              key={sig.signalId}
              className="pointer-events-auto surface p-4 rounded-xl border border-accent/40 bg-surface/95 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.6)] animate-slideUp transition-all"
            >
              {/* Top Banner Row */}
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-accent flex items-center gap-1">
                    <Radio className="w-3 h-3 text-accent" />
                    Incoming Trade Signal
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-accent mono tnum">
                    <Clock className="w-3 h-3 text-accent" />
                    <span>{formatTimer(sig.remainingSeconds)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissSignal(sig.signalId)}
                    className="text-text-muted hover:text-text-primary p-0.5"
                    title="Dismiss notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs font-semibold text-text-muted">
                    Leader <span className="text-text-primary">@{sig.leaderUsername}</span>
                  </div>
                  <div className="text-sm font-extrabold text-text-primary flex items-center gap-1.5 mt-0.5">
                    <span>{sig.symbol}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 ${
                        isBuy ? 'bg-semantic-success/20 text-semantic-success' : 'bg-semantic-danger/20 text-semantic-danger'
                      }`}
                    >
                      {isBuy ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                      {sig.side}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] uppercase font-semibold text-text-muted">Entry Price</div>
                  <div className="mono tnum text-xs font-bold text-text-primary">${sig.limit}</div>
                </div>
              </div>

              {/* Targets & Action */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/80">
                <div className="flex items-center gap-3 text-[11px] text-text-secondary">
                  <span>TP: <strong className="text-semantic-success mono tnum">${sig.target}</strong></span>
                  <span>SL: <strong className="text-semantic-danger mono tnum">${sig.stopLoss}</strong></span>
                </div>

                <button
                  type="button"
                  onClick={() => openCopyModal(sig)}
                  className="py-1.5 px-3 rounded-md bg-accent text-text-inverse font-bold text-xs hover:bg-[#d4f885] transition-all flex items-center gap-1 cursor-pointer shadow-[0_2px_10px_rgba(198,243,106,0.2)]"
                >
                  <TrendingUp className="w-3 h-3 stroke-[2.2]" />
                  <span>Copy Trade</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Copy Modal */}
      {selectedSignal && (
        <CopyTradeModal signal={selectedSignal} onClose={closeCopyModal} />
      )}
    </>
  )
}

