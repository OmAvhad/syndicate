import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import WalletConnectButton from '@/components/WalletConnectButton'
import { truncateHash } from '@/lib/utils'
import { publicClient, USDC_SEPOLIA, ERC20_ABI, LEADER_BURNER_ADDRESS, FOLLOWER_BURNER_ADDRESS } from '@/lib/flashEngine'
import { getOrCreateBaseBurner, fetchBaseMainnetBalances, BASE_MAINNET_EXPLORER } from '@/lib/baseBurner'
import { readCachedBalance } from '@/lib/shielded/balanceCache'
import { formatEther, formatUnits, type Address } from 'viem'
import {
  Wallet,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Zap,
  TrendingUp,
  ArrowUpRight,
  Copy,
  Check,
  Coins,
  Radio,
  Lock,
  Globe,
} from 'lucide-react'

interface DashboardBalanceCardProps {
  userId: string
  walletAddress?: string | null
}

export default function DashboardBalanceCard({ userId, walletAddress }: DashboardBalanceCardProps) {
  const [loading, setLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [activeBurnerRole, setActiveBurnerRole] = useState<'base' | 'leader' | 'follower'>('base')

  // Base Mainnet Burner
  const [baseBurner] = useState(() => getOrCreateBaseBurner())
  const [baseBurnerBal, setBaseBurnerBal] = useState<{ eth: string; usdc: string } | null>(null)
  const [baseMainBal, setBaseMainBal] = useState<{ eth: string; usdc: string } | null>(null)

  // MetaMask balances on Sepolia
  const [metaEth, setMetaEth] = useState<string | null>(null)
  const [metaUsdc, setMetaUsdc] = useState<string | null>(null)

  // Burner balances on Sepolia
  const [leaderEth, setLeaderEth] = useState<string>('0.0075')
  const [leaderUsdc, setLeaderUsdc] = useState<string>('20.51')
  const [followerEth, setFollowerEth] = useState<string>('0.0040')
  const [followerUsdc, setFollowerUsdc] = useState<string>('7.00')

  // Shielded private balances
  const [privateUsdc, setPrivateUsdc] = useState<string>('0.00')
  const [privateWeth, setPrivateWeth] = useState<string>('0.0000')

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(id)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const loadBalances = useCallback(async () => {
    setLoading(true)
    try {
      // 0. Fetch Base Mainnet balances
      const [bBurner, bMain] = await Promise.all([
        fetchBaseMainnetBalances(baseBurner.address).catch(() => null),
        walletAddress ? fetchBaseMainnetBalances(walletAddress as Address).catch(() => null) : null,
      ])
      if (bBurner) setBaseBurnerBal(bBurner)
      if (bMain) setBaseMainBal(bMain)

      // 1. Fetch burner balances on Sepolia
      const [lEth, lUsdc, fEth, fUsdc] = await Promise.all([
        publicClient.getBalance({ address: LEADER_BURNER_ADDRESS as Address }).catch(() => null),
        publicClient.readContract({
          address: USDC_SEPOLIA,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [LEADER_BURNER_ADDRESS as Address],
        }).catch(() => null),
        publicClient.getBalance({ address: FOLLOWER_BURNER_ADDRESS as Address }).catch(() => null),
        publicClient.readContract({
          address: USDC_SEPOLIA,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [FOLLOWER_BURNER_ADDRESS as Address],
        }).catch(() => null),
      ])

      if (lEth !== null) setLeaderEth(Number(formatEther(lEth)).toFixed(4))
      if (lUsdc !== null) setLeaderUsdc(Number(formatUnits(lUsdc, 6)).toFixed(2))
      if (fEth !== null) setFollowerEth(Number(formatEther(fEth)).toFixed(4))
      if (fUsdc !== null) setFollowerUsdc(Number(formatUnits(fUsdc, 6)).toFixed(2))

      // 2. Fetch connected MetaMask balance if available
      if (walletAddress) {
        const [mEth, mUsdc] = await Promise.all([
          publicClient.getBalance({ address: walletAddress as Address }).catch(() => null),
          publicClient.readContract({
            address: USDC_SEPOLIA,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddress as Address],
          }).catch(() => null),
        ])

        if (mEth !== null) setMetaEth(Number(formatEther(mEth)).toFixed(4))
        if (mUsdc !== null) setMetaUsdc(Number(formatUnits(mUsdc, 6)).toFixed(2))
      } else {
        setMetaEth(null)
        setMetaUsdc(null)
      }

      // 3. Read cached shielded pool balance
      if (walletAddress) {
        const cached = readCachedBalance({ userId, walletAddress })
        if (cached?.balances) {
          const usdcBal = cached.balances.find((b) => b.symbol === 'USDC')?.amount || '0.00'
          const wethBal = cached.balances.find((b) => b.symbol === 'WETH')?.amount || '0.0000'
          setPrivateUsdc(usdcBal)
          setPrivateWeth(wethBal)
        }
      }
    } catch (err) {
      console.warn('[DashboardBalance] Failed to refresh onchain balances:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, walletAddress])

  useEffect(() => {
    loadBalances()
  }, [loadBalances])

  // Aggregate numbers
  const currentBurnerUsdc = activeBurnerRole === 'leader' ? Number(leaderUsdc) : Number(followerUsdc)
  const currentBurnerEth = activeBurnerRole === 'leader' ? Number(leaderEth) : Number(followerEth)
  const metaUsdcNum = metaUsdc ? Number(metaUsdc) : 0
  const privUsdcNum = Number(privateUsdc) || 0
  const totalUsdcCapital = (currentBurnerUsdc + metaUsdcNum + privUsdcNum).toFixed(2)

  return (
    <div className="mb-8 space-y-4">
      {/* Top Banner: Total Portfolio & Quick Actions */}
      <div className="surface p-5 rounded-lg border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-md bg-accent-soft border border-accent/30 flex items-center justify-center text-accent shrink-0">
            <Coins className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Available Trading Capital</span>
              <Badge variant="accent" className="text-[10px] py-0 px-1.5">Sepolia Live</Badge>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="mono tnum text-2xl font-black text-text-primary">${totalUsdcCapital}</span>
              <span className="text-xs font-bold text-text-muted">USDC</span>
              <span className="text-xs text-text-muted ml-2">
                (Burner: ${currentBurnerUsdc.toFixed(2)} · Shielded: ${privUsdcNum.toFixed(2)} · Wallet: ${metaUsdcNum.toFixed(2)})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={loadBalances}
            disabled={loading}
            className="px-3 py-1.5 rounded-md bg-surface-raised hover:bg-surface-hover border border-border text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh onchain balances"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-accent' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/flash-trade"
            className="px-3 py-1.5 rounded-md bg-accent-soft hover:bg-accent/20 border border-accent/40 text-xs font-bold text-accent transition-colors flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Flash Orders</span>
          </Link>

          <Link
            to="/trade"
            className="px-3 py-1.5 rounded-md bg-accent hover:bg-[#d4f885] text-text-inverse text-xs font-bold transition-all shadow-[0_2px_10px_rgba(198,243,106,0.2)] flex items-center gap-1.5"
          >
            <TrendingUp className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Terminal</span>
          </Link>
        </div>
      </div>

      {/* 3-Column Balance Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: MetaMask Connected Wallet */}
        <Card className="hover:border-accent/40 transition-colors">
          <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-accent" />
                  <span className="text-xs font-bold text-text-primary">MetaMask Wallet</span>
                </div>
                {walletAddress ? (
                  <Badge variant="success" className="text-[10px]">Connected</Badge>
                ) : (
                  <Badge variant="muted" className="text-[10px]">Disconnected</Badge>
                )}
              </div>

              {walletAddress ? (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Address:</span>
                    <div className="flex items-center gap-1">
                      <span className="mono tnum text-[11px] font-bold text-text-primary">
                        {truncateHash(walletAddress, 6)}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(walletAddress, 'meta-addr')}
                        className="copy-chip text-[9px] p-0.5"
                      >
                        {copiedKey === 'meta-addr' ? <Check className="w-2.5 h-2.5 text-semantic-success" /> : <Copy className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-surface-raised border border-border space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-muted">Sepolia ETH:</span>
                      <span className="mono tnum font-bold text-text-primary">{metaEth ?? '0.0000'} ETH</span>
                    </div>
                    {baseMainBal && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-muted">Base Mainnet ETH:</span>
                        <span className="mono tnum font-extrabold text-[#0052FF]">{baseMainBal.eth} ETH</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-muted">Sepolia USDC:</span>
                      <span className="mono tnum font-extrabold text-accent">{metaUsdc ? `$${metaUsdc}` : '$0.00'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center space-y-2">
                  <p className="text-xs text-text-muted">Link MetaMask to deposit funds into the shielded pool or pay leader fees.</p>
                  <WalletConnectButton variant="compact" />
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border/80 flex items-center justify-between text-[11px] text-text-muted">
              <span>Network</span>
              <span className="mono font-semibold text-text-secondary">Ethereum Sepolia</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Kohaku Private Shielded Pool */}
        <Card className="hover:border-accent/40 transition-colors">
          <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-accent" />
                  <span className="text-xs font-bold text-text-primary">Private Shielded Pool</span>
                </div>
                <Badge variant="accent" className="text-[10px]">Zero-Knowledge</Badge>
              </div>

              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Railgun Status:</span>
                  <span className="text-semantic-success font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Encrypted Notes
                  </span>
                </div>

                <div className="p-2.5 rounded bg-surface-raised border border-border space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted">Private USDC:</span>
                    <span className="mono tnum font-extrabold text-accent">${privateUsdc}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted">Private WETH:</span>
                    <span className="mono tnum font-bold text-text-primary">{privateWeth} WETH</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/80 flex items-center justify-between text-[11px]">
              <span className="text-text-muted">Shielded Storage</span>
              <span className="text-accent font-semibold flex items-center gap-0.5">
                <span>IndexedDB Synced</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Dedicated Execution Burners */}
        <Card className="hover:border-accent/40 transition-colors">
          <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent fill-current" />
                  <span className="text-xs font-bold text-text-primary">Execution Burner</span>
                </div>
                <div className="flex items-center rounded bg-surface-raised border border-border p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setActiveBurnerRole('base')}
                    className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      activeBurnerRole === 'base' ? 'bg-[#0052FF] text-white' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Base
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBurnerRole('leader')}
                    className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      activeBurnerRole === 'leader' ? 'bg-accent text-text-inverse' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Leader
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveBurnerRole('follower')}
                    className={`px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                      activeBurnerRole === 'follower' ? 'bg-accent text-text-inverse' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Follower
                  </button>
                </div>
              </div>

              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Burner Address:</span>
                  <div className="flex items-center gap-1">
                    <span className="mono tnum text-[11px] font-bold text-text-primary">
                      {truncateHash(
                        activeBurnerRole === 'base'
                          ? baseBurner.address
                          : activeBurnerRole === 'leader'
                          ? LEADER_BURNER_ADDRESS
                          : FOLLOWER_BURNER_ADDRESS,
                        6
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          activeBurnerRole === 'base'
                            ? baseBurner.address
                            : activeBurnerRole === 'leader'
                            ? LEADER_BURNER_ADDRESS
                            : FOLLOWER_BURNER_ADDRESS,
                          'burner-addr'
                        )
                      }
                      className="copy-chip text-[9px] p-0.5"
                    >
                      {copiedKey === 'burner-addr' ? <Check className="w-2.5 h-2.5 text-semantic-success" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>
                    <a
                      href={
                        activeBurnerRole === 'base'
                          ? `${BASE_MAINNET_EXPLORER}/address/${baseBurner.address}`
                          : `https://sepolia.etherscan.io/address/${activeBurnerRole === 'leader' ? LEADER_BURNER_ADDRESS : FOLLOWER_BURNER_ADDRESS}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-text-muted hover:text-text-primary p-0.5"
                      title={activeBurnerRole === 'base' ? 'View on BaseScan' : 'View on Etherscan'}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-surface-raised border border-border space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted">{activeBurnerRole === 'base' ? 'Base ETH:' : 'Gas Reserve (ETH):'}</span>
                    <span className="mono tnum font-bold text-text-primary">
                      {activeBurnerRole === 'base'
                        ? `${baseBurnerBal?.eth ?? '0.0000'} ETH`
                        : activeBurnerRole === 'leader'
                        ? `${leaderEth} ETH`
                        : `${followerEth} ETH`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted">{activeBurnerRole === 'base' ? 'Base USDC:' : 'Trading Capital:'}</span>
                    <span className="mono tnum font-extrabold text-accent">
                      {activeBurnerRole === 'base'
                        ? `$${baseBurnerBal?.usdc ?? '0.00'} USDC`
                        : activeBurnerRole === 'leader'
                        ? `$${leaderUsdc} USDC`
                        : `$${followerUsdc} USDC`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/80 flex items-center justify-between text-[11px] text-text-muted">
              <span>{activeBurnerRole === 'base' ? 'Network' : 'Burner Mode'}</span>
              <span className="text-accent font-semibold">
                {activeBurnerRole === 'base' ? 'Base Mainnet (8453)' : 'Pre-Funded EIP-712'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

