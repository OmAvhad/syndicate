import React, { useState, useEffect, useRef } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { setupCryptoPolyfill } from '../utils/cryptoPolyfill'
import { IDKit, deviceLegacy, orbLegacy } from '@worldcoin/idkit-core'
import { X, ExternalLink, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react-native'
import { api } from '../api/client'
import type { User } from '../types/auth'

// Ensure runtime crypto is initialized
setupCryptoPolyfill()

const APP_ID = 'app_d00bd0c89505b99dcecd757f4d446373' as `app_${string}`
const ACTION = 'user-login'

interface WorldIDModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: (token: string, user: User) => void
}

export function WorldIDModal({ visible, onClose, onSuccess }: WorldIDModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectorURI, setConnectorURI] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('Initializing...')
  const [isSuccess, setIsSuccess] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!visible) {
      // Cleanup / abort active polling
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      setLoading(false)
      setError(null)
      setConnectorURI(null)
      setIsSuccess(false)
      return
    }

    let isMounted = true
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    async function initSession() {
      setLoading(true)
      setError(null)
      setIsSuccess(false)
      setStatusMessage('Fetching secure RP context...')

      try {
        // 1. Get signed RP context from backend
        const rpRes = await api.getRpContext()
        if (!isMounted) return

        const env = (rpRes.environment || 'staging') as 'staging' | 'production' | 'sandbox'
        setStatusMessage('Connecting to Worldcoin bridge...')

        // 2. Initialize IDKit request
        const preset = env === 'staging' ? deviceLegacy() : orbLegacy()
        const request = await IDKit.request({
          app_id: APP_ID,
          action: ACTION,
          rp_context: rpRes.rp_context,
          allow_legacy_proofs: true,
          environment: env,
        }).preset(preset)

        if (!isMounted) return

        setConnectorURI(request.connectorURI)
        setLoading(false)
        setStatusMessage('Waiting for connection...')

        // 3. Poll bridge for verification completion
        const completion = await request.pollUntilCompletion({
          pollInterval: 1200,
          timeout: 900000,
          signal: abortController.signal,
        })

        if (!isMounted) return

        if (completion.success && completion.result) {
          setStatusMessage('Verifying cryptographic proof with backend...')
          setLoading(true)

          const verifyRes = await api.verifyAuth({ result: completion.result })
          if (!isMounted) return

          setIsSuccess(true)
          setStatusMessage('Identity Verified!')

          setTimeout(() => {
            if (isMounted) {
              onSuccess(verifyRes.token, verifyRes.user)
              onClose()
            }
          }, 800)
        } else if (!completion.success) {
          setError(`Verification ${completion.error || 'cancelled'}`)
          setLoading(false)
        }
      } catch (err: any) {
        if (abortController.signal.aborted) return
        console.error('[WorldID] Session initialization failed:', err)
        setError(err.message || 'Failed to initialize World ID session')
        setLoading(false)
      }
    }

    initSession()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [visible])

  const handleOpenWorldApp = async () => {
    if (!connectorURI) return
    try {
      await Linking.openURL(connectorURI)
    } catch {
      setError('Could not open World App directly. Scan the QR code or use the simulator.')
    }
  }

  const handleOpenSimulator = async () => {
    if (!connectorURI) return
    const simulatorUrl = `https://simulator.worldcoin.org?connect_url=${encodeURIComponent(connectorURI)}`
    try {
      await Linking.openURL(simulatorUrl)
    } catch {
      setError('Could not open browser. Please open simulator.worldcoin.org manually.')
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.orbBadge}>
              <View style={styles.orbInner}>
                <ShieldCheck size={20} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={20} color="#666666" />
            </TouchableOpacity>
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>Connect your World ID</Text>
          <Text style={styles.subtitle}>
            {isSuccess
              ? 'Zero-knowledge verification confirmed!'
              : 'Use phone camera or World App to scan the QR code'}
          </Text>

          {/* Body / Content */}
          <View style={styles.contentContainer}>
            {loading ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color="#0066FE" />
                <Text style={styles.stateText}>{statusMessage}</Text>
              </View>
            ) : isSuccess ? (
              <View style={styles.stateContainer}>
                <CheckCircle2 size={56} color="#16A34A" />
                <Text style={[styles.stateText, { color: '#16A34A', fontWeight: '700' }]}>
                  Proof Verified Successfully
                </Text>
              </View>
            ) : error ? (
              <View style={styles.stateContainer}>
                <AlertCircle size={44} color="#EF4444" />
                <Text style={[styles.stateText, { color: '#EF4444' }]}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => {
                    setError(null)
                    setLoading(true)
                  }}
                >
                  <Text style={styles.retryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : connectorURI ? (
              <View style={styles.qrContainer}>
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={connectorURI}
                    size={200}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                  />
                </View>

                {/* Direct Action for Mobile */}
                <TouchableOpacity
                  style={styles.openAppBtn}
                  onPress={handleOpenWorldApp}
                  activeOpacity={0.8}
                >
                  <ShieldCheck size={18} color="#FFFFFF" />
                  <Text style={styles.openAppBtnText}>Open in World App</Text>
                </TouchableOpacity>

                {/* Simulator link for staging */}
                <TouchableOpacity
                  style={styles.simulatorLink}
                  onPress={handleOpenSimulator}
                  activeOpacity={0.7}
                >
                  <Text style={styles.simulatorText}>
                    Testing in staging?{' '}
                    <Text style={styles.simulatorHighlight}>Use the simulator</Text>
                  </Text>
                  <ExternalLink size={13} color="#0066FE" style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Terms & Privacy</Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  orbBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0066FE',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0066FE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  orbInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  contentContainer: {
    width: '100%',
    minHeight: 260,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 14,
  },
  stateText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  qrContainer: {
    alignItems: 'center',
    width: '100%',
  },
  qrWrapper: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  openAppBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0066FE',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  openAppBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  simulatorLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  simulatorText: {
    fontSize: 12,
    color: '#6B7280',
  },
  simulatorHighlight: {
    color: '#0066FE',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 14,
    marginTop: 10,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
})

