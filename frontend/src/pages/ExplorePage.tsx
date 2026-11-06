import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { truncateHash } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import WalletConnectButton from '@/components/WalletConnectButton'
import { parseEther, toHex } from 'viem'
import { ensureBaseSepoliaNetwork, getBaseScanTxUrl, getBaseScanAddressUrl, getArkivExplorerUrl, getArkivDataExplorerUrl } from '@/lib/network'
import {
  Compass,
  Users,
  ShieldCheck,
  Wallet,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
  Search,
  UserCheck,
  UserPlus,
  Clock,
  AlertCircle,
  Database,
  TrendingUp,
  Radio,
  Zap,
  Tag,
  Filter,
} from 'lucide-react'

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

interface ExploreUser {
  id: string
  nullifierHash: string
  username: string | null
  walletAddress: string | null
  bio: string | null
  subscriptionFee: number
  followersCount: number
  followingCount: number
  subscribersCount?: number
  subscribedCount?: number
  riskLevel?: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' | 'DEGEN'
  tradingStyle?: string
  tags?: string[]
  stats?: {
    totalPnlUsdc?: number
    winRate?: number
    totalTrades?: number
    winningTrades?: number
    profitFactor?: number
    verifiedClaimsCount?: number
  }
  createdAt: string
  isFollowing: boolean
  isSubscribed?: boolean
  activeUntil: string | null
  arkivEntityKey: string | null
}

export interface FollowRelationshipItem {
  _id: string
  leaderId?: {
    _id: string
    username?: string
    nullifierHash: string
    walletAddress?: string
    subscriptionFee?: number
    followersCount?: number
    bio?: string
  }
  followerId?: {
    _id: string
    username?: string
    nullifierHash: string
    walletAddress?: string
    subscriptionFee?: number
    followersCount?: number
    followingCount?: number
    bio?: string
  }
  leaderPublicKey?: string
  followerPublicKey?: string
  leaderNullifier?: string
  followerNullifier?: string
  transactionId?: string
  arkivEntityKey?: string
  expiresAt?: string
  createdAt?: string
}

