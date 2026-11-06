import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TextInput, RefreshControl } from 'react-native'
import { Search, ShieldAlert, Sparkles } from 'lucide-react-native'
import { useTrade } from '../../context/TradeContext'
import { useTheme } from '../../context/ThemeContext'
import { LeaderCard } from '../../components/LeaderCard'
import { CopyModal } from '../../components/CopyModal'
import type { Leader } from '../../types/trade'

export function DiscoverScreen() {
  const { colors } = useTheme()
  const { leaders, activeAllocation, allocateToLeader } = useTrade()
  const [search, setSearch] = useState('')
  const [selectedLeader, setSelectedLeader] = useState<Leader | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = React.useCallback(() => {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
    }, 600)
  }, [])

  const filteredLeaders = leaders.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.description.toLowerCase().includes(search.toLowerCase()) ||
      l.pairs.some((p) => p.toLowerCase().includes(search.toLowerCase()))
  )

  const handleOpenCopy = (leader: Leader) => {
    setSelectedLeader(leader)
  }

  const handleConfirmCopy = (amountEth: number, slippage: number, stopLoss: number) => {
    if (selectedLeader) {
      allocateToLeader(selectedLeader.id, amountEth, slippage, stopLoss)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
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
        {/* Banner */}
        <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.borderHover }]}>
          <View style={styles.bannerHeader}>
            <Sparkles size={14} color={colors.accent} />
            <Text style={[styles.bannerTag, { color: colors.accent }]}>VERIFIED LEADER DESKS</Text>
          </View>
          <Text style={[styles.bannerTitle, { color: colors.textPrimary }]}>
            Copy Proven Execution Without Custodial Risk
          </Text>
          <Text style={[styles.bannerSub, { color: colors.textMuted }]}>
            All leaders trade from verified accounts. When they submit signed instructions, your
            shielded funds mirror their moves proportionally via relayer batches.
          </Text>
        </View>

        {/* Search Bar (50px height) */}
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search by leader name or pair (e.g. Priya, ETH)..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Leaderboard List */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          FEATURED TRADERS ({filteredLeaders.length})
        </Text>

        {filteredLeaders.map((leader) => (
          <LeaderCard
            key={leader.id}
            leader={leader}
            isAllocated={activeAllocation?.leaderId === leader.id}
            onPressCopy={handleOpenCopy}
          />
        ))}

        {filteredLeaders.length === 0 && (
          <View style={styles.emptyBox}>
            <ShieldAlert size={28} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No matching leaders found</Text>
          </View>
        )}
      </ScrollView>

      {/* Mobile-Native Bottom Sheet Copy Allocation Modal */}
      <CopyModal
        visible={selectedLeader !== null}
        leader={selectedLeader}
        onClose={() => setSelectedLeader(null)}
        onConfirm={handleConfirmCopy}
      />
    </View>
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
  banner: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  bannerTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
  },
})
