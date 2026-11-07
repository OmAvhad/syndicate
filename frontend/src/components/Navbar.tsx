import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useSignals } from '@/context/SignalContext'
import { truncateHash } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle'
import WalletConnectButton from '@/components/WalletConnectButton'
import MetaMaskPromptBanner from '@/components/MetaMaskPromptBanner'
import { LogOut, User, ChevronDown, ShieldCheck, Menu, X, LayoutDashboard, Wallet, Compass, TrendingUp, Radio, Zap, Download, AlertCircle, Trophy, MessageSquare } from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { activeSignalCount } = useSignals()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const displayName = user?.username ? `@${user.username}` : 'Verified Human'

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto h-16 px-6 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-sm bg-accent flex items-center justify-center transition-transform duration-fast ease-standard group-hover:scale-105 shadow-[0_0_16px_rgba(198,243,106,0.2)]">
            <ShieldCheck className="w-4 h-4 text-text-inverse stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-text-primary">WorldAuth</span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-pill bg-accent-soft text-accent border border-accent/25">
              ZK-ID
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3">
          <Link
            to="/"
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 lg:px-3 py-1.5 rounded-pill transition-colors duration-fast ${location.pathname === '/'
              ? 'bg-surface-raised text-text-primary border border-border'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </Link>

          <Link
            to="/leaderboard"
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 lg:px-3 py-1.5 rounded-pill transition-colors duration-fast ${location.pathname === '/leaderboard'
              ? 'bg-surface-raised text-text-primary border border-border'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Leaderboard</span>
          </Link>

          <Link
            to="/feed"
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 lg:px-3 py-1.5 rounded-pill transition-colors duration-fast ${location.pathname === '/feed'
              ? 'bg-surface-raised text-text-primary border border-border'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-accent" />
            <span>Feed</span>
          </Link>

          <Link
            to="/explore"
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 lg:px-3 py-1.5 rounded-pill transition-colors duration-fast ${location.pathname === '/explore'
              ? 'bg-surface-raised text-text-primary border border-border'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Explore
          </Link>

          <Link
            to="/trade"
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 lg:px-3 py-1.5 rounded-pill transition-colors duration-fast ${location.pathname === '/trade'
              ? 'bg-accent text-text-inverse shadow-[0_0_12px_rgba(198,243,106,0.2)]'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
          >
            <TrendingUp className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Terminal</span>
          </Link>

          <Link to="/history" className="text-xs font-semibold text-text-secondary hover:text-text-primary px-2 py-1.5">History</Link>
          <Link
            to="/flash-trade"
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-pill transition-colors duration-fast ${
              location.pathname === '/flash-trade'
                ? 'bg-accent text-text-inverse font-bold shadow-[0_0_12px_rgba(198,243,106,0.25)]'
                : 'text-accent border border-accent/30 bg-accent-soft hover:bg-accent/20'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Flash Orders</span>
          </Link>

          {/* Active Signals Live Indicator */}
          {activeSignalCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-pill bg-accent-soft border border-accent/40 text-xs text-accent animate-pulse font-semibold">
              <Radio className="w-3 h-3 text-accent" />
              <span>{activeSignalCount} Signal{activeSignalCount > 1 ? 's' : ''} Live</span>
            </div>
          )}
          {/* World ID Verified Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface border border-border text-xs text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-semantic-success shadow-[0_0_8px_rgba(121,217,154,0.6)]" />
            <span className="tnum font-medium">World ID</span>
          </div>

          {/* MetaMask Wallet Status Pill or 1-Click Connect Prompt */}
          {user?.walletAddress ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface border border-border text-xs text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-semantic-success shadow-[0_0_8px_rgba(121,217,154,0.6)]" />
              <Wallet className="w-3.5 h-3.5 text-accent stroke-[2]" />
              <span className="mono tnum text-text-primary font-medium">{truncateHash(user.walletAddress, 6)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <WalletConnectButton variant="compact" />
            </div>
          )}

          {/* Judge Log Export Button */}
          <button
            type="button"
            onClick={() => window.downloadJudgeLogs && window.downloadJudgeLogs()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-accent-soft hover:bg-accent/20 border border-accent/40 text-xs font-semibold text-accent transition-colors cursor-pointer"
            title="Download output.md for hackathon judges"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">output.md</span>
          </button>

          {/* Theme Switcher Button */}
          <ThemeToggle variant="compact" />

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-hover hover:border-border-strong transition-all duration-fast cursor-pointer"
            >
              <div className="w-6 h-6 rounded-sm bg-surface-raised border border-border flex items-center justify-center text-xs font-bold text-accent">
                {(displayName || 'W')[0].toUpperCase()}
              </div>
              <span className="text-xs font-medium text-text-primary max-w-[120px] truncate tnum">
                {displayName}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-text-muted transition-transform duration-fast ${dropdownOpen ? 'rotate-180' : ''
                  }`}
              />
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-64 rounded-md overflow-hidden bg-surface-raised border border-border-strong shadow-[0_12px_32px_rgba(0,0,0,0.6)] animate-fadeIn z-50"
              >
                <div className="px-3.5 py-2.5 border-b border-border space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                    {user?.username ? `@${user.username}` : 'World ID Verified Human'}
                  </div>
                  <div className="text-[11px] font-mono text-text-secondary truncate tnum flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-semantic-success" />
                    <span>Nullifier: {truncateHash(user?.nullifierHash, 8)}</span>
                  </div>
                  {user?.walletAddress ? (
                    <div className="text-[11px] font-mono text-accent truncate tnum flex items-center gap-1 pt-1 border-t border-border/60">
                      <Wallet className="w-3 h-3 shrink-0" />
                      <span>Wallet: {truncateHash(user.walletAddress, 8)}</span>
                    </div>
                  ) : (
                    <div className="pt-1.5 border-t border-border/60">
                      <div className="text-[10px] text-amber-400 font-bold mb-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        <span>MetaMask Not Connected</span>
                      </div>
                      <WalletConnectButton variant="compact" />
                    </div>
                  )}
                </div>

                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  Edit Profile & Subscription Fee
                </Link>

                <div className="h-px bg-border" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs text-semantic-danger hover:bg-semantic-danger/10 transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle variant="compact" />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-text-secondary hover:text-text-primary p-2"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-b border-border bg-surface-raised p-4 space-y-3 animate-fadeIn">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary rounded-md hover:bg-surface-hover"
          >
            <LayoutDashboard className="w-4 h-4 text-accent" />
            Dashboard
          </Link>
          <Link
            to="/leaderboard"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary rounded-md hover:bg-surface-hover"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            Leaderboard
          </Link>
          <Link
            to="/feed"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary rounded-md hover:bg-surface-hover"
          >
            <MessageSquare className="w-4 h-4 text-accent" />
            Feed
          </Link>
          <Link
            to="/explore"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary rounded-md hover:bg-surface-hover"
          >
            <Compass className="w-4 h-4 text-accent" />
            Explore Leaders
          </Link>
          <Link
            to="/trade"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary rounded-md hover:bg-surface-hover"
          >
            <TrendingUp className="w-4 h-4 text-accent" />
            <span>Trade Terminal</span>
            {activeSignalCount > 0 && (
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-pill bg-accent text-text-inverse font-bold">
                {activeSignalCount} Live
              </span>
            )}
          </Link>
          <Link
            to="/flash-trade"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary rounded-md hover:bg-surface-hover"
          >
            <Zap className="w-4 h-4 text-accent fill-current" />
            <span>Flash Orders (Definitive)</span>
          </Link>
          <Link
            to="/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary rounded-md hover:bg-surface-hover"
          >
            <User className="w-4 h-4 text-accent" />
            Profile & Wallet
          </Link>
          <div className="flex items-center justify-between px-3 py-2 rounded-md bg-surface border border-border">
            <span className="text-xs font-semibold text-text-secondary">Theme</span>
            <ThemeToggle variant="pill" showLabel />
          </div>
          <div className="h-px bg-border" />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-semantic-danger rounded-md hover:bg-semantic-danger/10 text-left"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </nav>
  )
}
