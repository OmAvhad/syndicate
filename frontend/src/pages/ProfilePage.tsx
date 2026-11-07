import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import WalletConnectButton from '@/components/WalletConnectButton'
import {
  CheckCircle,
  ArrowLeft,
  Save,
  Loader2,
  Copy,
  Check,
  Wallet,
  Users,
  Compass,
  UserCheck,
  ShieldCheck,
  Database,
  ExternalLink,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { truncateHash } from '@/lib/utils'
import { getBaseScanAddressUrl } from '@/lib/network'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()

  const [form, setForm] = useState({
    username: user?.username || '',
    bio: user?.bio || '',
    subscriptionFee: user?.subscriptionFee ?? 0.001,
    riskLevel: (user?.riskLevel as any) || 'MODERATE',
    tradingStyle: user?.tradingStyle || 'SWING',
    tags: user?.tags ? user.tags.join(', ') : '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [copiedNullifier, setCopiedNullifier] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Social tabs: 'settings' | 'following' | 'followers'
  const [activeTab, setActiveTab] = useState<'settings' | 'following' | 'followers'>('settings')
  const [followingList, setFollowingList] = useState<any[]>([])
  const [followersList, setFollowersList] = useState<any[]>([])
  const [loadingSocial, setLoadingSocial] = useState(false)
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null)

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
      console.error('Failed to load social lists in profile:', err)
    } finally {
      setLoadingSocial(false)
    }
  }, [])

  useEffect(() => {
    fetchSocialLists()
  }, [fetchSocialLists])

  // Sync form when user refreshes
  useEffect(() => {
    if (user) {
      setForm({
        username: user.username || '',
        bio: user.bio || '',
        subscriptionFee: user.subscriptionFee ?? 0.001,
        riskLevel: (user?.riskLevel as any) || 'MODERATE',
        tradingStyle: user?.tradingStyle || 'SWING',
        tags: user?.tags ? user.tags.join(', ') : '',
      })
    }
  }, [user])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(id)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleUnfollow = async (leaderId: string) => {
    try {
      setUnfollowingId(leaderId)
      const res = await api.post('/api/unfollow', { leaderId })
      if (res.data?.success) {
        await refreshUser()
        await fetchSocialLists()
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      alert(e?.response?.data?.error || 'Failed to unfollow user.')
    } finally {
      setUnfollowingId(null)
    }
  }

  const avatarLetter = (form.username || truncateHash(user?.nullifierHash) || 'W')[0].toUpperCase()

  const handleChange = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
    setError('')
  }

  const handleCopyNullifier = () => {
    if (user?.nullifierHash) {
      navigator.clipboard.writeText(user.nullifierHash)
      setCopiedNullifier(true)
      setTimeout(() => setCopiedNullifier(false), 2000)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const tagsArray = form.tags
        ? form.tags
            .split(',')
            .map((t: string) => t.trim().toLowerCase().replace(/^#/, ''))
            .filter(Boolean)
        : []

      await api.put('/api/user/profile', {
        username: form.username,
        bio: form.bio,
        subscriptionFee: Number(form.subscriptionFee),
        riskLevel: form.riskLevel,
        tradingStyle: form.tradingStyle,
        tags: tagsArray,
      })
      await refreshUser()
      setSuccess(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error || 'Failed to save profile changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pt-20 pb-16 px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Link & Explore shortcut */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors duration-fast"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            <Compass className="w-3.5 h-3.5" />
            Explore Other Leaders
          </Link>
        </div>

        {/* Identity Overview Header */}
        <div className="surface p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-md bg-surface-raised border border-border flex items-center justify-center text-2xl font-bold text-accent shadow-sm">
                  {avatarLetter}
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-semantic-success border-2 border-surface flex items-center justify-center"
                  title="World ID Verified"
                >
                  <Check className="w-3 h-3 text-text-inverse stroke-[2.8]" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl font-bold text-text-primary truncate">
                    {form.username ? `@${form.username}` : 'Verified Human'}
                  </h1>
                  <Badge variant="success">Verified Human</Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                  <span>Nullifier:</span>
                  <button
                    type="button"
                    onClick={handleCopyNullifier}
                    className="copy-chip inline-flex items-center gap-1.5"
                  >
                    <span className="mono tnum">{truncateHash(user?.nullifierHash, 10)}</span>
                    {copiedNullifier ? (
                      <Check className="w-3 h-3 text-semantic-success" />
                    ) : (
                      <Copy className="w-3 h-3 text-text-muted" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Followers / Following Stats in Header (In same card with account numbers if < 3) */}
            <div className="p-3 rounded-md bg-surface-raised border border-border self-start sm:self-auto space-y-2 min-w-[220px]">
              <div className="flex items-center gap-3 justify-around">
                <button
                  type="button"
                  onClick={() => setActiveTab('followers')}
                  className={`text-center px-3 py-1.5 rounded transition-colors cursor-pointer ${
                    activeTab === 'followers'
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'hover:bg-surface text-text-primary'
                  }`}
                  title="View your followers"
                >
                  <div className="mono tnum text-base font-bold text-accent">
                    {followersList.length || user?.followersCount || 0}
                  </div>
                  <div className="text-[10px] uppercase font-semibold text-text-muted">Followers</div>
                </button>
                <div className="w-px h-6 bg-border" />
                <button
                  type="button"
                  onClick={() => setActiveTab('following')}
                  className={`text-center px-3 py-1.5 rounded transition-colors cursor-pointer ${
                    activeTab === 'following'
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'hover:bg-surface text-text-primary'
                  }`}
                  title="View leaders you follow"
                >
                  <div className="mono tnum text-base font-bold text-accent">
                    {followingList.length || user?.followingCount || 0}
                  </div>
                  <div className="text-[10px] uppercase font-semibold text-text-muted">Following</div>
                </button>
              </div>

              {/* Inline Follower Account Numbers without needing to click (< 3 accounts) */}
              {followersList.length > 0 && followersList.length < 3 && (
                <div className="pt-2 border-t border-border/80 text-[10px] space-y-1 animate-fadeIn">
                  <div className="font-bold uppercase text-text-muted text-[9px] flex items-center justify-between">
                    <span>Follower Account(s):</span>
                    <span className="text-accent">{followersList.length}</span>
                  </div>
                  {followersList.map((f, i) => {
                    const addr = f.followerPublicKey || f.followerId?.walletAddress
                    const handle = f.followerId?.username ? `@${f.followerId.username}` : `Follower #${i + 1}`
                    return (
                      <div key={f._id} className="p-1 rounded bg-surface border border-border space-y-0.5">
                        <div className="font-bold text-text-primary text-[10px] truncate">{handle}</div>
                        {addr ? (
                          <div className="flex items-center justify-between gap-1">
                            <span className="mono tnum text-accent font-bold truncate select-all">{truncateHash(addr, 6)}</span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(addr)}
                              className="px-1 py-0.2 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border shrink-0 cursor-pointer"
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

              {/* Inline Following Account Numbers without needing to click (< 3 accounts) */}
              {followingList.length > 0 && followingList.length < 3 && (
                <div className="pt-2 border-t border-border/80 text-[10px] space-y-1 animate-fadeIn">
                  <div className="font-bold uppercase text-text-muted text-[9px] flex items-center justify-between">
                    <span>Following Account(s):</span>
                    <span className="text-accent">{followingList.length}</span>
                  </div>
                  {followingList.map((f, i) => {
                    const addr = f.leaderPublicKey || f.leaderId?.walletAddress
                    const handle = f.leaderId?.username ? `@${f.leaderId.username}` : `Leader #${i + 1}`
                    return (
                      <div key={f._id} className="p-1 rounded bg-surface border border-border space-y-0.5">
                        <div className="font-bold text-text-primary text-[10px] truncate">{handle}</div>
                        {addr ? (
                          <div className="flex items-center justify-between gap-1">
                            <span className="mono tnum text-accent font-bold truncate select-all">{truncateHash(addr, 6)}</span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(addr)}
                              className="px-1 py-0.2 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border shrink-0 cursor-pointer"
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
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-2 border-b border-border pb-3 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border ${
              activeTab === 'settings'
                ? 'bg-accent text-text-inverse border-accent shadow-sm'
                : 'bg-surface-raised hover:bg-surface-hover text-text-secondary border-border'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Profile & Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('following')}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border ${
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
            className={`px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border ${
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

        {/* -------------------------------------------------------------
            TAB 1: Profile & Settings
            ------------------------------------------------------------- */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-fadeIn">
            {/* MetaMask Wallet Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-accent stroke-[2]" />
                    <CardTitle>Connected MetaMask Wallet</CardTitle>
                  </div>
                  {user?.walletAddress ? (
                    <Badge variant="accent">Linked</Badge>
                  ) : (
                    <Badge variant="muted">Not Connected</Badge>
                  )}
                </div>
                <CardDescription>
                  Your Ethereum public key receives subscription payments when other World ID users follow you, and is stored in Arkiv follower relationships.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WalletConnectButton variant="card" />
              </CardContent>
            </Card>

            {/* Profile Details & Subscription Fee Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Profile & Monetization Details</CardTitle>
                <CardDescription>
                  Set your handle and the subscription fee followers must pay via MetaMask to anchor a relationship on Arkiv.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                  <Input
                    id="username"
                    label="Username"
                    placeholder="e.g. satoshi"
                    value={form.username}
                    onChange={(e) => handleChange('username', e.target.value)}
                    hint="Your unique public handle across the platform."
                  />

                  <Input
                    id="subscriptionFee"
                    label="Leader Subscription Fee (Base Sepolia ETH / 30 Days)"
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="0.001"
                    value={form.subscriptionFee}
                    onChange={(e) => handleChange('subscriptionFee', e.target.value)}
                    hint="Followers pay this fee in Base Sepolia ETH via MetaMask to anchor a 30-day relationship on Arkiv."
                  />

                  {/* Risk Profile & Trading Style */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="riskLevel" className="block text-xs font-semibold text-text-primary">
                        Risk Profile
                      </label>
                      <select
                        id="riskLevel"
                        value={form.riskLevel}
                        onChange={(e) => handleChange('riskLevel', e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-surface-raised border border-border text-sm text-text-primary focus:border-accent focus:outline-none transition-colors cursor-pointer"
                      >
                        <option value="CONSERVATIVE">Conservative (Low Drawdown, Hedged)</option>
                        <option value="MODERATE">Moderate (Balanced Macro/Swing)</option>
                        <option value="AGGRESSIVE">Aggressive (High Momentum/Beta)</option>
                        <option value="DEGEN">Degen Alpha (Max Leverage, Scalps)</option>
                      </select>
                      <p className="text-[11px] text-text-muted">Displays badge on your profile and directory cards.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="tradingStyle" className="block text-xs font-semibold text-text-primary">
                        Trading Style
                      </label>
                      <select
                        id="tradingStyle"
                        value={form.tradingStyle}
                        onChange={(e) => handleChange('tradingStyle', e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-surface-raised border border-border text-sm text-text-primary focus:border-accent focus:outline-none transition-colors cursor-pointer"
                      >
                        <option value="SWING">Swing Trader (Days to Weeks)</option>
                        <option value="DAY_TRADER">Day Trader (Intraday)</option>
                        <option value="SCALPER">Scalper (Minutes/Seconds)</option>
                        <option value="POSITION">Position Trader (Long Term)</option>
                      </select>
                      <p className="text-[11px] text-text-muted">Informs subscribers about your expected hold duration.</p>
                    </div>
                  </div>

                  <Input
                    id="tags"
                    label="Profile Tags (Comma separated)"
                    placeholder="e.g. eth, momentum, swing, defi"
                    value={form.tags}
                    onChange={(e) => handleChange('tags', e.target.value)}
                    hint="Searchable tags shown on the Explore directory."
                  />

                  <Textarea
                    id="bio"
                    label="Bio & Strategy Overview"
                    rows={3}
                    placeholder="Describe your trading approach or background..."
                    value={form.bio}
                    onChange={(e) => handleChange('bio', e.target.value)}
                    hint="Visible in the Explore directory."
                  />

                  {error && (
                    <div className="p-3 rounded-md border border-semantic-danger/30 bg-semantic-danger/10 text-xs text-semantic-danger">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="p-3 rounded-md border border-semantic-success/30 bg-semantic-success/10 text-xs text-semantic-success flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>Profile and subscription fee updated successfully.</span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-text-inverse" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 stroke-[2.2]" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* -------------------------------------------------------------
            TAB 2: Following Tab (< 3 Accounts Detailed Listing)
            ------------------------------------------------------------- */}
        {activeTab === 'following' && (
          <div className="space-y-4 animate-fadeIn">
            {loadingSocial ? (
              <div className="py-16 text-center text-text-muted">
                <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-2" />
                <span className="text-xs">Loading followed leaders...</span>
              </div>
            ) : followingList.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center space-y-3">
                  <UserCheck className="w-8 h-8 text-text-muted mx-auto stroke-[1.5]" />
                  <div className="font-bold text-text-primary text-sm">You are not following anyone yet</div>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    Subscribe to verified World ID traders in the Explore directory to receive their private copy signals.
                  </p>
                  <Link
                    to="/explore"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-text-inverse text-xs font-bold hover:bg-[#d4f885] transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Explore Traders</span>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <>
                {followingList.length < 3 && (
                  <div className="p-3.5 rounded-lg bg-surface-raised border border-accent/30 flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-accent" />
                      <span className="text-text-primary font-medium">
                        You are following <strong>{followingList.length}</strong> leader(s) (&lt; 3 accounts). Listed below with their verified account numbers and Arkiv relationship proofs:
                      </span>
                    </div>
                    <Badge variant="accent" className="text-[10px]">Arkiv Anchored</Badge>
                  </div>
                )}

                <div className="space-y-3">
                  {followingList.map((f) => {
                    const leader = f.leaderId
                    const targetLeaderId = leader?._id || f._id
                    const accountAddr = f.leaderPublicKey || leader?.walletAddress || '0x0000000000000000000000000000000000000000'
                    const handle = leader?.username ? `@${leader.username}` : 'Verified Leader'

                    return (
                      <Card key={f._id} className="border border-border">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-text-primary text-sm">{handle}</span>
                                <Badge variant="success" className="text-[10px]">
                                  <Check className="w-2.5 h-2.5" />
                                  Active Subscription
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

                          {/* Full Account Number / Address Block */}
                          <div className="p-3 rounded-md bg-surface-raised border border-border space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-text-muted">Account Number / Public Key:</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                                LEADER WALLET
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-surface border border-border">
                              <span className="mono tnum text-[11px] font-bold text-text-primary break-all select-all">
                                {accountAddr}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(accountAddr, `p-acct-${f._id}`)}
                                  className="copy-chip text-[10px] py-1 px-1.5"
                                  title="Copy full account address"
                                >
                                  {copiedKey === `p-acct-${f._id}` ? <Check className="w-3 h-3 text-semantic-success" /> : <Copy className="w-3 h-3" />}
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
                              <span className="text-text-muted">Leader Nullifier:</span>
                              <span className="mono text-text-secondary">{truncateHash(f.leaderNullifier || leader?.nullifierHash, 10)}</span>
                            </div>

                            {/* Arkiv Entity Key */}
                            {f.arkivEntityKey && (
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-text-muted flex items-center gap-1">
                                  <Database className="w-3 h-3 text-accent" />
                                  Arkiv Relationship Key:
                                </span>
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
                            )}

                            {f.expiresAt && (
                              <div className="flex justify-between items-center text-[11px] text-text-muted">
                                <span>Subscription Expiry:</span>
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

        {/* -------------------------------------------------------------
            TAB 3: Followers Tab (< 3 Accounts Detailed Listing)
            ------------------------------------------------------------- */}
        {activeTab === 'followers' && (
          <div className="space-y-4 animate-fadeIn">
            {loadingSocial ? (
              <div className="py-16 text-center text-text-muted">
                <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-2" />
                <span className="text-xs">Loading your followers...</span>
              </div>
            ) : followersList.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center space-y-3">
                  <Users className="w-8 h-8 text-text-muted mx-auto stroke-[1.5]" />
                  <div className="font-bold text-text-primary text-sm">No followers yet</div>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    Ensure your username and subscription fee are configured in settings so other traders can follow your signals.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {followersList.length < 3 && (
                  <div className="p-3.5 rounded-lg bg-surface-raised border border-accent/30 flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-accent" />
                      <span className="text-text-primary font-medium">
                        You have <strong>{followersList.length}</strong> active follower(s) (&lt; 3 accounts). Listed below with their verified account numbers and encrypted signal keys:
                      </span>
                    </div>
                    <Badge variant="accent" className="text-[10px]">Signal Receivers</Badge>
                  </div>
                )}

                <div className="space-y-3">
                  {followersList.map((f) => {
                    const follower = f.followerId
                    const accountAddr = f.followerPublicKey || follower?.walletAddress || '0x0000000000000000000000000000000000000000'
                    const handle = follower?.username ? `@${follower.username}` : 'Verified Follower'

                    return (
                      <Card key={f._id} className="border border-border">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-text-primary text-sm">{handle}</span>
                                <Badge variant="accent" className="text-[10px]">
                                  Active Follower
                                </Badge>
                              </div>
                              <div className="text-[11px] text-text-muted mt-0.5">
                                Receiving real-time 10-minute encrypted copy trading signals
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-semantic-success/15 text-semantic-success border border-semantic-success/30">
                              VERIFIED HUMAN
                            </span>
                          </div>

                          {/* Full Follower Account Number / Address Block */}
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
                                  onClick={() => copyToClipboard(accountAddr, `p-f-acct-${f._id}`)}
                                  className="copy-chip text-[10px] py-1 px-1.5"
                                  title="Copy follower account address"
                                >
                                  {copiedKey === `p-f-acct-${f._id}` ? <Check className="w-3 h-3 text-semantic-success" /> : <Copy className="w-3 h-3" />}
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
                              <span className="text-text-muted">Follower Nullifier:</span>
                              <span className="mono text-text-secondary">{truncateHash(f.followerNullifier || follower?.nullifierHash, 10)}</span>
                            </div>

                            {/* Arkiv Entity Key */}
                            {f.arkivEntityKey && (
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="text-text-muted flex items-center gap-1">
                                  <Database className="w-3 h-3 text-accent" />
                                  Arkiv Relationship Key:
                                </span>
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
      </div>
    </div>
  )
}
