import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate, truncateHash } from '@/lib/utils'
import { Link } from 'react-router-dom'
import {
  Activity,
  Calendar,
  ShieldCheck,
  Clock,
  User,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Sparkles,
} from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

  const displayName = user?.displayName || user?.username

  const handleCopyNullifier = () => {
    if (user?.nullifierHash) {
      navigator.clipboard.writeText(user.nullifierHash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const stats = [
    {
      label: 'Session Logins',
      value: user?.loginCount ?? 1,
      icon: Activity,
      sub: 'Verified authentication cycles',
    },
    {
      label: 'Member Since',
      value: formatDate(user?.createdAt),
      icon: Calendar,
      sub: 'First verified proof timestamp',
    },
    {
      label: 'Proof Level',
      value: user?.verificationLevel === 'orb' ? 'Orb Verified' : 'Device Verified',
      icon: ShieldCheck,
      sub: 'Zero-Knowledge Biometric Proof',
    },
    {
      label: 'Last Authentication',
      value: formatDate(user?.lastLogin),
      icon: Clock,
      sub: 'Cryptographically refreshed',
    },
  ]

  return (
    <div className="pt-20 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Welcome & Identity Bar */}
        <div className="surface p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-md bg-surface-raised border border-border flex items-center justify-center text-xl font-bold text-accent shadow-sm">
                {(displayName || truncateHash(user?.nullifierHash))[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
                    {displayName || 'Verified Human'}
                  </h1>
                  <Badge variant="success">
                    <ShieldCheck className="w-3 h-3 stroke-[2.2]" />
                    World ID Verified
                  </Badge>
                  <Badge variant="muted">
                    1 Human = 1 Seat
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span>Nullifier:</span>
                  <button
                    onClick={handleCopyNullifier}
                    className="copy-chip inline-flex items-center gap-1.5"
                    title="Click to copy full nullifier hash"
                  >
                    <span className="mono tnum">{truncateHash(user?.nullifierHash, 12)}</span>
                    {copied ? (
                      <Check className="w-3 h-3 text-semantic-success" />
                    ) : (
                      <Copy className="w-3 h-3 text-text-muted group-hover:text-accent" />
                    )}
                  </button>
                  {copied && (
                    <span className="text-semantic-success text-[11px] font-semibold animate-fadeIn">
                      Copied!
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-surface-raised hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-colors duration-fast"
              >
                <User className="w-3.5 h-3.5" />
                Profile Settings
              </Link>
            </div>
          </div>

          {/* Stats Strip with Tabular Numerals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-border">
            {stats.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.label} className="bg-surface-raised border border-border rounded-md p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="meta-label">{s.label}</span>
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="text-xl font-bold text-text-primary tnum mb-1">
                    {s.value}
                  </div>
                  <div className="text-[11px] text-text-muted">{s.sub}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Two-Column Information Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Cryptographic Passport Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Zero-Knowledge Identity Passport</CardTitle>
                  <Badge variant="accent">zk-Proof Active</Badge>
                </div>
                <CardDescription>
                  Your public profile displays no real-world identity or wallet addresses. Authentication is verified through cryptographic nullifiers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md bg-surface-raised border border-border gap-2">
                    <div>
                      <div className="text-xs font-semibold text-text-primary">Application Nullifier Hash</div>
                      <div className="text-[11px] text-text-muted">Unique deterministic identifier bound to this service</div>
                    </div>
                    <button
                      onClick={handleCopyNullifier}
                      className="copy-chip self-start sm:self-auto"
                    >
                      <span className="mono tnum text-xs">{truncateHash(user?.nullifierHash, 10)}</span>
                      <Copy className="w-3 h-3 text-text-muted" />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md bg-surface-raised border border-border gap-2">
                    <div>
                      <div className="text-xs font-semibold text-text-primary">Verification Authority</div>
                      <div className="text-[11px] text-text-muted">World ID Identity Protocol v4.0</div>
                    </div>
                    <span className="text-xs font-semibold text-semantic-success flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Biometric Proof Verified
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-md bg-surface-raised border border-border gap-2">
                    <div>
                      <div className="text-xs font-semibold text-text-primary">Biometric Data Storage</div>
                      <div className="text-[11px] text-text-muted">Local device hardware enclave only</div>
                    </div>
                    <span className="text-xs font-semibold text-accent flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> Non-Custodial
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Protocol Integrations & SyndicateCopy */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Integrated Syndicate Protocols</CardTitle>
                  <Badge variant="info">SyndicateCopy</Badge>
                </div>
                <CardDescription>
                  Your verified World ID anchors a single authenticated seat in zero-leak social copy trading rooms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-md bg-surface-raised border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-text-primary mb-1 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-accent" />
                      SyndicateCopy — Zero-Leak Social Trading
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      Follow professional traders without public wallet leaks or front-running bots. All signals are sealed on Arkiv and executed via Definitive Flash TWAP.
                    </p>
                  </div>
                  <a
                    href="/syndicate-demo/index.html"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-text-inverse font-bold text-xs hover:bg-[#d4f885] transition-colors shrink-0"
                  >
                    Launch Demo UI
                    <ExternalLink className="w-3.5 h-3.5 stroke-[2.2]" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Column 2: Security & Privacy Posture */}
          <div className="space-y-6">
            <Card variant="raised">
              <CardHeader>
                <CardTitle className="text-base">Privacy Assurance</CardTitle>
                <CardDescription>
                  Strict adherence to cryptographic principles.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2.5 text-xs text-text-secondary">
                  <div className="w-4 h-4 rounded-full bg-semantic-success/20 text-semantic-success flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <strong className="text-text-primary block">Zero PII Stored</strong>
                    No email addresses, phone numbers, or passwords exist in the database.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs text-text-secondary">
                  <div className="w-4 h-4 rounded-full bg-semantic-success/20 text-semantic-success flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <strong className="text-text-primary block">Sybil Attack Proof</strong>
                    A user cannot create secondary fake accounts to manipulate ratings.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs text-text-secondary">
                  <div className="w-4 h-4 rounded-full bg-semantic-success/20 text-semantic-success flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <strong className="text-text-primary block">Unlinkable Across DApps</strong>
                    Your actions here cannot be linked to your World ID activity on other sites.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identity Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link
                  to="/profile"
                  className="flex items-center justify-between p-3 rounded-md bg-surface-raised hover:bg-surface-hover border border-border text-xs text-text-primary transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4 text-accent" />
                    Update Display Profile
                  </span>
                  <span className="text-text-muted">&rarr;</span>
                </Link>

                <button
                  onClick={handleCopyNullifier}
                  className="w-full flex items-center justify-between p-3 rounded-md bg-surface-raised hover:bg-surface-hover border border-border text-xs text-text-primary transition-colors text-left"
                >
                  <span className="flex items-center gap-2">
                    <Copy className="w-4 h-4 text-text-muted" />
                    Copy Nullifier Hash
                  </span>
                  <span className="text-text-muted">&rarr;</span>
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
