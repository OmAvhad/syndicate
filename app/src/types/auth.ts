export interface User {
  id: string
  nullifierHash: string
  username?: string
  walletAddress?: string | null
  walletConnectedAt?: string | null
  bio?: string
  avatarUrl?: string
  verificationLevel: string
  loginCount: number
  createdAt: string
  lastLogin: string
}

export interface RpContext {
  rp_id: string
  nonce: string
  created_at: number
  expires_at: number
  signature: string
}

export interface BackendHealthState {
  isOnline: boolean
  url: string
  latencyMs?: number
  environment?: string
  timestamp?: string
  isChecking: boolean
  error?: string | null
}

export interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  backendHealth: BackendHealthState
  checkBackendHealth: () => Promise<void>
  login: (token: string, user: User) => Promise<void>
  logout: () => Promise<void>
  simulateSandboxLogin: () => Promise<void>
  refreshUser: () => Promise<void>
}
