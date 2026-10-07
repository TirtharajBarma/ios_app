import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  ArrowRight,
  Users,
  Repeat,
  Tag,
  CheckCircle2,
  ArrowRightLeft,
  Check,
  ChevronRight,
  HandCoins,
  Receipt,
  Wallet,
  FileText,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useShallow } from 'zustand/react/shallow';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseCategory, ExpenseAccount } from '@/types/expense';
import { CategoryIcon } from '@/components/expense/CategoryIcon';
import { AccountIcon } from '@/components/expense/AccountIcon';
import { AddTransactionModal } from '@/components/expense/AddTransactionModal';
import { SplitDetailsModal } from '@/components/expense/SplitDetailsModal';
import { format, parseISO } from 'date-fns';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    transactions,
    categories,
    accounts,
    savingsVaults,
    currencySymbol,
    formatAmount,
    removeTransactions,
    settleTransaction,
    settleFriendShare,
  } = useExpenseStore(
    useShallow((s) => ({
      transactions: s.transactions,
      categories: s.categories,
      accounts: s.accounts,
      savingsVaults: s.savingsVaults,
      currencySymbol: s.currencySymbol,
      formatAmount: s.formatAmount,
      removeTransactions: s.removeTransactions,
      settleTransaction: s.settleTransaction,
      settleFriendShare: s.settleFriendShare,
    }))
  );

  const { subscriptions } = useSubscriptionStore();
  const sym = currencySymbol || '₹';

  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showSplitModal, setShowSplitModal] = useState<boolean>(false);

  // Locate the target transaction
  const transaction = useMemo(() => {
    return transactions.find((t) => t.id === id) || null;
  }, [transactions, id]);

  const category = useMemo((): ExpenseCategory => {
    if (!transaction) return { id: 'unknown', name: 'General', color: '#8E919D', iconName: 'MoreHorizontal' };
    const found = categories.find((c) => c.id === transaction.categoryId);
    if (found) return found;
    if (transaction.type === 'income') return { id: 'cat_income', name: 'Income', color: expenseColors.accentGreen, iconName: 'Coins' };
    return { id: transaction.categoryId, name: 'Expense', color: '#8E919D', iconName: 'MoreHorizontal' };
  }, [categories, transaction]);

  const fromAccount = useMemo((): ExpenseAccount | null => {
    if (!transaction) return null;
    return (
      accounts.find((a) => a.id === transaction.accountId) ||
      accounts.find((a) => a.name.toLowerCase() === (transaction.accountName || '').toLowerCase()) ||
      null
    );
  }, [accounts, transaction]);

  const toAccount = useMemo((): ExpenseAccount | null => {
    if (!transaction || !transaction.toAccountId) return null;
    return (
      accounts.find((a) => a.id === transaction.toAccountId) ||
      accounts.find((a) => a.name.toLowerCase() === (transaction.toAccountName || '').toLowerCase()) ||
      null
    );
  }, [accounts, transaction]);

  const linkedSubscription = useMemo(() => {
    if (!transaction?.subscriptionId) return null;
    return subscriptions.find((s) => s.id === transaction.subscriptionId) || null;
  }, [subscriptions, transaction]);

  const formattedDateFull = useMemo(() => {
    if (!transaction?.date) return 'Unknown Date';
    try {
      const parsed = parseISO(transaction.date);
      return format(parsed, 'EEEE, d MMMM yyyy');
    } catch {
      return transaction.date;
    }
  }, [transaction]);

  const formattedDateShort = useMemo(() => {
    if (!transaction?.date) return 'Unknown';
    try {
      const parsed = parseISO(transaction.date);
      return format(parsed, 'd MMM yyyy');
    } catch {
      return transaction.date;
    }
  }, [transaction]);

  const formattedTime = useMemo(() => {
    if (!transaction?.createdAt) return null;
    try {
      const d = typeof transaction.createdAt === 'number' ? new Date(transaction.createdAt) : new Date(transaction.createdAt);
      if (isNaN(d.getTime())) return null;
      return format(d, 'h:mm a');
    } catch {
      return null;
    }
  }, [transaction]);

  const isExpense = transaction?.type === 'expense';
  const isIncome = transaction?.type === 'income';
  const isTransfer = transaction?.type === 'transfer';
  const isGoal = transaction?.type === 'vault_deposit' || transaction?.type === 'vault_withdraw' || transaction?.categoryId === 'cat_goal';
  const isDebtLend = transaction?.type === 'debt_lend';
  const isDebtBorrow = transaction?.type === 'debt_borrow';
  const isDebt = isDebtLend || isDebtBorrow;
  const isSplit = Boolean(transaction?.split);

  const displayTitle = useMemo(() => {
    if (!transaction) return '';
    if (isGoal || transaction.vaultId) {
      const cleanNote = transaction.note?.trim() || '';
      const matchGoal = /^(?:Saved to|Withdrawn from|Refund from deleted goal:?)\s*(.+)$/i.exec(cleanNote);
      const vault = transaction.vaultId ? (savingsVaults || []).find((v) => v.id === transaction.vaultId) : null;
      const fallbackName = matchGoal ? matchGoal[1].trim() : cleanNote || 'Savings Goal';
      return vault ? `${vault.emoji ? vault.emoji + ' ' : ''}${vault.name}`.trim() : fallbackName;
    }
    if (transaction.merchant) return transaction.merchant;
    if (transaction.note) {
      return transaction.note.includes(' - ') ? transaction.note.split(' - ')[0] : transaction.note;
    }
    if (isTransfer) return 'Account Transfer';
    return category.name;
  }, [transaction, isTransfer, category, isGoal, savingsVaults]);

  const displayMemo = useMemo(() => {
    if (!transaction) return null;
    if (isGoal) {
      return transaction.note?.trim() || null;
    }
    if (transaction.merchant && transaction.note && transaction.note.trim()) {
      return transaction.note.trim();
    }
    if (!transaction.merchant && transaction.note && transaction.note.includes(' - ')) {
      const parts = transaction.note.split(' - ');
      return parts.slice(1).join(' - ').trim() || null;
    }
    return null;
  }, [transaction, isGoal]);

  const handleDelete = () => {
    if (!transaction) return;
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to permanently delete this transaction? Account balances will be updated accordingly.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            removeTransactions([transaction.id]);
            router.back();
          },
        },
      ]
    );
  };

  const handleSettleFull = () => {
    if (!transaction) return;
    settleTransaction(transaction.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleSettleFriend = (friendId: string) => {
    if (!transaction) return;
    settleFriendShare(transaction.id, friendId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  if (!transaction) {
    return (
      <View style={styles.screenContainer}>
        <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary }} />
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <AppText style={styles.titleThe}>TRANSACTION </AppText>
            <AppText style={styles.titleMain}>RECEIPT</AppText>
          </View>
          <View style={styles.headerRightSpacer} />
        </View>
        <View style={styles.notFoundContainer}>
          <AppText style={styles.notFoundTitle}>Transaction Not Found</AppText>
          <AppText style={styles.notFoundSub}>This transaction may have been removed or deleted.</AppText>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.back()}>
            <AppText style={styles.backHomeBtnText}>Go Back</AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  let amountPrefix = '-';
  let amountColor = expenseColors.accentPeach;
  let typeLabel = 'EXPENSE';
  let typeBadgeBg = 'rgba(248, 177, 149, 0.15)';

  if (isGoal) {
    amountPrefix = transaction.type === 'vault_withdraw' ? '+' : '';
    amountColor = expenseColors.accentGreen;
    typeLabel = transaction.type === 'vault_withdraw' ? 'GOAL WITHDRAWAL' : 'GOAL';
    typeBadgeBg = expenseColors.accentGreenBg;
  } else if (isIncome) {
    amountPrefix = '+';
    amountColor = expenseColors.accentGreen;
    typeLabel = 'INCOME';
    typeBadgeBg = expenseColors.accentGreenBg;
  } else if (isTransfer) {
    amountPrefix = '⇄ ';
    amountColor = '#9DC6EB';
    typeLabel = 'TRANSFER';
    typeBadgeBg = 'rgba(157, 198, 235, 0.15)';
  } else if (isDebtLend) {
    amountPrefix = '-';
    amountColor = transaction.isSettled ? expenseColors.accentGreen : '#F48B8B';
    typeLabel = transaction.isSettled ? 'LENT · SETTLED' : 'LENT (RECEIVABLE)';
    typeBadgeBg = transaction.isSettled ? expenseColors.accentGreenBg : 'rgba(244, 139, 139, 0.15)';
  } else if (isDebtBorrow) {
    amountPrefix = '+';
    amountColor = transaction.isSettled ? expenseColors.accentGreen : '#F4CD89';
    typeLabel = transaction.isSettled ? 'BORROWED · SETTLED' : 'BORROWED (PAYABLE)';
    typeBadgeBg = transaction.isSettled ? expenseColors.accentGreenBg : 'rgba(244, 205, 137, 0.15)';
  }

  const splitAllSettled = Boolean(
    transaction.split?.settled ||
    (transaction.split?.friends && transaction.split.friends.every((f) => f.settled))
  );

  return (
    <View style={styles.screenContainer}>
      {/* Top Safe Area Background */}
      <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary }} />

      {/* ── TOP NAVIGATION BAR ── */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <AppText style={styles.titleThe}>TRANSACTION </AppText>
          <AppText style={styles.titleMain}>RECEIPT</AppText>
        </View>

        <TouchableOpacity
          style={styles.headerEditBtn}
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setShowEditModal(true);
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Edit3 size={16} color={expenseColors.accentPeach} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 50 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── DIGITAL RECEIPT HERO CARD (APPLE HIG STYLE) ── */}
        <View style={styles.receiptHeroCard}>
          {/* Top Receipt Bar: Category Squircle + Type Pill + Settled Status */}
          <View style={styles.receiptTopHeaderRow}>
            <View style={[styles.receiptCategorySquircle, { backgroundColor: `${category.color || '#8E919D'}25` }]}>
              <CategoryIcon category={category} size={20} />
            </View>

            <View style={[styles.typePill, { backgroundColor: typeBadgeBg }]}>
              <AppText style={[styles.typePillText, { color: amountColor }]}>
                {typeLabel}
              </AppText>
            </View>

            {isSplit ? (
              <View style={[styles.splitTagPill, splitAllSettled && styles.splitTagPillSettled]}>
                <AppText style={[styles.splitTagPillText, splitAllSettled && styles.splitTagPillTextSettled]}>
                  {splitAllSettled ? '✓ SPLIT SETTLED' : 'SPLIT BILL'}
                </AppText>
              </View>
            ) : transaction.isSettled && isDebt ? (
              <View style={styles.settledTagPill}>
                <CheckCircle2 size={11} color={expenseColors.accentGreen} />
                <AppText style={styles.settledTagPillText}>SETTLED</AppText>
              </View>
            ) : (
              <View style={styles.metaTimeTag}>
                <AppText style={styles.metaTimeTagText}>{formattedTime || 'Logged'}</AppText>
              </View>
            )}
          </View>

          {/* Large Hero Tabular Amount */}
          <AppText
            style={[styles.heroAmountText, { color: amountColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
          >
            {amountPrefix}{formatAmount(transaction.amount)}
          </AppText>

          {/* Primary Transaction Title / Merchant Note */}
          <AppText style={styles.heroTitleText} numberOfLines={2}>
            {displayTitle.toUpperCase()}
          </AppText>

          {/* Receipt Dashed Perforation Line */}
          <View style={styles.receiptDashedLine} />

          {/* Receipt Bottom Metadata Summary Grid */}
          <View style={styles.receiptMetaGrid}>
            <View style={styles.receiptMetaCol}>
              <AppText style={styles.receiptMetaLabel}>DATE</AppText>
              <AppText style={styles.receiptMetaVal}>{formattedDateShort}</AppText>
            </View>

            <View style={styles.receiptMetaCol}>
              <AppText style={styles.receiptMetaLabel}>ACCOUNT</AppText>
              <AppText style={styles.receiptMetaVal} numberOfLines={1}>
                {fromAccount?.name || transaction.accountName || 'Primary'}
              </AppText>
            </View>

            <View style={styles.receiptMetaCol}>
              <AppText style={styles.receiptMetaLabel}>CATEGORY</AppText>
              <AppText style={styles.receiptMetaVal} numberOfLines={1}>
                {category.name}
              </AppText>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════════
            SECTION 1: PAYMENT & ACCOUNT FLOW
        ══════════════════════════════════════════════ */}
        <View style={styles.sectionHeaderWrap}>
          <AppText style={styles.sectionCategoryHeader}>PAYMENT & ACCOUNT FLOW</AppText>
        </View>

        <View style={styles.groupedInsetCard}>
          {isTransfer ? (
            <>
              {/* Transfer Source Account */}
              <TouchableOpacity
                style={styles.groupedRowItem}
                activeOpacity={0.7}
                onPress={() => {
                  if (fromAccount) router.push(`/account/${fromAccount.id}`);
                }}
              >
                <View style={styles.iconRowLeft}>
                  <AccountIcon name={fromAccount?.name || transaction.accountName} type={fromAccount?.type || 'savings'} size={18} containerSize={38} borderRadius={12} />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.fieldLabel}>SOURCE ACCOUNT (PAID FROM)</AppText>
                    <AppText style={styles.fieldValue}>{fromAccount?.name || transaction.accountName || 'Account'}</AppText>
                  </View>
                </View>
                {fromAccount && <ChevronRight size={18} color={expenseColors.textSubtle} />}
              </TouchableOpacity>

              {/* Animated Transfer Connection */}
              <View style={styles.transferFlowArrowRow}>
                <View style={styles.flowArrowLine} />
                <View style={styles.flowArrowCircle}>
                  <ArrowRightLeft size={14} color="#9DC6EB" />
                </View>
                <View style={styles.flowArrowLine} />
              </View>

              {/* Transfer Destination Account */}
              <TouchableOpacity
                style={styles.groupedRowItem}
                activeOpacity={0.7}
                onPress={() => {
                  if (toAccount) router.push(`/account/${toAccount.id}`);
                }}
              >
                <View style={styles.iconRowLeft}>
                  <AccountIcon name={toAccount?.name || transaction.toAccountName} type={toAccount?.type || 'savings'} size={18} containerSize={38} borderRadius={12} />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.fieldLabel}>DESTINATION ACCOUNT (TRANSFERRED TO)</AppText>
                    <AppText style={styles.fieldValue}>{toAccount?.name || transaction.toAccountName || 'Account'}</AppText>
                  </View>
                </View>
                {toAccount && <ChevronRight size={18} color={expenseColors.textSubtle} />}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Single Account Row */}
              <TouchableOpacity
                style={styles.groupedRowItem}
                activeOpacity={0.7}
                onPress={() => {
                  if (fromAccount) router.push(`/account/${fromAccount.id}`);
                }}
              >
                <View style={styles.iconRowLeft}>
                  <AccountIcon name={fromAccount?.name || transaction.accountName} type={fromAccount?.type || 'savings'} size={18} containerSize={38} borderRadius={12} />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.fieldLabel}>
                      {isIncome ? 'DEPOSITED INTO ACCOUNT' : 'PAID FROM ACCOUNT'}
                    </AppText>
                    <AppText style={styles.fieldValue}>{fromAccount?.name || transaction.accountName || 'Account'}</AppText>
                    {fromAccount && (
                      <AppText style={styles.fieldSubtext}>
                        {fromAccount.type === 'credit' ? 'Credit Card' : 'Bank / Wallet'} • Balance: {sym}{(fromAccount.balance ?? 0).toLocaleString('en-IN')}
                      </AppText>
                    )}
                  </View>
                </View>
                {fromAccount && <ChevronRight size={18} color={expenseColors.textSubtle} />}
              </TouchableOpacity>
            </>
          )}

          {/* Debt Person Row if applicable */}
          {isDebt && transaction.borrowerOrLender && (
            <>
              <View style={styles.groupedRowDivider} />
              <View style={styles.groupedRowItem}>
                <View style={styles.iconRowLeft}>
                  <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(112, 214, 188, 0.15)' }]}>
                    <HandCoins size={18} color={expenseColors.accentGreen} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.fieldLabel}>
                      {isDebtLend ? 'BORROWER (LENT TO)' : 'LENDER (BORROWED FROM)'}
                    </AppText>
                    <AppText style={styles.fieldValue}>{transaction.borrowerOrLender}</AppText>
                    <AppText style={styles.fieldSubtext}>
                      {transaction.isSettled ? 'Debt marked as settled' : 'Payment pending reconciliation'}
                    </AppText>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ══════════════════════════════════════════════
            SECTION 2: DETAILS & CATEGORIZATION
        ══════════════════════════════════════════════ */}
        <View style={styles.sectionHeaderWrap}>
          <AppText style={styles.sectionCategoryHeader}>DETAILS & CATEGORIZATION</AppText>
        </View>

        <View style={styles.groupedInsetCard}>
          {/* Category */}
          <View style={styles.groupedRowItem}>
            <View style={styles.iconRowLeft}>
              <View style={[styles.tileIconCircle, { backgroundColor: `${category.color || '#8E919D'}20` }]}>
                <CategoryIcon category={category} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles.fieldLabel}>CATEGORY</AppText>
                <AppText style={styles.fieldValue}>{category.name}</AppText>
              </View>
            </View>
          </View>

          {/* Trip / Event Folder Tag */}
          {transaction.tag && (
            <>
              <View style={styles.groupedRowDivider} />
              <TouchableOpacity
                style={styles.groupedRowItem}
                activeOpacity={0.7}
                onPress={() => {
                  if (transaction.folderId) {
                    router.push(`/folder/${transaction.folderId}`);
                  }
                }}
              >
                <View style={styles.iconRowLeft}>
                  <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(248, 177, 149, 0.16)' }]}>
                    <Tag size={16} color={expenseColors.accentPeach} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.fieldLabel}>TRIP / EVENT FOLDER</AppText>
                    <AppText style={styles.fieldValue}>{transaction.folderName || transaction.tag}</AppText>
                  </View>
                </View>
                {transaction.folderId && <ChevronRight size={18} color={expenseColors.textSubtle} />}
              </TouchableOpacity>
            </>
          )}

          {/* Linked Subscription */}
          {linkedSubscription && (
            <>
              <View style={styles.groupedRowDivider} />
              <TouchableOpacity
                style={styles.groupedRowItem}
                activeOpacity={0.7}
                onPress={() => router.push(`/subscription/${linkedSubscription.id}`)}
              >
                <View style={styles.iconRowLeft}>
                  <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(157, 198, 235, 0.15)' }]}>
                    <Repeat size={16} color="#9DC6EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.fieldLabel}>LINKED SUBSCRIPTION</AppText>
                    <AppText style={styles.fieldValue}>{linkedSubscription.name}</AppText>
                    <AppText style={styles.fieldSubtext}>
                      {linkedSubscription.billingCycle.toUpperCase()} • Next Bill: {linkedSubscription.nextBillingDate}
                    </AppText>
                  </View>
                </View>
                <ChevronRight size={18} color={expenseColors.textSubtle} />
              </TouchableOpacity>
            </>
          )}

          {/* Budget Month Allocation */}
          {transaction.allocatedMonth && (
            <>
              <View style={styles.groupedRowDivider} />
              <View style={styles.groupedRowItem}>
                <View style={styles.iconRowLeft}>
                  <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(112, 214, 188, 0.16)' }]}>
                    <Sparkles size={16} color={expenseColors.accentGreen} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.fieldLabel}>BUDGET CYCLE ALLOCATION</AppText>
                    <AppText style={styles.fieldValue}>{transaction.allocatedMonth}</AppText>
                    <AppText style={styles.fieldSubtext}>
                      Funds {transaction.allocatedMonth} cash flow & leftover
                    </AppText>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ══════════════════════════════════════════════
            SECTION 3: MULTI-FRIEND SPLIT BREAKDOWN
        ══════════════════════════════════════════════ */}
        {transaction.split && (
          <>
            <View style={styles.sectionHeaderWrap}>
              <AppText style={styles.sectionCategoryHeader}>BILL SPLIT BREAKDOWN</AppText>
            </View>

            <View style={styles.groupedInsetCard}>
              {/* 3-Column Split KPI Cards */}
              <View style={styles.splitKpiGrid}>
                <View style={styles.splitKpiBox}>
                  <AppText style={styles.splitKpiLabel}>TOTAL BILL</AppText>
                  <AppText style={styles.splitKpiValue}>{formatAmount(transaction.split.totalPaid)}</AppText>
                </View>
                <View style={styles.splitKpiBox}>
                  <AppText style={styles.splitKpiLabel}>YOUR SHARE</AppText>
                  <AppText style={[styles.splitKpiValue, { color: expenseColors.accentPeach }]}>
                    {formatAmount(transaction.split.yourShare)}
                  </AppText>
                </View>
                <View style={styles.splitKpiBox}>
                  <AppText style={styles.splitKpiLabel}>FRIENDS OWE</AppText>
                  <AppText style={[styles.splitKpiValue, { color: expenseColors.accentGreen }]}>
                    {formatAmount(transaction.split.friendsShare)}
                  </AppText>
                </View>
              </View>

              {/* Individual Friends List */}
              {transaction.split.friends && transaction.split.friends.length > 0 && (
                <View style={styles.friendsListStack}>
                  <View style={styles.friendsListHeader}>
                    <Users size={14} color={expenseColors.textSubtle} />
                    <AppText style={styles.friendsListHeaderText}>INDIVIDUAL FRIENDS</AppText>
                  </View>

                  {transaction.split.friends.map((f, idx) => (
                    <View key={f.id || idx} style={styles.friendRowItem}>
                      <View style={{ flex: 1 }}>
                        <AppText style={styles.friendNameText} numberOfLines={1}>{f.name}</AppText>
                        <AppText style={styles.friendAmountText} numberOfLines={1}>{formatAmount(f.amount)}</AppText>
                      </View>

                      {f.settled ? (
                        <View style={styles.settledFriendTag}>
                          <Check size={12} color={expenseColors.accentGreen} strokeWidth={3} />
                          <AppText style={styles.settledFriendTagText}>Settled</AppText>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.settleFriendBtn}
                          activeOpacity={0.8}
                          onPress={() => handleSettleFriend(f.id)}
                        >
                          <AppText style={styles.settleFriendBtnText}>Mark Paid</AppText>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════
            SECTION: TRANSACTION NOTE & MEMO
        ══════════════════════════════════════════════ */}
        {displayMemo && (
          <>
            <View style={styles.sectionHeaderWrap}>
              <AppText style={styles.sectionCategoryHeader}>TRANSACTION NOTE & MEMO</AppText>
            </View>
            <View style={styles.memoCard}>
              <View style={styles.memoHeader}>
                <View style={styles.memoIconBadge}>
                  <FileText size={13} color={expenseColors.accentPeach} />
                </View>
                <AppText style={styles.memoHeaderLabel}>NOTE</AppText>
              </View>
              <AppText style={styles.memoContentText}>"{displayMemo}"</AppText>
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════
            SECTION 4: ACTIONS & MANAGEMENT
        ══════════════════════════════════════════════ */}
        <View style={styles.actionsContainer}>
          {/* Primary Settle Debt Action */}
          {isDebt && !transaction.isSettled && (
            <TouchableOpacity
              style={styles.primarySettleBtn}
              activeOpacity={0.85}
              onPress={handleSettleFull}
            >
              <CheckCircle2 size={18} color="#0D0E12" strokeWidth={2.4} />
              <AppText style={styles.primarySettleBtnText}>Mark Debt as Settled</AppText>
            </TouchableOpacity>
          )}

          {/* Edit & Delete Action Buttons */}
          <View style={styles.dualActionRow}>
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setShowEditModal(true);
              }}
            >
              <Edit3 size={16} color="#FFFFFF" />
              <AppText style={styles.secondaryActionText}>Edit</AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.destructiveActionBtn}
              activeOpacity={0.8}
              onPress={handleDelete}
            >
              <Trash2 size={16} color={expenseColors.accentRed} />
              <AppText style={styles.destructiveActionText}>Delete</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      {showEditModal && (
        <AddTransactionModal
          visible={true}
          initialTransaction={transaction}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Split Details Modal */}
      {showSplitModal && (
        <SplitDetailsModal
          visible={true}
          transaction={transaction}
          onClose={() => setShowSplitModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: expenseColors.bgPrimary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: expenseColors.bgPrimary,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E212B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEditBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(248, 177, 149, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 177, 149, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleThe: {
    color: '#8E919D',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  titleMain: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  headerRightSpacer: {
    width: 38,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  receiptHeroCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    alignItems: 'center',
    marginBottom: 18,
  },
  receiptTopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  receiptCategorySquircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  splitTagPill: {
    backgroundColor: 'rgba(255, 157, 102, 0.14)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  splitTagPillSettled: {
    backgroundColor: 'rgba(112, 214, 188, 0.14)',
  },
  splitTagPillText: {
    color: expenseColors.accentPeach,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  splitTagPillTextSettled: {
    color: expenseColors.accentGreen,
  },
  settledTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(112, 214, 188, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  settledTagPillText: {
    color: expenseColors.accentGreen,
    fontSize: 10,
    fontWeight: '800',
  },
  metaTimeTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaTimeTagText: {
    color: '#8E919D',
    fontSize: 10,
    fontWeight: '700',
  },
  heroAmountText: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    letterSpacing: -1,
    marginVertical: 4,
  },
  heroTitleText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 16,
  },
  receiptDashedLine: {
    width: '100%',
    height: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderStyle: 'dashed',
    marginBottom: 14,
  },
  receiptMetaGrid: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  receiptMetaCol: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  receiptMetaLabel: {
    color: expenseColors.textSubtle,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  receiptMetaVal: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderWrap: {
    paddingHorizontal: 4,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionCategoryHeader: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  groupedInsetCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    marginBottom: 18,
    overflow: 'hidden',
  },
  groupedRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  iconRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  tileIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    color: expenseColors.textSubtle,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.0,
    marginBottom: 2,
  },
  fieldValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  fieldSubtext: {
    color: expenseColors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  groupedRowDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 66,
  },
  transferFlowArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 2,
  },
  flowArrowLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(157, 198, 235, 0.2)',
  },
  flowArrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(157, 198, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  splitKpiGrid: {
    flexDirection: 'row',
    padding: 14,
    gap: 8,
  },
  splitKpiBox: {
    flex: 1,
    backgroundColor: '#212430',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  splitKpiLabel: {
    color: expenseColors.textSubtle,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  splitKpiValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  friendsListStack: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    gap: 12,
  },
  friendsListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  friendsListHeaderText: {
    color: expenseColors.textSubtle,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  friendRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  friendNameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  friendAmountText: {
    color: expenseColors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  settledFriendTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  settledFriendTagText: {
    color: expenseColors.accentGreen,
    fontSize: 11,
    fontWeight: '800',
  },
  settleFriendBtn: {
    backgroundColor: 'rgba(248, 177, 149, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  settleFriendBtnText: {
    color: expenseColors.accentPeach,
    fontSize: 11,
    fontWeight: '800',
  },
  actionsContainer: {
    gap: 10,
    marginTop: 4,
  },
  primarySettleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: expenseColors.accentGreen,
    paddingVertical: 15,
    borderRadius: 18,
  },
  primarySettleBtnText: {
    color: '#0D0E12',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dualActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#20232E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 14,
    borderRadius: 16,
  },
  secondaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  destructiveActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(244, 139, 139, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 139, 139, 0.25)',
    paddingVertical: 14,
    borderRadius: 16,
  },
  destructiveActionText: {
    color: expenseColors.accentRed,
    fontSize: 14,
    fontWeight: '700',
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  notFoundTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  notFoundSub: {
    color: expenseColors.textSubtle,
    fontSize: 13,
    textAlign: 'center',
  },
  backHomeBtn: {
    marginTop: 12,
    backgroundColor: '#20232E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  backHomeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Memo / Note Card ──
  memoCard: {
    backgroundColor: '#161822',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 20,
  },
  memoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  memoIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoHeaderLabel: {
    color: '#8E919D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  memoContentText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
