import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import WorldIDButton from '@/components/WorldIDButton'
import { ShieldCheck, Fingerprint, Lock, Cpu, EyeOff, KeyRound, Check, Zap, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function LandingPage() {
  const { login } = useAuth()

  const handleVerified = (token: string, user: object) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    login(token, user as any)
  }

  const guarantees = [
    {
      icon: ShieldCheck,
      title: 'Zero-Knowledge Proofs',
      desc: 'Mathematically prove your humanness without disclosing names, biometric templates, or emails. The server only sees a unique nullifier hash.',
      tag: 'zk-SNARK',
    },
    {
      icon: Fingerprint,
      title: 'Strict Sybil Resistance',
      desc: 'One human, one account. Eliminates automated bot farms and multi-account manipulation while preserving total anonymity.',
      tag: '1 Human = 1 Seat',
    },
    {
      icon: EyeOff,
      title: 'Zero Cross-App Tracking',
      desc: 'Nullifier hashes are deterministically salted per application. No entity can correlate your activity across different web services.',
      tag: 'Unlinkable',
    },
    {
      icon: Lock,
      title: 'Hardware Enclave Security',
      desc: 'Private keys remain protected within your device secure element. No credentials travel across the wire or sit in vulnerable databases.',
      tag: 'Self-Sovereign',
    },
  ]

  const comparisonRows = [
    {
      feature: 'Personal Data Required',
      traditional: 'Email, phone, passport, or credit card',
      worldId: 'Zero personal data (Zero-Knowledge)',
    },
    {
      feature: 'Bot & Sybil Prevention',
      traditional: 'Vulnerable to CAPTCHAs, proxies, & farms',
      worldId: 'Mathematically guaranteed unique human',
    },
    {
      feature: 'Cross-Site Tracking',
      traditional: 'Tracked via cookies, OAuth IDs, IP addresses',
      worldId: 'Unlinkable deterministic nullifier hashes',
    },
    {
      feature: 'Credential Leak Risk',
      traditional: 'Centralized database breaches expose millions',
      worldId: 'Keys stay inside local device hardware enclave',
    },
  ]

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      {/* Top Brand Bar */}
      <header className="border-b border-border/80 bg-bg/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-accent flex items-center justify-center shadow-[0_0_16px_rgba(198,243,106,0.2)]">
              <ShieldCheck className="w-4 h-4 text-text-inverse stroke-[2.2]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight">WorldAuth</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-pill bg-accent-soft text-accent border border-accent/20">
                Protocol
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/flash-trade">
              <Button size="sm" className="h-8 px-3 text-xs gap-1.5 shadow-[0_0_12px_rgba(198,243,106,0.25)]">
                <Zap className="w-3.5 h-3.5 fill-text-inverse" />
                Flash Trade Demo
              </Button>
            </Link>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-pill bg-surface border border-border text-xs text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-semantic-success shadow-[0_0_8px_rgba(121,217,154,0.6)]" />
              <span>World ID 4.0 Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-pill bg-accent-soft border border-accent/25 text-xs font-semibold text-accent mb-6 animate-fadeIn">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Proof of Personhood for the Private Web</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-text-primary leading-[1.12] mb-6 animate-slideUp">
            Human verification without <br />
            <span className="text-accent underline decoration-accent/30 underline-offset-8">
              digital surveillance.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed mb-10">
            Authenticate seamlessly using zero-knowledge proofs. Prove you are a unique, living human
            without revealing your real-world identity, email, or credentials to anyone.
          </p>

          {/* CTA with WorldIDButton and Flash Trade link */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
              <WorldIDButton onVerified={handleVerified} size="lg" />
              <Link to="/flash-trade">
                <Button variant="secondary" size="lg" className="border-accent/40 text-accent hover:border-accent gap-2 h-[52px]">
                  <Zap className="w-4 h-4 fill-accent" />
                  Flash Trade Demo (No Login)
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-6 text-xs text-text-muted mt-2">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-accent" /> Sybil resistant
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-accent" /> Zero personal data
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-accent" /> Self-sovereign
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Architectural Guarantees Grid */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <div className="meta-label mb-2">Cryptographic Foundations</div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary">
                Built for privacy, engineered for trust.
              </h2>
            </div>
            <p className="text-sm text-text-secondary max-w-md">
              Every authentication exchange adheres to strict non-custodial cryptographic guarantees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {guarantees.map((g) => {
              const Icon = g.icon
              return (
                <div
                  key={g.title}
                  className="surface p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-sm bg-surface-raised border border-border flex items-center justify-center mb-5 text-accent">
                      <Icon className="w-5 h-5 stroke-[1.8]" />
                    </div>
                    <div className="text-xs font-semibold text-accent mb-1 tracking-wide uppercase">
                      {g.tag}
                    </div>
                    <h3 className="text-base font-bold text-text-primary mb-2">
                      {g.title}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {g.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Comparison: Traditional vs World ID */}
      <section className="py-16 px-6 border-t border-border bg-surface/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="meta-label mb-2">Architectural Paradigm</div>
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              Why Zero-Knowledge Proofs Change Everything
            </h2>
          </div>

          <div className="border border-border rounded-lg overflow-hidden bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-raised">
                    <th className="p-4 font-semibold text-text-muted uppercase tracking-wider">Dimension</th>
                    <th className="p-4 font-semibold text-text-muted uppercase tracking-wider">Traditional Auth (OAuth / Passwords)</th>
                    <th className="p-4 font-semibold text-accent uppercase tracking-wider">World ID Protocol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparisonRows.map((row) => (
                    <tr key={row.feature} className="hover:bg-surface-raised/40 transition-colors">
                      <td className="p-4 font-medium text-text-primary">{row.feature}</td>
                      <td className="p-4 text-text-muted">{row.traditional}</td>
                      <td className="p-4 text-text-primary font-semibold flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                        {row.worldId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-8 px-6 text-xs text-text-muted">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>WorldAuth — Open Zero-Knowledge Identity Protocol</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Inter font system</span>
            <span>•</span>
            <span>Tabular numerals</span>
            <span>•</span>
            <span>Strict UI Guidelines</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
