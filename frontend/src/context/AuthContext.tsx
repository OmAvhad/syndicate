import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api from '../lib/api'

interface User {
  id: string
  nullifierHash: string
  username?: string
  walletAddress?: string | null
  walletConnectedAt?: string | null
  subscriptionFee?: number
  followersCount?: number
  followingCount?: number
  bio?: string
  avatarUrl?: string
  verificationLevel: string
  loginCount: number
  createdAt: string
  lastLogin: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('world-id-token', newToken)
    localStorage.setItem('world-id-user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('world-id-token')
    localStorage.removeItem('world-id-user')
    setToken(null)
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const res = await api.get('/api/user/profile')
      setUser(res.data)
      localStorage.setItem('world-id-user', JSON.stringify(res.data))
    } catch {
      logout()
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem('world-id-token')
    const savedUser = localStorage.getItem('world-id-user')

    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
      // Verify token is still valid
      api.get('/api/user/profile')
        .then((res) => {
          setUser(res.data)
          localStorage.setItem('world-id-user', JSON.stringify(res.data))
        })
        .catch(() => {
          logout()
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token && !!user,
      isLoading,
      login,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
