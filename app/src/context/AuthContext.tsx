import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { storage } from '../utils/storage'
import { api } from '../api/client'
import { getBackendUrl } from '../api/config'
import type { User, AuthContextType, BackendHealthState } from '../types/auth'

const AuthContext = createContext<AuthContextType | null>(null)

const INITIAL_HEALTH: BackendHealthState = {
  isOnline: false,
  url: 'https://syndicate-backend-n3p9.onrender.com',
  isChecking: true,
  error: null,
}

const DEMO_USER: User = {
  id: 'usr_zk_9824f11a',
  nullifierHash: '0x3f8a912e74d1c9b2e457fa8820641b9d4c728310e527b13fa2487e8129dca042',
  username: 'ShieldedFollower_42',
  walletAddress: '0x71C...B492',
  walletConnectedAt: new Date().toISOString(),
  bio: 'Anonymous follower allocating capital to verified zero-knowledge leaders.',
  avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  verificationLevel: 'orb',
  loginCount: 1,
  createdAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [backendHealth, setBackendHealth] = useState<BackendHealthState>(INITIAL_HEALTH)

  const checkBackendHealth = async () => {
    try {
      const currentUrl = await getBackendUrl()
      setBackendHealth((prev) => ({ ...prev, isChecking: true, url: currentUrl, error: null }))
      const res = await api.getHealth()
      setBackendHealth({
        isOnline: res.status === 'ok',
        url: currentUrl,
        latencyMs: res.latencyMs,
        environment: res.environment,
        timestamp: res.timestamp,
        isChecking: false,
        error: null,
      })
    } catch (err: any) {
      setBackendHealth((prev) => ({
        ...prev,
        isOnline: false,
        isChecking: false,
        error: err.message || 'Cannot connect to backend',
      }))
    }
  }

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const savedToken = await storage.getItem('syndicate_token')
        const savedUser = await storage.getItem('syndicate_user')
        if (savedToken) {
          setToken(savedToken)
          if (savedUser) {
            setUser(JSON.parse(savedUser))
          }
          // Try fetching fresh profile from backend if online
          try {
            const freshProfile = await api.getProfile(savedToken)
            setUser(freshProfile)
            await storage.setItem('syndicate_user', JSON.stringify(freshProfile))
          } catch {
            // keep cached profile
          }
        }
      } catch (err) {
        console.warn('Failed to load stored auth session:', err)
      } finally {
        setIsLoading(false)
        checkBackendHealth()
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
    // 1. Fetch real signed rp_context from Render backend to test live connectivity
    let rpContextData = null
    try {
      const rpRes = await api.getRpContext()
      rpContextData = rpRes.rp_context
    } catch (err) {
      console.warn('Could not fetch live rp_context, using fallback:', err)
    }

    const mockNullifier =
      '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

    // Try verifying on real backend to create real Mongo record
    let finalToken = 'jwt_zk_token_' + Math.random().toString(36).substring(2, 10)
    let finalUser: User = {
      ...DEMO_USER,
      nullifierHash: mockNullifier,
      lastLogin: new Date().toISOString(),
      loginCount: (user?.loginCount || 0) + 1,
    }

    try {
      // Send verification payload to backend
      const verifyRes = await api.verifyAuth({
        result: {
          protocol_version: '4.0.0',
          environment: 'staging',
          nullifier: mockNullifier,
          verification_level: 'orb',
          responses: [
            {
              identifier: 'orb',
              nullifier: mockNullifier,
              proof: '0x' + 'ab'.repeat(64),
              merkle_root: '0x' + 'cd'.repeat(32),
            },
          ],
        },
      })
      if (verifyRes.token && verifyRes.user) {
        finalToken = verifyRes.token
        finalUser = verifyRes.user
      }
    } catch (backendErr) {
      console.log('Real backend verify simulated fallback:', backendErr)
    }

    await login(finalToken, finalUser)
    setIsLoading(false)
  }

  const refreshUser = async () => {
    if (token) {
      try {
        const fresh = await api.getProfile(token)
        setUser(fresh)
        await storage.setItem('syndicate_user', JSON.stringify(fresh))
      } catch {
        if (user) {
          setUser({ ...user, lastLogin: new Date().toISOString() })
        }
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        backendHealth,
        checkBackendHealth,
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
