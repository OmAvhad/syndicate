import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { ShieldCheck, Cpu, Sun, Moon } from 'lucide-react-native'
import { useTheme } from '../context/ThemeContext'

interface BrandHeaderProps {
  subtitle?: string
  rightComponent?: React.ReactNode
}

export function BrandHeader({ subtitle = 'ANONYMOUS COPY TRADING', rightComponent }: BrandHeaderProps) {
  const { colors, mode, toggleTheme } = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSubtle, borderBottomColor: colors.border }]}>
      <View style={styles.left}>
        <View style={[styles.iconBox, { backgroundColor: colors.accent }]}>
          <ShieldCheck size={18} color={colors.textInverse} strokeWidth={2.5} />
        </View>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>SYNDICATE</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.rightRow}>
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.themeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
          accessibilityLabel="Toggle Dark / Light Theme"
        >
          {mode === 'dark' ? (
            <Sun size={15} color={colors.accent} />
          ) : (
            <Moon size={15} color={colors.accent} />
          )}
        </TouchableOpacity>

        {rightComponent || (
          <View style={[styles.zkBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }]}>
            <Cpu size={12} color={colors.accent} />
            <Text style={[styles.zkText, { color: colors.accent }]}>ZK-SNARK</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  rightRow: {
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
  zkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  zkText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
