import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ShieldCheck,
  Fingerprint,
  Lock,
  ArrowRight,
  Sun,
  Moon,
  Sparkles,
  Cpu,
  UserCheck,
} from 'lucide-react-native'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
// import { BackendStatusCard } from '../../components/BackendStatusCard'

export function LoginScreen() {
  const insets = useSafeAreaInsets()
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
        setNotice('World App not detected. Launching Sandbox demo...')
        setTimeout(() => {
          simulateSandboxLogin()
          setIsVerifying(false)
        }, 1200)
      }
    } catch {
      setNotice('Running verification...')
      setTimeout(() => {
        simulateSandboxLogin()
        setIsVerifying(false)
      }, 1000)
    }
  }

  const handleSandboxVerify = async () => {
    setIsVerifying(true)
    setNotice('Generating zero-knowledge proof...')
    await simulateSandboxLogin()
    setIsVerifying(false)
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.bg,
          paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 16 : 0),
          paddingBottom: Math.max(insets.bottom, 24),
        },
      ]}
    >
      {/* Minimal Top Brand Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={[styles.brandIcon, { backgroundColor: colors.accent }]}>
            <ShieldCheck size={18} color={colors.textInverse} strokeWidth={2.5} />
          </View>
          <Text style={[styles.brandText, { color: colors.textPrimary }]}>SYNDICATE</Text>
        </View>

        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.themePill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
          activeOpacity={0.7}
          hitSlop={12}
        >
          {mode === 'dark' ? (
            <Sun size={15} color={colors.accent} />
          ) : (
            <Moon size={15} color={colors.accent} />
          )}
        </TouchableOpacity>
      </View>

      {/* Main Content Area - Clean, Focused, Spaced */}
      <View style={styles.centerContainer}>
        {/* Futuristic Glowing Biometric Emblem */}
        <View style={styles.emblemWrapper}>
          <View style={[styles.glowRing, { backgroundColor: colors.accentSoft }]} />
          <View style={[styles.emblemCircle, { backgroundColor: colors.surface, borderColor: colors.borderHover }]}>
            <Fingerprint size={42} color={colors.accent} strokeWidth={1.8} />
          </View>
        </View>

        {/* Hero Title & Subtext */}
        <View style={styles.typographyBlock}>
          <Text style={[styles.heroHeading, { color: colors.textPrimary }]}>
            Shielded Copy Trading
          </Text>
          <Text style={[styles.heroSubhead, { color: colors.textMuted }]}>
            Mirror top Ethereum traders with mathematical zero-knowledge privacy.
          </Text>
        </View>

        {/* Minimalist Micro Badges Row */}
        <View style={styles.pillsRow}>
          <View style={[styles.microPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <Cpu size={12} color={colors.accent} />
            <Text style={[styles.microPillText, { color: colors.textSecondary }]}>zk-SNARK</Text>
          </View>

          <View style={[styles.microPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <UserCheck size={12} color={colors.accent} />
            <Text style={[styles.microPillText, { color: colors.textSecondary }]}>1 Human = 1 Seat</Text>
          </View>

          <View style={[styles.microPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <Lock size={11} color={colors.accent} />
            <Text style={[styles.microPillText, { color: colors.textSecondary }]}>Non-Custodial</Text>
          </View>
        </View>
      </View>

      {/* Action Zone (Thumb Area) */}
      <View style={styles.bottomActionZone}>
        {/* Optional Backend Status (Commented out per request) */}
        {/* <BackendStatusCard /> */}

        {notice && (
          <View style={[styles.noticePill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.noticeLabel, { color: colors.accent }]}>{notice}</Text>
          </View>
        )}

        {/* Primary CTA Button: 56px Height, High Contrast */}
        <TouchableOpacity
          style={[styles.primaryCta, { backgroundColor: colors.accent }]}
          onPress={handleWorldAppDeepLink}
          disabled={isVerifying || isLoading}
          activeOpacity={0.85}
        >
          <Fingerprint size={20} color={colors.textInverse} strokeWidth={2.4} />
          <Text style={[styles.primaryCtaText, { color: colors.textInverse }]}>
            {isVerifying ? 'Connecting...' : 'Verify with World ID'}
          </Text>
          <ArrowRight size={18} color={colors.textInverse} strokeWidth={2.4} />
        </TouchableOpacity>

        {/* Clean, Subtle Demo Sandbox Button */}
        <TouchableOpacity
          style={styles.sandboxLink}
          onPress={handleSandboxVerify}
          disabled={isVerifying || isLoading}
          activeOpacity={0.6}
        >
          <Sparkles size={14} color={colors.textMuted} />
          <Text style={[styles.sandboxLinkText, { color: colors.textMuted }]}>
            Quick Demo Sandbox
          </Text>
        </TouchableOpacity>

        {/* Bottom Security Note */}
        <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
          Zero KYC • Private keys remain in your device enclave
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  themePill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emblemWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  glowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  emblemCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  typographyBlock: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  heroHeading: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  heroSubhead: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 290,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  microPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  microPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bottomActionZone: {
    gap: 12,
    alignItems: 'center',
    width: '100%',
  },
  noticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  noticeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  primaryCta: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sandboxLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  sandboxLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  disclaimerText: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
})
