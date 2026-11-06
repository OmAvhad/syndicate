import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDate, truncateHash } from '@/lib/utils'
import { Link } from 'react-router-dom'
import WalletConnectButton from '@/components/WalletConnectButton'
import ShieldedPoolCard from '@/components/ShieldedPoolCard'
import { getBaseScanAddressUrl } from '@/lib/network'
import {
  Users,
  Compass,
  Calendar,
  ShieldCheck,
  User,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Wallet,
  Coins,
  Database,
  ArrowRight,
  TrendingUp,
  Radio,
} from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const [copiedNullifier, setCopiedNullifier] = useState(false)
  const [copiedWallet, setCopiedWallet] = useState(false)
  const [followingList, setFollowingList] = useState<any[]>([])
  const [followersList, setFollowersList] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      api.get('/api/following').catch(() => ({ data: { following: [] } })),
      api.get('/api/followers').catch(() => ({ data: { followers: [] } })),
    ]).then(([followingRes, followersRes]) => {
      if (followingRes.data?.success) setFollowingList(followingRes.data.following || [])
      if (followersRes.data?.success) setFollowersList(followersRes.data.followers || [])
    })
  }, [])

  const identifier = user?.username ? `@${user.username}` : 'Verified Human'

  const handleCopyNullifier = () => {
    if (user?.nullifierHash) {
      navigator.clipboard.writeText(user.nullifierHash)
      setCopiedNullifier(true)
      setTimeout(() => setCopiedNullifier(false), 2000)
    }
  }

  const handleCopyWallet = () => {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress)
      setCopiedWallet(true)
      setTimeout(() => setCopiedWallet(false), 2000)
    }
  }

  // Dashboard Stats with Follower & Following Counts stored in MongoDB
  const stats = [
    {
      label: 'Followers',
      value: user?.followersCount ?? 0,
      icon: Users,
      sub: 'Verified humans following you',
      highlight: true,
    },
    {
      label: 'Following',
      value: user?.followingCount ?? 0,
      icon: Compass,
      sub: 'Leaders anchored on Arkiv',
      highlight: true,
    },
    {
      label: 'Your Fee',
      value: `${user?.subscriptionFee ?? 0.001} ETH`,
      icon: Coins,
      sub: 'Per 30-day subscription',
      highlight: false,
    },
    {
      label: 'Member Since',
      value: formatDate(user?.createdAt),
      icon: Calendar,
      sub: 'First verified proof date',
      highlight: false,
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
                {(user?.username || truncateHash(user?.nullifierHash))[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
                    {identifier}
                  </h1>
                  <Badge variant="success">
                    <ShieldCheck className="w-3 h-3 stroke-[2.2]" />
                    World ID Verified
                  </Badge>
                  {user?.walletAddress ? (
                    <Badge variant="accent">
                      <Wallet className="w-3 h-3 stroke-[2]" />
                      MetaMask Linked
                    </Badge>
                  ) : (
                    <Badge variant="muted">
                      No Wallet Linked
                    </Badge>
                  )}
                  <Badge variant="info">
                    <Database className="w-3 h-3 stroke-[2]" />
                    Arkiv TTL 30d
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                  <span>Nullifier:</span>
                  <button
                    onClick={handleCopyNullifier}
                    className="copy-chip inline-flex items-center gap-1.5"
                    title="Click to copy full nullifier hash"
                  >
                    <span className="mono tnum">{truncateHash(user?.nullifierHash, 12)}</span>
                    {copiedNullifier ? (
                      <Check className="w-3 h-3 text-semantic-success" />
                    ) : (
                      <Copy className="w-3 h-3 text-text-muted group-hover:text-accent" />
                    )}
                  </button>
                  {copiedNullifier && (
                    <span className="text-semantic-success text-[11px] font-semibold animate-fadeIn">
                      Copied!
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                to="/trade"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-text-inverse text-xs font-bold hover:bg-[#d4f885] transition-all shadow-[0_2px_12px_rgba(198,243,106,0.18)]"
              >
                <TrendingUp className="w-3.5 h-3.5 stroke-[2.2]" />
                Trade Terminal
              </Link>
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-surface-raised hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-colors duration-fast"
              >
                <Compass className="w-3.5 h-3.5 stroke-[2.2]" />
                Explore Leaders
              </Link>
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-surface-raised hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-colors duration-fast"
              >
                <User className="w-3.5 h-3.5" />
                Settings
              </Link>
            </div>
          </div>

          {/* Stats Strip with Tabular Numerals (Followers, Following, Fee, Date) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-border">
            {stats.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.label} className="bg-surface-raised border border-border rounded-md p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="meta-label">{s.label}</span>
                      <Icon className="w-4 h-4 text-accent" />
                    </div>
                    <div
                      className={`text-2xl font-bold tnum mb-1 ${
                        s.highlight ? 'text-accent' : 'text-text-primary'
                      }`}
                    >
                      {s.value}
                    </div>
                    <div className="text-[11px] text-text-muted">{s.sub}</div>
                  </div>

                  {/* Followers Card: If count < 3 and > 0, list account numbers directly in same card */}
                  {s.label === 'Followers' && followersList.length > 0 && followersList.length < 3 && (
                    <div className="mt-3 pt-2.5 border-t border-border/80 space-y-1.5 animate-fadeIn">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
                        <span>Account Number(s):</span>
                        <span className="text-accent">{followersList.length} human</span>
                      </div>
                      {followersList.map((f, idx) => {
                        const addr = f.followerPublicKey || f.followerId?.walletAddress
                        const handle = f.followerId?.username ? `@${f.followerId.username}` : `Human #${idx + 1}`
                        return (
                          <div key={f._id} className="p-1.5 rounded bg-surface border border-border text-[11px] space-y-0.5">
                            <div className="font-bold text-text-primary text-[10px] truncate">{handle}</div>
                            {addr ? (
                              <div className="flex items-center justify-between gap-1">
                                <span className="mono tnum text-accent font-bold text-[10px] truncate select-all">{truncateHash(addr, 6)}</span>
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard.writeText(addr)}
                                  className="text-[9px] px-1 py-0.2 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary cursor-pointer border border-border shrink-0"
                                  title="Copy address"
                                >
                                  Copy
                                </button>
                              </div>
                            ) : (
                              <span className="text-[9px] text-text-muted">No wallet linked</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Following Card: If count < 3 and > 0, list account numbers directly in same card */}
                  {s.label === 'Following' && followingList.length > 0 && followingList.length < 3 && (
                    <div className="mt-3 pt-2.5 border-t border-border/80 space-y-1.5 animate-fadeIn">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
                        <span>Account Number(s):</span>
                        <span className="text-accent">{followingList.length} leader</span>
                      </div>
                      {followingList.map((f, idx) => {
                        const addr = f.leaderPublicKey || f.leaderId?.walletAddress
                        const handle = f.leaderId?.username ? `@${f.leaderId.username}` : `Leader #${idx + 1}`
                        return (
                          <div key={f._id} className="p-1.5 rounded bg-surface border border-border text-[11px] space-y-0.5">
                            <div className="font-bold text-text-primary text-[10px] truncate">{handle}</div>
                            {addr ? (
                              <div className="flex items-center justify-between gap-1">
                                <span className="mono tnum text-accent font-bold text-[10px] truncate select-all">{truncateHash(addr, 6)}</span>
                                <button
                                  type="button"
                                  onClick={() => navigator.clipboard.writeText(addr)}
                                  className="text-[9px] px-1 py-0.2 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary cursor-pointer border border-border shrink-0"
                                  title="Copy address"
                                >
                                  Copy
                                </button>
                              </div>
                            ) : (
                              <span className="text-[9px] text-text-muted">No wallet linked</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {user && <ShieldedPoolCard key={`${user.id}:${user.walletAddress || ''}`} userId={user.id} walletAddress={user.walletAddress} />}

        {/* Two-Column Information Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Explore & Arkiv Follower Ecosystem */}
          <div className="lg:col-span-2 space-y-6">

            {/* Explore Section Promo Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass className="w-5 h-5 text-accent stroke-[2]" />
                    <CardTitle>Follower Relationships & Arkiv Network</CardTitle>
                  </div>
                  <Badge variant="accent">30-Day TTL Pass</Badge>
                </div>
                <CardDescription>
                  Follow top traders by sending their subscription fee via MetaMask. Relationships are anchored in Arkiv with leader & follower nullifiers, public keys, and transaction hashes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-md bg-surface-raised border border-border space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-text-primary flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-accent" />
                        Explore & Subscribe to Leaders
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed max-w-md">
                        Browse verified World ID traders, review their past track record, and subscribe with a single on-chain transaction.
                      </p>
                    </div>

                    <Link
                      to="/explore"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-accent text-text-inverse font-bold text-xs hover:bg-[#d4f885] transition-colors shrink-0 shadow-[0_2px_12px_rgba(198,243,106,0.18)]"
                    >
                      <span>Explore Directory</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
                    </Link>
                  </div>

                  <div className="pt-3 border-t border-border/80 flex items-center justify-between text-xs text-text-muted flex-wrap gap-2">
                    <span>Your Following Count: <strong className="text-text-primary tnum">{user?.followingCount ?? 0}</strong></span>
                    <span>•</span>
                    <span>Your Followers Count: <strong className="text-text-primary tnum">{user?.followersCount ?? 0}</strong></span>
                    <span>•</span>
                    <span>Arkiv Status: <span className="text-semantic-success font-medium">Rabdi Testnet Connected</span></span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* MetaMask Wallet Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-accent stroke-[2]" />
                    <CardTitle>MetaMask Public Key</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="muted" className="text-[10px]">
                      Base Sepolia (84532)
                    </Badge>
                    {user?.walletAddress ? (
                      <Badge variant="success">Stored in Database</Badge>
                    ) : (
                      <Badge variant="warning">Action Needed</Badge>
                    )}
                  </div>
                </div>
                <CardDescription>
                  Your Ethereum public key is stored in the database to link your World ID to on-chain copy trading, fee payments on Base Sepolia, and Arkiv relationships.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user?.walletAddress ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-md bg-surface-raised border border-border">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="meta-label mb-1">Stored Public Address (0x)</div>
                          <div className="mono tnum text-sm text-text-primary font-semibold break-all">
                            {user.walletAddress}
                          </div>
                          {user.walletConnectedAt && (
                            <div className="text-[11px] text-text-muted mt-1">
                              Linked on {formatDate(user.walletConnectedAt)} • Base Sepolia Testnet
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleCopyWallet}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-surface hover:bg-surface-hover border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
                          >
                            {copiedWallet ? (
                              <Check className="w-3.5 h-3.5 text-semantic-success" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedWallet ? 'Copied' : 'Copy'}</span>
                          </button>
                          <a
                            href={getBaseScanAddressUrl(user.walletAddress)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-sm bg-surface hover:bg-surface-hover border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
                          >
                            <span>BaseScan</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <WalletConnectButton variant="card" />
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-md bg-surface-raised border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-text-primary mb-1">
                        No Ethereum wallet linked yet
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed max-w-md">
                        Connect MetaMask to save your public key in your account. You need a linked wallet to follow leaders and send subscription fees.
                      </p>
                    </div>
                    <WalletConnectButton variant="compact" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Zero-Knowledge Identity Passport */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Zero-Knowledge Identity Passport</CardTitle>
                  <Badge variant="accent">zk-Proof Active</Badge>
                </div>
                <CardDescription>
                  Your profile displays no real-world identity. Authentication is anchored via cryptographic nullifiers and unique Proof of Human.
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
                      <div className="text-xs font-semibold text-text-primary">Username Handle</div>
                      <div className="text-[11px] text-text-muted">Public alias across the platform</div>
                    </div>
                    <span className="text-xs font-semibold text-text-primary">
                      {user?.username ? `@${user.username}` : 'Not set (defaults to nullifier)'}
                    </span>
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
                </div>
              </CardContent>
            </Card>

            {/* Protocol Integrations & SyndicateCopy Demo */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>SyndicateCopy Protocol Demo</CardTitle>
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
                <CardTitle className="text-base">Arkiv & Wallet Integration</CardTitle>
                <CardDescription>
                  Specifications from spec.md active.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2.5 text-xs text-text-secondary">
                  <div className="w-4 h-4 rounded-full bg-semantic-success/20 text-semantic-success flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <strong className="text-text-primary block">30-Day TTL in Arkiv</strong>
                    Follower schema automatically expires 30 days after the payment date.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs text-text-secondary">
                  <div className="w-4 h-4 rounded-full bg-semantic-success/20 text-semantic-success flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <strong className="text-text-primary block">Subscription Fees</strong>
                    Followers pay via browser MetaMask directly to the leader's wallet.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs text-text-secondary">
                  <div className="w-4 h-4 rounded-full bg-semantic-success/20 text-semantic-success flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <strong className="text-text-primary block">Dual Count Persistence</strong>
                    Followers and following counts are updated in MongoDB on follow / unfollow.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link
                  to="/explore"
                  className="flex items-center justify-between p-3 rounded-md bg-surface-raised hover:bg-surface-hover border border-border text-xs text-text-primary transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-accent" />
                    Explore Leaders
                  </span>
                  <span className="text-text-muted">&rarr;</span>
                </Link>

                <Link
                  to="/profile"
                  className="flex items-center justify-between p-3 rounded-md bg-surface-raised hover:bg-surface-hover border border-border text-xs text-text-primary transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-accent" />
                    Set Subscription Fee
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
