import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native'
import {
  ShieldCheck,
  UserCheck,
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  Play,
  RotateCw,
} from 'lucide-react-native'
import { useAuth } from '../../context/AuthContext'
import { useTrade } from '../../context/TradeContext'
import { useTheme } from '../../context/ThemeContext'
import { ShieldedBalanceCard } from '../../components/ShieldedBalanceCard'

export function DashboardScreen({ onNavigateDiscover }: { onNavigateDiscover: () => void }) {
  const { user } = useAuth()
  const { colors } = useTheme()
  const {
    activeAllocation,
    leaders,
    executions,
    executeSimulatedTrade,
    stopCopying,
  } = useTrade()
  const [refreshing, setRefreshing] = useState(false)

  const activeLeader = leaders.find((l) => l.id === activeAllocation?.leaderId)

  const onRefresh = React.useCallback(() => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
    }, 600)
  }, [])

  const handleStopCopying = () => {
    Alert.alert(
      'Cancel Copy Allocation',
      'Are you sure you want to stop copying moves from this leader? Outstanding orders will be cancelled.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop Copying', style: 'destructive', onPress: stopCopying },
      ]
    )
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      {/* User Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
        <View style={styles.statusLeft}>
          <View style={[styles.avatarBox, { backgroundColor: colors.accentSoft }]}>
            <UserCheck size={16} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.username || 'Shielded User'}</Text>
            <Text style={[styles.nullifierText, { color: colors.textMuted }]}>
              {user?.nullifierHash
                ? `${user.nullifierHash.substring(0, 8)}...${user.nullifierHash.substring(user.nullifierHash.length - 6)}`
                : 'ZK Verified'}
            </Text>
          </View>
        </View>

        <View style={[styles.verifiedBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }]}>
          <ShieldCheck size={12} color={colors.accent} />
          <Text style={[styles.verifiedText, { color: colors.accent }]}>ORB VERIFIED</Text>
        </View>
      </View>

      {/* Shielded Balance Card */}
      <ShieldedBalanceCard />

      {/* Active Syndicate Delegation */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACTIVE COPY DELEGATION</Text>
        {activeAllocation && (
          <TouchableOpacity onPress={handleStopCopying} hitSlop={10}>
            <Text style={[styles.stopText, { color: colors.danger }]}>Stop Copying</Text>
          </TouchableOpacity>
        )}
      </View>

      {activeAllocation && activeLeader ? (
        <View style={[styles.activeSyndicateCard, { backgroundColor: colors.card, borderColor: colors.borderHover }]}>
          <View style={styles.leaderHeader}>
            <View>
              <Text style={[styles.leaderName, { color: colors.textPrimary }]}>{activeLeader.name}</Text>
              <Text style={[styles.leaderBadgeText, { color: colors.accent }]}>{activeLeader.badge}</Text>
            </View>
            <View style={[styles.liveTag, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
              <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.liveText, { color: colors.success }]}>COPYING ACTIVE</Text>
            </View>
          </View>

          <View style={[styles.allocGrid, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle }]}>
            <View style={styles.allocItem}>
              <Text style={[styles.allocLabel, { color: colors.textMuted }]}>ALLOCATED</Text>
              <Text style={[styles.allocVal, { color: colors.textPrimary }]}>{activeAllocation.allocatedEth} ETH</Text>
            </View>
            <View style={styles.allocItem}>
              <Text style={[styles.allocLabel, { color: colors.textMuted }]}>MAX SLIPPAGE</Text>
              <Text style={[styles.allocVal, { color: colors.textPrimary }]}>{activeAllocation.maxSlippagePercent}%</Text>
            </View>
            <View style={styles.allocItem}>
              <Text style={[styles.allocLabel, { color: colors.textMuted }]}>STOP-LOSS</Text>
              <Text style={[styles.allocVal, { color: colors.textPrimary }]}>{activeAllocation.stopLossPercent}%</Text>
            </View>
            <View style={styles.allocItem}>
              <Text style={[styles.allocLabel, { color: colors.textMuted }]}>UNREALIZED PNL</Text>
              <Text style={[styles.allocVal, { color: colors.success }]}>+0.18 ETH</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AlertCircle size={26} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Active Copy Delegation</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Select a verified leader to automatically mirror their trades via zero-knowledge relayers.
          </Text>
          <TouchableOpacity
            style={[styles.browseBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderHover }]}
            onPress={onNavigateDiscover}
          >
            <Text style={[styles.browseBtnText, { color: colors.accent }]}>Discover Leaders</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Simulation Trigger Bar (Mobile Thumb Ergonomics) */}
      <View style={[styles.simBar, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.simTitle, { color: colors.textPrimary }]}>Simulate Leader Trade Move</Text>
          <Text style={[styles.simSubtitle, { color: colors.textMuted }]}>
            Trigger mock copy-execution via simulated Node relayer.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.simBtn, { backgroundColor: colors.accent }]}
          onPress={executeSimulatedTrade}
          activeOpacity={0.8}
        >
          <Play size={14} color={colors.textInverse} fill={colors.textInverse} />
          <Text style={[styles.simBtnText, { color: colors.textInverse }]}>Trigger</Text>
        </TouchableOpacity>
      </View>

      {/* Execution History */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SHIELDED EXECUTION HISTORY</Text>
        <Text style={[styles.historyCounter, { color: colors.textMuted }]}>{executions.length} Events</Text>
      </View>

      <View style={styles.historyList}>
        {executions.map((item) => (
          <View
            key={item.id}
            style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.historyLeft}>
              <View
                style={[
                  styles.actionCircle,
                  item.action === 'BUY'
                    ? { backgroundColor: colors.successSoft }
                    : { backgroundColor: colors.dangerSoft },
                ]}
              >
                {item.action === 'BUY' ? (
                  <ArrowDownRight size={15} color={colors.success} />
                ) : (
                  <ArrowUpRight size={15} color={colors.danger} />
                )}
              </View>
              <View>
                <View style={styles.pairRow}>
                  <Text style={[styles.pairText, { color: colors.textPrimary }]}>{item.pair}</Text>
                  <View style={[styles.simBadge, { backgroundColor: colors.warningSoft }]}>
                    <Text style={[styles.simBadgeText, { color: colors.warning }]}>⚠️ SIMULATION</Text>
                  </View>
                </View>
                <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                  Leader {item.leaderName} • {item.timestamp}
                </Text>
              </View>
            </View>

            <View style={styles.historyRight}>
              <Text
                style={[
                  styles.historyAmount,
                  { color: item.action === 'BUY' ? colors.success : colors.textPrimary },
                ]}
              >
                {item.action === 'BUY' ? '+' : '-'}{item.amountEth} ETH
              </Text>
              <Text style={[styles.historyFee, { color: colors.textMuted }]}>Relayer: {item.relayerFee}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 12,
    fontWeight: '700',
  },
  nullifierText: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  stopText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeSyndicateCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  leaderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leaderName: {
    fontSize: 16,
    fontWeight: '800',
  },
  leaderBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
  },
  allocGrid: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 10,
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  allocItem: {
    alignItems: 'flex-start',
  },
  allocLabel: {
    fontSize: 8,
    fontWeight: '800',
    marginBottom: 3,
  },
  allocVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 280,
  },
  browseBtn: {
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginTop: 8,
  },
  browseBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  simBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    gap: 12,
  },
  simTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  simSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  simBtn: {
    height: 42,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    gap: 5,
  },
  simBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  historyCounter: {
    fontSize: 10,
    fontWeight: '600',
  },
  historyList: {
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pairText: {
    fontSize: 13,
    fontWeight: '700',
  },
  simBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  simBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  historyMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  historyFee: {
    fontSize: 9,
    marginTop: 2,
  },
})
