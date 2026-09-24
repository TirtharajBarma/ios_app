import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowRightLeft,
  Users,
  Tag,
  CheckCircle2,
  Circle,
  Trash2,
  Sparkles,
  HandCoins,
  Search,
  X,
  Mic,
  Cpu,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { MenuAction } from '@expo/ui/community/menu';
import { AppText, NativeLiquidMenu } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { FixedBottomNav } from './FixedBottomNav';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseTransaction, ExpenseCategory } from '@/types/expense';
import { CategoryIcon } from './CategoryIcon';
import { getDeviceAiEngineInfo, SMART_QUERY_PRESETS } from '@/services/onDeviceAi';

export const ExpenseLedger: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    accounts,
    categories,
    transactions,
    activeAccountFilter,
    smartSearchQuery,
    selectedTransactionIds,
    currencySymbol,
    setActiveAccountFilter,
    setSmartSearchQuery,
    getFilteredTransactions,
    getSmartSearchResult,
    toggleSelectTransaction,
    clearSelectedTransactions,
    selectAllTransactions,
    removeTransactions,
    settleTransaction,
  } = useExpenseStore();

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [settlingTx, setSettlingTx] = useState<ExpenseTransaction | null>(null);
  const [settleAccountId, setSettleAccountId] = useState<string>(accounts[0]?.id || 'acc_hdfc');
  const sym = currencySymbol || '₹';

  // Statistical Anomaly / Outlier Calculation (Z-Score approximation per category)
  const categoryAverages = useMemo(() => {
    const map: Record<string, { avg: number; stdDev: number }> = {};
    categories.forEach((cat) => {
      const catTxs = transactions.filter((t) => t.categoryId === cat.id && t.type === 'expense');
      if (catTxs.length >= 2) {
        const sum = catTxs.reduce((acc, t) => acc + t.amount, 0);
        const avg = sum / catTxs.length;
        const variance = catTxs.reduce((acc, t) => acc + Math.pow(t.amount - avg, 2), 0) / catTxs.length;
        const stdDev = Math.sqrt(variance);
        map[cat.id] = { avg, stdDev };
      }
    });
    return map;
  }, [categories, transactions]);

  const deviceAiInfo = useMemo(() => getDeviceAiEngineInfo(), []);
  const aiResult = useMemo(() => getSmartSearchResult(), [transactions, activeAccountFilter, smartSearchQuery, accounts, categories]);
  const filteredTxs = useMemo(() => getFilteredTransactions(), [transactions, activeAccountFilter, smartSearchQuery, accounts, categories]);

  const getCategoryObj = (catId: string) => {
    return categories.find((c) => c.id === catId) || categories[0];
  };

  const getAccountName = (accId?: string) => {
    if (!accId) return '';
    return accounts.find((a) => a.id === accId)?.name || accId;
  };

  const renderCategoryIcon = (cat: ExpenseCategory) => {
    return (
      <CategoryIcon
        category={cat}
        size={16}
        color="#FFFFFF"
        strokeWidth={2}
        fill={true}
      />
    );
  };

  const accountFilterList = ['All', ...accounts.map((a) => a.name)];

  const dateGrouped = useMemo(() => {
    const groups: Record<string, ExpenseTransaction[]> = {};
    filteredTxs.forEach((tx) => {
      const dateObj = new Date(tx.date);
      const dateHeading = dateObj
        .toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
        .toUpperCase();

      if (!groups[dateHeading]) {
        groups[dateHeading] = [];
      }
      groups[dateHeading].push(tx);
    });
    return groups;
  }, [filteredTxs]);

  const renderTransactionItem = (tx: ExpenseTransaction, isLast: boolean) => {
    const cat = getCategoryObj(tx.categoryId);
    const isSelected = selectedTransactionIds.includes(tx.id);
    const formattedDate = new Date(tx.date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
    });

    const isTransfer = tx.type === 'transfer';
    const isSplit = !!tx.split;
    const isDebt = tx.type === 'debt_lend' || tx.type === 'debt_borrow';
    const isExpense = tx.type === 'expense' || isSplit || tx.type === 'debt_lend';
    const isIncome = tx.type === 'income' || tx.type === 'debt_borrow';

    const sym = currencySymbol || '₹';
    let amountDisplay = `${sym}${tx.amount.toLocaleString('en-IN')}`;
    if (tx.type === 'debt_lend') amountDisplay = `-${sym}${tx.amount.toLocaleString('en-IN')}`;
    else if (tx.type === 'debt_borrow') amountDisplay = `+${sym}${tx.amount.toLocaleString('en-IN')}`;
    else if (isExpense) amountDisplay = `-${sym}${tx.amount.toLocaleString('en-IN')}`;
    else if (isIncome) amountDisplay = `+${sym}${tx.amount.toLocaleString('en-IN')}`;
    else if (isTransfer) amountDisplay = `⇄ ${sym}${tx.amount.toLocaleString('en-IN')}`;

    const isDebtLend = tx.type === 'debt_lend';
    const isSettled = isDebtLend ? tx.isSettled : tx.split?.settled;
    const canSettle = (isDebtLend || (isSplit && (tx.split?.friendsShare || 0) > 0)) && !isSettled;

    const catStats = categoryAverages[tx.categoryId];
    const isOutlier =
      tx.type === 'expense' &&
      catStats &&
      catStats.stdDev > 25 &&
      tx.amount > catStats.avg + 1.8 * catStats.stdDev;

    const txActions: MenuAction[] = [
      {
        id: 'copy',
        title: 'Copy Details',
        image: 'doc.on.doc' as any,
      },
      ...(canSettle
        ? [
            {
              id: 'settle',
              title: 'Settle Up',
              image: 'checkmark.circle.fill' as any,
            },
          ]
        : []),
      {
        id: 'select',
        title: 'Select Item',
        image: 'checklist' as any,
      },
      {
        id: 'delete',
        title: 'Delete Transaction',
        image: 'trash.fill' as any,
        attributes: { destructive: true },
      },
    ];

    const rowContent = (
      <TouchableOpacity
        style={[styles.transactionRow, !isLast && styles.rowDivider]}
        activeOpacity={0.7}
        onPress={() => {
          if (isSelectMode) {
            toggleSelectTransaction(tx.id);
          }
        }}
      >
        {/* Select Checkbox in Select Mode */}
        {isSelectMode && (
          <View style={styles.checkboxContainer}>
            {isSelected ? (
              <CheckCircle2 size={20} color={expenseColors.accentPeach} />
            ) : (
              <Circle size={20} color={expenseColors.textMuted} />
            )}
          </View>
        )}

        {/* Left: Category / Transfer Icon Circle */}
        <View
          style={[
            styles.categoryIconCircle,
            {
              backgroundColor: isTransfer
                ? expenseColors.accentBlue
                : isSplit
                ? expenseColors.accentPurple
                : isDebt
                ? '#F2994A'
                : cat.color,
            },
          ]}
        >
          {isTransfer ? (
            <ArrowRightLeft size={16} color="#FFFFFF" />
          ) : isSplit ? (
            <Users size={16} color="#FFFFFF" />
          ) : isDebt ? (
            <HandCoins size={16} color="#FFFFFF" />
          ) : (
            renderCategoryIcon(cat)
          )}
        </View>

        {/* Center: Title & Subtitle Badge */}
        <View style={styles.transactionCenter}>
          <AppText style={styles.transactionTitle} numberOfLines={1}>
            {tx.note || (isTransfer ? 'Account Transfer' : cat.name.toUpperCase())}
          </AppText>

          {/* Badges / Flow details */}
          <View style={styles.badgeRow}>
            {isTransfer ? (
              <View style={styles.transferFlowPill}>
                <AppText style={styles.transferFlowText}>
                  {getAccountName(tx.accountId)} ➔ {getAccountName(tx.toAccountId)}
                </AppText>
              </View>
            ) : isDebt ? (
              <View style={styles.debtFlowPill}>
                <AppText style={styles.debtFlowText}>
                  {tx.type === 'debt_lend' ? 'Lent to' : 'Borrowed from'} {tx.borrowerOrLender || 'Friend'}
                </AppText>
              </View>
            ) : (
              <View
                style={[
                  styles.categoryPill,
                  { backgroundColor: `${cat.color}25` },
                ]}
              >
                <AppText style={[styles.categoryPillText, { color: cat.color }]}>
                  {cat.name} {cat.emoji || ''}
                </AppText>
              </View>
            )}

            {/* Event / Trip Tag Badge */}
            {tx.tag && (
              <View style={styles.tripTagBadge}>
                <Tag size={10} color={expenseColors.accentPeach} />
                <AppText style={styles.tripTagBadgeText}>{tx.tag}</AppText>
              </View>
            )}

            {/* Statistical Anomaly / Outlier Badge */}
            {isOutlier && (
              <View style={styles.outlierBadge}>
                <AppText style={styles.outlierBadgeText}>⚠️ High</AppText>
              </View>
            )}

            <AppText style={styles.transactionDateText}>{formattedDate}</AppText>
          </View>

          {/* Split breakdown info if split transaction */}
          {isSplit && tx.split && (
            <View style={styles.splitLedgerDetail}>
              <AppText style={styles.splitLedgerDetailText}>
                Your share: <AppText style={{ color: '#FFFFFF', fontWeight: '700' }}>{sym}{tx.split.yourShare.toLocaleString('en-IN')}</AppText>
                {'  '}•{'  '}
                Lent: <AppText style={{ color: expenseColors.accentGreen, fontWeight: '700' }}>{sym}{tx.split.friendsShare.toLocaleString('en-IN')}</AppText>
                {tx.split.friendNames ? ` (${tx.split.friendNames})` : ''}
              </AppText>
            </View>
          )}
        </View>

        {/* Right: Amount & Settle Up action */}
        <View style={styles.amountCol}>
          <AppText
            style={[
              styles.transactionAmountText,
              isExpense && styles.expenseAmount,
              isIncome && styles.incomeAmount,
              isTransfer && styles.transferAmount,
            ]}
          >
            {amountDisplay}
          </AppText>
          <AppText style={styles.accountSubText}>
            {getAccountName(tx.accountId)}
          </AppText>

          {canSettle && (
            <TouchableOpacity
              style={styles.settleUpBtn}
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                setSettlingTx(tx);
                setSettleAccountId(tx.accountId || accounts[0]?.id || 'acc_hdfc');
              }}
              activeOpacity={0.8}
            >
              <Check size={10} color="#2ECC71" strokeWidth={3} />
              <AppText style={styles.settleUpBtnText}>Settle Up</AppText>
            </TouchableOpacity>
          )}
          {isSettled && (
            <View style={styles.settledBadge}>
              <AppText style={styles.settledBadgeText}>✓ Settled</AppText>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );

    if (isSelectMode) {
      return <React.Fragment key={tx.id}>{rowContent}</React.Fragment>;
    }

    return (
      <NativeLiquidMenu
        key={tx.id}
        title={tx.note || cat.name}
        actions={txActions}
        shouldOpenOnLongPress={true}
        onSelect={(actionId) => {
          if (actionId === 'copy') {
            const copyText = `${tx.note || cat.name}: ${amountDisplay} (${formattedDate})`;
            Clipboard.setStringAsync(copyText).catch(() => {});
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } else if (actionId === 'settle') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setSettlingTx(tx);
            setSettleAccountId(tx.accountId || accounts[0]?.id || 'acc_hdfc');
          } else if (actionId === 'select') {
            Haptics.selectionAsync().catch(() => {});
            setIsSelectMode(true);
            toggleSelectTransaction(tx.id);
          } else if (actionId === 'delete') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            removeTransactions([tx.id]);
          }
        }}
        style={{ width: '100%' }}
      >
        {rowContent}
      </NativeLiquidMenu>
    );
  };

  return (
    <View style={styles.screenContainer}>
      {/* Top Safe Area Background */}
      <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary, zIndex: 10 }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 8,
            paddingBottom: insets.bottom + 80,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.selectActionBtn}
            onPress={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) clearSelectedTransactions();
            }}
          >
            <AppText style={styles.selectActionText}>
              {isSelectMode ? 'Cancel' : 'Select'}
            </AppText>
          </TouchableOpacity>

          {/* Mixed Typography Header: "THE LEDGER" */}
          <View style={styles.titleContainer}>
            <AppText style={styles.titleThe}>THE </AppText>
            <AppText style={styles.titleLedger}>LEDGER</AppText>
          </View>

          <View style={styles.headerRightPlaceholder} />
        </View>

        {/* On-Device AI Smart Search & Query Card */}
        <View style={styles.smartSearchCard}>
          <View style={styles.smartSearchHeadingRow}>
            <View style={styles.headingTitleLeft}>
              <Sparkles size={14} color={expenseColors.accentPeach} />
              <AppText style={styles.smartSearchHeading}>ON-DEVICE AI QUERY</AppText>
            </View>
            {/* <View style={styles.hardwareBadge}>
              <Cpu size={10} color="#5CE49A" />
              <AppText style={styles.hardwareBadgeText}>
                {Platform.OS === 'ios' ? ' Neural Engine' : '🤖 NNAPI ML'}
              </AppText>
            </View> */}
          </View>

          {/* Search Input Box */}
          <View style={styles.inputContainer}>
            <Search size={16} color={expenseColors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder='Ask: "How much spent on Food in September?"'
              placeholderTextColor={expenseColors.textMuted}
              value={smartSearchQuery}
              onChangeText={(text) => {
                if (text.length === 1 && smartSearchQuery.length === 0) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                setSmartSearchQuery(text);
              }}
              autoCorrect={false}
              returnKeyType="search"
            />
            {smartSearchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setSmartSearchQuery('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.clearBtn}
              >
                <X size={15} color={expenseColors.textSubtle} />
              </TouchableOpacity>
            ) : (
              <View style={styles.micBadge}>
                <Mic size={15} color={expenseColors.textMuted} />
              </View>
            )}
          </View>

          {/* Smart AI Query Preset Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.queryPresetScroll}
          >
            {SMART_QUERY_PRESETS.map((preset) => {
              const isSelected = smartSearchQuery === preset.query;
              return (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    styles.presetQueryChip,
                    isSelected && styles.presetQueryChipActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    if (isSelected) {
                      setSmartSearchQuery('');
                    } else {
                      setSmartSearchQuery(preset.query);
                    }
                  }}
                >
                  <AppText
                    style={[
                      styles.presetQueryText,
                      isSelected && styles.presetQueryTextActive,
                    ]}
                  >
                    {preset.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── ON-DEVICE AI INSIGHT CARD (Rendered when a query is active) ── */}
        {aiResult && (
          <View style={styles.aiInsightCard}>
            <View style={styles.aiInsightTopRow}>
              <View style={styles.aiInsightBadge}>
                <Sparkles size={13} color="#EBB29A" />
                <AppText style={styles.aiInsightBadgeText}>AI INSIGHT</AppText>
              </View>
              <AppText style={styles.aiEngineSubtext}>{deviceAiInfo.chip}</AppText>
            </View>

            <AppText style={styles.aiAnswerText}>{aiResult.naturalLanguageAnswer}</AppText>

            {/* AI Metrics Row */}
            {aiResult.metrics.length > 0 && (
              <View style={styles.aiMetricsRow}>
                {aiResult.metrics.map((m) => (
                  <View key={m.label} style={styles.metricPill}>
                    <AppText style={styles.metricLabel}>{m.label}</AppText>
                    <AppText style={styles.metricValue}>{m.value}</AppText>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Account Filters Row ONLY */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContainer}
          style={styles.filterScrollView}
        >
          {accountFilterList.map((filterName) => {
            const isActive = activeAccountFilter.toLowerCase() === filterName.toLowerCase();
            return (
              <TouchableOpacity
                key={filterName}
                style={[
                  styles.filterPill,
                  isActive ? styles.filterPillActive : styles.filterPillInactive,
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setActiveAccountFilter(filterName);
                }}
              >
                <AppText
                  style={[
                    styles.filterPillText,
                    isActive ? styles.filterTextActive : styles.filterTextInactive,
                  ]}
                >
                  {filterName}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Bulk Action Controls in Select Mode */}
        {isSelectMode && (
          <View style={styles.bulkActionBar}>
            <TouchableOpacity onPress={selectAllTransactions}>
              <AppText style={styles.bulkActionText}>Select All</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (selectedTransactionIds.length > 0) {
                  removeTransactions(selectedTransactionIds);
                  setIsSelectMode(false);
                }
              }}
            >
              <View style={styles.deleteBtnContent}>
                <Trash2 size={16} color={expenseColors.accentRed} />
                <AppText style={styles.deleteActionText}>
                  Delete ({selectedTransactionIds.length})
                </AppText>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* DATE GROUPED VIEW (Standard Ledger View) */}
        {Object.keys(dateGrouped).length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <Search size={22} color={expenseColors.textMuted} />
            </View>
            <AppText style={styles.emptyStateTitle}>
              {smartSearchQuery ? 'No matching transactions' : 'No transactions found'}
            </AppText>
            <AppText style={styles.emptyStateSubtitle}>
              {smartSearchQuery
                ? `No transactions matched "${smartSearchQuery}". Try asking about "Food", "Shopping", or "Expenses > 100".`
                : 'Try adjusting your account selection or add a new transaction.'}
            </AppText>
            {smartSearchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSmartSearchQuery('');
                }}
                activeOpacity={0.8}
              >
                <AppText style={styles.clearSearchBtnText}>Clear Search</AppText>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          Object.entries(dateGrouped).map(([dateHeading, txs]) => (
            <View key={dateHeading} style={styles.dateGroupContainer}>
              {/* Date Heading */}
              <AppText style={styles.dateHeadingText}>{dateHeading}</AppText>

              {/* Group Card */}
              <View style={styles.groupCard}>
                {txs.map((tx, idx) => renderTransactionItem(tx, idx === txs.length - 1))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* 1-TAP SETTLE UP MODAL */}
      <Modal
        visible={settlingTx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSettlingTx(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSettlingTx(null)}
        >
          <View style={styles.settleModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.settleModalHeader}>
              <View style={styles.settleHeaderLeft}>
                <Check size={16} color="#2ECC71" strokeWidth={3} />
                <AppText style={styles.settleModalTitle}>SETTLE RECEIVABLE</AppText>
              </View>
              <TouchableOpacity onPress={() => setSettlingTx(null)}>
                <X size={18} color="#A0A5B5" />
              </TouchableOpacity>
            </View>

            {settlingTx && (
              <>
                <AppText style={styles.settleModalDesc}>
                  Receive payment from{' '}
                  <AppText style={{ color: '#FFFFFF', fontWeight: '800' }}>
                    {settlingTx.borrowerOrLender || settlingTx.split?.friendNames || 'Friend'}
                  </AppText>
                </AppText>

                <View style={styles.settleAmountHero}>
                  <AppText style={styles.settleAmountHeroText}>
                    {sym}
                    {(
                      settlingTx.type === 'debt_lend'
                        ? settlingTx.amount
                        : settlingTx.split?.friendsShare || 0
                    ).toLocaleString('en-IN')}
                  </AppText>
                </View>

                <AppText style={styles.modalFieldLabel}>RECEIVE INTO ACCOUNT</AppText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, marginVertical: 8 }}
                >
                  {accounts.map((acc) => {
                    const isSelected = settleAccountId === acc.id;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => setSettleAccountId(acc.id)}
                        style={[
                          styles.settleAccChip,
                          isSelected && styles.settleAccChipSelected,
                        ]}
                      >
                        <AppText
                          style={[
                            styles.settleAccChipText,
                            isSelected && { color: '#FFFFFF', fontWeight: '800' },
                          ]}
                        >
                          {acc.name.toUpperCase()}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={styles.settleConfirmBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (settlingTx) {
                      settleTransaction(settlingTx.id, settleAccountId);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                      setSettlingTx(null);
                    }
                  }}
                >
                  <AppText style={styles.settleConfirmBtnText}>Confirm & Deposit</AppText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: expenseColors.bgPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
  },
  selectActionBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  selectActionText: {
    color: expenseColors.accentPeach,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  titleThe: {
    color: expenseColors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  titleLedger: {
    color: expenseColors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: 1.0,
  },
  headerRightPlaceholder: {
    width: 48,
  },
  smartSearchCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(235, 178, 154, 0.2)',
  },
  smartSearchHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headingTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smartSearchHeading: {
    color: expenseColors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.0,
  },
  hardwareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(92, 228, 154, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(92, 228, 154, 0.3)',
  },
  hardwareBadgeText: {
    color: '#5CE49A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  inputContainer: {
    backgroundColor: '#22242F',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    color: expenseColors.textPrimary,
    fontSize: 14,
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  micBadge: {
    padding: 4,
  },
  queryPresetScroll: {
    paddingTop: 12,
    gap: 8,
  },
  presetQueryChip: {
    backgroundColor: '#1E202B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  presetQueryChipActive: {
    backgroundColor: 'rgba(235, 178, 154, 0.22)',
    borderColor: expenseColors.accentPeach,
  },
  presetQueryText: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    fontWeight: '600',
  },
  presetQueryTextActive: {
    color: expenseColors.accentPeach,
    fontWeight: '800',
  },
  aiInsightCard: {
    backgroundColor: 'rgba(235, 178, 154, 0.08)',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(235, 178, 154, 0.35)',
  },
  aiInsightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  aiInsightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(235, 178, 154, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiInsightBadgeText: {
    color: expenseColors.accentPeach,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  aiEngineSubtext: {
    color: expenseColors.textMuted,
    fontSize: 10,
    fontWeight: '500',
  },
  aiAnswerText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  aiMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    backgroundColor: '#1E202B',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    color: expenseColors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: '#5CE49A',
    fontSize: 11,
    fontWeight: '800',
  },
  typeFilterScrollContainer: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  typeFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  typeFilterPillActive: {
    backgroundColor: 'rgba(235, 178, 154, 0.18)',
    borderColor: expenseColors.accentPeach,
  },
  typeFilterPillInactive: {
    backgroundColor: '#1E202B',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  typeFilterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  typeFilterTextActive: {
    color: expenseColors.accentPeach,
    fontWeight: '800',
  },
  typeFilterTextInactive: {
    color: expenseColors.textSubtle,
  },
filterScrollView: {
  height: 44,
  flexGrow: 0,
  flexShrink: 0,
},
filterScrollContainer: {
  height: 44,
  paddingHorizontal: 16,
  gap: 8,
  marginBottom: 16,
  alignItems: 'center',
  flexDirection: 'row',
},
filterPill: {
  height: 36,
  minHeight: 36,
  paddingHorizontal: 14,
  borderRadius: 14,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
  flexGrow: 0,
  flexShrink: 0,
},
  filterPillActive: {
    backgroundColor: '#FFFFFF',
  },
  filterPillInactive: {
    backgroundColor: '#1E202B',
  },
  filterPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#0F1015',
    fontWeight: '800',
  },
  filterTextInactive: {
    color: expenseColors.textSubtle,
  },
  bulkActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  bulkActionText: {
    color: expenseColors.accentPeach,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteActionText: {
    color: expenseColors.accentRed,
    fontSize: 14,
    fontWeight: '700',
  },
  tripCapsuleContainer: {
    marginBottom: 16,
  },
  tripCapsuleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1C24',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(235, 178, 154, 0.25)',
  },
  tripCapsuleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  tripCapsuleName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tripCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tripCountBadgeText: {
    color: '#A0A5B5',
    fontSize: 10,
    fontWeight: '700',
  },
  tripCapsuleRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripTotalText: {
    color: expenseColors.accentPeach,
    fontSize: 14,
    fontWeight: '800',
  },
  dateGroupContainer: {
    marginBottom: 20,
  },
  dateHeadingText: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 10,
    paddingTop: 12,
  },
  groupCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    overflow: 'hidden',
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  categoryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  transactionTitle: {
    color: expenseColors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  transferFlowPill: {
    backgroundColor: 'rgba(144, 202, 249, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  transferFlowText: {
    color: expenseColors.accentBlue,
    fontSize: 11,
    fontWeight: '700',
  },
  debtFlowPill: {
    backgroundColor: 'rgba(242, 153, 74, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  debtFlowText: {
    color: '#F2994A',
    fontSize: 11,
    fontWeight: '700',
  },
  tripTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(235, 178, 154, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tripTagBadgeText: {
    color: expenseColors.accentPeach,
    fontSize: 10,
    fontWeight: '700',
  },
  splitLedgerDetail: {
    marginTop: 4,
  },
  splitLedgerDetailText: {
    color: '#8E919D',
    fontSize: 11,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryPillText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  transactionDateText: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  amountCol: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  transactionAmountText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  accountSubText: {
    color: expenseColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  expenseAmount: {
    color: expenseColors.accentRed,
  },
  incomeAmount: {
    color: expenseColors.accentGreen,
  },
  transferAmount: {
    color: '#4A90E2',
  },
  outlierBadge: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  outlierBadgeText: {
    color: '#FF9D66',
    fontSize: 9,
    fontWeight: '800',
  },
  settleUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  settleUpBtnText: {
    color: '#2ECC71',
    fontSize: 9,
    fontWeight: '800',
  },
  settledBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  settledBadgeText: {
    color: expenseColors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  emptyStateContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E202B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyStateTitle: {
    color: expenseColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  clearSearchBtn: {
    backgroundColor: 'rgba(235, 178, 154, 0.16)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: expenseColors.accentPeach,
  },
  clearSearchBtnText: {
    color: expenseColors.accentPeach,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Settle Up Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  settleModalCard: {
    width: '100%',
    backgroundColor: '#1A1C24',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  settleModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  settleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settleModalTitle: {
    color: '#2ECC71',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  settleModalDesc: {
    color: '#8E919D',
    fontSize: 12,
    marginBottom: 8,
  },
  settleAmountHero: {
    backgroundColor: '#232633',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.25)',
  },
  settleAmountHeroText: {
    color: '#2ECC71',
    fontSize: 28,
    fontWeight: '800',
  },
  modalFieldLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  settleAccChip: {
    backgroundColor: '#232633',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  settleAccChipSelected: {
    borderColor: '#2ECC71',
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
  },
  settleAccChipText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '700',
  },
  settleConfirmBtn: {
    backgroundColor: '#2ECC71',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  settleConfirmBtnText: {
    color: '#0D0E12',
    fontSize: 13,
    fontWeight: '800',
  },
});
