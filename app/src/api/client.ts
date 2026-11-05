import { getBackendUrl } from './config'
import type { RpContext, User } from '../types/auth'

export interface HealthResponse {
  status: string
  environment: string
  timestamp: string
  latencyMs?: number
}

export interface RpContextResponse {
  rp_context: RpContext
  environment: string
}

export interface VerifyResponse {
  success: boolean
  token: string
  user: User
}

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const baseUrl = await getBackendUrl()
    const startTime = Date.now()
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      throw new Error(`Health check failed with status: ${res.status}`)
    }

    const data = await res.json()
    const latencyMs = Date.now() - startTime
    return {
      ...data,
      latencyMs,
    }
  },

  async getRpContext(): Promise<RpContextResponse> {
    const baseUrl = await getBackendUrl()
    const res = await fetch(`${baseUrl}/api/auth/rp-context`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Failed to fetch rp-context: ${res.status}`)
    }

    return res.json()
  },

  async verifyAuth(payload: unknown): Promise<VerifyResponse> {
    const baseUrl = await getBackendUrl()
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || err.details || `Verification failed: ${res.status}`)
    }

    return res.json()
  },

  async getProfile(token: string): Promise<User> {
    const baseUrl = await getBackendUrl()
    const res = await fetch(`${baseUrl}/api/user/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch profile: ${res.status}`)
    }

    const data = await res.json()
    return data.user || data
  },

  async getExploreUsers(token: string): Promise<any[]> {
    const baseUrl = await getBackendUrl()
    const res = await fetch(`${baseUrl}/api/explore`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch explore users: ${res.status}`)
    }

    const data = await res.json()
    return data.users || []
  },
}
