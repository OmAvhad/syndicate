import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { truncateHash } from '@/lib/utils'
import { LogOut, User, ChevronDown, ShieldCheck, Menu, X, LayoutDashboard, Wallet } from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const identifier = user?.username || truncateHash(user?.nullifierHash)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-bg/85 backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
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
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/"
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-pill transition-colors duration-fast ${
              location.pathname === '/'
                ? 'bg-surface-raised text-text-primary border border-border'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </Link>

          {/* World ID Verified Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface border border-border text-xs text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-semantic-success shadow-[0_0_8px_rgba(121,217,154,0.6)]" />
            <span className="tnum font-medium">World ID</span>
          </div>

          {/* MetaMask Wallet Status Pill */}
          {user?.walletAddress ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface border border-border text-xs text-text-secondary">
              <Wallet className="w-3.5 h-3.5 text-accent stroke-[2]" />
              <span className="mono tnum text-text-primary font-medium">{truncateHash(user.walletAddress, 6)}</span>
            </div>
          ) : (
            <Link
              to="/profile"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface hover:bg-surface-hover border border-border hover:border-accent text-xs text-text-muted hover:text-accent transition-colors"
              title="Link MetaMask Wallet"
            >
              <Wallet className="w-3.5 h-3.5 stroke-[1.8]" />
              <span>Link Wallet</span>
            </Link>
          )}

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-hover hover:border-border-strong transition-all duration-fast cursor-pointer"
            >
              <div className="w-6 h-6 rounded-sm bg-surface-raised border border-border flex items-center justify-center text-xs font-bold text-accent">
                {(identifier || 'W')[0].toUpperCase()}
              </div>
              <span className="text-xs font-medium text-text-primary max-w-[120px] truncate tnum">
                {user?.username ? `@${user.username}` : identifier}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-text-muted transition-transform duration-fast ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-md overflow-hidden bg-surface-raised border border-border-strong shadow-[0_12px_32px_rgba(0,0,0,0.6)] animate-fadeIn z-50"
              >
                <div className="px-3.5 py-2.5 border-b border-border">
                  <div className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
                    {user?.username ? `@${user.username}` : 'Authenticated Human'}
                  </div>
                  <div className="text-xs font-mono text-text-primary truncate tnum mt-0.5">
                    {truncateHash(user?.nullifierHash, 10)}
                  </div>
                  {user?.walletAddress && (
                    <div className="text-[11px] font-mono text-accent truncate tnum mt-1 flex items-center gap-1">
                      <Wallet className="w-3 h-3 shrink-0" />
                      <span>{truncateHash(user.walletAddress, 8)}</span>
                    </div>
                  )}
                </div>

                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  Edit Profile & Wallet
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
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-text-secondary hover:text-text-primary p-2"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
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
            to="/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary rounded-md hover:bg-surface-hover"
          >
            <User className="w-4 h-4 text-accent" />
            Profile & Wallet
          </Link>
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