export default function ExplorePage() {
  const { user, refreshUser } = useAuth()
  const [users, setUsers] = useState<ExploreUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLeader, setSelectedLeader] = useState<ExploreUser | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Navigation Filter Tabs: 'all' | 'following' | 'followers'
  const [activeTab, setActiveTab] = useState<'all' | 'following' | 'followers'>('all')
  const [riskFilter, setRiskFilter] = useState<string>('ALL')
  const [followingList, setFollowingList] = useState<FollowRelationshipItem[]>([])
  const [followersList, setFollowersList] = useState<FollowRelationshipItem[]>([])
  const [loadingSocial, setLoadingSocial] = useState(false)

  // Follow & Payment Transaction Lifecycle
  const [txStep, setTxStep] = useState<'review' | 'wallet_request' | 'anchoring_arkiv' | 'success' | 'error'>('review')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [arkivEntityKey, setArkivEntityKey] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [socialLoading, setSocialLoading] = useState<Record<string, boolean>>({})

  const fetchSocialLists = useCallback(async () => {
    try {
      setLoadingSocial(true)
      const [followingRes, followersRes] = await Promise.all([
        api.get('/api/following').catch(() => ({ data: { following: [] } })),
        api.get('/api/followers').catch(() => ({ data: { followers: [] } })),
      ])
      if (followingRes.data?.success) {
        setFollowingList(followingRes.data.following || [])
      }
      if (followersRes.data?.success) {
        setFollowersList(followersRes.data.followers || [])
      }
    } catch (err) {
      console.error('Failed to fetch social lists:', err)
    } finally {
      setLoadingSocial(false)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (riskFilter !== 'ALL') {
        params.riskLevel = riskFilter
      }
      const res = await api.get('/api/explore', { params })
      if (res.data?.success) {
        setUsers(res.data.users)
      }
    } catch (err) {
      console.error('Failed to fetch explore users:', err)
    } finally {
      setLoading(false)
    }
  }, [riskFilter])

  const handleToggleSocialFollow = async (leader: ExploreUser) => {
    const leaderId = leader.id
    try {
      setSocialLoading((prev) => ({ ...prev, [leaderId]: true }))
      if (leader.isFollowing) {
        await api.delete(`/api/social/unfollow/${leaderId}`)
        setUsers((prev) =>
          prev.map((u) =>
            u.id === leaderId ? { ...u, isFollowing: false, followersCount: Math.max(0, u.followersCount - 1) } : u
          )
        )
      } else {
        await api.post(`/api/social/follow/${leaderId}`)
        setUsers((prev) =>
          prev.map((u) =>
            u.id === leaderId ? { ...u, isFollowing: true, followersCount: u.followersCount + 1 } : u
          )
        )
      }
    } catch (err) {
      console.error('Failed to toggle social follow:', err)
    } finally {
      setSocialLoading((prev) => ({ ...prev, [leaderId]: false }))
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchSocialLists()
  }, [fetchUsers, fetchSocialLists])

  const handleOpenFollowModal = (leader: ExploreUser) => {
    setSelectedLeader(leader)
    setTxStep('review')
    setTxHash(null)
    setArkivEntityKey(null)
    setErrorMessage(null)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedLeader(null)
    setTxStep('review')
    setErrorMessage(null)
  }

  // Browser-based MetaMask Wallet Payment and Arkiv Registration
  const handleExecuteSubscription = async () => {
    if (!selectedLeader) return

    if (!user?.walletAddress) {
      setErrorMessage('Please link your MetaMask wallet first from the top navbar or profile.')
      return
    }

    if (!selectedLeader.walletAddress) {
      setErrorMessage('This leader has not linked an Ethereum wallet address to receive fees.')
      return
    }

    if (typeof window === 'undefined' || !window.ethereum) {
      setErrorMessage('MetaMask is not detected. Please install MetaMask to complete subscription payments.')
      return
    }

    try {
      setErrorMessage(null)
      setTxStep('wallet_request')

      // Ensure MetaMask is connected to Base Sepolia Testnet (Chain ID 84532)
      await ensureBaseSepoliaNetwork()

      const feeEth = String(selectedLeader.subscriptionFee || '0.001')
      const valueWei = parseEther(feeEth)
      const valueHex = toHex(valueWei)

      console.log(`[Payment] Sending ${feeEth} Base Sepolia ETH to ${selectedLeader.walletAddress} from ${user.walletAddress}`)

      // 1. Browser-based transaction via MetaMask
      const hash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: user.walletAddress,
            to: selectedLeader.walletAddress,
            value: valueHex,
          },
        ],
      })) as string

      console.log(`[Payment] Transaction sent! Tx Hash: ${hash}`)
      setTxHash(hash)

      // 2. Register relationship on Arkiv testnet & save to MongoDB
      setTxStep('anchoring_arkiv')

      const res = await api.post('/api/follow', {
        leaderId: selectedLeader.id,
        transactionId: hash,
      })

      if (res.data?.success) {
        setArkivEntityKey(res.data.arkiv?.entityKey || res.data.follow?.arkivEntityKey || '0xarkiv_confirmed')
        setTxStep('success')

        // Update local state and auth context
        await refreshUser()
        await fetchUsers()
        await fetchSocialLists()
      } else {
        throw new Error(res.data?.error || 'Failed to register relationship in Arkiv')
      }
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string; response?: { data?: { error?: string } } }
      console.error('[Payment] Error executing follow:', e)
      setTxStep('error')

      if (e?.code === 4001) {
        setErrorMessage('Transaction rejected in MetaMask.')
      } else {
        setErrorMessage(e?.response?.data?.error || e?.message || 'Payment or Arkiv registration failed.')
      }
    }
  }

  // Unfollow handler
  const handleUnfollow = async (leaderId: string) => {
    try {
      setUnfollowingId(leaderId)
      const res = await api.post('/api/unfollow', { leaderId })
      if (res.data?.success) {
        await refreshUser()
        await fetchUsers()
        await fetchSocialLists()
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      alert(e?.response?.data?.error || 'Failed to unfollow user.')
    } finally {
      setUnfollowingId(null)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(id)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase()
    return (
      (u.username && u.username.toLowerCase().includes(q)) ||
      u.nullifierHash.toLowerCase().includes(q) ||
      (u.walletAddress && u.walletAddress.toLowerCase().includes(q)) ||
      (u.bio && u.bio.toLowerCase().includes(q))
    )
  })

  return (
    <div className="pt-20 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="surface p-6 sm:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-sm bg-accent flex items-center justify-center text-text-inverse shadow-sm">
                  <Compass className="w-4 h-4 stroke-[2.2]" />
                </span>
                <span className="meta-label">Decentralized Social Directory</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">
                Explore Verified Leaders & Syndicates
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
                Discover verified humans on World ID. Follow leaders by sending an on-chain subscription fee via MetaMask — 
                each relationship is cryptographically anchored on <strong className="text-accent">Arkiv</strong> with a 30-day lifespan.
              </p>
            </div>

            {/* Quick Wallet Anchor Badge */}
            <div className="shrink-0 flex flex-col items-start sm:items-end gap-2">
              <div className="meta-label">Your Transaction Wallet</div>
              {user?.walletAddress ? (
                <div className="flex items-center gap-2 p-2 rounded-md bg-surface-raised border border-border">
                  <Wallet className="w-3.5 h-3.5 text-accent stroke-[2]" />
                  <span className="mono tnum text-xs text-text-primary">{truncateHash(user.walletAddress, 6)}</span>
                  <Badge variant="success" className="text-[10px]">Ready</Badge>
                </div>
              ) : (
                <WalletConnectButton variant="compact" />
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-6 pt-6 border-t border-border flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by username, bio, or public key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-md bg-surface-raised border border-border text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
              />
            </div>
            <div className="text-xs text-text-muted tnum shrink-0">
              Showing <strong>{filteredUsers.length}</strong> leaders
            </div>
          </div>

          {/* Social Navigation Tabs (All Leaders / Following / Followers) */}
          <div className="mt-6 pt-4 border-t border-border flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border ${
                  activeTab === 'all'
                    ? 'bg-accent text-text-inverse border-accent shadow-sm'
                    : 'bg-surface-raised hover:bg-surface-hover text-text-secondary border-border'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>All Leaders</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${activeTab === 'all' ? 'bg-black/20 text-text-inverse' : 'bg-surface text-text-muted'}`}>
                  {users.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('following')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border ${
                  activeTab === 'following'
                    ? 'bg-accent text-text-inverse border-accent shadow-sm'
                    : 'bg-surface-raised hover:bg-surface-hover text-text-secondary border-border'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Following</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${activeTab === 'following' ? 'bg-black/20 text-text-inverse' : 'bg-surface text-text-muted'}`}>
                  {followingList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('followers')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border ${
                  activeTab === 'followers'
                    ? 'bg-accent text-text-inverse border-accent shadow-sm'
                    : 'bg-surface-raised hover:bg-surface-hover text-text-secondary border-border'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Followers</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${activeTab === 'followers' ? 'bg-black/20 text-text-inverse' : 'bg-surface text-text-muted'}`}>
                  {followersList.length}
                </span>
              </button>
            </div>

            <div className="text-xs text-text-muted tnum shrink-0">
              {activeTab === 'all' && <>Showing <strong>{filteredUsers.length}</strong> leaders</>}
              {activeTab === 'following' && <>You are following <strong>{followingList.length}</strong> leader(s)</>}
              {activeTab === 'followers' && <><strong>{followersList.length}</strong> verified human(s) follow you</>}
            </div>
          </div>

          {/* Risk Level Filter Bar (Visible in 'All Leaders' view) */}
          {activeTab === 'all' && (
            <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-text-muted text-[11px] font-semibold flex items-center gap-1.5 mr-1 shrink-0">
                <Filter className="w-3 h-3" /> Risk Profile:
              </span>
              {['ALL', 'CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'DEGEN'].map((tier) => {
                const isActive = riskFilter === tier
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setRiskFilter(tier)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-accent text-text-inverse shadow-sm'
                        : 'bg-surface-raised hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border'
                    }`}
                  >
                    {tier === 'ALL' ? 'All Profiles' : tier}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* -----------------------------------------------------------------
            VIEW 1: All Leaders Directory Grid
            ----------------------------------------------------------------- */}
        {activeTab === 'all' && (
          <>
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-xs uppercase tracking-widest font-semibold">Loading Verified Leaders...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="surface p-12 text-center">
                <Users className="w-10 h-10 text-text-muted mx-auto mb-3 stroke-[1.5]" />
                <h3 className="text-base font-bold text-text-primary mb-1">No leaders found</h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  {searchQuery || riskFilter !== 'ALL'
                    ? 'No leaders matched your search or risk filter criteria. Try adjusting your filters.'
                    : 'There are no other registered users yet. Test with another simulated identity!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredUsers.map((leader) => {
                  const leaderIdentifier = leader.username ? `@${leader.username}` : truncateHash(leader.nullifierHash, 8)
                  const avatarLetter = (leader.username || truncateHash(leader.nullifierHash))[0].toUpperCase()
                  const riskCfg = leader.riskLevel ? RISK_BADGES[leader.riskLevel] : RISK_BADGES.MODERATE
                  const winRateVal = leader.stats?.winRate !== undefined ? leader.stats.winRate : 0
                  const pnlVal = leader.stats?.totalPnlUsdc ?? 0

                  return (
                    <Card key={leader.id} className="flex flex-col justify-between hover:border-accent/40 transition-colors">
                      <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                        <div>
                          {/* Top Row: Avatar & Identity */}
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-md bg-surface-raised border border-border flex items-center justify-center font-bold text-accent shrink-0 text-base">
                                {avatarLetter}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-text-primary truncate">
                                  {leaderIdentifier}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-0.5">
                                  <ShieldCheck className="w-3 h-3 text-semantic-success stroke-[2.2]" />
                                  <span>World ID Verified</span>
                                </div>
                              </div>
                            </div>

                            {/* Risk Badge */}
                            {riskCfg && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${riskCfg.bg} ${riskCfg.text} ${riskCfg.border}`}>
                                {riskCfg.label}
                              </span>
                            )}
                          </div>

                          {/* Trading Style & Subscription Price */}
                          <div className="flex items-center justify-between text-[11px] mb-2.5">
                            <span className="text-text-muted font-medium">
                              Style: <strong className="text-text-primary uppercase">{leader.tradingStyle || 'DISCRETIONARY'}</strong>
                            </span>
                            <span className="mono tnum text-accent font-bold">
                              {leader.subscriptionFee} ETH / 30d
                            </span>
                          </div>

                          {/* Bio */}
                          <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-2">
                            {leader.bio || 'Verified trader & strategist. Open for syndicate copy relationships.'}
                          </p>

                          {/* Tags */}
                          {leader.tags && leader.tags.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mb-3">
                              {leader.tags.map((t, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-raised border border-border text-text-muted">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Performance Stats Metrics Bar */}
                          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-md bg-surface-raised border border-border text-center mb-3">
                            <div>
                              <div className="text-[9px] uppercase font-bold text-text-muted">Win Rate</div>
                              <div className={`mono tnum text-xs font-black mt-0.5 ${winRateVal >= 60 ? 'text-semantic-success' : 'text-text-primary'}`}>
                                {winRateVal > 0 ? `${winRateVal.toFixed(1)}%` : '—'}
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase font-bold text-text-muted">Net PnL</div>
                              <div className={`mono tnum text-xs font-black mt-0.5 ${pnlVal > 0 ? 'text-semantic-success' : pnlVal < 0 ? 'text-semantic-danger' : 'text-text-primary'}`}>
                                {pnlVal !== 0 ? `${pnlVal >= 0 ? '+' : ''}$${pnlVal.toFixed(2)}` : '$0.00'}
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase font-bold text-text-muted">Subscribers</div>
                              <div className="mono tnum text-xs font-black text-text-primary mt-0.5">
                                {leader.subscribersCount ?? leader.followersCount ?? 0}
                              </div>
                            </div>
                          </div>

                          {/* Public Address */}
                          <div className="p-2 rounded bg-surface-raised/60 border border-border/80 flex items-center justify-between text-xs mb-1">
                            <span className="text-[10px] uppercase font-semibold text-text-muted">Wallet</span>
                            {leader.walletAddress ? (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(leader.walletAddress!, `addr-${leader.id}`)}
                                className="copy-chip text-[10px] py-0.5 px-1.5"
                              >
                                <span className="mono tnum">{truncateHash(leader.walletAddress, 6)}</span>
                                {copiedKey === `addr-${leader.id}` ? (
                                  <Check className="w-2.5 h-2.5 text-semantic-success" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            ) : (
                              <span className="text-[10px] text-semantic-warning">No wallet linked</span>
                            )}
                          </div>
                        </div>

                        {/* Dual Action Buttons: Free Follow + Paid Copy-Trade Subscribe */}
                        <div className="pt-2 border-t border-border flex items-center gap-2">
                          {/* 1-Click Free Social Follow */}
                          <button
                            type="button"
                            onClick={() => handleToggleSocialFollow(leader)}
                            disabled={socialLoading[leader.id]}
                            className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border ${
                              leader.isFollowing
                                ? 'bg-surface-raised border-accent/40 text-accent hover:border-semantic-danger/40 hover:text-semantic-danger'
                                : 'bg-surface-raised hover:bg-surface-hover border-border text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            {socialLoading[leader.id] ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : leader.isFollowing ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Following</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-3 h-3" />
                                <span>Follow</span>
                              </>
                            )}
                          </button>

                          {/* Paid Gated Copy-Trade Subscribe */}
                          {leader.isSubscribed ? (
                            <div className="flex-1 py-1.5 px-2.5 rounded-md bg-semantic-success/15 border border-semantic-success/30 text-semantic-success text-xs font-bold flex items-center justify-center gap-1">
                              <Zap className="w-3 h-3" />
                              <span>Subscribed</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenFollowModal(leader)}
                              disabled={!leader.walletAddress}
                              className="flex-1 py-1.5 px-2.5 rounded-md bg-accent hover:bg-[#d4f885] text-text-inverse text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_10px_rgba(198,243,106,0.18)]"
                            >
                              <Radio className="w-3 h-3 stroke-[2.5]" />
                              <span>Copy Trade</span>
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* -----------------------------------------------------------------
            VIEW 2: Following Tab (< 3 Accounts Detailed Listing)
            ----------------------------------------------------------------- */}
        {activeTab === 'following' && (
          <div className="space-y-4">
            {loadingSocial ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-xs uppercase tracking-widest font-semibold">Loading Following Relationships...</p>
              </div>
            ) : followingList.length === 0 ? (
              <div className="surface p-12 text-center">
                <UserCheck className="w-10 h-10 text-text-muted mx-auto mb-3 stroke-[1.5]" />
                <h3 className="text-base font-bold text-text-primary mb-1">Not Following Any Leaders Yet</h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto mb-4">
                  Browse the All Leaders directory to find verified traders and subscribe to their copy signals.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className="px-4 py-2 rounded-md bg-accent text-text-inverse text-xs font-bold hover:bg-[#d4f885] transition-colors cursor-pointer"
                >
                  Browse Leaders
                </button>
              </div>
            ) : (
              <>
                {/* Specific Highlighting when Following < 3 Accounts */}
                {followingList.length < 3 && (
                  <div className="p-3.5 rounded-lg bg-surface-raised border border-accent/30 flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-accent" />
                      <span className="text-text-primary font-medium">
                        You are following <strong>{followingList.length}</strong> leader(s) (&lt; 3 accounts). Below are their full verified account numbers and Arkiv cryptographic relationship proofs.
                      </span>
                    </div>
                    <Badge variant="accent" className="text-[10px]">Active Arkiv TTL</Badge>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {followingList.map((f) => {
                    const leader = f.leaderId
                    const targetLeaderId = leader?._id || f._id
                    const accountAddr = f.leaderPublicKey || leader?.walletAddress || '0x0000000000000000000000000000000000000000'
                    const handle = leader?.username ? `@${leader.username}` : 'Verified Leader'

                    return (
                      <Card key={f._id} className="overflow-hidden border border-border">
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-text-primary text-base">{handle}</h4>
                                <Badge variant="success" className="text-[10px]">
                                  <Check className="w-2.5 h-2.5" />
                                  Following
                                </Badge>
                              </div>
                              <div className="text-[11px] text-text-muted mt-0.5">
                                Subscribed via Base Sepolia ({leader?.subscriptionFee ?? 0.001} ETH / 30d)
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnfollow(targetLeaderId)}
                              disabled={unfollowingId === targetLeaderId}
                              className="px-2.5 py-1 rounded bg-surface hover:bg-semantic-danger/10 border border-border hover:border-semantic-danger/30 text-xs font-semibold text-semantic-danger transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {unfollowingId === targetLeaderId ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Unfollow'}
                            </button>
                          </div>

                          {/* Full Account Number / Address Block (Requested by User) */}
                          <div className="p-3 rounded-md bg-surface-raised border border-border space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-text-muted">Account Number / Public Key:</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                                ETHEREUM SEPOLIA
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-surface border border-border">
                              <span className="mono tnum text-[11px] font-bold text-text-primary break-all select-all">
                                {accountAddr}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(accountAddr, `acct-${f._id}`)}
                                  className="copy-chip text-[10px] py-1 px-1.5"
                                  title="Copy full account address"
                                >
                                  {copiedKey === `acct-${f._id}` ? <Check className="w-3 h-3 text-semantic-success" /> : <Copy className="w-3 h-3" />}
                                </button>
                                <a
                                  href={getBaseScanAddressUrl(accountAddr)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary"
                                  title="View on BaseScan"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>

                            {/* World ID Nullifier Hash */}
                            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-border/60">
                              <span className="text-text-muted">Nullifier:</span>
                              <span className="mono text-text-secondary">{truncateHash(f.leaderNullifier || leader?.nullifierHash, 10)}</span>
                            </div>

                            {/* Arkiv Entity Key */}
                            {f.arkivEntityKey && (
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-text-muted flex items-center gap-1">
                                  <Database className="w-3 h-3 text-accent" />
                                  Arkiv Relationship Key:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={`https://rabdi.explorer.arkiv.network/entity/${f.arkivEntityKey}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mono text-blue-700 hover:text-blue-900 dark:text-accent font-bold underline underline-offset-2 flex items-center gap-1"
                                  >
                                    <span>{truncateHash(f.arkivEntityKey, 6)}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              </div>
                            )}

                            {f.expiresAt && (
                              <div className="flex justify-between items-center text-[11px] text-text-muted">
                                <span>Relationship Expiry:</span>
                                <span className="tnum font-medium text-text-secondary">{new Date(f.expiresAt).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* -----------------------------------------------------------------
            VIEW 3: Followers Tab (< 3 Accounts Detailed Listing)
            ----------------------------------------------------------------- */}
        {activeTab === 'followers' && (
          <div className="space-y-4">
            {loadingSocial ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-xs uppercase tracking-widest font-semibold">Loading Followers...</p>
              </div>
            ) : followersList.length === 0 ? (
              <div className="surface p-12 text-center">
                <Users className="w-10 h-10 text-text-muted mx-auto mb-3 stroke-[1.5]" />
                <h3 className="text-base font-bold text-text-primary mb-1">No Followers Yet</h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  When other verified World ID users follow your trading signals, their account numbers and Arkiv relationship proofs will appear here.
                </p>
              </div>
            ) : (
              <>
                {/* Specific Highlighting when Followers < 3 Accounts */}
                {followersList.length < 3 && (
                  <div className="p-3.5 rounded-lg bg-surface-raised border border-accent/30 flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-accent" />
                      <span className="text-text-primary font-medium">
                        You have <strong>{followersList.length}</strong> active follower(s) (&lt; 3 accounts). Below are their full account numbers and encrypted signal access tokens.
                      </span>
                    </div>
                    <Badge variant="accent" className="text-[10px]">Signal Receivers</Badge>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {followersList.map((f) => {
                    const follower = f.followerId
                    const accountAddr = f.followerPublicKey || follower?.walletAddress || '0x0000000000000000000000000000000000000000'
                    const handle = follower?.username ? `@${follower.username}` : 'Verified Follower'

                    return (
                      <Card key={f._id} className="overflow-hidden border border-border">
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-text-primary text-base">{handle}</h4>
                                <Badge variant="accent" className="text-[10px]">
                                  Active Follower
                                </Badge>
                              </div>
                              <div className="text-[11px] text-text-muted mt-0.5">
                                Access granted to your 10-minute encrypted ArkDB trading signals
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-semantic-success/15 text-semantic-success border border-semantic-success/30">
                              VERIFIED HUMAN
                            </span>
                          </div>

                          {/* Full Follower Account Number / Address Block (Requested by User) */}
                          <div className="p-3 rounded-md bg-surface-raised border border-border space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-text-muted">Account Number / Public Key:</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                FOLLOWER WALLET
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-surface border border-border">
                              <span className="mono tnum text-[11px] font-bold text-text-primary break-all select-all">
                                {accountAddr}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(accountAddr, `f-acct-${f._id}`)}
                                  className="copy-chip text-[10px] py-1 px-1.5"
                                  title="Copy follower account address"
                                >
                                  {copiedKey === `f-acct-${f._id}` ? <Check className="w-3 h-3 text-semantic-success" /> : <Copy className="w-3 h-3" />}
                                </button>
                                <a
                                  href={getBaseScanAddressUrl(accountAddr)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary"
                                  title="View on BaseScan"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>

                            {/* World ID Nullifier Hash */}
                            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-border/60">
                              <span className="text-text-muted">Nullifier:</span>
                              <span className="mono text-text-secondary">{truncateHash(f.followerNullifier || follower?.nullifierHash, 10)}</span>
                            </div>

                            {/* Arkiv Entity Key */}
                            {f.arkivEntityKey && (
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-text-muted flex items-center gap-1">
                                  <Database className="w-3 h-3 text-accent" />
                                  Arkiv Relationship Key:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={`https://rabdi.explorer.arkiv.network/entity/${f.arkivEntityKey}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mono text-blue-700 hover:text-blue-900 dark:text-accent font-bold underline underline-offset-2 flex items-center gap-1"
                                  >
                                    <span>{truncateHash(f.arkivEntityKey, 6)}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              </div>
                            )}

                            {f.createdAt && (
                              <div className="flex justify-between items-center text-[11px] text-text-muted">
                                <span>Subscribed Since:</span>
                                <span className="tnum font-medium text-text-secondary">{new Date(f.createdAt).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* -----------------------------------------------------------------
            MODAL: Browser MetaMask Payment & Arkiv TTL Anchor
            ----------------------------------------------------------------- */}
        {modalOpen && selectedLeader && (
          <div className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="surface p-6 sm:p-8 max-w-lg w-full rounded-xl border border-border-strong shadow-[0_20px_50px_rgba(0,0,0,0.7)] animate-slideUp">
              
              <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-accent stroke-[2]" />
                  <h3 className="text-base font-bold text-text-primary">
                    Subscribe & Anchor on Arkiv
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-text-muted hover:text-text-primary text-xs p-1"
                >
                  ✕
                </button>
              </div>

              {/* Review Step */}
              {txStep === 'review' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-md bg-surface-raised border border-border space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-muted uppercase tracking-wider font-semibold">Leader</span>
                      <strong className="text-text-primary">{selectedLeader.username ? `@${selectedLeader.username}` : truncateHash(selectedLeader.nullifierHash)}</strong>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-muted uppercase tracking-wider font-semibold">Leader Public Key</span>
                      <span className="mono tnum text-text-primary">{truncateHash(selectedLeader.walletAddress, 8)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-muted uppercase tracking-wider font-semibold">Network</span>
                      <span className="font-semibold text-text-primary flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                        Base Sepolia Testnet (84532)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-muted uppercase tracking-wider font-semibold">Subscription Fee</span>
                      <span className="mono tnum font-bold text-accent text-sm">{selectedLeader.subscriptionFee} ETH</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-2 border-t border-border">
                      <span className="text-text-muted uppercase tracking-wider font-semibold">Arkiv Time-to-Live (TTL)</span>
                      <span className="font-semibold text-semantic-success flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> 30 Days Valid
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-md bg-accent-soft border border-accent/20 text-xs text-text-primary flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div>
                      <strong>Decentralized Copy-Trading Epoch:</strong> Your subscription sends {selectedLeader.subscriptionFee} ETH directly to the leader via MetaMask.
                      Once confirmed on Base Sepolia, the subscription is recorded on Arkiv to grant 30 days of real-time encrypted trade copy signals.
                    </div>
                  </div>

                  {!user?.walletAddress ? (
                    <div className="p-3 rounded-md border border-semantic-warning/30 bg-semantic-warning/10 text-xs text-semantic-warning flex items-center justify-between gap-3">
                      <span>You must link your MetaMask wallet before paying.</span>
                      <WalletConnectButton variant="compact" />
                    </div>
                  ) : null}

                  {errorMessage && (
                    <div className="p-3 rounded-md border border-semantic-danger/30 bg-semantic-danger/10 text-xs text-semantic-danger flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-3">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 py-2.5 rounded-md bg-surface-raised hover:bg-surface-hover border border-border text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteSubscription}
                      disabled={!user?.walletAddress || !selectedLeader.walletAddress}
                      className="flex-1 py-2.5 rounded-md bg-accent hover:bg-[#d4f885] text-text-inverse text-xs font-bold transition-all shadow-[0_2px_14px_rgba(198,243,106,0.2)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Pay & Subscribe
                    </button>
                  </div>
                </div>
              )}

              {/* Wallet Request Step */}
              {txStep === 'wallet_request' && (
                <div className="py-8 text-center space-y-4">
                  <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto" />
                  <div>
                    <h4 className="text-base font-bold text-text-primary">Confirm in MetaMask</h4>
                    <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto leading-relaxed">
                      Please switch to Base Sepolia and confirm the {selectedLeader.subscriptionFee} ETH transaction in your browser wallet extension...
                    </p>
                  </div>
                </div>
              )}

              {/* Anchoring in Arkiv Step */}
              {txStep === 'anchoring_arkiv' && (
                <div className="py-8 text-center space-y-4">
                  <div className="w-10 h-10 rounded-full bg-accent-soft border border-accent flex items-center justify-center text-accent mx-auto">
                    <Database className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-text-primary">Creating Arkiv Entity</h4>
                    <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto leading-relaxed">
                      Transaction confirmed on Base Sepolia! Registering follower schema on Arkiv testnet with 30-day TTL...
                    </p>
                  </div>
                  {txHash && (
                    <div className="mono text-xs text-text-secondary tnum">
                      Tx: {truncateHash(txHash, 10)}
                    </div>
                  )}
                </div>
              )}

              {/* Success Step */}
              {txStep === 'success' && (
                <div className="space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-semantic-success/20 text-semantic-success flex items-center justify-center mx-auto mb-2">
                    <Check className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-text-primary">Follower Relationship Stored!</h4>
                    <p className="text-xs text-text-secondary mt-1">
                      You are now following <strong>{selectedLeader.username ? `@${selectedLeader.username}` : 'Leader'}</strong> for the next 30 days.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-md bg-surface-raised border border-border text-left text-xs space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Arkiv Entity Key</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(arkivEntityKey!, 'arkiv-key')}
                          className="copy-chip text-[10px]"
                        >
                          <span className="mono tnum">{truncateHash(arkivEntityKey, 8)}</span>
                          {copiedKey === 'arkiv-key' ? (
                            <Check className="w-3 h-3 text-semantic-success" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <a
                          href={getArkivExplorerUrl(arkivEntityKey || undefined)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-muted hover:text-accent p-1 transition-colors"
                          title="Open on Arkiv Rabdi Explorer"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">BaseScan Payment Tx</span>
                      {txHash ? (
                        <a
                          href={getBaseScanTxUrl(txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mono tnum text-accent hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>{truncateHash(txHash, 8)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="mono tnum text-text-primary">—</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Arkiv Data Explorer</span>
                      <a
                        href={getArkivDataExplorerUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline flex items-center gap-1 font-semibold"
                      >
                        <span>data.arkiv.network</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Network</span>
                      <span className="text-text-primary font-medium">Base Sepolia (84532)</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">Expiration</span>
                      <span className="text-semantic-success font-semibold">30 Days from today</span>
                    </div>
                  </div>

                  {arkivEntityKey?.startsWith('0xarkiv_') && (
                    <div className="p-3 rounded-md bg-semantic-warning/10 border border-semantic-warning/30 text-xs text-semantic-warning text-left leading-relaxed">
                      <strong>Pending On-Chain Gas:</strong> The relationship is saved in your database schema. To broadcast directly to the Arkiv Rabdi blockchain so it appears on the block explorer, fund the backend signer (<span className="mono tnum font-semibold">0x1502B0a879C59Aa38bc704eA807f0Eaa22F42Dbf</span>) with free testnet tokens at{' '}
                      <a
                        href="https://hub.arkiv.network/faucet"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-bold hover:text-accent"
                      >
                        hub.arkiv.network/faucet
                      </a>.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full py-2.5 rounded-md bg-accent text-text-inverse text-xs font-bold hover:bg-[#d4f885] transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Error Step */}
              {txStep === 'error' && (
                <div className="space-y-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-semantic-danger/20 text-semantic-danger flex items-center justify-center mx-auto mb-2">
                    <AlertCircle className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-text-primary">Transaction Failed</h4>
                    <p className="text-xs text-semantic-danger mt-1">
                      {errorMessage || 'Unable to complete transaction or store in Arkiv.'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 py-2.5 rounded-md bg-surface-raised border border-border text-xs font-semibold text-text-secondary hover:text-text-primary"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteSubscription}
                      className="flex-1 py-2.5 rounded-md bg-accent text-text-inverse text-xs font-bold hover:bg-[#d4f885]"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  )
}

