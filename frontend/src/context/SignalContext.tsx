import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import api from '@/lib/api'
import { decryptWithMetaMask, getMetaMaskEncryptionPublicKey } from '@/lib/network'

export interface TradeSignalItem {
  signalId: string
  tradeIndex?: number
  leaderPublicKey: string
  followerPublicKey?: string
  leaderUsername: string
  symbol: string
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT'
  orderType: 'LIMIT' | 'MARKET'
  limit: number | null
  amount: number | null
  stopLoss: number | null
  target: number | null
  burnerAccountAddress?: string | null
  arkivEntityKey?: string
  ttlSeconds: number
  expiresAt: string
  createdAt: string
  remainingSeconds: number
  requiresMetaMaskDecrypt?: boolean
  encryptedPayloadHex?: string | null
  isDecrypted?: boolean
  isDecrypting?: boolean
  decryptionError?: string | null
}

interface SignalContextType {
  signals: TradeSignalItem[]
  activeSignalCount: number
  selectedSignal: TradeSignalItem | null
  openCopyModal: (signal: TradeSignalItem) => void
  closeCopyModal: () => void
  dismissSignal: (signalId: string) => void
  decryptSignal: (signalId: string, refreshEncryption?: boolean) => Promise<{ success: boolean; error?: string }>
  executeCopyTrade: (signalId: string, customAmount: number, executionTxHash?: string, entryDeliveryTxHash?: string, burner?: string) => Promise<{ success: boolean; error?: string; tradeId?: string }>
  isConnected: boolean
  refreshSignals: () => Promise<void>
}

const SignalContext = createContext<SignalContextType | undefined>(undefined)

