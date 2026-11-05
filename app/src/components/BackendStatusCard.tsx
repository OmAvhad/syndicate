import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native'
import { Server, CheckCircle2, AlertTriangle, RefreshCw, Globe, ChevronRight } from 'lucide-react-native'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { setBackendUrl } from '../api/config'

export function BackendStatusCard() {
  const { colors } = useTheme()
  const { backendHealth, checkBackendHealth } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [editUrl, setEditUrl] = useState(backendHealth.url)
  const [testResult, setTestResult] = useState<string | null>(null)

  const handleSaveUrl = async () => {
    if (editUrl.trim()) {
      await setBackendUrl(editUrl.trim())
      await checkBackendHealth()
      setModalOpen(false)
    }
  }

  const handleTestPing = async () => {
    setTestResult(null)
    await checkBackendHealth()
    setTestResult(backendHealth.isOnline ? 'Connection verified successfully!' : 'Connection error')
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.left}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: backendHealth.isOnline ? colors.successSoft : colors.warningSoft },
            ]}
          >
            <Server size={14} color={backendHealth.isOnline ? colors.success : colors.warning} />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>RENDER BACKEND</Text>
            <Text style={[styles.urlText, { color: colors.textMuted }]} numberOfLines={1}>
              {backendHealth.url.replace(/^https?:\/\//, '')}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.statusPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
          onPress={() => setModalOpen(true)}
          activeOpacity={0.7}
        >
          {backendHealth.isChecking ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <View
              style={[
                styles.dot,
                { backgroundColor: backendHealth.isOnline ? colors.success : colors.danger },
              ]}
            />
          )}
          <Text
            style={[
              styles.statusText,
              { color: backendHealth.isOnline ? colors.success : colors.danger },
            ]}
          >
            {backendHealth.isChecking
              ? 'CONNECTING'
              : backendHealth.isOnline
              ? `${backendHealth.latencyMs || 0}ms`
              : 'OFFLINE'}
          </Text>
          <ChevronRight size={12} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Edit URL / Diagnostics Modal */}
      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.borderHover }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Globe size={18} color={colors.accent} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Backend Connection</Text>
              </View>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Text style={[styles.closeText, { color: colors.textMuted }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              Live Render Cloud backend hosting MongoDB database, World ID Relying Party signing, and
              user profiles.
            </Text>

            {/* Health Status Box */}
            <View style={[styles.healthBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
              <View style={styles.healthRow}>
                <Text style={[styles.healthLabel, { color: colors.textMuted }]}>ENDPOINT:</Text>
                <Text style={[styles.healthVal, { color: colors.textPrimary }]}>{backendHealth.url}/health</Text>
              </View>
              <View style={styles.healthRow}>
                <Text style={[styles.healthLabel, { color: colors.textMuted }]}>STATUS:</Text>
                <Text
                  style={[
                    styles.healthVal,
                    { color: backendHealth.isOnline ? colors.success : colors.danger, fontWeight: '800' },
                  ]}
                >
                  {backendHealth.isOnline ? 'ONLINE (200 OK)' : 'OFFLINE'}
                </Text>
              </View>
              {backendHealth.environment && (
                <View style={styles.healthRow}>
                  <Text style={[styles.healthLabel, { color: colors.textMuted }]}>ENVIRONMENT:</Text>
                  <Text style={[styles.healthVal, { color: colors.textPrimary }]}>{backendHealth.environment}</Text>
                </View>
              )}
            </View>

            {/* Change URL Input */}
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>BACKEND API URL</Text>
            <TextInput
              style={[
                styles.urlInput,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, color: colors.textPrimary },
              ]}
              value={editUrl}
              onChangeText={setEditUrl}
              placeholder="https://your-backend.onrender.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Actions */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.pingBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                onPress={handleTestPing}
              >
                <RefreshCw size={14} color={colors.accent} />
                <Text style={[styles.pingBtnText, { color: colors.accent }]}>Ping Health</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                onPress={handleSaveUrl}
              >
                <Text style={[styles.saveBtnText, { color: colors.textInverse }]}>Save Endpoint</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  urlText: {
    fontSize: 11,
    marginTop: 1,
    maxWidth: 180,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.4)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalSub: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  healthBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  healthVal: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pingBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  pingBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
})
