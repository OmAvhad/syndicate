import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Pressable } from 'react-native'
import { ShieldCheck, Eye, EyeOff, ArrowDownRight, ArrowUpRight, Lock, X } from 'lucide-react-native'
import { useTrade } from '../context/TradeContext'
import { useTheme } from '../context/ThemeContext'

export function ShieldedBalanceCard() {
  const { colors } = useTheme()
  const { shieldedBalance, isConcealed, toggleConceal, depositToPool, withdrawFromPool } = useTrade()
  const [modalType, setModalType] = useState<'deposit' | 'withdraw' | null>(null)
  const [inputAmount, setInputAmount] = useState('')

  const handleAction = () => {
    const val = parseFloat(inputAmount)
    if (!isNaN(val) && val > 0) {
      if (modalType === 'deposit') {
        depositToPool(val)
      } else {
        withdrawFromPool(val)
      }
      setInputAmount('')
      setModalType(null)
    }
  }

  const ethPriceUsd = 2650
  const totalUsd = (shieldedBalance * ethPriceUsd).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={[styles.shieldIconBox, { backgroundColor: colors.accentSoft }]}>
            <Lock size={12} color={colors.accent} />
          </View>
          <Text style={[styles.badgeText, { color: colors.accent }]}>KOHAKU RAILGUN SHIELDED POOL</Text>
        </View>

        <TouchableOpacity onPress={toggleConceal} style={styles.concealBtn} activeOpacity={0.7} hitSlop={12}>
          {isConcealed ? (
            <Eye size={17} color={colors.textMuted} />
          ) : (
            <EyeOff size={17} color={colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      {/* Balance Figures */}
      <View style={styles.balanceContainer}>
        <Text style={[styles.balanceEth, { color: colors.textPrimary }]}>
          {isConcealed ? '••••••••' : `${shieldedBalance.toFixed(4)} ETH`}
        </Text>
        <Text style={[styles.balanceUsd, { color: colors.textMuted }]}>
          {isConcealed ? '••••••' : `≈ ${totalUsd} (Sepolia)`}
        </Text>
      </View>

      {/* Privacy guarantee note */}
      <View style={[styles.privacyNote, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle }]}>
        <ShieldCheck size={14} color={colors.accent} />
        <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
          Balance is fully unlinked from your public address on-chain.
        </Text>
      </View>

      {/* Actions (Touch targets: 48px height) */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.accent }]}
          onPress={() => setModalType('deposit')}
          activeOpacity={0.8}
        >
          <ArrowDownRight size={16} color={colors.textInverse} strokeWidth={2.2} />
          <Text style={[styles.depositBtnText, { color: colors.textInverse }]}>Shield Deposit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
          onPress={() => setModalType('withdraw')}
          activeOpacity={0.8}
        >
          <ArrowUpRight size={16} color={colors.textPrimary} strokeWidth={2.2} />
          <Text style={[styles.withdrawBtnText, { color: colors.textPrimary }]}>Unshield</Text>
        </TouchableOpacity>
      </View>

      {/* Mobile-Native Bottom Sheet for Deposit / Withdraw */}
      <Modal visible={modalType !== null} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.backdropPress} onPress={() => setModalType(null)} />
          <View style={[styles.sheetContent, { backgroundColor: colors.card, borderColor: colors.borderHover }]}>
            {/* Sheet Handle */}
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                {modalType === 'deposit' ? 'Shield Funds (Deposit)' : 'Unshield to Public Address'}
              </Text>
              <TouchableOpacity onPress={() => setModalType(null)} hitSlop={12}>
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sheetSub, { color: colors.textMuted }]}>
              {modalType === 'deposit'
                ? 'Adds testnet ETH into your private zero-knowledge Railgun note.'
                : 'Withdraws funds from your shielded balance back to a public address.'}
            </Text>

            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="0.00 ETH"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={inputAmount}
                onChangeText={setInputAmount}
                autoFocus
              />
            </View>

            {/* Quick Amount Pills */}
            <View style={styles.pillRow}>
              {[0.1, 0.5, 1.0].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[styles.quickPill, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                  onPress={() => setInputAmount(amt.toString())}
                >
                  <Text style={[styles.quickPillText, { color: colors.accent }]}>+{amt} ETH</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sheetBtnRow}>
              <TouchableOpacity
                style={[styles.sheetCancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  setModalType(null)
                  setInputAmount('')
                }}
              >
                <Text style={[styles.sheetCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetConfirmBtn, { backgroundColor: colors.accent }]}
                onPress={handleAction}
              >
                <Text style={[styles.sheetConfirmText, { color: colors.textInverse }]}>
                  {modalType === 'deposit' ? 'Confirm Shield' : 'Confirm Unshield'}
                </Text>
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shieldIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  concealBtn: {
    padding: 6,
  },
  balanceContainer: {
    marginVertical: 4,
  },
  balanceEth: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  balanceUsd: {
    fontSize: 14,
    marginTop: 2,
    fontWeight: '500',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginVertical: 12,
    borderWidth: 1,
  },
  privacyText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  depositBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  withdrawBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  backdropPress: {
    flex: 1,
  },
  sheetContent: {
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
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSub: {
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 17,
  },
  inputWrap: {
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 18,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
  },
  quickPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sheetBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetCancelBtn: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  sheetCancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  sheetConfirmBtn: {
    flex: 2,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  sheetConfirmText: {
    fontWeight: '800',
    fontSize: 14,
  },
})
