import { useState, useCallback } from 'react'
import {
  IDKitRequestWidget,
  type IDKitRequestHookConfig,
  type IDKitResult,
} from '@worldcoin/idkit'
import { orbLegacy, deviceLegacy } from '@worldcoin/idkit'
import { ShieldCheck, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

interface WorldIDButtonProps {
  onVerified: (token: string, user: object) => void
  className?: string
  size?: 'default' | 'lg'
}

type RpContext = {
  rp_id: string
  nonce: string
  created_at: number
  expires_at: number
  signature: string
}

type EnvironmentType = 'staging' | 'production' | 'sandbox'

const APP_ID = import.meta.env.VITE_APP_ID as `app_${string}`
// ACTION is the action name registered in the Developer Portal (e.g. "login")
// RP_ID (rp_cfb93...) is the Relying Party ID — it lives in rp_context, NOT in action
const ACTION = import.meta.env.VITE_ACTION || 'user-login'
const DEFAULT_ENV = (import.meta.env.VITE_WORLDID_ENV || 'staging') as EnvironmentType

export default function WorldIDButton({ onVerified, className, size = 'lg' }: WorldIDButtonProps) {
  const [open, setOpen] = useState(false)
  const [rpContext, setRpContext] = useState<RpContext | null>(null)
  const [currentEnv, setCurrentEnv] = useState<EnvironmentType>(DEFAULT_ENV)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch a fresh signed rp_context from our backend before opening the widget
  const fetchRpContext = useCallback(async (): Promise<{ rp_context: RpContext; environment: EnvironmentType }> => {
    const res = await api.get('/api/auth/rp-context')
    return {
      rp_context: res.data.rp_context as RpContext,
      environment: (res.data.environment as EnvironmentType) || DEFAULT_ENV,
    }
  }, [])

  const handleOpen = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await fetchRpContext()
      setRpContext(data.rp_context)
      setCurrentEnv(data.environment)
      setOpen(true)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      const msg = e?.response?.data?.error || e?.message || 'Failed to initialise session'
      console.error('Failed to fetch rp_context:', msg)
      setError(`Failed to initialise: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (result: IDKitResult) => {
    try {
      console.log('[WorldID] Sending IDKitResult to backend:', result)
      const res = await api.post('/api/auth/verify', { result })
      console.log('[WorldID] Backend verification success:', res.data)
      ;(window as unknown as Record<string, unknown>).__wid_pending__ = {
        token: res.data.token,
        user: res.data.user,
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; details?: unknown } }; message?: string }
      const detailStr = typeof e?.response?.data?.details === 'string'
        ? e?.response?.data?.details
        : JSON.stringify(e?.response?.data?.details || '')
      const msg = e?.response?.data?.error || detailStr || e?.message || 'Verification failed on backend'
      console.error('[WorldID] Verification failed in handleVerify:', msg)
      setError(`Verification rejected: ${msg}`)
      throw err // IDKit catches this and shows FailedByHostApp
    }
  }

  const onSuccess = (result: IDKitResult) => {
    console.log('[WorldID] onSuccess called with result:', result)
    const pending = (window as unknown as Record<string, unknown>).__wid_pending__ as
      | { token: string; user: object }
      | undefined
    if (pending) {
      delete (window as unknown as Record<string, unknown>).__wid_pending__
      onVerified(pending.token, pending.user)
    }
    setOpen(false)
  }

  // Use deviceLegacy preset in staging (simulator only supports device level)
  // Use orbLegacy preset in production
  const preset = currentEnv === 'staging' ? deviceLegacy() : orbLegacy()

  // Build IDKit config — only render widget when rp_context is ready
  const widgetConfig: IDKitRequestHookConfig | null = rpContext
    ? {
        app_id: APP_ID,
        action: ACTION,
        rp_context: rpContext,
        allow_legacy_proofs: true,
        environment: currentEnv,
        preset,
      }
    : null

  return (
    <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
      {/* Trigger button adhering strictly to CRED-inspired visual language */}
      <button
        onClick={handleOpen}
        disabled={loading}
        className={cn(
          'inline-flex items-center justify-center gap-2.5 rounded-md font-bold text-text-inverse bg-accent hover:bg-[#d4f885] active:translate-y-0 transition-all duration-fast ease-standard cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed select-none shadow-[0_2px_18px_rgba(198,243,106,0.22)] hover:shadow-[0_4px_24px_rgba(198,243,106,0.34)] hover:-translate-y-px',
          size === 'lg' ? 'px-8 py-3.5 text-base' : 'px-5 py-2.5 text-sm',
          className
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-text-inverse" />
        ) : (
          <ShieldCheck className="w-5 h-5 text-text-inverse stroke-[2.2]" />
        )}
        <span>{loading ? 'Initialising Secure Session...' : 'Verify with World ID'}</span>
      </button>

      {error && (
        <div className="rounded-md border border-semantic-danger/30 bg-semantic-danger/10 px-4 py-2.5 text-xs text-semantic-danger max-w-md text-center">
          {error}
        </div>
      )}

      {/* Render IDKit widget when rp_context is available */}
      {widgetConfig && (
        <IDKitRequestWidget
          {...widgetConfig}
          open={open}
          onOpenChange={setOpen}
          handleVerify={handleVerify}
          onSuccess={onSuccess}
          onError={(code, debugReport) => {
            console.error('[WorldID] onError code:', code, 'debugReport:', debugReport)
            setError((prev) => prev || `Verification failed: ${code}`)
            setOpen(false)
          }}
          autoClose
        />
      )}
    </div>
  )
}
