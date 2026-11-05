import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { CheckCircle2, TrendingUp, Users, ArrowRight } from 'lucide-react-native'
import { useTheme } from '../context/ThemeContext'
import type { Leader } from '../types/trade'

interface LeaderCardProps {
  leader: Leader
  isAllocated?: boolean
  onPressCopy: (leader: Leader) => void
}

export function LeaderCard({ leader, isAllocated, onPressCopy }: LeaderCardProps) {
  const { colors } = useTheme()

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: isAllocated ? colors.accent : colors.border },
      ]}
    >
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{leader.name}</Text>
          {leader.isVerified && (
            <CheckCircle2 size={15} color={colors.accent} strokeWidth={2.5} />
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
          <Text style={[styles.badgeText, { color: colors.accent }]}>{leader.badge}</Text>
        </View>
      </View>

      <Text style={[styles.desc, { color: colors.textMuted }]}>{leader.description}</Text>

      {/* Metrics Row */}
      <View
        style={[
          styles.metricsGrid,
          { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle },
        ]}
      >
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>30D ROI</Text>
          <View style={styles.metricValueRow}>
            <TrendingUp size={13} color={colors.success} />
            <Text style={[styles.roiValue, { color: colors.success }]}>+{leader.monthlyRoi}%</Text>
          </View>
        </View>

        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>WIN RATE</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{leader.winRate}%</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>SHIELDED COPIERS</Text>
          <View style={styles.metricValueRow}>
            <Users size={12} color={colors.textMuted} />
            <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{leader.totalCopiers}</Text>
          </View>
        </View>

        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>AUM</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{leader.shieldedAum}</Text>
        </View>
      </View>

      {/* Bottom CTA Row (48px height) */}
      <View style={styles.footerRow}>
        <View style={styles.pairsRow}>
          {leader.pairs.map((p) => (
            <View
              key={p}
              style={[styles.pairTag, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.pairText, { color: colors.textSecondary }]}>{p}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.copyBtn,
            { backgroundColor: isAllocated ? colors.surfaceSubtle : colors.accent },
            isAllocated && { borderWidth: 1, borderColor: colors.accent },
          ]}
          onPress={() => onPressCopy(leader)}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.copyBtnText,
              { color: isAllocated ? colors.accent : colors.textInverse },
            ]}
          >
            {isAllocated ? 'Allocated' : 'Copy Moves'}
          </Text>
          {!isAllocated && <ArrowRight size={14} color={colors.textInverse} strokeWidth={2.5} />}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  desc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 10,
    justifyContent: 'space-between',
    borderWidth: 1,
    marginBottom: 12,
  },
  metricItem: {
    alignItems: 'flex-start',
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '800',
    marginBottom: 3,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roiValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pairsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pairTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  pairText: {
    fontSize: 10,
    fontWeight: '700',
  },
  copyBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
})
