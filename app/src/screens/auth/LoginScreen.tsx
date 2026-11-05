import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native'
import {
  ShieldCheck,
  Fingerprint,
  Lock,
  EyeOff,
  Cpu,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react-native'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

export function LoginScreen() {
  const { simulateSandboxLogin, isLoading } = useAuth()
  const { colors, mode, toggleTheme } = useTheme()
  const [isVerifying, setIsVerifying] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const handleWorldAppDeepLink = async () => {
    setIsVerifying(true)
    setNotice('Connecting to World App...')

    const deepLinkUrl = 'worldcoin://verify?app_id=app_staging_syndicate&action=login'

    try {
      const supported = await Linking.canOpenURL(deepLinkUrl)
      if (supported) {
        await Linking.openURL(deepLinkUrl)
      } else {
        setNotice('World App not detected on device. Running Sandbox ZK proof simulator...')
        setTimeout(() => {
          simulateSandboxLogin()
          setIsVerifying(false)
        }, 1200)
      }
    } catch {
      setNotice('Launching zero-knowledge verification simulator...')
      setTimeout(() => {
        simulateSandboxLogin()
        setIsVerifying(false)
      }, 1000)
    }
  }

  const handleSandboxVerify = async () => {
    setIsVerifying(true)
    setNotice('Generating client-side zk-SNARK nullifier proof...')
    await simulateSandboxLogin()
    setIsVerifying(false)
  }

  const guarantees = [
    {
      icon: ShieldCheck,
      title: 'Zero-Knowledge Proofs',
      desc: 'Prove your humanness without disclosing names, biometrics, or emails. The server only sees a unique nullifier hash.',
      tag: 'zk-SNARK',
    },
    {
      icon: Fingerprint,
      title: 'Strict Sybil Resistance',
      desc: 'One human, one account. Eliminates automated bot farms and multi-account manipulation while preserving total anonymity.',
      tag: '1 Human = 1 Seat',
    },
    {
      icon: EyeOff,
      title: 'Zero Cross-App Tracking',
      desc: 'Nullifier hashes are deterministically salted per app. No entity can correlate your activity across different web services.',
      tag: 'Unlinkable',
    },
    {
      icon: Lock,
      title: 'Hardware Enclave Security',
      desc: 'Private keys remain protected within your device secure element. No credentials travel across the wire.',
      tag: 'Self-Sovereign',
    },
  ]

  const comparisons = [
    {
      feature: 'Personal Data Required',
      traditional: 'Email, phone, passport, KYC',
      syndicate: 'Zero personal data (Zero-Knowledge)',
    },
    {
      feature: 'Bot & Sybil Prevention',
      traditional: 'Vulnerable to CAPTCHAs & proxies',
      syndicate: 'Mathematically guaranteed human',
    },
    {
      feature: 'Cross-Site Tracking',
      traditional: 'Tracked via cookies & OAuth IDs',
      syndicate: 'Unlinkable deterministic nullifier',
    },
    {
      feature: 'Credential Leak Risk',
      traditional: 'Centralized database breaches',
      syndicate: 'Keys stay inside device enclave',
    },
  ]

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Brand Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={[styles.logoBox, { backgroundColor: colors.accent }]}>
            <ShieldCheck size={20} color={colors.textInverse} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={[styles.logoTitle, { color: colors.textPrimary }]}>SYNDICATE</Text>
            <Text style={[styles.logoSubtitle, { color: colors.textMuted }]}>WORLD ID AUTHENTICATION</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.themeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            {mode === 'dark' ? (
              <Sun size={15} color={colors.accent} />
            ) : (
              <Moon size={15} color={colors.accent} />
            )}
          </TouchableOpacity>

          <View style={[styles.statusBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.pulseDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>SEPOLIA</Text>
          </View>
        </View>
      </View>

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={[styles.heroTag, { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }]}>
          <Cpu size={12} color={colors.accent} />
          <Text style={[styles.heroTagText, { color: colors.accent }]}>PRIVATE FOLLOWER PORTAL</Text>
        </View>

        <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
          Shielded Copy Trading for{' '}
          <Text style={{ color: colors.accent }}>Anonymous Capital</Text>
        </Text>

        <Text style={[styles.heroDesc, { color: colors.textMuted }]}>
          Verify your humanness with World ID. Copy top Ethereum traders from a Railgun shielded
          pool with zero counterparty risk and complete identity isolation.
        </Text>
      </View>

      {/* Primary Verification Card */}
      <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.borderHover }]}>
        <Text style={[styles.authCardTitle, { color: colors.textPrimary }]}>Prove Humanness to Enter</Text>
        <Text style={[styles.authCardSubtitle, { color: colors.textMuted }]}>
          Zero KYC. Authenticate via your World ID Orb or Device credential to access the follower
          desk.
        </Text>

        {notice && (
          <View style={[styles.noticeBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.noticeText, { color: colors.accent }]}>{notice}</Text>
          </View>
        )}

        {/* Primary World App Deep Link CTA (52px Touch Target) */}
        <TouchableOpacity
          style={[styles.worldIdBtn, { backgroundColor: colors.accent }]}
          onPress={handleWorldAppDeepLink}
          disabled={isVerifying || isLoading}
          activeOpacity={0.8}
        >
          <Fingerprint size={20} color={colors.textInverse} strokeWidth={2.4} />
          <Text style={[styles.worldIdBtnText, { color: colors.textInverse }]}>
            {isVerifying ? 'Verifying with World ID...' : 'Verify with World ID'}
          </Text>
          <ArrowRight size={18} color={colors.textInverse} strokeWidth={2.4} />
        </TouchableOpacity>

        {/* Instant Sandbox Verify */}
        <TouchableOpacity
          style={[styles.sandboxBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderHover }]}
          onPress={handleSandboxVerify}
          disabled={isVerifying || isLoading}
          activeOpacity={0.8}
        >
          <Sparkles size={15} color={colors.accent} />
          <Text style={[styles.sandboxBtnText, { color: colors.textSecondary }]}>
            Instant ZK Sandbox Verify (Demo / Testing)
          </Text>
        </TouchableOpacity>

        <View style={styles.secureElementRow}>
          <Lock size={12} color={colors.textMuted} />
          <Text style={[styles.secureElementText, { color: colors.textMuted }]}>
            Enclave-backed • No biometric data transmitted
          </Text>
        </View>
      </View>

      {/* Guarantees Grid */}
      <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>MATHEMATICAL GUARANTEES</Text>
      <View style={styles.guaranteesGrid}>
        {guarantees.map((item, idx) => {
          const Icon = item.icon
          return (
            <View
              key={idx}
              style={[styles.guaranteeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
                  <Icon size={16} color={colors.accent} />
                </View>
                <View style={[styles.tagPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  <Text style={[styles.tagText, { color: colors.accent }]}>{item.tag}</Text>
                </View>
              </View>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.cardDesc, { color: colors.textMuted }]}>{item.desc}</Text>
            </View>
          )
        })}
      </View>

      {/* Comparison Table */}
      <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>TRADITIONAL VS WORLD ID</Text>
      <View style={[styles.comparisonTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {comparisons.map((c, i) => (
          <View
            key={i}
            style={[
              styles.comparisonRow,
              { borderBottomColor: colors.borderSubtle },
              i === comparisons.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <Text style={[styles.compFeature, { color: colors.textSecondary }]}>{c.feature}</Text>
            <View style={styles.compValues}>
              <Text style={[styles.compTraditional, { color: colors.textMuted }]}>{c.traditional}</Text>
              <View style={styles.compSyndicateRow}>
                <CheckCircle2 size={13} color={colors.accent} strokeWidth={2.4} />
                <Text style={[styles.compSyndicate, { color: colors.accent }]}>{c.syndicate}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Syndicate Protocol • EthGlobal Mumbai POC
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  logoSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  heroSection: {
    marginBottom: 20,
  },
  heroTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    marginBottom: 10,
  },
  heroTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  authCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  authCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  authCardSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  noticeText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  worldIdBtn: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    gap: 10,
    marginBottom: 10,
  },
  worldIdBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  sandboxBtn: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
    marginBottom: 14,
  },
  sandboxBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  secureElementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secureElementText: {
    fontSize: 11,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  guaranteesGrid: {
    gap: 12,
    marginBottom: 24,
  },
  guaranteeCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  comparisonTable: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  comparisonRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  compFeature: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  compValues: {
    gap: 2,
  },
  compTraditional: {
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  compSyndicateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  compSyndicate: {
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 10,
  },
})
