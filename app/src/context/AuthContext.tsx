import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { storage } from '../utils/storage'
import type { User, AuthContextType } from '../types/auth'

const AuthContext = createContext<AuthContextType | null>(null)

const DEMO_USER: User = {
  id: 'usr_zk_9824f11a',
  nullifierHash: '0x3f8a912e74d1c9b2e457fa8820641b9d4c728310e527b13fa2487e8129dca042',
  username: 'ShieldedFollower_42',
  walletAddress: '0x71C...B492',
  walletConnectedAt: new Date().toISOString(),
  bio: 'Anonymous follower allocating capital to verified zero-knowledge leaders.',
  avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  verificationLevel: 'orb',
  loginCount: 3,
  createdAt: '2026-03-01T12:00:00.000Z',
  lastLogin: new Date().toISOString(),
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const savedToken = await storage.getItem('syndicate_token')
        const savedUser = await storage.getItem('syndicate_user')
        if (savedToken && savedUser) {
          setToken(savedToken)
          setUser(JSON.parse(savedUser))
        }
      } catch (err) {
        console.warn('Failed to load stored auth session:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadStoredAuth()
  }, [])

  const login = async (newToken: string, newUser: User) => {
    await storage.setItem('syndicate_token', newToken)
    await storage.setItem('syndicate_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = async () => {
    await storage.removeItem('syndicate_token')
    await storage.removeItem('syndicate_user')
    setToken(null)
    setUser(null)
  }

  const simulateSandboxLogin = async () => {
    setIsLoading(true)
    // Simulate ZK proof verification generation
    await new Promise((resolve) => setTimeout(resolve, 800))
    const mockToken = 'mock_jwt_zk_' + Math.random().toString(36).substring(2, 15)
    await login(mockToken, {
      ...DEMO_USER,
      lastLogin: new Date().toISOString(),
      loginCount: (user?.loginCount || 0) + 1,
    })
    setIsLoading(false)
  }

  const refreshUser = async () => {
    if (user) {
      setUser({ ...user, lastLogin: new Date().toISOString() })
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        simulateSandboxLogin,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

