import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Target, X, Check, ArrowRight, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';

interface SetBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const BUDGET_PRESETS = [15000, 25000, 35000, 50000, 75000, 100000];

export const SetBudgetModal: React.FC<SetBudgetModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const { monthlyBudget, setMonthlyBudget, setStatementSetup, currencySymbol, formatAmount } = useExpenseStore();
  const sym = currencySymbol || '₹';

  const [budgetInput, setBudgetInput] = useState<string>(
    monthlyBudget > 0 ? monthlyBudget.toString() : '30000'
  );

  const handleSelectPreset = (amount: number) => {
    Haptics.selectionAsync().catch(() => {});
    setBudgetInput(amount.toString());
  };

  const handleSave = () => {
    Keyboard.dismiss();
    const clean = budgetInput.trim().replace(/,/g, '');
    const num = clean === '' ? 0 : parseFloat(clean);
    if (isNaN(num) || num < 0) {
      alert('Please enter a valid monthly budget amount.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setMonthlyBudget(num);
    setStatementSetup({ budgetConfigured: true });

    onSuccess?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.badgeRow}>
              <View style={styles.stepBadge}>
                <Sparkles size={11} color="#FF9D66" />
                <AppText style={styles.stepBadgeText}>SETUP STEP 2 OF 2</AppText>
              </View>
            </View>
            <AppText style={styles.headerTitle}>MONTHLY SPENDING BUDGET</AppText>
            <AppText style={styles.headerSubtitle}>
              Set a monthly limit to track your spending runway
            </AppText>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onClose();
            }}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={20} color={expenseColors.textSubtle} />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        <View style={styles.contentBody}>
          {/* Informational Box */}
          <View style={styles.infoCard}>
            <Target size={18} color="#FF9D66" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <AppText style={styles.infoTitle}>Why set a budget?</AppText>
              <AppText style={styles.infoText}>
                Bank statements contain historical expenses, but not your personal target limit. Setting a budget helps calculate your safe-to-spend daily runway.
              </AppText>
            </View>
          </View>

          {/* Amount Input Box */}
          <View style={styles.inputSection}>
            <AppText style={styles.inputLabel}>MONTHLY TARGET AMOUNT</AppText>
            <View style={styles.inputRow}>
              <AppText style={styles.currencyPrefix}>{sym}</AppText>
              <TextInput
                style={styles.amountInput}
                value={budgetInput}
                onChangeText={setBudgetInput}
                placeholder="30,000"
                placeholderTextColor="#6C7082"
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
          </View>

          {/* Quick Presets Grid */}
          <View style={styles.presetsSection}>
            <AppText style={styles.presetsLabel}>QUICK PRESETS</AppText>
            <View style={styles.presetsGrid}>
              {BUDGET_PRESETS.map((amount) => {
                const isSelected = budgetInput.trim().replace(/,/g, '') === amount.toString();
                return (
                  <TouchableOpacity
                    key={amount}
                    style={[
                      styles.presetChip,
                      isSelected && styles.presetChipSelected,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => handleSelectPreset(amount)}
                  >
                    <AppText
                      style={[
                        styles.presetChipText,
                        isSelected && styles.presetChipTextSelected,
                      ]}
                    >
                      {formatAmount(amount)}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Bottom Save Action Button */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.saveButton}
            activeOpacity={0.85}
            onPress={handleSave}
          >
            <AppText style={styles.saveButtonText}>Save Budget & Finish Setup</AppText>
            <ArrowRight size={18} color="#0D0E12" strokeWidth={2.8} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101114',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeRow: {
    marginBottom: 6,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  stepBadgeText: {
    color: '#FF9D66',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    color: '#8E919D',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#161922',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.15)',
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoText: {
    color: '#8E919D',
    fontSize: 12,
    lineHeight: 17,
  },
  inputSection: {
    backgroundColor: '#161922',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputLabel: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyPrefix: {
    color: '#FF9D66',
    fontSize: 26,
    fontWeight: '800',
  },
  amountInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    paddingVertical: 0,
  },
  presetsSection: {
    gap: 10,
  },
  presetsLabel: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetChipSelected: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    borderColor: '#FF9D66',
  },
  presetChipText: {
    color: '#8E919D',
    fontSize: 13,
    fontWeight: '600',
  },
  presetChipTextSelected: {
    color: '#FF9D66',
    fontWeight: '700',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#101114',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9D66',
    paddingVertical: 15,
    borderRadius: 14,
  },
  saveButtonText: {
    color: '#0D0E12',
    fontSize: 15,
    fontWeight: '800',
  },
});