export function SignalProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
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
        setSignals((prev) => {
          const prevMap = new Map(prev.map((s) => [s.signalId, s]))
          return res.data.signals
            .map((s: TradeSignalItem) => {
              const existing = prevMap.get(s.signalId)
              const isDecrypted = existing?.isDecrypted || !s.requiresMetaMaskDecrypt
              return {
                ...s,
                limit: isDecrypted && existing?.limit != null ? existing.limit : s.limit,
                amount: isDecrypted && existing?.amount != null ? existing.amount : s.amount,
                stopLoss: isDecrypted && existing?.stopLoss != null ? existing.stopLoss : s.stopLoss,
                target: isDecrypted && existing?.target != null ? existing.target : s.target,
                burnerAccountAddress: isDecrypted && existing?.burnerAccountAddress != null ? existing.burnerAccountAddress : s.burnerAccountAddress,
                isDecrypted,
                remainingSeconds: calculateRemaining(s.expiresAt),
              }
            })
            .filter((s: TradeSignalItem) => s.remainingSeconds > 0)
        })
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
                isDecrypted: !data.signal.requiresMetaMaskDecrypt,
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

  // True asymmetric private-key decryption via MetaMask eth_decrypt
  const decryptSignal = async (signalId: string, refreshEncryption = false): Promise<{ success: boolean; error?: string }> => {
    const target = signals.find((s) => s.signalId === signalId) || selectedSignal
    if (!target) return { success: false, error: 'Signal not found or expired' }

    if (!target.requiresMetaMaskDecrypt || target.isDecrypted) {
      return { success: true }
    }

    if (!target.encryptedPayloadHex) {
      return { success: false, error: 'Signal is missing encrypted payload hex' }
    }

    if (!user?.walletAddress) {
      return { success: false, error: 'Please connect your MetaMask wallet first' }
    }
    if (target.followerPublicKey && target.followerPublicKey.toLowerCase() !== user.walletAddress.toLowerCase()) {
      return { success: false, error: 'This signal was encrypted for a different follower wallet. Reconnect the original wallet or request a fresh signal.' }
    }

    setSignals((prev) =>
      prev.map((s) => (s.signalId === signalId ? { ...s, isDecrypting: true, decryptionError: null } : s))
    )
    if (selectedSignal?.signalId === signalId) {
      setSelectedSignal((prev) => (prev ? { ...prev, isDecrypting: true, decryptionError: null } : null))
    }

    try {
      let encryptedPayloadHex = target.encryptedPayloadHex
      if (refreshEncryption) {
        const accounts = await window.ethereum?.request({ method: 'eth_requestAccounts' }) as string[] | undefined
        if (accounts?.[0]?.toLowerCase() !== user.walletAddress.toLowerCase()) throw new Error('Select your linked follower wallet before refreshing encryption.')
        const encryptionPublicKey = await getMetaMaskEncryptionPublicKey(user.walletAddress)
        const response = await api.post(`/api/trades/signals/${encodeURIComponent(signalId)}/refresh-encryption`, { encryptionPublicKey, walletAddress: user.walletAddress })
        encryptedPayloadHex = response.data.encryptedPayloadHex
        setSignals(prev => prev.map(s => s.signalId === signalId ? { ...s, encryptedPayloadHex } : s))
        setSelectedSignal(prev => prev?.signalId === signalId ? { ...prev, encryptedPayloadHex } : prev)
      }
      const decrypted = await decryptWithMetaMask<Record<string, unknown>>(
        encryptedPayloadHex!,
        user.walletAddress
      )

      const updatedFields = {
        limit: Number(decrypted.limit ?? decrypted.price ?? 0),
        amount: Number(decrypted.amount ?? 0),
        stopLoss: Number(decrypted.stopLoss ?? 0),
        target: Number(decrypted.target ?? 0),
        burnerAccountAddress: (decrypted.burnerAccountAddress as string) || target.burnerAccountAddress,
        isDecrypted: true,
        isDecrypting: false,
        decryptionError: null,
      }

      setSignals((prev) =>
        prev.map((s) => (s.signalId === signalId ? { ...s, ...updatedFields } : s))
      )

      if (selectedSignal?.signalId === signalId) {
        setSelectedSignal((prev) => (prev ? { ...prev, ...updatedFields } : null))
      }

      return { success: true }
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string }
      const msg =
        e?.code === 4001
          ? 'MetaMask private key decryption was rejected'
          : e?.message || 'Failed to decrypt trade signal with MetaMask'

      setSignals((prev) =>
        prev.map((s) => (s.signalId === signalId ? { ...s, isDecrypting: false, decryptionError: msg } : s))
      )
      if (selectedSignal?.signalId === signalId) {
        setSelectedSignal((prev) => (prev ? { ...prev, isDecrypting: false, decryptionError: msg } : null))
      }

      return { success: false, error: msg }
    }
  }

  // Execute trade order for follower
  const executeCopyTrade = async (signalId: string, customAmount: number, executionTxHash?: string, entryDeliveryTxHash?: string, burner?: string) => {
    const target = signals.find((s) => s.signalId === signalId) || selectedSignal
    if (!target) return { success: false, error: 'Signal not found or expired' }

    if (target.requiresMetaMaskDecrypt && !target.isDecrypted) {
      return {
        success: false,
        error: 'Trade signal must be decrypted with your MetaMask private key before execution',
      }
    }

    try {
      const res = await api.post('/api/trades/execute', {
        symbol: target.symbol,
        side: target.side,
        orderType: target.orderType || 'BRACKET',
        limit: target.limit,
        amount: customAmount,
        stopLoss: target.stopLoss,
        target: target.target,
        burnerAccountAddress: burner,
        tradeIndex: target.tradeIndex || 1,
        isCopyTrade: true,
        originalSignalId: target.signalId,
        executionTxHash: executionTxHash || undefined,
        entryDeliveryTxHash,
      })

      if (res.data?.success) {
        // Remove from active signals
        // Keep the selected modal mounted to show the receipt and exit controls.
        setSignals(prev => prev.filter(signal => signal.signalId !== signalId))
        window.dispatchEvent(new Event('syndicate:trades-changed'))
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
        decryptSignal,
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
