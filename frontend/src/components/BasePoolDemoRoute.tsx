import { ArrowRight, ShieldCheck, Flame, Zap } from 'lucide-react'

export default function BasePoolDemoRoute({ amount, asset = 'USDC', burner, active = false }: { amount: string; asset?: string; burner: string; active?: boolean }) {
  return <section aria-label="Prototype funding route" className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-text-primary">Pool-to-burner workflow</h3>
      <span className="text-[10px] font-bold uppercase rounded border border-accent/30 px-2 py-0.5 text-accent">Prototype</span>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="rounded border border-border bg-surface p-2 flex-1 min-w-28"><ShieldCheck className="w-4 h-4 text-accent mb-1" /><p className="font-semibold">Pool interface</p><p className="text-text-muted">Funding route preview</p></div>
      <ArrowRight className={`w-4 h-4 text-accent ${active ? 'animate-pulse' : ''}`} />
      <div className="rounded border border-border bg-surface p-2 flex-1 min-w-28"><Flame className="w-4 h-4 text-accent mb-1" /><p className="font-semibold">Fresh local burner</p><p className="mono break-all text-text-muted">{burner.slice(0, 8)}…{burner.slice(-6)}</p></div>
      <ArrowRight className={`w-4 h-4 text-accent ${active ? 'animate-pulse' : ''}`} />
      <div className="rounded border border-border bg-surface p-2 flex-1 min-w-28"><Zap className="w-4 h-4 text-accent mb-1" /><p className="font-semibold">Pimlico → Definitive</p><p className="text-text-muted">Live preparation & execution</p></div>
    </div>
    <p className="text-xs text-text-secondary">Route budget: <strong>{amount || '0.00'} {asset}</strong> plus burner gas.</p>
    <details className="text-[11px] text-text-muted">
      <summary className="cursor-pointer">Demo funding details</summary>
      <p className="mt-2">The pool interface previews the intended shielded architecture. On Base, MetaMask supplies real funds directly to the burner. Private deposits, withdrawal proofs and shielded balances are not implemented in this mode. Pimlico preparation and Definitive execution are live.</p>
    </details>
  </section>
}
