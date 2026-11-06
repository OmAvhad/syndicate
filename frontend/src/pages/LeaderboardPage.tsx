import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { truncateHash } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import WalletConnectButton from '@/components/WalletConnectButton'
import { parseEther } from 'viem'
import { ensureBaseSepoliaNetwork, getBaseScanTxUrl } from '@/lib/network'
import {
  Trophy,
  TrendingUp,
  ShieldCheck,
  Users,
  Award,
  Filter,
  ArrowUpDown,
  Search,
  ExternalLink,
  Loader2,
  Check,
  UserCheck,
  UserPlus,
  Radio,
  Zap,
  Sparkles,
  BarChart3,
  Calendar,
  AlertCircle,
} from 'lucide-react'

interface LeaderboardUser {
  rank: number
  tier: 'DIAMOND' | 'GOLD' | 'SILVER' | 'BRONZE'
  id: string
  nullifierHash: string
  username: string
  walletAddress: string | null
  bio: string | null
  subscriptionFee: number
  riskLevel: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' | 'DEGEN'
  tradingStyle: string
  tags: string[]
  subscribersCount: number
  followersCount: number
  stats: {
    totalPnlUsdc: number
    winRate: number
    totalTrades: number
    winningTrades: number
    profitFactor: number
    verifiedClaimsCount: number
  }
  isSubscribed: boolean
  isFollowing: boolean
  isSelf: boolean
}

