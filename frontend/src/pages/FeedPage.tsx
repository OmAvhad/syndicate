import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { truncateHash } from '@/lib/utils'
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  Heart,
  Send,
  Loader2,
  ShieldCheck,
  Tag,
  Paperclip,
  Share2,
  ExternalLink,
  Flame,
  Globe,
  Users,
  Check,
  AlertCircle,
} from 'lucide-react'

interface PostAuthor {
  id: string
  username: string
  nullifierHash: string
  walletAddress: string | null
  riskLevel: string
  tradingStyle: string
  tags: string[]
  subscribersCount: number
  stats: {
    totalPnlUsdc?: number
    winRate?: number
    totalTrades?: number
  }
}

interface TradeSnapshot {
  symbol?: string
  side?: string
  entryPrice?: number
  exitPrice?: number
  realizedPnl?: number
  isClosed?: boolean
  status?: string
}

interface FeedPost {
  id: string
  content: string
  tags: string[]
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  promiseId: string | null
  tradeSnapshot: TradeSnapshot | null
  likesCount: number
  isLiked: boolean
  createdAt: string
  author: PostAuthor | null
}

export default function FeedPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'global' | 'following'>('global')

  // Create post state
  const [content, setContent] = useState('')
  const [sentiment, setSentiment] = useState<'BULLISH' | 'BEARISH' | 'NEUTRAL'>('NEUTRAL')
  const [tagsInput, setTagsInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recentTrades, setRecentTrades] = useState<any[]>([])
  const [selectedTradeId, setSelectedTradeId] = useState<string>('')
  const [showAttachTrade, setShowAttachTrade] = useState(false)

  // Fetch feed posts
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/api/posts', { params: { filter } })
      if (res.data?.success) {
        setPosts(res.data.posts || [])
      }
    } catch (err: any) {
      console.error('Failed to load posts:', err)
      setError(err.response?.data?.error || 'Failed to load trade posts feed')
    } finally {
      setLoading(false)
    }
  }, [filter])

  // Fetch recent trades for post attachment
  const fetchRecentTrades = async () => {
    try {
      const res = await api.get('/api/trades/history?page=0')
      if (res.data?.success) {
        setRecentTrades(res.data.trades?.slice(0, 5) || [])
      }
    } catch (e) {
      console.warn('Could not load recent trades for attachment')
    }
  }

  useEffect(() => {
    fetchPosts()
    fetchRecentTrades()
  }, [fetchPosts])

  // Publish new post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    try {
      setIsSubmitting(true)
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean)

      const payload: any = {
        content: content.trim(),
        sentiment,
        tags,
      }
      if (selectedTradeId) {
        payload.tradeId = selectedTradeId
      }

      const res = await api.post('/api/posts', payload)
      if (res.data?.success) {
        setContent('')
        setTagsInput('')
        setSelectedTradeId('')
        setShowAttachTrade(false)
        setSentiment('NEUTRAL')
        fetchPosts()
      }
    } catch (err: any) {
      console.error('Failed to publish post:', err)
      alert(err.response?.data?.error || 'Failed to publish post')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle Like
  const handleToggleLike = async (postId: string) => {
    try {
      // Optimistic update
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const nextLiked = !p.isLiked
            return {
              ...p,
              isLiked: nextLiked,
              likesCount: nextLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
            }
          }
          return p
        })
      )
      await api.post(`/api/posts/${postId}/like`)
    } catch (err) {
      console.error('Like error:', err)
      // Revert if error
      fetchPosts()
    }
  }

  return (
    <div className="flex-1 w-full bg-bg py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        {/* Feed Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-accent" />
              Alpha Trade Feed
            </h1>
            <p className="text-xs text-text-secondary">
              Real-time market commentary, trade breakdowns, and thesis sharing from verified leaders.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center bg-surface-raised p-1 rounded-pill border border-border">
            <button
              type="button"
              onClick={() => setFilter('global')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-pill font-medium transition-colors ${
                filter === 'global'
                  ? 'bg-accent text-text-inverse font-semibold shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Global Alpha
            </button>
            <button
              type="button"
              onClick={() => setFilter('following')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-pill font-medium transition-colors ${
                filter === 'following'
                  ? 'bg-accent text-text-inverse font-semibold shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Following
            </button>
          </div>
        </div>

        {/* Post Creation Box */}
        <Card className="bg-surface border-border shadow-sm">
          <CardContent className="p-4 space-y-3">
            <form onSubmit={handleCreatePost} className="space-y-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share trade rationale, market insights, or bracket entry conditions..."
                rows={3}
                maxLength={1200}
                className="w-full bg-surface-raised border border-border rounded-xl p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
              />

              {/* Sentiment Selector & Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted font-medium">Sentiment:</span>
                  <div className="inline-flex rounded-lg border border-border bg-surface-raised p-0.5">
                    <button
                      type="button"
                      onClick={() => setSentiment('BULLISH')}
                      className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md font-semibold transition-colors ${
                        sentiment === 'BULLISH'
                          ? 'bg-semantic-success/20 text-semantic-success border border-semantic-success/30'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <TrendingUp className="w-3 h-3 text-semantic-success" /> Bullish
                    </button>
                    <button
                      type="button"
                      onClick={() => setSentiment('BEARISH')}
                      className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md font-semibold transition-colors ${
                        sentiment === 'BEARISH'
                          ? 'bg-semantic-error/20 text-semantic-error border border-semantic-error/30'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <TrendingDown className="w-3 h-3 text-semantic-error" /> Bearish
                    </button>
                    <button
                      type="button"
                      onClick={() => setSentiment('NEUTRAL')}
                      className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md font-semibold transition-colors ${
                        sentiment === 'NEUTRAL'
                          ? 'bg-surface text-text-primary border border-border shadow-sm'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <Minus className="w-3 h-3" /> Neutral
                    </button>
                  </div>

                  {/* Attach Trade Toggle */}
                  {recentTrades.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAttachTrade(!showAttachTrade)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        showAttachTrade || selectedTradeId
                          ? 'bg-accent-soft text-accent border-accent/40 font-semibold'
                          : 'bg-surface-raised border-border text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <Paperclip className="w-3 h-3" />
                      {selectedTradeId ? 'Trade Attached' : 'Attach Trade'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-muted mono">{1200 - content.length}</span>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !content.trim()}
                    size="sm"
                    className="bg-accent text-text-inverse font-bold text-xs gap-1.5 shadow-sm"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Post Alpha
                  </Button>
                </div>
              </div>

              {/* Trade Attachment Dropdown */}
              {showAttachTrade && recentTrades.length > 0 && (
                <div className="p-3 bg-surface-raised rounded-xl border border-border space-y-1.5 animate-fadeIn">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-text-primary">Attach an executed trade from your history:</span>
                    {selectedTradeId && (
                      <button
                        type="button"
                        onClick={() => setSelectedTradeId('')}
                        className="text-text-muted hover:text-semantic-error text-[11px]"
                      >
                        Clear selection
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {recentTrades.map((t) => (
                      <label
                        key={t._id}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selectedTradeId === t._id
                            ? 'bg-accent-soft/30 border-accent/50 text-text-primary'
                            : 'bg-surface border-border text-text-secondary hover:border-border-hover'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="attachedTrade"
                            checked={selectedTradeId === t._id}
                            onChange={() => setSelectedTradeId(t._id)}
                            className="text-accent"
                          />
                          <span className="font-bold">{t.symbol}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${t.side === 'BUY' ? 'bg-semantic-success/20 text-semantic-success' : 'bg-semantic-error/20 text-semantic-error'}`}>
                            {t.side}
                          </span>
                          <span className="mono text-text-muted">@ ${t.limit || t.executionPrice}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] mono">
                          <span>Status: {t.status}</span>
                          {t.claimEntityKey && <Badge variant="muted" className="text-[10px] text-purple-400">Claimed</Badge>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags Input */}
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Tags (comma-separated, e.g. eth, swing, breakout)"
                  className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
                />
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Posts List */}
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
            <p className="text-sm text-text-secondary">Loading feed updates...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-semantic-error/10 border border-semantic-error/30 text-semantic-error text-center text-xs">
            {error}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center bg-surface rounded-xl border border-border p-8 space-y-2">
            <MessageSquare className="w-8 h-8 text-text-muted mx-auto" />
            <p className="text-sm font-semibold text-text-primary">No posts found in this feed yet</p>
            <p className="text-xs text-text-secondary">
              Be the first leader to post an analysis, or switch to Global Alpha to see all traders.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="bg-surface border-border hover:border-border-hover transition-colors">
                <CardContent className="p-5 space-y-3">
                  {/* Author Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-accent-soft border border-accent/30 flex items-center justify-center font-bold text-xs text-accent">
                        {post.author?.username?.slice(0, 2).toUpperCase() || 'TR'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-text-primary">
                            {post.author?.username || 'Verified Leader'}
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-semantic-success/10 text-semantic-success border border-semantic-success/20">
                            <ShieldCheck className="w-3 h-3" /> Human
                          </span>
                          {post.author?.riskLevel && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-raised text-text-muted border border-border uppercase font-semibold">
                              {post.author.riskLevel}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-text-muted">
                          {new Date(post.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Sentiment Badge */}
                    {post.sentiment && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          post.sentiment === 'BULLISH'
                            ? 'bg-semantic-success/10 text-semantic-success border border-semantic-success/30'
                            : post.sentiment === 'BEARISH'
                            ? 'bg-semantic-error/10 text-semantic-error border border-semantic-error/30'
                            : 'bg-surface-raised text-text-muted border border-border'
                        }`}
                      >
                        {post.sentiment === 'BULLISH' && <TrendingUp className="w-3 h-3" />}
                        {post.sentiment === 'BEARISH' && <TrendingDown className="w-3 h-3" />}
                        {post.sentiment === 'NEUTRAL' && <Minus className="w-3 h-3" />}
                        {post.sentiment}
                      </span>
                    )}
                  </div>

                  {/* Post Content */}
                  <p className="text-sm text-text-primary whitespace-pre-line leading-relaxed">
                    {post.content}
                  </p>

                  {/* Attached Trade Card (if present) */}
                  {post.tradeSnapshot && (
                    <div className="bg-surface-raised border border-border rounded-xl p-3 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-accent-soft text-accent">
                          <TrendingUp className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-text-primary">{post.tradeSnapshot.symbol || 'ETH/USDC'}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-semantic-success/20 text-semantic-success">
                              {post.tradeSnapshot.side || 'BUY'}
                            </span>
                            <span className="mono text-text-muted">Entry: ${post.tradeSnapshot.entryPrice || 3000}</span>
                          </div>
                          {post.tradeSnapshot.exitPrice && (
                            <span className="text-[11px] text-text-secondary mono">
                              Exit: ${post.tradeSnapshot.exitPrice}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        {post.tradeSnapshot.realizedPnl !== undefined && post.tradeSnapshot.realizedPnl !== null ? (
                          <div className="font-bold mono text-semantic-success">
                            +${post.tradeSnapshot.realizedPnl.toFixed(2)} USDC
                          </div>
                        ) : null}
                        <span className="text-[10px] text-text-muted uppercase font-semibold">
                          {post.tradeSnapshot.status || 'CLOSED'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {post.tags.map((t) => (
                        <span key={t} className="text-[11px] text-accent hover:underline font-mono cursor-pointer">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Post Actions Footer */}
                  <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs text-text-muted">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1.5 transition-colors ${
                        post.isLiked ? 'text-semantic-error font-bold' : 'hover:text-text-primary'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-current' : ''}`} />
                      <span>{post.likesCount}</span>
                    </button>

                    <div className="flex items-center gap-3">
                      {post.author?.walletAddress && (
                        <Link
                          to="/explore"
                          className="hover:text-accent flex items-center gap-1 text-[11px]"
                        >
                          Copy Leader <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
