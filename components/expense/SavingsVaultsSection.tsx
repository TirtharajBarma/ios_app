import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
} from 'react-native';
import { Sparkles, Plus, ChevronRight, X, ArrowUpRight, ArrowDownLeft, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { SavingsVault } from '@/types/expense';
import { expenseColors } from '@/constants/expenseColors';
import { formatCompactCurrency } from './MoneyFlowCard';

interface SavingsVaultsSectionProps {
  onOpenGoalsModal?: () => void;
}

export const SavingsVaultsSection: React.FC<SavingsVaultsSectionProps> = ({ onOpenGoalsModal }) => {
  const {
    savingsVaults,
    currencySymbol,
    depositToVault,
    withdrawFromVault,
    addSavingsVault,
    accounts,
  } = useExpenseStore();

  const sym = currencySymbol || '₹';

  // Quick Action Modal States
  const [selectedVault, setSelectedVault] = useState<SavingsVault | null>(null);
  const [actionType, setActionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [actionAmount, setActionAmount] = useState<string>('');
  const [showActionModal, setShowActionModal] = useState<boolean>(false);

  // New Goal Modal States
  const [showNewGoalModal, setShowNewGoalModal] = useState<boolean>(false);
  const [newGoalName, setNewGoalName] = useState<string>('');
  const [newGoalTarget, setNewGoalTarget] = useState<string>('');
  const [newGoalEmoji, setNewGoalEmoji] = useState<string>('🛡️');

  const totalSavedInVaults = savingsVaults.reduce((sum, v) => sum + (v.currentAmount || 0), 0);

  const handleOpenAction = (vault: SavingsVault, type: 'deposit' | 'withdraw') => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedVault(vault);
    setActionType(type);
    setActionAmount('');
    setShowActionModal(true);
  };

  const handleExecuteAction = () => {
    Keyboard.dismiss();
    if (!selectedVault) return;
    const amt = parseFloat(actionAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    const defaultAccId = accounts[0]?.id || 'acc_primary';

    if (actionType === 'deposit') {
      depositToVault(selectedVault.id, amt, defaultAccId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      if (amt > selectedVault.currentAmount) {
        Alert.alert('Exceeds Balance', `You only have ${sym}${selectedVault.currentAmount.toLocaleString('en-IN')} in this goal.`);
        return;
      }
      withdrawFromVault(selectedVault.id, amt, defaultAccId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    setShowActionModal(false);
    setActionAmount('');
    setSelectedVault(null);
  };

  const handleCreateGoal = () => {
    Keyboard.dismiss();
    const target = parseFloat(newGoalTarget);
    if (!newGoalName.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Invalid Goal', 'Please enter a valid goal name and target amount.');
      return;
    }

    const pastelColors = ['#70D6BC', '#C4A7E7', '#F8A888', '#8CD9C8', '#FF9D66'];
    const randomColor = pastelColors[savingsVaults.length % pastelColors.length];

    addSavingsVault({
      name: newGoalName.trim(),
      emoji: newGoalEmoji.trim() || '🎯',
      targetAmount: target,
      color: randomColor,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setShowNewGoalModal(false);
    setNewGoalName('');
    setNewGoalTarget('');
    setNewGoalEmoji('🛡️');
  };

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <View style={styles.iconCircle}>
            <Shield size={13} color="#70D6BC" strokeWidth={2.5} />
          </View>
          <AppText style={styles.sectionTitle}>SAVINGS & GOALS</AppText>
          {totalSavedInVaults > 0 && (
            <View style={styles.totalPill}>
              <AppText style={styles.totalPillText}>
                {sym}{totalSavedInVaults.toLocaleString('en-IN')}
              </AppText>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.addGoalBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setShowNewGoalModal(true);
          }}
          activeOpacity={0.7}
        >
          <Plus size={13} color="#FF9D66" strokeWidth={2.5} />
          <AppText style={styles.addGoalBtnText}>New Goal</AppText>
        </TouchableOpacity>
      </View>

      {/* Goal Cards Stack */}
      {savingsVaults.length === 0 ? (
        <TouchableOpacity
          style={styles.emptyCard}
          onPress={() => setShowNewGoalModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.emptyIconCircle}>
            <Sparkles size={18} color="#FF9D66" />
          </View>
          <View style={styles.emptyContent}>
            <AppText style={styles.emptyTitle}>Create your first Savings Goal</AppText>
            <AppText style={styles.emptySub}>
              Lock money away for Emergency Fund or Travel so you stay disciplined.
            </AppText>
          </View>
          <Plus size={16} color="#FF9D66" />
        </TouchableOpacity>
      ) : (
        <View style={styles.goalsStack}>
          {savingsVaults.map((vault) => {
            const current = vault.currentAmount || 0;
            const target = vault.targetAmount || 1;
            const pct = Math.min(Math.round((current / target) * 100), 100);
            const isCompleted = current >= target;

            return (
              <View key={vault.id} style={styles.vaultCard}>
                {/* Top Info */}
                <View style={styles.vaultTopRow}>
                  <View style={styles.vaultLeft}>
                    <AppText style={styles.vaultEmoji}>{vault.emoji || '🎯'}</AppText>
                    <View>
                      <AppText style={styles.vaultName} numberOfLines={1}>
                        {vault.name}
                      </AppText>
                      <AppText style={styles.vaultMeta}>
                        {formatCompactCurrency(current, sym)} of {formatCompactCurrency(target, sym)}
                      </AppText>
                    </View>
                  </View>

                  <View style={[styles.pctBadge, isCompleted && styles.pctBadgeCompleted]}>
                    <AppText style={[styles.pctText, isCompleted && styles.pctTextCompleted]}>
                      {pct}%
                    </AppText>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: vault.color || '#70D6BC',
                      },
                    ]}
                  />
                </View>

                {/* Bottom Quick Action Buttons */}
                <View style={styles.vaultBottomRow}>
                  <AppText style={styles.vaultFootnote}>
                    {isCompleted
                      ? '🎉 Goal Completed!'
                      : `${sym}${Math.max(0, target - current).toLocaleString('en-IN')} remaining`}
                  </AppText>

                  <View style={styles.actionBtnsGroup}>
                    <TouchableOpacity
                      style={styles.miniActionBtn}
                      onPress={() => handleOpenAction(vault, 'deposit')}
                      activeOpacity={0.7}
                    >
                      <ArrowUpRight size={11} color="#70D6BC" />
                      <AppText style={styles.miniActionTextGreen}>Deposit</AppText>
                    </TouchableOpacity>

                    {current > 0 && (
                      <TouchableOpacity
                        style={styles.miniActionBtn}
                        onPress={() => handleOpenAction(vault, 'withdraw')}
                        activeOpacity={0.7}
                      >
                        <ArrowDownLeft size={11} color="#FF9D66" />
                        <AppText style={styles.miniActionTextPeach}>Withdraw</AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Quick Deposit / Withdraw Sheet Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowActionModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setShowActionModal(false);
            }}
          />
          <View style={styles.actionModalCard}>
            <View style={styles.modalHeaderRow}>
              <AppText style={styles.modalTitle}>
                {actionType === 'deposit' ? 'Deposit into Goal' : 'Withdraw from Goal'}
              </AppText>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowActionModal(false);
                }}
                style={styles.modalCloseBtn}
              >
                <X size={15} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {selectedVault && (
              <View style={styles.selectedVaultInfo}>
                <AppText style={{ fontSize: 20 }}>{selectedVault.emoji}</AppText>
                <View>
                  <AppText style={styles.selectedVaultName}>{selectedVault.name}</AppText>
                  <AppText style={styles.selectedVaultSub}>
                    Current Saved: {sym}{selectedVault.currentAmount.toLocaleString('en-IN')}
                  </AppText>
                </View>
              </View>
            )}

            <View style={styles.modalInputWrapper}>
              <AppText style={styles.modalInputPrefix}>{sym}</AppText>
              <TextInput
                style={styles.modalTextInput}
                placeholder="Amount (e.g. 3000)"
                placeholderTextColor="#555866"
                keyboardType="numeric"
                autoFocus
                value={actionAmount}
                onChangeText={setActionAmount}
                returnKeyType="done"
                onSubmitEditing={handleExecuteAction}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.modalSubmitBtn,
                actionType === 'deposit' ? styles.modalSubmitBtnGreen : styles.modalSubmitBtnPeach,
              ]}
              onPress={handleExecuteAction}
              activeOpacity={0.85}
            >
              <AppText style={styles.modalSubmitBtnText}>
                {actionType === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
              </AppText>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* New Goal Modal */}
      <Modal
        visible={showNewGoalModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowNewGoalModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          style={styles.modalOverlayBottom}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setShowNewGoalModal(false);
            }}
          />
          <View style={styles.newGoalSheetCard}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeaderRow}>
              <AppText style={styles.modalTitle}>Create New Savings Goal</AppText>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowNewGoalModal(false);
                }}
                style={styles.modalCloseBtn}
              >
                <X size={15} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ width: 64 }}>
                <AppText style={styles.inputFieldLabel}>EMOJI</AppText>
                <TextInput
                  style={styles.emojiInput}
                  value={newGoalEmoji}
                  onChangeText={setNewGoalEmoji}
                  returnKeyType="next"
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles.inputFieldLabel}>GOAL NAME</AppText>
                <TextInput
                  style={styles.sheetTextInput}
                  placeholder="e.g. Emergency Fund, Goa Trip"
                  placeholderTextColor="#555866"
                  value={newGoalName}
                  onChangeText={setNewGoalName}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={{ marginBottom: 18 }}>
              <AppText style={styles.inputFieldLabel}>TARGET AMOUNT ({sym})</AppText>
              <TextInput
                style={styles.sheetTextInput}
                placeholder="e.g. 50000"
                placeholderTextColor="#555866"
                keyboardType="numeric"
                value={newGoalTarget}
                onChangeText={setNewGoalTarget}
                returnKeyType="done"
                onSubmitEditing={handleCreateGoal}
              />
            </View>

            <TouchableOpacity
              style={styles.saveGoalBtn}
              onPress={handleCreateGoal}
              activeOpacity={0.85}
            >
              <Sparkles size={16} color="#0D0E12" />
              <AppText style={styles.saveGoalBtnText}>Create Goal</AppText>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  totalPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(112, 214, 188, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(112, 214, 188, 0.2)',
  },
  totalPillText: {
    color: '#70D6BC',
    fontSize: 10,
    fontWeight: '800',
  },
  addGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
  },
  addGoalBtnText: {
    color: '#FF9D66',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#16181D',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  emptyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContent: {
    flex: 1,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  emptySub: {
    color: '#7E8394',
    fontSize: 11,
    lineHeight: 15,
  },
  goalsStack: {
    gap: 10,
  },
  vaultCard: {
    backgroundColor: '#16181D',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  vaultTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  vaultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  vaultEmoji: {
    fontSize: 22,
  },
  vaultName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  vaultMeta: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
  },
  pctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pctBadgeCompleted: {
    backgroundColor: 'rgba(112, 214, 188, 0.15)',
    borderColor: '#70D6BC',
  },
  pctText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '800',
  },
  pctTextCompleted: {
    color: '#70D6BC',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  vaultBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vaultFootnote: {
    color: '#7E8394',
    fontSize: 11,
    fontWeight: '500',
  },
  actionBtnsGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  miniActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  miniActionTextGreen: {
    color: '#70D6BC',
    fontSize: 10,
    fontWeight: '700',
  },
  miniActionTextPeach: {
    color: '#FF9D66',
    fontSize: 10,
    fontWeight: '700',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  actionModalCard: {
    width: '100%',
    backgroundColor: '#1A1D23',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  newGoalSheetCard: {
    backgroundColor: '#1A1D23',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedVaultInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#101114',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  selectedVaultName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedVaultSub: {
    color: '#7E8394',
    fontSize: 11,
  },
  modalInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101114',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  modalInputPrefix: {
    color: '#70D6BC',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 6,
  },
  modalTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 12,
  },
  modalSubmitBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnGreen: {
    backgroundColor: '#70D6BC',
  },
  modalSubmitBtnPeach: {
    backgroundColor: '#FF9D66',
  },
  modalSubmitBtnText: {
    color: '#0D0E12',
    fontSize: 13,
    fontWeight: '800',
  },
  inputFieldLabel: {
    color: '#656A7B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  emojiInput: {
    backgroundColor: '#101114',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sheetTextInput: {
    backgroundColor: '#101114',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  saveGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9D66',
    paddingVertical: 14,
    borderRadius: 16,
  },
  saveGoalBtnText: {
    color: '#0D0E12',
    fontSize: 14,
    fontWeight: '800',
  },
});
