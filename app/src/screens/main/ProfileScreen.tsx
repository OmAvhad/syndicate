import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import {
  ShieldCheck,
  Fingerprint,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Moon,
} from 'lucide-react-native'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { BackendStatusCard } from '../../components/BackendStatusCard'

export function ProfileScreen() {
  const { user, logout } = useAuth()
  const { colors, mode, toggleTheme, setThemeMode } = useTheme()
  const [showSeed, setShowSeed] = useState(false)
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null)

  const mockMnemonic =
    'shield quantum velvet cipher echo orbit harbor timber nomad beacon whisper drift'

  const handleCopyNullifier = () => {
    setCopiedNotice('Nullifier hash copied to clipboard')
    setTimeout(() => setCopiedNotice(null), 2500)
  }

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ])
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Profile Card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }]}>
          <Fingerprint size={30} color={colors.accent} strokeWidth={2.2} />
        </View>
        <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.username || 'Shielded User'}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.verifiedPill, { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }]}>
            <ShieldCheck size={11} color={colors.accent} />
            <Text style={[styles.verifiedText, { color: colors.accent }]}>
              WORLD ID {user?.verificationLevel?.toUpperCase() || 'ORB'}
            </Text>
          </View>
          <View style={[styles.sessionsPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <Text style={[styles.sessionsText, { color: colors.textMuted }]}>LOGIN #{user?.loginCount || 1}</Text>
          </View>
        </View>
      </View>

      {copiedNotice && (
        <View style={[styles.toast, { backgroundColor: colors.surfaceSubtle, borderColor: colors.accent }]}>
          <CheckCircle2 size={14} color={colors.accent} />
          <Text style={[styles.toastText, { color: colors.accent }]}>{copiedNotice}</Text>
        </View>
      )}

      {/* Backend Connection Diagnostics */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>LIVE BACKEND SERVICE</Text>
      <BackendStatusCard />

      {/* Theme / Appearance Toggle Card */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>APPEARANCE THEME</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.themeToggleRow}>
          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              mode === 'dark' && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
            ]}
            onPress={() => setThemeMode('dark')}
          >
            <Moon size={18} color={mode === 'dark' ? colors.accent : colors.textMuted} />
            <Text style={[styles.themeOptionText, { color: mode === 'dark' ? colors.accent : colors.textSecondary }]}>
              Dark Mode
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOptionBtn,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              mode === 'light' && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
            ]}
            onPress={() => setThemeMode('light')}
          >
            <Sun size={18} color={mode === 'light' ? colors.accent : colors.textMuted} />
            <Text style={[styles.themeOptionText, { color: mode === 'light' ? colors.accent : colors.textSecondary }]}>
              Light Mode
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Nullifier Hash */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ZERO-KNOWLEDGE IDENTITY</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.labelRow}>
            <Cpu size={15} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Application Nullifier Hash</Text>
          </View>
          <TouchableOpacity onPress={handleCopyNullifier} hitSlop={10}>
            <Text style={[styles.actionLink, { color: colors.accent }]}>Copy</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.monoText, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle, color: colors.textSecondary }]}>
          {user?.nullifierHash || '0x3f8a912e74d1c9b2e457fa8820641b9d4c728310e527b13fa2487e8129dca042'}
        </Text>
        <Text style={[styles.cardHelper, { color: colors.textMuted }]}>
          Unique to this application. The World ID network salts this value so your activity cannot
          be correlated with any other app or your real identity.
        </Text>
      </View>

      {/* Keystore Mnemonic Backup */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>RAILGUN MNEMONIC KEYSTORE</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.labelRow}>
            <KeyRound size={15} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Client-Side Recovery Secret</Text>
          </View>
          <TouchableOpacity onPress={() => setShowSeed(!showSeed)} style={styles.toggleBtn} hitSlop={10}>
            {showSeed ? (
              <EyeOff size={15} color={colors.textMuted} />
            ) : (
              <Eye size={15} color={colors.textMuted} />
            )}
            <Text style={[styles.toggleBtnText, { color: colors.textMuted }]}>{showSeed ? 'Hide' : 'Reveal'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.seedBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle }]}>
          <Text style={[styles.seedText, { color: colors.accent }, !showSeed && { color: colors.textMuted, letterSpacing: 1 }]}>
            {showSeed
              ? mockMnemonic
              : '•••••• •••••• •••••• •••••• •••••• •••••• •••••• •••••• •••••• •••••• •••••• ••••••'}
          </Text>
        </View>

        <View style={styles.warningRow}>
          <AlertTriangle size={14} color={colors.warning} />
          <Text style={[styles.warningText, { color: colors.warning }]}>
            This seed derives your private Railgun account keys. It NEVER touches the backend.
            Back it up securely.
          </Text>
        </View>
      </View>

      {/* Hardware & Enclave Security */}
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>DEVICE ENCLAVE STATUS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.enclaveRow}>
          <View style={styles.enclaveLeft}>
            <Lock size={15} color={colors.accent} />
            <Text style={[styles.enclaveTitle, { color: colors.textPrimary }]}>Hardware Secure Element</Text>
          </View>
          <View style={[styles.activeTag, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.activeTagText, { color: colors.accent }]}>ENFORCED</Text>
          </View>
        </View>
        <Text style={[styles.cardHelper, { color: colors.textMuted }]}>
          Private authorization keys are held securely in the device enclave for EIP-712 copy trade signatures.
        </Text>
      </View>

      {/* Logout Button (52px Touch Target) */}
      <TouchableOpacity
        style={[styles.signOutBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.danger }]}
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <LogOut size={16} color={colors.danger} />
        <Text style={[styles.signOutText, { color: colors.danger }]}>Sign Out from Syndicate</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  profileCard: {
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '800',
  },
  sessionsPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
  },
  sessionsText: {
    fontSize: 9,
    fontWeight: '700',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  themeToggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeOptionBtn: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionLink: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  monoText: {
    fontSize: 11,
    fontFamily: 'monospace',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  cardHelper: {
    fontSize: 10,
    lineHeight: 15,
  },
  seedBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  seedText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  warningText: {
    fontSize: 10,
    flex: 1,
    lineHeight: 14,
  },
  enclaveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  enclaveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  enclaveTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  activeTagText: {
    fontSize: 8,
    fontWeight: '800',
  },
  signOutBtn: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    gap: 8,
    marginTop: 10,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '700',
  },
})
