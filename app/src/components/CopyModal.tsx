import React, { useState } from 'react'
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Pressable } from 'react-native'
import { ShieldCheck, Check, X } from 'lucide-react-native'
import { useTheme } from '../context/ThemeContext'
import type { Leader } from '../types/trade'

interface CopyModalProps {
  visible: boolean
  leader: Leader | null
  onClose: () => void
  onConfirm: (allocationEth: number, slippage: number, stopLoss: number) => void
}

export function CopyModal({ visible, leader, onClose, onConfirm }: CopyModalProps) {
  const { colors } = useTheme()
  const [allocation, setAllocation] = useState('0.5')
  const [slippage, setSlippage] = useState('0.5')
  const [stopLoss, setStopLoss] = useState('10')

  if (!leader) return null

  const handleConfirm = () => {
    const allocNum = parseFloat(allocation) || 0.5
    const slipNum = parseFloat(slippage) || 0.5
    const slNum = parseFloat(stopLoss) || 10
    onConfirm(allocNum, slipNum, slNum)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderTopColor: colors.borderHover }]}>
          {/* Pull Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Delegate Copy Allocation</Text>
              <Text style={[styles.subtitle, { color: colors.accent }]}>Copying {leader.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Allocation Input with Quick Presets */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textMuted }]}>ALLOCATION CAP (ETH)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, color: colors.textPrimary }]}
              value={allocation}
              onChangeText={setAllocation}
              keyboardType="decimal-pad"
              placeholder="0.5"
              placeholderTextColor={colors.textMuted}
            />
            {/* Presets */}
            <View style={styles.presetRow}>
              {['0.25', '0.5', '1.0', '2.0'].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.presetPill,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                    allocation === val && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
                  ]}
                  onPress={() => setAllocation(val)}
                >
                  <Text style={[styles.presetText, { color: allocation === val ? colors.accent : colors.textSecondary }]}>
                    {val} ETH
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Slippage & Stop Loss Row */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textMuted }]}>MAX SLIPPAGE (%)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, color: colors.textPrimary }]}
                value={slippage}
                onChangeText={setSlippage}
                keyboardType="decimal-pad"
                placeholder="0.5"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textMuted }]}>STOP-LOSS (%)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, color: colors.textPrimary }]}
                value={stopLoss}
                onChangeText={setStopLoss}
                keyboardType="decimal-pad"
                placeholder="10"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* Security guarantee note */}
          <View style={[styles.warningBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderSubtle }]}>
            <ShieldCheck size={16} color={colors.accent} />
            <Text style={[styles.warningText, { color: colors.textSecondary }]}>
              EIP-712 Intent Delegation: Leader never gains custody of your funds. Trades execute via relayer batch zk-SNARKs.
            </Text>
          </View>

          {/* Actions with 52px thumb target */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.accent }]}
              onPress={handleConfirm}
            >
              <Check size={18} color={colors.textInverse} strokeWidth={2.5} />
              <Text style={[styles.confirmText, { color: colors.textInverse }]}>Authorize Copy Trade</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  presetPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    marginTop: 4,
  },
  warningText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    flex: 2,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 6,
  },
  confirmText: {
    fontWeight: '800',
    fontSize: 14,
  },
})
