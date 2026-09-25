import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import {
  X,
  Wallet,
  CreditCard,
  Banknote,
  CheckCircle2,
  Plus,
  Building2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseAccount } from '@/types/expense';
import { AccountIcon } from './AccountIcon';

interface SetOpeningBalancesModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export const SetOpeningBalancesModal: React.FC<SetOpeningBalancesModalProps> = ({
  visible,
  onClose,
  onSaveSuccess,
}) => {
  const { accounts, updateAccount, addAccount, setStatementSetup, currencySymbol } = useExpenseStore();
  const sym = currencySymbol || '₹';

  // Map of account ID -> input string for balance
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});
  const [accountTypes, setAccountTypes] = useState<Record<string, 'savings' | 'credit' | 'wallet'>>({});

  // Add missing account state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'savings' | 'credit' | 'wallet'>('savings');
  const [newAccBalance, setNewAccBalance] = useState('');

  useEffect(() => {
    if (visible) {
      const initialMap: Record<string, string> = {};
      const initialTypes: Record<string, 'savings' | 'credit' | 'wallet'> = {};

      accounts.forEach((acc) => {
        initialMap[acc.id] = acc.balance > 0 ? acc.balance.toString() : '';
        initialTypes[acc.id] = (acc.type as 'savings' | 'credit' | 'wallet') || (acc.statusType === 'due' ? 'credit' : 'savings');
      });

      setBalanceInputs(initialMap);
      setAccountTypes(initialTypes);
      setIsAddingNew(false);
      setNewAccName('');
      setNewAccBalance('');
      setNewAccType('savings');
    }
  }, [visible, accounts]);

  const handleInputChange = (accId: string, text: string) => {
    setBalanceInputs((prev) => ({
      ...prev,
      [accId]: text,
    }));
  };

  const handleToggleType = (accId: string, newType: 'savings' | 'credit' | 'wallet') => {
    Keyboard.dismiss();
    Haptics.selectionAsync().catch(() => {});
    setAccountTypes((prev) => ({
      ...prev,
      [accId]: newType,
    }));
  };

  const handleAddNewAccount = () => {
    Keyboard.dismiss();
    if (!newAccName.trim()) return;
    Haptics.selectionAsync().catch(() => {});

    const numBal = parseFloat(newAccBalance.trim().replace(/,/g, '')) || 0;
    const isCredit = newAccType === 'credit';

    addAccount({
      name: newAccName.trim(),
      type: newAccType,
      balance: isCredit ? 0 : numBal,
      dueAmount: isCredit ? numBal : undefined,
      statusType: isCredit ? 'due' : 'positive',
      openingBalance: numBal,
    });

    setNewAccName('');
    setNewAccBalance('');
    setNewAccType('savings');
    setIsAddingNew(false);
  };

  const handleSaveAll = () => {
    Keyboard.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Save newly entered account if filled
    if (isAddingNew && newAccName.trim()) {
      handleAddNewAccount();
    }

    accounts.forEach((acc) => {
      const inputVal = balanceInputs[acc.id];
      const assignedType = accountTypes[acc.id] || acc.type || 'savings';
      const isCredit = assignedType === 'credit';

      const updates: Partial<ExpenseAccount> = {
        type: assignedType,
        statusType: isCredit ? 'due' : 'positive',
      };

      if (inputVal !== undefined && inputVal.trim().length > 0) {
        const numVal = parseFloat(inputVal.trim().replace(/,/g, ''));
        if (!isNaN(numVal) && numVal >= 0) {
          if (isCredit) {
            updates.dueAmount = numVal;
          } else {
            updates.balance = numVal;
            updates.openingBalance = numVal;
          }
        }
      }

      updateAccount(acc.id, updates);
    });

    setStatementSetup({ openingBalancesConfigured: true });
    onSaveSuccess?.();
    onClose();
  };

  const renderIcon = (type: 'savings' | 'credit' | 'wallet') => {
    if (type === 'credit') {
      return <CreditCard size={18} color="#FF9D66" />;
    }
    if (type === 'wallet') {
      return <Wallet size={18} color="#60A5FA" />;
    }
    return <Banknote size={18} color={expenseColors.accentGreen} />;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        Keyboard.dismiss();
        onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        {/* iOS Drag Handle */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Header Bar */}
        <View style={styles.header}>
          <View>
            <AppText style={styles.headerTitle}>SET STARTING BALANCES</AppText>
            <AppText style={styles.headerSubtitle}>
              Configure your account types & current balances
            </AppText>
          </View>
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              Haptics.selectionAsync().catch(() => {});
              onClose();
            }}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <X size={20} color={expenseColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Guidance Notice */}
          <View style={styles.infoCard}>
            <Building2 size={16} color={expenseColors.accentPeach} />
            <AppText style={styles.infoText}>
              Statements reflect monthly activity. Select each account's type and enter your starting balance to match your real financial totals.
            </AppText>
          </View>

          {/* Accounts List */}
          <View style={styles.accountsStack}>
            {accounts.map((acc) => {
              const currentType = accountTypes[acc.id] || (acc.type as 'savings' | 'credit' | 'wallet') || 'savings';
              const isCredit = currentType === 'credit';
              const inputVal = balanceInputs[acc.id] ?? '';

              return (
                <View key={acc.id} style={styles.accountCard}>
                  <View style={styles.accountCardTop}>
                    <AccountIcon type={currentType} size={16} containerSize={34} borderRadius={10} />
                    <View style={styles.accountTextCol}>
                      <AppText style={styles.accountName} numberOfLines={1}>
                        {acc.name.toUpperCase()}
                      </AppText>
                      <AppText style={styles.accountTypeLabel}>
                        {isCredit
                          ? `Credit Card • Monthly Due: ${sym}${(acc.dueAmount || 0).toLocaleString('en-IN')}`
                          : currentType === 'wallet'
                          ? `Digital Wallet • ${acc.txnCountThisMonth} txns`
                          : `Bank Account • ${acc.txnCountThisMonth} txns`}
                      </AppText>
                    </View>
                  </View>

                  {/* 1-Tap Account Type Selector */}
                  <View style={styles.typeSelectorRow}>
                    <TouchableOpacity
                      style={[styles.typeOptionPill, currentType === 'savings' && styles.typeOptionActive]}
                      onPress={() => handleToggleType(acc.id, 'savings')}
                    >
                      <AppText style={[styles.typeOptionText, currentType === 'savings' && styles.typeOptionTextActive]}>
                        BANK / SAVINGS
                      </AppText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.typeOptionPill, currentType === 'credit' && styles.typeOptionActive]}
                      onPress={() => handleToggleType(acc.id, 'credit')}
                    >
                      <AppText style={[styles.typeOptionText, currentType === 'credit' && styles.typeOptionTextActive]}>
                        CREDIT CARD
                      </AppText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.typeOptionPill, currentType === 'wallet' && styles.typeOptionActive]}
                      onPress={() => handleToggleType(acc.id, 'wallet')}
                    >
                      <AppText style={[styles.typeOptionText, currentType === 'wallet' && styles.typeOptionTextActive]}>
                        WALLET
                      </AppText>
                    </TouchableOpacity>
                  </View>

                  {!isCredit && (
                    <View style={styles.inputRow}>
                      <AppText style={styles.currencyPrefix}>{sym}</AppText>
                      <TextInput
                        style={styles.balanceInput}
                        placeholder="0.00 (Optional starting balance)"
                        placeholderTextColor={expenseColors.textMuted}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        value={inputVal}
                        onChangeText={(txt) => handleInputChange(acc.id, txt)}
                      />
                    </View>
                  )}
                </View>
              );
            })}

            {/* Add Missing Account Section */}
            {isAddingNew ? (
              <View style={styles.newAccountCard}>
                <AppText style={styles.newAccountTitle}>ADD UNLISTED ACCOUNT</AppText>

                <TextInput
                  style={styles.newAccountNameInput}
                  placeholder="Account Name (e.g. HDFC, Cash, ICICI)"
                  placeholderTextColor={expenseColors.textMuted}
                  value={newAccName}
                  onChangeText={setNewAccName}
                  returnKeyType="next"
                  autoFocus={true}
                />

                <View style={styles.typeSelectorRow}>
                  <TouchableOpacity
                    style={[styles.typeOptionPill, newAccType === 'savings' && styles.typeOptionActive]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setNewAccType('savings');
                    }}
                  >
                    <AppText style={[styles.typeOptionText, newAccType === 'savings' && styles.typeOptionTextActive]}>
                      BANK
                    </AppText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.typeOptionPill, newAccType === 'credit' && styles.typeOptionActive]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setNewAccType('credit');
                    }}
                  >
                    <AppText style={[styles.typeOptionText, newAccType === 'credit' && styles.typeOptionTextActive]}>
                      CREDIT
                    </AppText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.typeOptionPill, newAccType === 'wallet' && styles.typeOptionActive]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setNewAccType('wallet');
                    }}
                  >
                    <AppText style={[styles.typeOptionText, newAccType === 'wallet' && styles.typeOptionTextActive]}>
                      WALLET
                    </AppText>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputRow}>
                  <AppText style={styles.currencyPrefix}>{sym}</AppText>
                  <TextInput
                    style={styles.balanceInput}
                    placeholder="Starting Balance (e.g. 2771)"
                    placeholderTextColor={expenseColors.textMuted}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    value={newAccBalance}
                    onChangeText={setNewAccBalance}
                  />
                </View>

                <View style={styles.newAccountActionsRow}>
                  <TouchableOpacity
                    style={styles.confirmAddBtn}
                    onPress={handleAddNewAccount}
                  >
                    <AppText style={styles.confirmAddBtnText}>Add Account</AppText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelAddBtn}
                    onPress={() => {
                      Keyboard.dismiss();
                      setIsAddingNew(false);
                    }}
                  >
                    <AppText style={styles.cancelAddBtnText}>Cancel</AppText>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addAccountTriggerBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIsAddingNew(true);
                }}
                activeOpacity={0.8}
              >
                <Plus size={16} color={expenseColors.accentPeach} />
                <AppText style={styles.addAccountTriggerText}>Add Missing Account (e.g. HDFC)</AppText>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* Floating Bottom Save Action */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveAll}
            activeOpacity={0.85}
          >
            <CheckCircle2 size={18} color="#0F1015" />
            <AppText style={styles.saveBtnText}>Save Balances & Continue →</AppText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: expenseColors.bgPrimary,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3F50',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitle: {
    color: expenseColors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#232633',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 130,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255, 157, 102, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.2)',
    marginBottom: 16,
  },
  infoText: {
    color: '#FFD3B6',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  accountsStack: {
    gap: 12,
  },
  accountCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
  },
  accountCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#232633',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTextCol: {
    flex: 1,
  },
  accountName: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  accountTypeLabel: {
    color: expenseColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  typeOptionPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161820',
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  typeOptionActive: {
    backgroundColor: expenseColors.accentPeach,
    borderColor: expenseColors.accentPeach,
  },
  typeOptionText: {
    color: expenseColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  typeOptionTextActive: {
    color: '#0F1015',
    fontWeight: '800',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161820',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    height: 44,
  },
  currencyPrefix: {
    color: expenseColors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginRight: 6,
  },
  balanceInput: {
    flex: 1,
    color: expenseColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },
  addAccountTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 157, 102, 0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 157, 102, 0.3)',
    marginTop: 4,
  },
  addAccountTriggerText: {
    color: expenseColors.accentPeach,
    fontSize: 12,
    fontWeight: '700',
  },
  newAccountCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: expenseColors.accentPeach,
    gap: 10,
  },
  newAccountTitle: {
    color: expenseColors.accentPeach,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  newAccountNameInput: {
    backgroundColor: '#161820',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    color: expenseColors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  newAccountActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  confirmAddBtn: {
    flex: 1,
    backgroundColor: expenseColors.accentPeach,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmAddBtnText: {
    color: '#0F1015',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelAddBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cancelAddBtnText: {
    color: expenseColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 16, 21, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#232633',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9D66',
    borderRadius: 16,
    paddingVertical: 14,
  },
  saveBtnText: {
    color: '#0F1015',
    fontSize: 14,
    fontWeight: '800',
  },
});
