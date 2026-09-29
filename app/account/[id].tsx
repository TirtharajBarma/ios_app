import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Edit3,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Users,
  HandCoins,
  ShieldCheck,
  CheckCircle2,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText, NativeLiquidMenu } from '@/components/ui';
import type { MenuAction } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useShallow } from 'zustand/react/shallow';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseAccount, ExpenseTransaction, ExpenseCategory } from '@/types/expense';
import { getCreditCardDueStatus } from '@/utils/creditCard';
import { AccountIcon } from '@/components/expense/AccountIcon';
import { CategoryIcon } from '@/components/expense/CategoryIcon';
import { EditAccountModal } from '@/components/expense/EditAccountModal';
import { AddTransactionModal } from '@/components/expense/AddTransactionModal';
import { SplitDetailsModal } from '@/components/expense/SplitDetailsModal';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

type FilterType = 'all' | 'expense' | 'income' | 'transfer' | 'debt';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    accounts,
    transactions,
    categories,
    currencySymbol,
    formatAmount,
    removeTransactions,
    settleTransaction,
  } = useExpenseStore(
    useShallow((s) => ({
      accounts: s.accounts,
      transactions: s.transactions,
      categories: s.categories,
      currencySymbol: s.currencySymbol,
      formatAmount: s.formatAmount,
      removeTransactions: s.removeTransactions,
      settleTransaction: s.settleTransaction,
    }))
  );

  const sym = currencySymbol || '₹';

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingTx, setEditingTx] = useState<ExpenseTransaction | null>(null);
  const [splitModalTx, setSplitModalTx] = useState<ExpenseTransaction | null>(null);

  // Locate the target account
  const account = useMemo(() => {
    return accounts.find(
      (a) => a.id === id || a.name.toLowerCase() === (id || '').toLowerCase()
    ) || null;
  }, [accounts, id]);

  const accNameLower = (account?.name || '').trim().toLowerCase();
  const isCredit = account?.type === 'credit';
  const hasDue = isCredit && (account?.dueAmount || 0) > 0;

  // Real-time credit card due status
  const dueStatus = useMemo(() => {
    if (!account || !isCredit) return null;
    return getCreditCardDueStatus(account.dueDay, account.billingDay, account.dueAmount || 0);
  }, [account, isCredit]);

  // All transactions linked to this account
  const accountTransactions = useMemo(() => {
    if (!account) return [];
    return transactions.filter((t) => {
      const txAccNameLower = (t.accountName || '').trim().toLowerCase();
      const txToAccNameLower = (t.toAccountName || '').trim().toLowerCase();
      return (
        t.accountId === account.id ||
        t.toAccountId === account.id ||
        (accNameLower && (txAccNameLower === accNameLower || txToAccNameLower === accNameLower)) ||
        t.accountId === account.name
      );
    });
  }, [account, transactions, accNameLower]);

  // Account Analytics
  const stats = useMemo(() => {
    let inflowSum = 0;
    let outflowSum = 0;
    let expenseCount = 0;
    let incomeCount = 0;
    let transferCount = 0;
    let debtCount = 0;

    for (const t of accountTransactions) {
      const isFrom =
        t.accountId === account?.id ||
        (t.accountName && accNameLower && t.accountName.trim().toLowerCase() === accNameLower);
      const isTo =
        t.toAccountId === account?.id ||
        (t.toAccountName && accNameLower && t.toAccountName.trim().toLowerCase() === accNameLower);

      if (t.type === 'expense' && isFrom) {
        outflowSum += t.amount;
        expenseCount++;
      } else if (t.type === 'income' && isFrom) {
        inflowSum += t.amount;
        incomeCount++;
      } else if (t.type === 'transfer') {
        transferCount++;
        if (isFrom) outflowSum += t.amount;
        if (isTo) inflowSum += t.amount;
      } else if (t.type === 'debt_lend' && isFrom) {
        outflowSum += t.amount;
        debtCount++;
      } else if (t.type === 'debt_borrow' && isFrom) {
        inflowSum += t.amount;
        debtCount++;
      } else if (t.type === 'vault_deposit' && isFrom) {
        outflowSum += t.amount;
      } else if (t.type === 'vault_withdraw' && isFrom) {
        inflowSum += t.amount;
      }
    }

    return {
      inflowSum,
      outflowSum,
      totalCount: accountTransactions.length,
      expenseCount,
      incomeCount,
      transferCount,
      debtCount,
    };
  }, [accountTransactions, account, accNameLower]);

  // Filtered transactions for list view
  const filteredTxs = useMemo(() => {
    if (activeFilter === 'all') return accountTransactions;
    if (activeFilter === 'expense') return accountTransactions.filter((t) => t.type === 'expense');
    if (activeFilter === 'income') return accountTransactions.filter((t) => t.type === 'income');
    if (activeFilter === 'transfer') return accountTransactions.filter((t) => t.type === 'transfer');
    if (activeFilter === 'debt') {
      return accountTransactions.filter((t) => t.type === 'debt_lend' || t.type === 'debt_borrow');
    }
    return accountTransactions;
  }, [accountTransactions, activeFilter]);

  // Group transactions by date
  const groupedTxs = useMemo(() => {
    const groups: Record<string, ExpenseTransaction[]> = {};
    filteredTxs.forEach((tx) => {
      const d = tx.date || new Date().toISOString().split('T')[0];
      if (!groups[d]) groups[d] = [];
      groups[d].push(tx);
    });
    return Object.entries(groups).sort(
      ([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime()
    );
  }, [filteredTxs]);

  const formatDateHeader = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr);
      if (isToday(parsed)) return 'TODAY';
      if (isYesterday(parsed)) return 'YESTERDAY';
      return format(parsed, 'EEE, d MMM yyyy').toUpperCase();
    } catch {
      return dateStr;
    }
  };

  const getCategory = (catId: string): ExpenseCategory => {
    const found = categories.find((c) => c.id === catId);
    if (found) return found;
    return { id: catId, name: 'General', color: '#8E919D', iconName: 'MoreHorizontal' };
  };

  const getTransactionActions = (tx: ExpenseTransaction): MenuAction[] => {
    const actions: MenuAction[] = [
      {
        id: 'view_details',
        title: 'View Details',
        image: 'info.circle' as any,
      },
      {
        id: 'edit',
        title: 'Edit Transaction',
        image: 'pencil' as any,
      },
    ];

    if (tx.split && !tx.split.settled) {
      actions.push({
        id: 'split_details',
        title: 'Split Details & Settlement',
        image: 'person.2.fill' as any,
      });
    }

    if ((tx.type === 'debt_lend' || tx.type === 'debt_borrow') && !tx.isSettled) {
      actions.push({
        id: 'settle_debt',
        title: 'Mark as Settled',
        image: 'checkmark.circle.fill' as any,
      });
    }

    actions.push({
      id: 'delete',
      title: 'Delete Transaction',
      image: 'trash.fill' as any,
      attributes: { destructive: true },
    });

    return actions;
  };

  const handleActionSelect = (actionId: string, tx: ExpenseTransaction) => {
    Haptics.selectionAsync().catch(() => {});
    if (actionId === 'view_details') {
      router.push(`/transaction/${tx.id}`);
    } else if (actionId === 'edit') {
      setEditingTx(tx);
    } else if (actionId === 'split_details') {
      setSplitModalTx(tx);
    } else if (actionId === 'settle_debt') {
      settleTransaction(tx.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (actionId === 'delete') {
      removeTransactions([tx.id]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const getAccountTypeLabel = (type?: string) => {
    if (type === 'credit') return 'Credit Card';
    if (type === 'wallet') return 'Wallet Account';
    if (type === 'cash') return 'Cash Account';
    return 'Savings Account';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#101114" />

      {/* Navigation Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
        >
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <AppText style={styles.headerTitle} numberOfLines={1}>
          {account?.name?.toUpperCase() || 'ACCOUNT'}
        </AppText>

        <TouchableOpacity
          style={styles.editHeaderBtn}
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setShowEditModal(true);
          }}
        >
          <Edit3 size={18} color={expenseColors.accentPeach} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrapper}>
              <AccountIcon name={account?.name} type={account?.type || 'savings'} size={24} containerSize={50} borderRadius={16} />
            </View>
            <View style={styles.heroInfoCol}>
              <AppText style={styles.heroAccountName}>{account?.name || 'Account'}</AppText>
              <AppText style={styles.heroAccountType}>{getAccountTypeLabel(account?.type)}</AppText>
            </View>
            {dueStatus?.hasDueInfo && (
              <View
                style={[
                  styles.dueBadge,
                  dueStatus.status === 'paid'
                    ? styles.dueBadgePaid
                    : dueStatus.isUrgent
                    ? styles.dueBadgeUrgent
                    : styles.dueBadgeUpcoming,
                ]}
              >
                <AppText
                  style={[
                    styles.dueBadgeText,
                    dueStatus.status === 'paid'
                      ? styles.dueBadgePaidText
                      : dueStatus.isUrgent
                      ? styles.dueBadgeUrgentText
                      : styles.dueBadgeUpcomingText,
                  ]}
                >
                  {dueStatus.badgeLabel}
                </AppText>
              </View>
            )}
          </View>

          {/* Large Main Balance Display */}
          <View style={styles.heroBalanceBlock}>
            <AppText style={styles.heroBalanceLabel}>
              {isCredit ? 'OUTSTANDING DUE' : 'CURRENT BALANCE'}
            </AppText>
            <AppText
              style={[
                styles.heroBalanceValue,
                isCredit && hasDue && { color: '#FF6B6B' },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.75}
            >
              {formatAmount(isCredit ? account?.dueAmount || 0 : account?.balance || 0)}
            </AppText>
            {dueStatus?.billingCycleLabel && (
              <AppText style={styles.heroBillingCycleText}>
                {dueStatus.billingCycleLabel}
              </AppText>
            )}
          </View>

          {/* Inflow & Outflow Stats KPIs */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <View style={styles.kpiIconWrapGreen}>
                <TrendingUp size={14} color={expenseColors.accentGreen} />
              </View>
              <View>
                <AppText style={styles.kpiLabel}>TOTAL INFLOW</AppText>
                <AppText style={styles.kpiValueGreen}>+{formatAmount(stats.inflowSum)}</AppText>
              </View>
            </View>

            <View style={styles.kpiDivider} />

            <View style={styles.kpiCard}>
              <View style={styles.kpiIconWrapRed}>
                <TrendingDown size={14} color="#FF6B6B" />
              </View>
              <View>
                <AppText style={styles.kpiLabel}>TOTAL OUTFLOW</AppText>
                <AppText style={styles.kpiValueRed}>-{formatAmount(stats.outflowSum)}</AppText>
              </View>
            </View>
          </View>
        </View>

        {/* Filter Bar Pills */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
            {[
              { id: 'all', label: `All (${accountTransactions.length})` },
              { id: 'expense', label: `Expenses (${stats.expenseCount})` },
              { id: 'income', label: `Income (${stats.incomeCount})` },
              { id: 'transfer', label: `Transfers (${stats.transferCount})` },
              { id: 'debt', label: `Debts (${stats.debtCount})` },
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveFilter(tab.id as FilterType);
                  }}
                  activeOpacity={0.75}
                >
                  <AppText style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {tab.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Transaction Grouped List */}
        {groupedTxs.length === 0 ? (
          <View style={styles.emptyState}>
            <AppText style={styles.emptyStateTitle}>No Transactions</AppText>
            <AppText style={styles.emptyStateSub}>
              {activeFilter === 'all'
                ? 'No transactions have been recorded for this account yet.'
                : `No ${activeFilter} transactions found for this account.`}
            </AppText>
          </View>
        ) : (
          <View style={styles.transactionsStack}>
            {groupedTxs.map(([dateKey, txList]) => (
              <View key={dateKey} style={styles.dateGroup}>
                <AppText style={styles.dateHeader}>{formatDateHeader(dateKey)}</AppText>

                <View style={styles.dateCard}>
                  {txList.map((tx, idx) => {
                    const cat = getCategory(tx.categoryId);
                    const isIncome = tx.type === 'income';
                    const isTransfer = tx.type === 'transfer';
                    const isDebt = tx.type === 'debt_lend' || tx.type === 'debt_borrow';
                    const isFromAccount =
                      tx.accountId === account?.id ||
                      (tx.accountName && accNameLower && tx.accountName.trim().toLowerCase() === accNameLower);

                    let amountPrefix = '-';
                    let amountColor = expenseColors.textPrimary;

                    if (isIncome) {
                      amountPrefix = '+';
                      amountColor = expenseColors.accentGreen;
                    } else if (isTransfer) {
                      amountPrefix = isFromAccount ? '-' : '+';
                      amountColor = isFromAccount ? '#FF9D66' : '#70D6BC';
                    } else if (isDebt) {
                      amountPrefix = tx.type === 'debt_lend' ? '-' : '+';
                      amountColor = tx.type === 'debt_lend' ? '#F48B8B' : '#70D6BC';
                    }

                    const title = tx.note?.trim() || cat.name;
                    let subtitle = cat.name;

                    if (isTransfer) {
                      subtitle = isFromAccount
                        ? `Transfer ➔ ${tx.toAccountName || 'Account'}`
                        : `Transfer from ${tx.accountName || 'Account'}`;
                    } else if (isDebt) {
                      subtitle = tx.type === 'debt_lend'
                        ? `Lent to ${tx.borrowerOrLender || 'Friend'}`
                        : `Borrowed from ${tx.borrowerOrLender || 'Friend'}`;
                    } else if (tx.split) {
                      subtitle = `Split with ${tx.split.friendNames || 'Friends'}`;
                    }

                    return (
                      <NativeLiquidMenu
                        key={tx.id}
                        title={title}
                        actions={getTransactionActions(tx)}
                        shouldOpenOnLongPress={true}
                        onSelect={(actionId) => handleActionSelect(actionId, tx)}
                      >
                        <TouchableOpacity
                          style={[
                            styles.txRow,
                            idx < txList.length - 1 && styles.txRowBorder,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            router.push(`/transaction/${tx.id}`);
                          }}
                        >
                          <View style={styles.txIconBox}>
                            <CategoryIcon category={cat} size={18} />
                          </View>

                          <View style={styles.txInfoCol}>
                            <AppText style={styles.txTitle} numberOfLines={1}>
                              {title}
                            </AppText>
                            <View style={styles.txSubRow}>
                              <AppText style={styles.txSubtitle} numberOfLines={1}>
                                {subtitle}
                              </AppText>
                              {tx.tag && (
                                <View style={styles.txTagBadge}>
                                  <AppText style={styles.txTagText} numberOfLines={1}>
                                    {tx.tag}
                                  </AppText>
                                </View>
                              )}
                            </View>
                          </View>

                          <View style={styles.txAmountCol}>
                            <AppText style={[styles.txAmountText, { color: amountColor }]}>
                              {amountPrefix}{formatAmount(tx.amount)}
                            </AppText>
                            {tx.split && (
                              <AppText style={styles.txYourShareText}>
                                Share: {formatAmount(tx.split.yourShare)}
                              </AppText>
                            )}
                          </View>
                        </TouchableOpacity>
                      </NativeLiquidMenu>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Edit Account Modal */}
      {account && (
        <EditAccountModal
          visible={showEditModal}
          account={account}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <AddTransactionModal
          visible={true}
          initialTransaction={editingTx}
          onClose={() => setEditingTx(null)}
        />
      )}

      {/* Split Details Modal */}
      {splitModalTx && (
        <SplitDetailsModal
          visible={true}
          transaction={splitModalTx}
          onClose={() => setSplitModalTx(null)}
        />
      )}
    </View>
  );
}

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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  editHeaderBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 157, 102, 0.1)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 18,
  },
  heroCard: {
    backgroundColor: '#1A1D23',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIconWrapper: {
    flexShrink: 0,
  },
  heroInfoCol: {
    flex: 1,
  },
  heroAccountName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroAccountType: {
    color: expenseColors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  dueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dueBadgeUpcoming: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
  },
  dueBadgeUrgent: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
  },
  dueBadgePaid: {
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dueBadgeUpcomingText: {
    color: expenseColors.accentPeach,
  },
  dueBadgeUrgentText: {
    color: '#FF6B6B',
  },
  dueBadgePaidText: {
    color: expenseColors.accentGreen,
  },
  heroBalanceBlock: {
    gap: 4,
  },
  heroBalanceLabel: {
    color: expenseColors.textSubtle,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroBalanceValue: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroBillingCycleText: {
    color: expenseColors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101114',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  kpiCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kpiIconWrapGreen: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(92, 228, 154, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIconWrapRed: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    color: expenseColors.textSubtle,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiValueGreen: {
    color: expenseColors.accentGreen,
    fontSize: 13,
    fontWeight: '800',
  },
  kpiValueRed: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '800',
  },
  kpiDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 8,
  },
  filterSection: {
    marginHorizontal: -16,
  },
  filterPillsRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    backgroundColor: '#1A1D23',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterPillActive: {
    backgroundColor: expenseColors.accentPeach,
    borderColor: expenseColors.accentPeach,
  },
  filterPillText: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#0F1015',
    fontWeight: '800',
  },
  transactionsStack: {
    gap: 16,
  },
  dateGroup: {
    gap: 8,
  },
  dateHeader: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dateCard: {
    backgroundColor: '#1A1D23',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#202330',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  txInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  txTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  txSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  txTagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txTagText: {
    color: '#A0A5B5',
    fontSize: 9,
    fontWeight: '600',
  },
  txAmountCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  txAmountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  txYourShareText: {
    color: expenseColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#1A1D23',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyStateTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyStateSub: {
    color: expenseColors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});
