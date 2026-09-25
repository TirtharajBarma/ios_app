import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  X,
  Plus,
  ChevronRight,
  Banknote,
  CreditCard,
  Wallet,
  PiggyBank,
  Target,
  Sparkles,
  ArrowUpRight,
  Check,
  TrendingUp,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MenuAction } from '@expo/ui/community/menu';
import { AppText, NativeLiquidMenu } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseAccount, SavingsVault } from '@/types/expense';
import { EditAccountModal } from './EditAccountModal';
import { AccountIcon } from './AccountIcon';

const EMOJI_OPTIONS = ['🛡️', '🌴', '💻', '🚗', '🏠', '💍', '📚', '📈', '🎁', '⚡'];
const COLOR_OPTIONS = ['#8CD9C8', '#9DC6EB', '#F2AEC4', '#F4CD89', '#C4A7E7', '#F8A888'];

interface AccountsListModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AccountsListModal: React.FC<AccountsListModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    accounts,
    transactions,
    savingsVaults,
    currencySymbol,
    deleteAccount,
    archiveAccount,
    unarchiveAccount,
    addSavingsVault,
    deleteSavingsVault,
    depositToVault,
    withdrawFromVault,
    getTotalBalance,
    getTotalSavedInVaults,
  } = useExpenseStore();

  const sym = currencySymbol || '₹';
  const totalBalance = getTotalBalance();
  const totalSavedInVaults = getTotalSavedInVaults();

  const [activeTab, setActiveTab] = useState<'accounts' | 'goals'>('accounts');
  const [selectedAccountForEdit, setSelectedAccountForEdit] = useState<ExpenseAccount | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);

  // Savings Goal Creation Modal
  const [showNewGoalModal, setShowNewGoalModal] = useState<boolean>(false);
  const [goalName, setGoalName] = useState<string>('');
  const [goalTarget, setGoalTarget] = useState<string>('');
  const [goalEmoji, setGoalEmoji] = useState<string>('🛡️');
  const [goalColor, setGoalColor] = useState<string>('#8CD9C8');

  // Quick Action Sheet (Deposit / Withdraw from Goal)
  const [selectedVault, setSelectedVault] = useState<SavingsVault | null>(null);
  const [actionType, setActionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [actionAmount, setActionAmount] = useState<string>('');
  const [sourceAccountId, setSourceAccountId] = useState<string>(accounts[0]?.id || '');
  const [showActionModal, setShowActionModal] = useState<boolean>(false);

  // Active (non-archived) accounts
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const archivedAccounts = accounts.filter((a) => a.isArchived);

  const getAccountTxCount = (accountId: string) => {
    return transactions.filter((t) => t.accountId === accountId).length;
  };

  const getAccountIcon = (account: ExpenseAccount) => {
    const name = account.name.toLowerCase();
    const type = account.type || 'savings';
    if (type === 'credit' || name.includes('axis') || name.includes('icici') || name.includes('card')) {
      return <CreditCard size={18} color="#A0A5B5" />;
    }
    if (type === 'wallet' || name.includes('wallet') || name.includes('pay')) {
      return <Wallet size={18} color="#A0A5B5" />;
    }
    return <Banknote size={18} color="#A0A5B5" />;
  };

  const handleOpenEdit = (account: ExpenseAccount) => {
    setSelectedAccountForEdit(account);
    setShowEditModal(true);
  };

  const handleOpenAdd = () => {
    if (activeTab === 'accounts') {
      setSelectedAccountForEdit(null);
      setShowEditModal(true);
    } else {
      setShowNewGoalModal(true);
    }
  };

  const openDeposit = (vault: SavingsVault) => {
    setSelectedVault(vault);
    setActionType('deposit');
    setActionAmount('');
    setSourceAccountId(accounts[0]?.id || '');
    setShowActionModal(true);
    Haptics.selectionAsync().catch(() => {});
  };

  const openWithdraw = (vault: SavingsVault) => {
    setSelectedVault(vault);
    setActionType('withdraw');
    setActionAmount('');
    setSourceAccountId(accounts[0]?.id || '');
    setShowActionModal(true);
    Haptics.selectionAsync().catch(() => {});
  };

  const handleConfirmAction = () => {
    const amt = parseFloat(actionAmount);
    if (isNaN(amt) || amt <= 0 || !selectedVault) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    if (actionType === 'deposit') {
      depositToVault(selectedVault.id, amt, sourceAccountId || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      if (amt > selectedVault.currentAmount) {
        Alert.alert('Insufficient Balance', `You only have ${sym}${selectedVault.currentAmount.toLocaleString('en-IN')} in this goal.`);
        return;
      }
      withdrawFromVault(selectedVault.id, amt, sourceAccountId || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    setShowActionModal(false);
    setActionAmount('');
  };

  const handleCreateGoal = () => {
    const target = parseFloat(goalTarget);
    if (!goalName.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Invalid Goal', 'Please enter a goal name and target amount.');
      return;
    }

    addSavingsVault({
      name: goalName.trim(),
      emoji: goalEmoji,
      targetAmount: target,
      color: goalColor,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setShowNewGoalModal(false);
    setGoalName('');
    setGoalTarget('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <X size={22} color="#A0A5B5" />
          </TouchableOpacity>

          {/* Segmented Control */}
          <View style={styles.tabSegment}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'accounts' && styles.tabBtnActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab('accounts');
              }}
            >
              <AppText style={[styles.tabBtnText, activeTab === 'accounts' && styles.tabBtnTextActive]}>
                ACCOUNTS
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'goals' && styles.tabBtnActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab('goals');
              }}
            >
              <AppText style={[styles.tabBtnText, activeTab === 'goals' && styles.tabBtnTextActive]}>
                GOALS & VAULTS
              </AppText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleOpenAdd} style={styles.addBtn}>
            <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'accounts' ? (
            <>
              {/* Summary Stats Pill */}
              <View style={styles.summaryBar}>
                <AppText style={styles.summaryBarLabel}>TOTAL LIQUID BALANCE</AppText>
                <AppText style={styles.summaryBarVal}>{sym}{totalBalance.toLocaleString('en-IN')}</AppText>
              </View>

              <AppText style={styles.sectionTitle}>ACTIVE ACCOUNTS</AppText>

              {/* Accounts List */}
              <View style={styles.listStack}>
                {activeAccounts.map((account) => {
                  const txCount = getAccountTxCount(account.id) || account.txnCountThisMonth || 0;
                  const isDue = account.statusType === 'due' && (account.dueAmount ?? 0) > 0;

                  return (
                    <TouchableOpacity
                      key={account.id}
                      style={styles.accountRow}
                      onPress={() => handleOpenEdit(account)}
                      activeOpacity={0.7}
                    >
                      {/* Left Icon */}
                      <AccountIcon type={account.type || 'savings'} size={18} containerSize={40} borderRadius={12} />

                      {/* Middle Info */}
                      <View style={styles.infoCol}>
                        <AppText style={styles.accountName}>
                          {account.name}
                        </AppText>
                        {account.type === 'credit' ? (
                          <AppText style={styles.dueText}>
                            Due: {sym}{(account.dueAmount || 0).toLocaleString('en-IN')}
                          </AppText>
                        ) : (
                          <AppText style={styles.balanceText}>
                            {sym}{account.balance.toLocaleString('en-IN')}
                          </AppText>
                        )}
                      </View>

                      {/* Right: Badge + Chevron */}
                      <View style={styles.rightGroup}>
                        <View style={styles.txBadge}>
                          <AppText style={styles.txBadgeText}>
                            {txCount} txns
                          </AppText>
                        </View>
                        <ChevronRight size={18} color="#555866" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {archivedAccounts.length > 0 && (
                <>
                  <AppText style={[styles.sectionTitle, { marginTop: 18 }]}>ARCHIVED ACCOUNTS</AppText>
                  <View style={styles.listStack}>
                    {archivedAccounts.map((account) => {
                      const txCount = getAccountTxCount(account.id) || account.txnCountThisMonth || 0;
                      return (
                        <TouchableOpacity
                          key={account.id}
                          style={[styles.accountRow, { opacity: 0.85 }]}
                          activeOpacity={0.75}
                          onPress={() => handleOpenEdit(account)}
                        >
                          <AccountIcon type={account.type || 'savings'} size={18} containerSize={40} borderRadius={12} />
                          <View style={styles.infoCol}>
                            <AppText style={styles.accountName}>
                              {account.name}
                            </AppText>
                            <AppText style={styles.balanceText}>
                              Archived • {sym}{account.balance.toLocaleString('en-IN')}
                            </AppText>
                          </View>
                          <TouchableOpacity
                            style={styles.unarchiveBtn}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={(e) => {
                              e.stopPropagation();
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                              unarchiveAccount(account.id);
                            }}
                          >
                            <AppText style={styles.unarchiveBtnText}>Restore</AppText>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          ) : (
            <>
              {/* Summary Stats Pill for Goals */}
              <View style={styles.summaryBar}>
                <AppText style={styles.summaryBarLabel}>TOTAL RESERVED IN GOALS</AppText>
                <AppText style={[styles.summaryBarVal, { color: expenseColors.accentGreen }]}>
                  {sym}{totalSavedInVaults.toLocaleString('en-IN')}
                </AppText>
              </View>

              <AppText style={styles.sectionTitle}>SAVINGS VAULTS & POCKETS</AppText>

              {savingsVaults.length === 0 ? (
                <View style={styles.emptyGoalsBox}>
                  <PiggyBank size={36} color="#FF9D66" />
                  <AppText style={styles.emptyGoalsTitle}>No Savings Goals Yet</AppText>
                  <AppText style={styles.emptyGoalsSub}>
                    Create goals like Emergency Fund, Travel, or Gadgets to ringfence your savings from your daily spend!
                  </AppText>
                  <TouchableOpacity
                    style={styles.emptyCreateBtn}
                    onPress={() => setShowNewGoalModal(true)}
                    activeOpacity={0.8}
                  >
                    <Plus size={16} color="#0D0E12" strokeWidth={2.5} />
                    <AppText style={styles.emptyCreateBtnText}>Create First Goal</AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.goalsListStack}>
                  {savingsVaults.map((vault) => {
                    const progressPct = vault.targetAmount > 0
                      ? Math.min(Math.round((vault.currentAmount / vault.targetAmount) * 100), 100)
                      : 0;

                    const vaultActions: MenuAction[] = [
                      {
                        id: 'deposit',
                        title: 'Save Money',
                        image: 'plus.circle.fill' as any,
                      },
                      {
                        id: 'withdraw',
                        title: 'Withdraw Funds',
                        image: 'arrow.up.right.circle.fill' as any,
                      },
                      {
                        id: 'delete',
                        title: 'Delete Goal',
                        image: 'trash.fill' as any,
                        attributes: { destructive: true },
                      },
                    ];

                    return (
                      <NativeLiquidMenu
                        key={vault.id}
                        title={vault.name}
                        actions={vaultActions}
                        shouldOpenOnLongPress={true}
                        onSelect={(actionId) => {
                          if (actionId === 'deposit') {
                            openDeposit(vault);
                          } else if (actionId === 'withdraw') {
                            openWithdraw(vault);
                          } else if (actionId === 'delete') {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                            deleteSavingsVault(vault.id);
                          }
                        }}
                        style={{ width: '100%' }}
                      >
                        <View style={styles.goalCard}>
                          <View style={styles.goalTopRow}>
                            <View style={styles.goalEmojiBox}>
                              <AppText style={styles.goalEmojiText}>{vault.emoji}</AppText>
                            </View>
                            <View style={styles.goalInfoCol}>
                              <AppText style={styles.goalName}>{vault.name}</AppText>
                              <AppText style={styles.goalTargetText}>
                                Target: {sym}{vault.targetAmount.toLocaleString('en-IN')}
                              </AppText>
                            </View>
                            <View style={[styles.goalPctPill, { backgroundColor: `${vault.color}20` }]}>
                              <AppText style={[styles.goalPctText, { color: vault.color }]}>
                                {progressPct}%
                              </AppText>
                            </View>
                          </View>

                          {/* Progress Track */}
                          <View style={styles.progressBarTrack}>
                            <View
                              style={[
                                styles.progressBarFill,
                                {
                                  width: `${progressPct}%`,
                                  backgroundColor: vault.color,
                                },
                              ]}
                            />
                          </View>

                          {/* Bottom Values & Buttons */}
                          <View style={styles.goalBottomRow}>
                            <View>
                              <AppText style={styles.savedLabel}>SAVED</AppText>
                              <AppText style={styles.savedValue}>
                                {sym}{vault.currentAmount.toLocaleString('en-IN')}
                              </AppText>
                            </View>

                            <View style={styles.goalActionBtns}>
                              {vault.currentAmount > 0 && (
                                <TouchableOpacity
                                  style={styles.goalWithdrawBtn}
                                  onPress={() => openWithdraw(vault)}
                                >
                                  <ArrowUpRight size={13} color="#A0A5B5" />
                                  <AppText style={styles.goalWithdrawBtnText}>Withdraw</AppText>
                                </TouchableOpacity>
                              )}

                              <TouchableOpacity
                                style={[styles.goalDepositBtn, { backgroundColor: vault.color }]}
                                onPress={() => openDeposit(vault)}
                              >
                                <Plus size={13} color="#0D0E12" strokeWidth={3} />
                                <AppText style={styles.goalDepositBtnText}>Save</AppText>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </NativeLiquidMenu>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Edit / Add Account Modal */}
        <EditAccountModal
          visible={showEditModal}
          account={selectedAccountForEdit}
          onClose={() => setShowEditModal(false)}
        />

        {/* Quick Deposit / Withdraw Sheet */}
        <Modal
          visible={showActionModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowActionModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBackdrop}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowActionModal(false)}
            />

            <View style={styles.sheetContent}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeaderRow}>
                <View style={styles.sheetHeaderLeft}>
                  <AppText style={styles.sheetEmoji}>{selectedVault?.emoji}</AppText>
                  <View>
                    <AppText style={styles.sheetTitle}>
                      {actionType === 'deposit' ? 'Save to' : 'Withdraw from'} {selectedVault?.name}
                    </AppText>
                    <AppText style={styles.sheetSub}>
                      Saved: {sym}{selectedVault?.currentAmount.toLocaleString('en-IN')} / {sym}{selectedVault?.targetAmount.toLocaleString('en-IN')}
                    </AppText>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setShowActionModal(false)}
                >
                  <X size={16} color="#A0A5B5" />
                </TouchableOpacity>
              </View>

              <View style={styles.amountInputContainer}>
                <AppText style={styles.amountCurrencySymbol}>{sym}</AppText>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor="#555866"
                  keyboardType="numeric"
                  value={actionAmount}
                  onChangeText={setActionAmount}
                  autoFocus
                />
              </View>

              <View style={styles.presetChipsRow}>
                {[500, 1000, 2000, 5000].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.presetChip}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setActionAmount(amt.toString());
                    }}
                  >
                    <AppText style={styles.presetChipText}>+{sym}{amt.toLocaleString('en-IN')}</AppText>
                  </TouchableOpacity>
                ))}
              </View>

              {accounts.length > 0 && (
                <View style={styles.accountSelectSection}>
                  <AppText style={styles.accountSelectLabel}>
                    {actionType === 'deposit' ? 'DEDUCT FROM ACCOUNT' : 'TRANSFER INTO ACCOUNT'}
                  </AppText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {accounts.map((acc) => {
                      const isSelected = sourceAccountId === acc.id;
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          style={[styles.accountPill, isSelected && styles.accountPillActive]}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setSourceAccountId(acc.id);
                          }}
                        >
                          <AppText style={[styles.accountPillText, isSelected && styles.accountPillTextActive]}>
                            {acc.name} ({sym}{acc.balance.toLocaleString('en-IN')})
                          </AppText>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.confirmActionBtn,
                  { backgroundColor: selectedVault?.color || expenseColors.accentPeach },
                ]}
                onPress={handleConfirmAction}
                activeOpacity={0.85}
              >
                <PiggyBank size={18} color="#0D0E12" strokeWidth={2.5} />
                <AppText style={styles.confirmActionBtnText}>
                  {actionType === 'deposit' ? `Confirm & Save in ${selectedVault?.name}` : 'Confirm Withdrawal'}
                </AppText>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Create New Goal Modal */}
        <Modal
          visible={showNewGoalModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNewGoalModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalBackdrop}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowNewGoalModal(false)}
            />

            <View style={styles.sheetContent}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeaderRow}>
                <View>
                  <AppText style={styles.sheetTitle}>Create Savings Goal</AppText>
                  <AppText style={styles.sheetSub}>Isolate funds for emergency, travel or dreams</AppText>
                </View>

                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setShowNewGoalModal(false)}
                >
                  <X size={16} color="#A0A5B5" />
                </TouchableOpacity>
              </View>

              <View style={styles.formRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {EMOJI_OPTIONS.map((e) => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.emojiPickItem, goalEmoji === e && styles.emojiPickItemActive]}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setGoalEmoji(e);
                      }}
                    >
                      <AppText style={styles.emojiPickText}>{e}</AppText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <AppText style={styles.fieldLabel}>GOAL NAME</AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Emergency Fund, Goa Trip, MacBook"
                  placeholderTextColor="#555866"
                  value={goalName}
                  onChangeText={setGoalName}
                />
              </View>

              <View style={styles.inputGroup}>
                <AppText style={styles.fieldLabel}>TARGET AMOUNT ({sym})</AppText>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 50000"
                  placeholderTextColor="#555866"
                  keyboardType="numeric"
                  value={goalTarget}
                  onChangeText={setGoalTarget}
                />
              </View>

              <View style={styles.inputGroup}>
                <AppText style={styles.fieldLabel}>THEME COLOR</AppText>
                <View style={styles.colorsRow}>
                  {COLOR_OPTIONS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c },
                        goalColor === c && styles.colorDotActive,
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setGoalColor(c);
                      }}
                    >
                      {goalColor === c && <Check size={12} color="#0D0E12" strokeWidth={3} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.createGoalBtn}
                onPress={handleCreateGoal}
                activeOpacity={0.85}
              >
                <Sparkles size={16} color="#0D0E12" />
                <AppText style={styles.createGoalBtnText}>Create Savings Goal</AppText>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101114',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSegment: {
    flexDirection: 'row',
    backgroundColor: '#1E202B',
    borderRadius: 14,
    padding: 3,
    gap: 4,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 11,
  },
  tabBtnActive: {
    backgroundColor: '#FF9D66',
  },
  tabBtnText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabBtnTextActive: {
    color: '#0D0E12',
    fontWeight: '800',
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#232633',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1D23',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  summaryBarLabel: {
    color: '#707587',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  summaryBarVal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionTitle: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  listStack: {
    gap: 12,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D23',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 14,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#232633',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  accountName: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  balanceText: {
    color: '#8E95A5',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  dueText: {
    color: expenseColors.accentRed,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  txBadge: {
    backgroundColor: '#232633',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  txBadgeText: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '600',
  },
  unarchiveBtn: {
    backgroundColor: '#272224',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.35)',
  },
  unarchiveBtnText: {
    color: '#FF9D66',
    fontSize: 12,
    fontWeight: '700',
  },

  // Goals List Styles
  goalsListStack: {
    gap: 14,
  },
  goalCard: {
    backgroundColor: '#1A1D23',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  goalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  goalEmojiBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#202330',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalEmojiText: {
    fontSize: 20,
  },
  goalInfoCol: {
    flex: 1,
  },
  goalName: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  goalTargetText: {
    color: '#707587',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  goalPctPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  goalPctText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedLabel: {
    color: '#656A7B',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  savedValue: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  goalActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalWithdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#202330',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  goalWithdrawBtnText: {
    color: '#A0A5B5',
    fontSize: 11,
    fontWeight: '700',
  },
  goalDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  goalDepositBtnText: {
    color: '#0D0E12',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyGoalsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1D23',
    borderRadius: 20,
    padding: 28,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyGoalsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyGoalsSub: {
    color: '#707587',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 18,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF9D66',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyCreateBtnText: {
    color: '#0D0E12',
    fontSize: 13,
    fontWeight: '800',
  },

  // Modal Sheet Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#1A1D23',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sheetEmoji: {
    fontSize: 28,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  sheetSub: {
    color: '#707587',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#202330',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101114',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  amountCurrencySymbol: {
    color: '#FF9D66',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    marginRight: 6,
  },
  amountInput: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    minWidth: 100,
  },
  presetChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#202330',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  presetChipText: {
    color: '#E0E3EB',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  accountSelectSection: {
    marginBottom: 20,
  },
  accountSelectLabel: {
    color: '#656A7B',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.0,
    marginBottom: 8,
  },
  accountPill: {
    backgroundColor: '#202330',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  accountPillActive: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    borderColor: '#FF9D66',
  },
  accountPillText: {
    color: '#A0A5B5',
    fontSize: 11,
    fontWeight: '600',
  },
  accountPillTextActive: {
    color: '#FF9D66',
    fontWeight: '700',
  },
  confirmActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },
  confirmActionBtnText: {
    color: '#0D0E12',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  formRow: {
    marginBottom: 16,
  },
  emojiPickItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#202330',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiPickItemActive: {
    borderColor: expenseColors.accentGreen,
    backgroundColor: expenseColors.accentGreenBg,
  },
  emojiPickText: {
    fontSize: 20,
  },
  inputGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#7E8394',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  formInput: {
    backgroundColor: '#1E202B',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  colorsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  createGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9D66',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  createGoalBtnText: {
    color: '#0D0E12',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
});
