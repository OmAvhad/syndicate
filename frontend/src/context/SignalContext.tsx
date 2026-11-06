import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import api from '@/lib/api'

export interface TradeSignalItem {
  signalId: string
  tradeIndex?: number
  leaderPublicKey: string
  leaderUsername: string
  symbol: string
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT'
  orderType: 'LIMIT' | 'MARKET'
  limit: number
  amount: number
  stopLoss: number
  target: number
  burnerAccountAddress?: string
  arkivEntityKey?: string
  ttlSeconds: number
  expiresAt: string
  createdAt: string
  remainingSeconds: number
}

interface SignalContextType {
  signals: TradeSignalItem[]
  activeSignalCount: number
  selectedSignal: TradeSignalItem | null
  openCopyModal: (signal: TradeSignalItem) => void
  closeCopyModal: () => void
  dismissSignal: (signalId: string) => void
  executeCopyTrade: (signalId: string, customAmount: number) => Promise<{ success: boolean; error?: string; tradeId?: string }>
  isConnected: boolean
  refreshSignals: () => Promise<void>
}

const SignalContext = createContext<SignalContextType | undefined>(undefined)

export function SignalProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [signals, setSignals] = useState<TradeSignalItem[]>([])
  const [selectedSignal, setSelectedSignal] = useState<TradeSignalItem | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Calculate remaining seconds
  const calculateRemaining = (expiresAtStr: string): number => {
    const diff = Math.floor((new Date(expiresAtStr).getTime() - Date.now()) / 1000)
    return Math.max(0, diff)
  }

  // Fetch active signals from API
  const refreshSignals = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await api.get('/api/trades/signals/active')
      if (res.data?.success && Array.isArray(res.data.signals)) {
        const withRemaining: TradeSignalItem[] = res.data.signals
          .map((s: TradeSignalItem) => ({
            ...s,
            remainingSeconds: calculateRemaining(s.expiresAt),
          }))
          .filter((s: TradeSignalItem) => s.remainingSeconds > 0)

        setSignals(withRemaining)
      }
    } catch (err) {
      console.warn('[SignalContext] Failed to fetch active signals:', err)
    }
  }, [isAuthenticated])

  // WebSocket Connection
  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
      setIsConnected(false)
      setSignals([])
      return
    }

    const token = localStorage.getItem('world-id-token')
    if (!token) return

    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const wsProto = baseUrl.startsWith('https') ? 'wss:' : 'ws:'
    const host = baseUrl.replace(/^https?:\/\//, '')
    const wsUrl = `${wsProto}//${host}/ws?token=${token}`

    let isUnmounted = false

    const connect = () => {
      if (isUnmounted) return
      try {
        const ws = new WebSocket(wsUrl)
        socketRef.current = ws

        ws.onopen = () => {
          setIsConnected(true)
          console.log('[WebSocket] Signal channel connected')
          refreshSignals()
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'TRADE_SIGNAL' && data.signal) {
              const newSignal: TradeSignalItem = {
                ...data.signal,
                remainingSeconds: calculateRemaining(data.signal.expiresAt),
              }

              // Play brief visual/audio alert sound
              try {
                const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
                const osc = audioCtx.createOscillator()
                const gain = audioCtx.createGain()
                osc.type = 'sine'
                osc.frequency.setValueAtTime(880, audioCtx.currentTime)
                gain.gain.setValueAtTime(0.05, audioCtx.currentTime)
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35)
                osc.connect(gain)
                gain.connect(audioCtx.destination)
                osc.start()
                osc.stop(audioCtx.currentTime + 0.35)
              } catch {
                // AudioContext not allowed before user gesture, harmless
              }

              setSignals((prev) => {
                const exists = prev.find((s) => s.signalId === newSignal.signalId)
                if (exists) return prev
                return [newSignal, ...prev]
              })
            }
          } catch (err) {
            console.error('[WebSocket] Failed to parse message:', err)
          }
        }

        ws.onclose = () => {
          setIsConnected(false)
          if (!isUnmounted) {
            reconnectTimeoutRef.current = setTimeout(connect, 4000)
          }
        }

        ws.onerror = (err) => {
          console.warn('[WebSocket] Error on signal channel:', err)
          ws.close()
        }
      } catch (e) {
        console.error('[WebSocket] Setup exception:', e)
      }
    }

    connect()
    refreshSignals()

    return () => {
      isUnmounted = true
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [isAuthenticated, refreshSignals])

  // Tick timer every second to countdown TTL for all active signals
  useEffect(() => {
    if (signals.length === 0) return

    const interval = setInterval(() => {
      setSignals((prev) =>
        prev
          .map((s) => ({
            ...s,
            remainingSeconds: calculateRemaining(s.expiresAt),
          }))
          .filter((s) => s.remainingSeconds > 0)
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [signals.length])

  const openCopyModal = (signal: TradeSignalItem) => {
    setSelectedSignal(signal)
  }

  const closeCopyModal = () => {
    setSelectedSignal(null)
  }

  const dismissSignal = (signalId: string) => {
    setSignals((prev) => prev.filter((s) => s.signalId !== signalId))
    if (selectedSignal?.signalId === signalId) {
      setSelectedSignal(null)
    }
  }

  // Execute trade order for follower
  const executeCopyTrade = async (signalId: string, customAmount: number) => {
    const target = signals.find((s) => s.signalId === signalId) || selectedSignal
    if (!target) return { success: false, error: 'Signal not found or expired' }

    try {
      const res = await api.post('/api/trades/execute', {
        symbol: target.symbol,
        side: target.side,
        orderType: target.orderType,
        limit: target.limit,
        amount: customAmount,
        stopLoss: target.stopLoss,
        target: target.target,
        burnerAccountAddress: target.burnerAccountAddress,
        isCopyTrade: true,
        originalSignalId: target.signalId,
      })

      if (res.data?.success) {
        // Remove from active signals
        dismissSignal(signalId)
        return { success: true, tradeId: res.data.tradeId }
      } else {
        return { success: false, error: res.data?.error || 'Execution failed' }
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string }
      return { success: false, error: e?.response?.data?.error || e?.message || 'Trade execution failed' }
    }
  }

  return (
    <SignalContext.Provider
      value={{
        signals,
        activeSignalCount: signals.length,
        selectedSignal,
        openCopyModal,
        closeCopyModal,
        dismissSignal,
        executeCopyTrade,
        isConnected,
        refreshSignals,
      }}
    >
      {children}
    </SignalContext.Provider>
  )
}

export function useSignals() {
  const ctx = useContext(SignalContext)
  if (!ctx) throw new Error('useSignals must be used within SignalProvider')
  return ctx
}