const RISK_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  CONSERVATIVE: {
    label: 'Conservative',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  MODERATE: {
    label: 'Moderate',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  AGGRESSIVE: {
    label: 'Aggressive',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  DEGEN: {
    label: 'Degen Alpha',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Sorting
  const [sortBy, setSortBy] = useState<'pnl' | 'winRate' | 'subscribers' | 'trades' | 'claims'>('pnl')
  const [riskFilter, setRiskFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Subscribing modal/action state
  const [subscribingLeader, setSubscribingLeader] = useState<LeaderboardUser | null>(null)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [subSuccess, setSubSuccess] = useState<string | null>(null)
  const [subTxHash, setSubTxHash] = useState<string | null>(null)

  // Follow action in-flight tracker
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({})

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params: Record<string, string> = { sort: sortBy }
      if (riskFilter !== 'ALL') {
        params.riskLevel = riskFilter
      }
      const res = await api.get('/leaderboard', { params })
      if (res.data?.success) {
        setLeaders(res.data.leaderboard || [])
      }
    } catch (err: any) {
      console.error('Failed to load leaderboard:', err)
      setError(err.response?.data?.error || 'Failed to load leader rankings')
    } finally {
      setLoading(false)
    }
  }, [sortBy, riskFilter])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // 1-Click Free Social Follow toggle
  const handleToggleSocialFollow = async (leader: LeaderboardUser) => {
    const leaderId = leader.id
    try {
      setFollowLoading((prev) => ({ ...prev, [leaderId]: true }))
      if (leader.isFollowing) {
        // Unfollow
        await api.delete(`/social/unfollow/${leaderId}`)
        setLeaders((prev) =>
          prev.map((l) =>
            l.id === leaderId
              ? { ...l, isFollowing: false, followersCount: Math.max(0, l.followersCount - 1) }
              : l
          )
        )
      } else {
        // Follow
        await api.post(`/social/follow/${leaderId}`)
        setLeaders((prev) =>
          prev.map((l) =>
            l.id === leaderId ? { ...l, isFollowing: true, followersCount: l.followersCount + 1 } : l
          )
        )
      }
    } catch (err: any) {
      console.error('Failed to toggle follow:', err)
    } finally {
      setFollowLoading((prev) => ({ ...prev, [leaderId]: false }))
    }
  }

  // Paid Subscription execution on Base Sepolia
  const handleExecuteSubscription = async () => {
    if (!subscribingLeader) return
    setIsSubscribing(true)
    setError(null)
    setSubSuccess(null)
    setSubTxHash(null)

    try {
      if (!window.ethereum) throw new Error('MetaMask not detected.')
      await ensureBaseSepoliaNetwork()
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[]
      const fromAddress = accounts[0]
      const toAddress = subscribingLeader.walletAddress
      if (!toAddress) throw new Error('Leader has not configured a payout wallet.')

      const feeEth = subscribingLeader.subscriptionFee || 0.001
      const valueHex = '0x' + parseEther(feeEth.toString()).toString(16)

      const txHash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: fromAddress, to: toAddress, value: valueHex }],
      })) as string

      setSubTxHash(txHash)

      const res = await api.post('/follow', {
        leaderId: subscribingLeader.id,
        transactionId: txHash,
      })

      if (res.data?.success) {
        setSubSuccess(`Subscribed to ${subscribingLeader.username}! 30-day signal key anchored on Arkiv.`)
        setLeaders((prev) =>
          prev.map((l) =>
            l.id === subscribingLeader.id
              ? { ...l, isSubscribed: true, subscribersCount: l.subscribersCount + 1 }
              : l
          )
        )
      }
    } catch (err: any) {
      console.error('Subscription error:', err)
      setError(err.message || 'Subscription payment failed')
    } finally {
      setIsSubscribing(false)
    }
  }

  // Filtered leaders by search query
  const displayedLeaders = leaders.filter((l) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      l.username.toLowerCase().includes(q) ||
      l.nullifierHash.toLowerCase().includes(q) ||
      (l.tags && l.tags.some((t) => t.toLowerCase().includes(q))) ||
      (l.bio && l.bio.toLowerCase().includes(q))
    )
  })

  return (
    <div className="flex-1 w-full bg-bg py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-accent-soft text-accent border border-accent/30">
                <Trophy className="w-5 h-5 fill-current" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                Leaderboard & Alpha Rankings
              </h1>
            </div>
            <p className="text-sm text-text-secondary">
              Ranked by verified onchain trading receipts and cryptographic Arkiv commitments. Zero fabricated track records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/explore">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Search className="w-3.5 h-3.5" />
                Explore Discovery
              </Button>
            </Link>
            <Link to="/trade">
              <Button size="sm" className="gap-1.5 text-xs bg-accent text-text-inverse font-semibold">
                <TrendingUp className="w-3.5 h-3.5" />
                Trade as Leader
              </Button>
            </Link>
          </div>
        </div>

        {/* Global Stats Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-surface border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider">Top Performer PnL</span>
              <div className="text-xl font-bold text-semantic-success mono">
                {leaders.length > 0 ? `+$${Math.max(...leaders.map((l) => l.stats?.totalPnlUsdc || 0)).toFixed(2)}` : '$0.00'}
              </div>
              <p className="text-[11px] text-text-secondary">Highest realized USDC returns</p>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider">Top Win Rate</span>
              <div className="text-xl font-bold text-accent mono">
                {leaders.length > 0 ? `${Math.max(...leaders.map((l) => l.stats?.winRate || 0)).toFixed(1)}%` : '0%'}
              </div>
              <p className="text-[11px] text-text-secondary">Verified bracket exits</p>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider">Active Copy Subscribers</span>
              <div className="text-xl font-bold text-text-primary mono">
                {leaders.reduce((sum, l) => sum + (l.subscribersCount || 0), 0)}
              </div>
              <p className="text-[11px] text-text-secondary">30-day epoch on Arkiv</p>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider">Audited Proofs</span>
              <div className="text-xl font-bold text-purple-400 mono">
                {leaders.reduce((sum, l) => sum + (l.stats?.verifiedClaimsCount || 0), 0)}
              </div>
              <p className="text-[11px] text-text-secondary">trade_result_claims on Rabdi</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-raised p-4 rounded-xl border border-border">
          {/* Risk Level Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-text-muted font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Risk:
            </span>
            {['ALL', 'CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'DEGEN'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRiskFilter(r)}
                className={`text-xs px-2.5 py-1 rounded-pill font-medium transition-colors ${
                  riskFilter === r
                    ? 'bg-accent text-text-inverse font-semibold shadow-sm'
                    : 'bg-surface text-text-secondary hover:text-text-primary border border-border'
                }`}
              >
                {r === 'ALL' ? 'All Tiers' : r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Sort Selector & Search Input */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search trader, tag, address..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent w-48 md:w-56"
              />
            </div>

            <div className="flex items-center gap-1 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-surface border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent"
              >
                <option value="pnl">Rank by: Realized PnL ($)</option>
                <option value="winRate">Rank by: Win Rate (%)</option>
                <option value="subscribers">Rank by: Subscribers</option>
                <option value="trades">Rank by: Total Trades</option>
                <option value="claims">Rank by: Arkiv Verified Claims</option>
              </select>
            </div>
          </div>
        </div>

        {/* Leaderboard Table / Cards */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-sm text-text-secondary">Loading leader performance metrics...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl bg-semantic-error/10 border border-semantic-error/30 text-semantic-error text-center space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto" />
            <p className="text-sm font-semibold">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchLeaderboard} className="text-xs">
              Retry
            </Button>
          </div>
        ) : displayedLeaders.length === 0 ? (
          <div className="py-16 text-center bg-surface rounded-xl border border-border p-8 space-y-3">
            <Users className="w-10 h-10 text-text-muted mx-auto" />
            <p className="text-base font-semibold text-text-primary">No leaders match this filter criteria</p>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Try resetting the risk level or search keyword to see all active ranked traders.
            </p>
            <Button size="sm" variant="outline" onClick={() => { setRiskFilter('ALL'); setSearchQuery(''); }}>
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedLeaders.map((leader) => {
              const riskMeta = RISK_BADGES[leader.riskLevel] || RISK_BADGES.MODERATE
              const isProfit = (leader.stats?.totalPnlUsdc || 0) >= 0

              return (
                <div
                  key={leader.id}
                  className="bg-surface rounded-xl border border-border p-4 hover:border-border-hover transition-all duration-fast flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: Rank & Profile Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Rank Badge */}
                    <div className="flex flex-col items-center justify-center min-w-[2.5rem]">
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          leader.rank === 1
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-[0_0_10px_rgba(251,191,36,0.25)]'
                            : leader.rank === 2
                            ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
                            : leader.rank === 3
                            ? 'bg-amber-700/20 text-amber-400 border border-amber-700/40'
                            : 'bg-surface-raised text-text-muted border border-border'
                        }`}
                      >
                        #{leader.rank}
                      </span>
                      <span className="text-[10px] text-text-muted mt-0.5 uppercase tracking-wider font-semibold">
                        {leader.tier}
                      </span>
                    </div>

                    {/* Trader Info */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-text-primary hover:text-accent transition-colors">
                          {leader.username}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-semantic-success/10 text-semantic-success border border-semantic-success/20">
                          <ShieldCheck className="w-3 h-3" /> Human
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${riskMeta.bg} ${riskMeta.text} ${riskMeta.border}`}>
                          {riskMeta.label}
                        </span>
                        {leader.tradingStyle && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-raised text-text-muted border border-border font-medium">
                            {leader.tradingStyle}
                          </span>
                        )}
                      </div>

                      {leader.bio && (
                        <p className="text-xs text-text-secondary line-clamp-1 max-w-xl">
                          {leader.bio}
                        </p>
                      )}

                      {/* Tags */}
                      {leader.tags && leader.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {leader.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] px-1.5 py-0.2 rounded bg-surface-raised text-text-muted font-mono"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Performance Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-2 py-2 lg:py-0 border-y lg:border-y-0 lg:border-x border-border/60">
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-medium block">Realized PnL</span>
                      <span className={`text-sm font-bold mono ${isProfit ? 'text-semantic-success' : 'text-semantic-error'}`}>
                        {isProfit ? '+' : ''}${leader.stats?.totalPnlUsdc?.toFixed(2) || '0.00'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-medium block">Win Rate</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold mono text-text-primary">
                          {leader.stats?.winRate?.toFixed(1) || '0.0'}%
                        </span>
                        <span className="text-[10px] text-text-muted">
                          ({leader.stats?.winningTrades || 0}/{leader.stats?.totalTrades || 0})
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-medium block">Arkiv Proofs</span>
                      <span className="text-sm font-bold mono text-purple-400 flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        {leader.stats?.verifiedClaimsCount || 0}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-medium block">Subscribers</span>
                      <span className="text-sm font-bold mono text-text-primary flex items-center gap-1">
                        <Users className="w-3 h-3 text-text-muted" />
                        {leader.subscribersCount || 0}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions (Follow & Subscribe) */}
                  <div className="flex items-center gap-2 flex-shrink-0 justify-end">
                    {leader.isSelf ? (
                      <Badge variant="muted" className="text-xs text-text-muted">
                        You
                      </Badge>
                    ) : (
                      <>
                        {/* Free 1-Click Social Follow */}
                        <Button
                          size="sm"
                          variant={leader.isFollowing ? 'secondary' : 'outline'}
                          onClick={() => handleToggleSocialFollow(leader)}
                          disabled={followLoading[leader.id]}
                          className="text-xs gap-1.5"
                        >
                          {followLoading[leader.id] ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : leader.isFollowing ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-accent" />
                              Following
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5" />
                              Follow
                            </>
                          )}
                        </Button>

                        {/* Paid Copy-Trading Subscription */}
                        {leader.isSubscribed ? (
                          <Badge variant="success" className="text-xs py-1.5 px-3 gap-1">
                            <Check className="w-3.5 h-3.5" /> Subscribed
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSubscribingLeader(leader)
                              setError(null)
                              setSubSuccess(null)
                              setSubTxHash(null)
                            }}
                            className="text-xs bg-accent text-text-inverse font-semibold hover:bg-accent/90 shadow-sm gap-1.5"
                          >
                            <Zap className="w-3 h-3 fill-current" />
                            Subscribe to Copy
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Subscription Modal */}
        {subscribingLeader && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 space-y-5 shadow-2xl relative">
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Zap className="w-5 h-5 text-accent fill-current" />
                    Subscribe to {subscribingLeader.username}
                  </h3>
                  <p className="text-xs text-text-secondary">
                    Unlock real-time encrypted trade signals & automated copy trading.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubscribingLeader(null)}
                  className="text-text-muted hover:text-text-primary text-xl font-bold p-1"
                >
                  ×
                </button>
              </div>

              {/* Leader Snapshot Card */}
              <div className="bg-surface-raised p-3.5 rounded-xl border border-border space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Trader:</span>
                  <span className="font-semibold text-text-primary">{subscribingLeader.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Win Rate:</span>
                  <span className="font-semibold text-semantic-success">{subscribingLeader.stats?.winRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">30-Day Subscription Fee:</span>
                  <span className="font-bold text-accent mono text-sm">{subscribingLeader.subscriptionFee || 0.001} ETH</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Network:</span>
                  <span className="font-semibold text-text-primary">Base Sepolia L2 (Fast & Low Gas)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Data Anchoring:</span>
                  <span className="font-semibold text-purple-400">Arkiv Rabdi (30-day epoch TTL)</span>
                </div>
              </div>

              {subSuccess ? (
                <div className="p-4 rounded-xl bg-semantic-success/10 border border-semantic-success/30 text-semantic-success space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Check className="w-4 h-4" /> {subSuccess}
                  </div>
                  {subTxHash && (
                    <a
                      href={getBaseScanTxUrl(subTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline flex items-center gap-1"
                    >
                      View BaseScan Transaction <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <Button
                    size="sm"
                    className="w-full mt-2 text-xs bg-semantic-success text-text-inverse font-bold"
                    onClick={() => setSubscribingLeader(null)}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="p-3 rounded-lg bg-semantic-error/10 border border-semantic-error/30 text-semantic-error text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button
                      onClick={handleExecuteSubscription}
                      disabled={isSubscribing}
                      className="w-full py-2.5 bg-accent text-text-inverse font-bold text-sm shadow-md gap-2"
                    >
                      {isSubscribing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Broadcasting to Base Sepolia & Arkiv...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 fill-current" />
                          Confirm & Pay {subscribingLeader.subscriptionFee || 0.001} ETH
                        </>
                      )}
                    </Button>
                    <p className="text-[11px] text-text-muted text-center">
                      Payment directly transfers to the leader's wallet. Arkiv records your membership entity with an automatic 30-day TTL.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
