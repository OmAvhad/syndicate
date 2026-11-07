import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import WorldIDButton from '@/components/WorldIDButton'
import ThemeToggle from '@/components/ThemeToggle'
import { Button } from '@/components/ui/Button'
import {
  ShieldCheck,
  Fingerprint,
  Lock,
  Zap,
  ArrowRight,
  Check,
  Clock,
  Radio,
  Database,
  KeyRound,
  TrendingUp,
  AlertTriangle,
  UserCheck,
  Sparkles,
  Layers,
  ChevronRight,
  ExternalLink,
  EyeOff,
} from 'lucide-react'

export default function LandingPage() {
  const { login } = useAuth()
  const [activeStep, setActiveStep] = useState(0)

  const handleVerified = (token: string, user: object) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    login(token, user as any)
  }

  const problemCards = [
    {
      icon: AlertTriangle,
      badge: 'MEV Exploits',
      title: 'Mempool Front-Running',
      desc: 'Traditional copy trading exposes pending trade signals to public mempools, allowing bots to sandwich attack retail followers and siphon profits through slippage.',
    },
    {
      icon: Layers,
      badge: 'Sybil Manipulation',
      title: 'Bot-Farmed Leaderboards',
      desc: 'Malicious actors spin up hundreds of automated bot accounts, gamble on high leverage, curate the one lucky survivor, and dupe retail followers into paying fees.',
    },
    {
      icon: EyeOff,
      badge: 'Alpha Leakage',
      title: 'Doxxed Trade Positions',
      desc: 'Followers broadcast their copy allocations on-chain in plaintext, letting whales and predatory market makers reverse-engineer strategies and liquidate retail positions.',
    },
    {
      icon: Clock,
      badge: 'Signal Decay',
      title: 'Toxic Stale Fills',
      desc: 'Signals delayed by minutes or hours on social channels cause followers to buy local tops and sell panic bottoms without any cryptographic time-lock protection.',
    },
  ]

  const pillars = [
    {
      icon: Fingerprint,
      badge: '1 Human = 1 Seat',
      title: 'World ID ZK-SNARKs',
      desc: 'Every leader and follower must prove unique biological personhood using zero-knowledge proofs. Bot farms and multi-account sybil leaderboards are mathematically barred without collecting names, emails, or biometric templates.',
    },
    {
      icon: Database,
      badge: '10-Minute TTL',
      title: 'ArkDB Ephemeral Anchors',
      desc: 'Trade signals are anchored immutably to ArkDB (Arkiv Rabdi Testnet) with an enforced 10-minute time-to-live. Stale signals self-destruct automatically, guaranteeing followers only execute live alpha.',
    },
    {
      icon: Lock,
      badge: 'eth_decrypt',
      title: 'Asymmetric Private-Key Encryption',
      desc: 'Trade parameters (entry limit, stop loss, take profit) are encrypted using Curve25519 ECIES specifically for each follower. Only the follower holding the native MetaMask private key can decrypt the signal.',
    },
    {
      icon: KeyRound,
      badge: '/promise Commit',
      title: 'Cryptographic Trade Commitments',
      desc: 'Leaders cannot bait-and-switch. Before a signal broadcasts, the leader must submit an HMAC-SHA256 cryptographic commitment hash of their exact trade parameters to ensure strict execution fidelity.',
    },
  ]

  const protocolSteps = [
    {
      step: '01',
      title: 'Leader Executes & Commits',
      subtitle: '/promise HMAC-SHA256 Hash',
      desc: 'A verified human leader executes an order on Base Sepolia. The backend computes an immutable HMAC-SHA256 commitment hash of the order parameters before broadcast.',
    },
    {
      step: '02',
      title: 'Asymmetric Curve25519 Encryption',
      subtitle: 'x25519-xsalsa20-poly1305',
      desc: 'The trade parameters are encrypted uniquely for each verified follower using their registered MetaMask encryption public key.',
    },
    {
      step: '03',
      title: 'On-Chain ArkDB TTL Anchor',
      subtitle: '10-Minute Auto-Expiry',
      desc: 'The ciphertext entity is anchored into ArkDB Rabdi testnet with a strict 10-minute time-to-live, preventing replay attacks and front-running.',
    },
    {
      step: '04',
      title: 'Real-Time WebSocket Dispatch',
      subtitle: 'Targeted Stream',
      desc: 'Followers receive the encrypted signal in under 50ms over dedicated WebSocket channels with parameters completely locked until authorized.',
    },
    {
      step: '05',
      title: 'MetaMask Private-Key Decrypt',
      subtitle: 'window.ethereum eth_decrypt',
      desc: 'Follower clicks Decrypt. MetaMask uses their device private key to unlock the true price, target, and stop loss for non-custodial copy execution.',
    },
  ]

  const comparisonRows = [
    {
      dimension: 'Sybil Resistance',
      traditional: 'Vulnerable to bot farms, proxies & fake accounts',
      syndicate: 'Mathematical 1 Human = 1 Seat via World ID ZK-SNARK',
    },
    {
      dimension: 'Signal Privacy',
      traditional: 'Plaintext social feeds; front-runnable in mempools',
      syndicate: 'Asymmetric Curve25519 encryption (MetaMask eth_decrypt)',
    },
    {
      dimension: 'Signal Freshness',
      traditional: 'No expiration; followers trade on hours-old tops/bottoms',
      syndicate: 'ArkDB 10-minute TTL; signals auto-expire on-chain',
    },
    {
      dimension: 'Execution Commitment',
      traditional: 'No skin-in-the-game; leaders post unexecuted calls',
      syndicate: 'Cryptographic /promise HMAC commitments before broadcast',
    },
    {
      dimension: 'Custody & Risk',
      traditional: 'Centralized exchange wallets or doxxed public addresses',
      syndicate: 'Non-custodial execution with isolated burner accounts',
    },
    {
      dimension: 'Personal Identity',
      traditional: 'Full KYC (Passports, proof of address, selfie checks)',
      syndicate: 'Zero KYC: Anonymous cryptographic nullifier hashes',
    },
  ]

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col selection:bg-accent-soft selection:text-accent font-sans">
      
      {/* Top Brand Bar */}
      <header className="border-b border-border/80 bg-bg/85 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Brand Logo matching attached spec design */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center shadow-[0_0_16px_rgba(198,243,106,0.28)]">
              <ShieldCheck className="w-4 h-4 text-text-inverse stroke-[2.4]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wider uppercase text-text-primary">
                SYNDICATE
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-pill bg-accent-soft text-accent border border-accent/25">
                Shielded
              </span>
            </div>
          </div>

          {/* Right Header Navigation */}
          <div className="flex items-center gap-3">
            <Link to="/flash-trade">
              <Button size="sm" className="h-8 px-3 text-xs gap-1.5 shadow-[0_0_12px_rgba(198,243,106,0.22)]">
                <Zap className="w-3.5 h-3.5 fill-text-inverse" />
                <span className="hidden sm:inline">Quick Demo Sandbox</span>
                <span className="sm:hidden">Sandbox</span>
              </Button>
            </Link>

            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-pill bg-surface border border-border text-xs text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-semantic-success shadow-[0_0_8px_rgba(121,217,154,0.6)]" />
              <span>Base Sepolia & ArkDB</span>
            </div>

            <ThemeToggle variant="compact" />
          </div>
        </div>
      </header>

      {/* Hero Section matching user design inspiration */}
      <section className="relative pt-16 pb-20 px-6 overflow-hidden flex flex-col items-center justify-center text-center">
        
        {/* Ambient Radial Backdrop Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-accent/8 rounded-full blur-[140px] pointer-events-none -z-10" />

        <div className="max-w-3xl mx-auto flex flex-col items-center">
          
          {/* Pulsing Biometric Radar / Fingerprint Visual Centerpiece */}
          <div className="relative mb-8 group cursor-pointer">
            {/* Outer pulsating ring */}
            <div className="absolute -inset-4 rounded-full border border-accent/20 animate-ping opacity-40 duration-1000" />
            {/* Second decorative ring */}
            <div className="absolute -inset-2.5 rounded-full border border-accent/30 shadow-[0_0_30px_rgba(198,243,106,0.15)]" />
            
            {/* Center Biometric Orb */}
            <div className="w-24 h-24 rounded-full bg-surface-raised border border-border-strong flex items-center justify-center relative shadow-[inset_0_2px_12px_rgba(0,0,0,0.6),0_0_24px_rgba(198,243,106,0.25)] transition-transform duration-fast group-hover:scale-105">
              <div className="w-16 h-16 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
                <Fingerprint className="w-9 h-9 text-accent stroke-[2.2] animate-pulse" />
              </div>
            </div>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-text-primary leading-[1.12] mb-4">
            Shielded Copy Trading
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-text-secondary max-w-xl mx-auto leading-relaxed mb-8">
            Mirror top Ethereum traders with mathematical zero-knowledge privacy.
          </p>

          {/* Feature Badges (zk-SNARK, 1 Human = 1 Seat, Non-Custodial) */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mb-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface-raised border border-border text-xs font-semibold text-text-primary shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>zk-SNARK</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface-raised border border-border text-xs font-semibold text-text-primary shadow-sm">
              <UserCheck className="w-3.5 h-3.5 text-accent" />
              <span>1 Human = 1 Seat</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface-raised border border-border text-xs font-semibold text-text-primary shadow-sm">
              <Lock className="w-3.5 h-3.5 text-accent" />
              <span>Non-Custodial</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface-raised border border-border text-xs font-semibold text-text-primary shadow-sm">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>10-Min ArkDB TTL</span>
            </span>
          </div>

          {/* Primary Action Button (Verify with World ID) */}
          <div className="flex flex-col items-center gap-4 w-full max-w-md">
            <WorldIDButton
              onVerified={handleVerified}
              size="lg"
              label="Verify with World ID"
              showArrow
              className="w-full sm:w-auto h-14 text-base px-9 shadow-[0_4px_28px_rgba(198,243,106,0.3)] hover:shadow-[0_6px_36px_rgba(198,243,106,0.45)]"
            />

            {/* Quick Demo Sandbox Link */}
            <Link
              to="/flash-trade"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-accent transition-colors pt-2 group"
            >
              <Zap className="w-3.5 h-3.5 text-accent group-hover:scale-110 transition-transform" />
              <span>Quick Demo Sandbox</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </Link>

            {/* Security Guarantee Microcopy */}
            <p className="text-[11px] text-text-muted mt-2 tracking-wide">
              Zero KYC · Private keys remain in your device enclave
            </p>
          </div>

        </div>
      </section>

      {/* The Problem: Why Traditional Copy Trading Fails */}
      <section className="py-20 px-6 border-t border-border bg-surface/30">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <div className="text-[10px] uppercase font-bold tracking-widest text-semantic-danger bg-semantic-danger/10 border border-semantic-danger/25 px-2.5 py-1 rounded-pill inline-flex items-center gap-1.5 mb-3">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>The Industry Problem</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary mb-3">
              Traditional Copy Trading is Fundamentally Broken
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Crypto social trading platforms subject retail followers to toxic front-running, fake leaderboard stats, and uncommitted bait-and-switch trades.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {problemCards.map((p) => {
              const Icon = p.icon
              return (
                <div
                  key={p.title}
                  className="surface p-6 rounded-lg border border-border flex flex-col justify-between hover:border-semantic-danger/40 transition-colors"
                >
                  <div>
                    <div className="w-9 h-9 rounded-md bg-surface-raised border border-border flex items-center justify-center text-semantic-danger mb-4">
                      <Icon className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-semantic-danger mb-1">
                      {p.badge}
                    </div>
                    <h3 className="text-sm font-bold text-text-primary mb-2">
                      {p.title}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* The Solution: Syndicate's 4 Cryptographic Pillars */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <div className="text-[10px] uppercase font-bold tracking-widest text-accent bg-accent-soft border border-accent/25 px-2.5 py-1 rounded-pill inline-flex items-center gap-1.5 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>The Shielded Protocol</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary mb-3">
              Engineered with Mathematical Trust Guarantees
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Syndicate replaces centralized trust with zero-knowledge identity, asymmetric signal encryption, and auto-expiring on-chain anchors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {pillars.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="surface p-6 sm:p-7 rounded-xl border border-border hover:border-accent/50 transition-all flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-md bg-surface-raised border border-border flex items-center justify-center text-accent">
                        <Icon className="w-5 h-5 stroke-[2]" />
                      </div>
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-accent-soft text-accent border border-accent/25">
                        {item.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-text-primary mb-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works: Interactive Step-by-Step Flow */}
      <section className="py-20 px-6 border-t border-border bg-surface/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-[10px] uppercase font-bold tracking-widest text-accent bg-accent-soft border border-accent/25 px-2.5 py-1 rounded-pill inline-flex items-center gap-1.5 mb-2">
              <Radio className="w-3.5 h-3.5" />
              <span>Execution Pipeline</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
              How a Shielded Signal Reaches Your Wallet
            </h2>
          </div>

          {/* Interactive Steps List */}
          <div className="space-y-3">
            {protocolSteps.map((step, idx) => (
              <div
                key={step.step}
                onClick={() => setActiveStep(idx)}
                className={`p-5 rounded-lg border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  activeStep === idx
                    ? 'bg-surface-raised border-accent/60 shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
                    : 'surface border-border hover:border-border-strong opacity-85'
                }`}
              >
                <div className="flex items-start sm:items-center gap-4">
                  <span className="mono tnum text-sm font-extrabold text-accent shrink-0 w-8 h-8 rounded bg-surface border border-border flex items-center justify-center">
                    {step.step}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-text-primary">{step.title}</h4>
                      <span className="text-[10px] font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
                        {step.subtitle}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1 max-w-xl">
                      {step.desc}
                    </p>
                  </div>
                </div>

                <div className="sm:self-center shrink-0">
                  <span className={`text-[11px] font-bold flex items-center gap-1 ${activeStep === idx ? 'text-accent' : 'text-text-muted'}`}>
                    <span>Phase {step.step}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison: Traditional Social Trading vs Syndicate Protocol */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-[10px] uppercase font-bold tracking-widest text-text-muted bg-surface border border-border px-2.5 py-1 rounded-pill inline-flex items-center gap-1.5 mb-2">
              <Layers className="w-3.5 h-3.5" />
              <span>Protocol Benchmark</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
              Traditional Copy Trading vs. SYNDICATE
            </h2>
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-raised">
                    <th className="p-4 font-semibold text-text-muted uppercase tracking-wider">Protocol Dimension</th>
                    <th className="p-4 font-semibold text-text-muted uppercase tracking-wider">Traditional Social Trading</th>
                    <th className="p-4 font-bold text-accent uppercase tracking-wider">SYNDICATE Protocol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {comparisonRows.map((row) => (
                    <tr key={row.dimension} className="hover:bg-surface-raised/40 transition-colors">
                      <td className="p-4 font-bold text-text-primary">{row.dimension}</td>
                      <td className="p-4 text-text-muted leading-relaxed">{row.traditional}</td>
                      <td className="p-4 text-text-primary font-semibold leading-relaxed flex items-center gap-2">
                        <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <span>{row.syndicate}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Footer Section */}
      <section className="py-16 px-6 border-t border-border bg-surface-raised/40 text-center">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto text-accent">
            <Fingerprint className="w-6 h-6 stroke-[2]" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Ready to Experience Shielded Copy Trading?
          </h2>

          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Verify with World ID to claim your seat, subscribe to verified leaders on Base Sepolia, and execute private-key encrypted copy trades.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <WorldIDButton onVerified={handleVerified} size="lg" label="Verify with World ID" showArrow />
            <Link to="/flash-trade">
              <Button variant="secondary" size="lg" className="h-[52px] px-6 text-sm gap-2">
                <Zap className="w-4 h-4 text-accent" />
                <span>Quick Demo Sandbox</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="mt-auto border-t border-border py-8 px-6 text-xs text-text-muted bg-bg">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-accent flex items-center justify-center">
              <ShieldCheck className="w-3 h-3 text-text-inverse stroke-[2.4]" />
            </div>
            <span className="font-bold text-text-primary tracking-wider uppercase">SYNDICATE</span>
            <span>—</span>
            <span>Shielded Zero-Knowledge Copy Trading Protocol</span>
          </div>

          <div className="flex items-center gap-4 mono text-[11px] text-text-secondary">
            <span>Base Sepolia</span>
            <span>•</span>
            <span>ArkDB (10m TTL)</span>
            <span>•</span>
            <span>World ID ZK-SNARK</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
