import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  CheckSquare,
  Square,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Tag,
  Search,
  Filter,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { CategoryIcon } from './CategoryIcon';
import { NormalizedStatementResult, StagedStatementTxn } from '@/utils/statementNormalizer';
import { ExpenseAccount } from '@/types/expense';

interface StatementReviewModalProps {
  visible: boolean;
  onClose: () => void;
  result: NormalizedStatementResult | null;
  onConfirmImport: (selectedTxs: StagedStatementTxn[], targetAccountId?: string) => void;
}

export const StatementReviewModal: React.FC<StatementReviewModalProps> = ({
  visible,
  onClose,
  result,
  onConfirmImport,
}) => {
  const insets = useSafeAreaInsets();
  const { categories, accounts, currencySymbol, saveLearnedMerchantRule } = useExpenseStore();
  const sym = currencySymbol || '₹';

  const [stagedList, setStagedList] = useState<StagedStatementTxn[]>([]);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [defaultTargetAccount, setDefaultTargetAccount] = useState<string>(accounts[0]?.id || '');
  const [activeCategoryPickerTxnId, setActiveCategoryPickerTxnId] = useState<string | null>(null);

  // Sync stagedList whenever result changes
  React.useEffect(() => {
    if (result && result.transactions) {
      setStagedList(result.transactions);
      if (accounts.length > 0) {
        setDefaultTargetAccount(accounts[0].id);
      }
    }
  }, [result, accounts]);

  // Detected accounts tabs (e.g. "All", "Slice", "Neo Axis", "SBI", etc.)
  const accountTabs = useMemo(() => {
    if (!result) return ['All'];
    const accs = result.accountsDetected;
    if (accs.length <= 1) return ['All'];
    return ['All', ...accs];
  }, [result]);

  // Filtered transactions for display
  const filteredTxs = useMemo(() => {
    return stagedList.filter((tx) => {
      // Account filter
      if (selectedAccountFilter !== 'All' && tx.accountName !== selectedAccountFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const cat = categories.find((c) => c.id === tx.categoryId);
        const matchNote = tx.narration.toLowerCase().includes(q);
        const matchCat = cat?.name.toLowerCase().includes(q);
        const matchAmt = tx.amount.toString().includes(q);
        if (!matchNote && !matchCat && !matchAmt) return false;
      }
      return true;
    });
  }, [stagedList, selectedAccountFilter, searchQuery, categories]);

  // Selected totals
  const selectedCount = useMemo(() => stagedList.filter((t) => t.selected).length, [stagedList]);
  const selectedTotal = useMemo(
    () => stagedList.filter((t) => t.selected).reduce((sum, t) => sum + t.amount, 0),
    [stagedList]
  );
  const selectedDebits = useMemo(
    () =>
      stagedList
        .filter((t) => t.selected && (t.type === 'expense' || t.type === 'transfer' || t.type === 'debt_lend'))
        .reduce((sum, t) => sum + t.amount, 0),
    [stagedList]
  );
  const selectedCredits = useMemo(
    () =>
      stagedList
        .filter((t) => t.selected && (t.type === 'income' || t.type === 'debt_borrow'))
        .reduce((sum, t) => sum + t.amount, 0),
    [stagedList]
  );

  const toggleSelect = (id: string) => {
    Haptics.selectionAsync();
    setStagedList((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const toggleSelectAll = () => {
    Haptics.selectionAsync();
    const allSelected = filteredTxs.every((t) => t.selected);
    const targetIds = new Set(filteredTxs.map((t) => t.id));
    setStagedList((prev) =>
      prev.map((t) => (targetIds.has(t.id) ? { ...t, selected: !allSelected } : t))
    );
  };

  const cycleCategory = (txnId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStagedList((prev) =>
      prev.map((t) => {
        if (t.id !== txnId) return t;
        const currentIdx = categories.findIndex((c) => c.id === t.categoryId);
        const nextIdx = (currentIdx + 1) % categories.length;
        const nextCat = categories[nextIdx] || categories[0];
        // Learn rule
        saveLearnedMerchantRule(t.narration, nextCat.id);
        return {
          ...t,
          categoryId: nextCat.id,
          categoryConfidence: 'high',
        };
      })
    );
  };

  const setTxCategory = (txnId: string, catId: string) => {
    Haptics.selectionAsync();
    setStagedList((prev) =>
      prev.map((t) => {
        if (t.id !== txnId) return t;
        saveLearnedMerchantRule(t.narration, catId);
        return {
          ...t,
          categoryId: catId,
          categoryConfidence: 'high',
        };
      })
    );
    setActiveCategoryPickerTxnId(null);
  };

  const handleImportClick = () => {
    const toImport = stagedList.filter((t) => t.selected);
    if (toImport.length === 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onConfirmImport(toImport, defaultTargetAccount);
  };

  if (!result) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 14 : insets.top }]}>
        {/* iOS Drag Indicator */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <View style={styles.bankBadge}>
              <Building2 size={13} color={expenseColors.accentPeach} />
              <AppText style={styles.bankBadgeText}>{result.bankName.toUpperCase()}</AppText>
            </View>
            {result.statementPeriod ? (
              <View style={styles.periodRow}>
                <Calendar size={11} color={expenseColors.textMuted} />
                <AppText style={styles.periodText}>{result.statementPeriod}</AppText>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.selectionAsync();
              onClose();
            }}
          >
            <X size={18} color={expenseColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Metric Cards */}
          <View style={styles.summaryCard}>
            <View style={styles.metricRow}>
              {/* Debits / Spent */}
              <View style={styles.metricCol}>
                <AppText style={styles.metricLabel}>OUTFLOW</AppText>
                <AppText style={[styles.metricValue, { color: expenseColors.accentPeach }]}>
                  -{sym}{selectedDebits.toLocaleString('en-IN')}
                </AppText>
              </View>

              <View style={styles.metricDivider} />

              {/* Credits / Income */}
              <View style={styles.metricCol}>
                <AppText style={styles.metricLabel}>INFLOW</AppText>
                <AppText style={[styles.metricValue, { color: expenseColors.accentGreen }]}>
                  +{sym}{selectedCredits.toLocaleString('en-IN')}
                </AppText>
              </View>

              <View style={styles.metricDivider} />

              {/* Net Flow */}
              <View style={styles.metricCol}>
                <AppText style={styles.metricLabel}>NET FLOW</AppText>
                <AppText
                  style={[
                    styles.metricValue,
                    {
                      color:
                        selectedCredits - selectedDebits >= 0
                          ? expenseColors.accentGreen
                          : expenseColors.textPrimary,
                    },
                  ]}
                >
                  {selectedCredits - selectedDebits >= 0 ? '+' : '-'}
                  {sym}
                  {Math.abs(selectedCredits - selectedDebits).toLocaleString('en-IN')}
                </AppText>
              </View>
            </View>

            {/* Reconciliation Status Pill */}
            <View
              style={[
                styles.reconciliationPill,
                result.reconciliation.isReconciled
                  ? styles.reconciledSuccess
                  : styles.reconciledWarning,
              ]}
            >
              {result.reconciliation.isReconciled ? (
                <>
                  <ShieldCheck size={14} color={expenseColors.accentGreen} />
                  <AppText style={styles.reconciledSuccessText}>
                    Mathematical Balance Reconciled ({stagedList.length} Transactions)
                  </AppText>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} color="#FFB84D" />
                  <AppText style={styles.reconciledWarningText}>
                    Balance verified with slight rounding difference ({sym}
                    {result.reconciliation.reconciledDiff.toFixed(2)})
                  </AppText>
                </>
              )}
            </View>
          </View>

          {/* Account Filter Tabs (If multi-account statement) */}
          {accountTabs.length > 1 ? (
            <View style={styles.accountTabsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.accountTabsScroll}
              >
                {accountTabs.map((tab) => {
                  const isSelected = selectedAccountFilter === tab;
                  const count =
                    tab === 'All'
                      ? stagedList.length
                      : stagedList.filter((t) => t.accountName === tab).length;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.accountTabPill, isSelected && styles.accountTabPillActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedAccountFilter(tab);
                      }}
                    >
                      <AppText
                        style={[
                          styles.accountTabPillText,
                          isSelected && styles.accountTabPillTextActive,
                        ]}
                      >
                        {tab} ({count})
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Duplicates Notification Banner */}
          {result.duplicateCount > 0 ? (
            <View style={styles.duplicateNoticeCard}>
              <View style={styles.duplicateNoticeLeft}>
                <CheckCircle2 size={16} color={expenseColors.accentGreen} />
                <AppText style={styles.duplicateNoticeText}>
                  {result.newCount} new transactions selected • {result.duplicateCount} duplicates deselected
                </AppText>
              </View>
            </View>
          ) : null}

          {/* Search & Actions Bar */}
          <View style={styles.searchActionBar}>
            <View style={styles.searchBar}>
              <Search size={14} color={expenseColors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search narration or category..."
                placeholderTextColor={expenseColors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>

            <TouchableOpacity
              style={styles.selectAllBtn}
              activeOpacity={0.8}
              onPress={toggleSelectAll}
            >
              {filteredTxs.every((t) => t.selected) ? (
                <CheckSquare size={16} color={expenseColors.accentPeach} />
              ) : (
                <Square size={16} color={expenseColors.textMuted} />
              )}
              <AppText style={styles.selectAllBtnText}>
                {filteredTxs.every((t) => t.selected) ? 'Deselect All' : 'Select All'}
              </AppText>
            </TouchableOpacity>
          </View>

          {/* Staged Transactions List */}
          <View style={styles.txListContainer}>
            {filteredTxs.map((item) => {
              const cat = categories.find((c) => c.id === item.categoryId) || categories[0];
              const isIncome = item.type === 'income';

              return (
                <View key={item.id} style={styles.txItemWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.txItemRow,
                      !item.selected && styles.txItemRowDeselected,
                      item.isDuplicate && styles.txItemRowDuplicate,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => toggleSelect(item.id)}
                  >
                    {/* Checkbox */}
                    <View style={styles.checkboxWrapper}>
                      {item.selected ? (
                        <CheckSquare size={18} color={expenseColors.accentGreen} />
                      ) : (
                        <Square size={18} color={expenseColors.textMuted} />
                      )}
                    </View>

                    {/* Category Icon */}
                    <View style={[styles.catIconCircle, { backgroundColor: cat.color + '22' }]}>
                      <CategoryIcon category={cat} size={15} color={cat.color} />
                    </View>

                    {/* Narration & Metadata */}
                    <View style={styles.txMiddle}>
                      <View style={styles.txNoteRow}>
                        <AppText style={styles.txNarration} numberOfLines={1}>
                          {item.narration}
                        </AppText>
                        {item.isDuplicate ? (
                          <View style={styles.duplicateTag}>
                            <AppText style={styles.duplicateTagText}>DUPLICATE</AppText>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.txSubRow}>
                        <AppText style={styles.txDateText}>{item.date}</AppText>
                        <AppText style={styles.txDotText}>•</AppText>
                        <AppText style={styles.txAccountText}>{item.accountName}</AppText>

                        {/* Interactive Category Tag */}
                        <TouchableOpacity
                          style={[styles.interactiveCatPill, { borderColor: cat.color + '66' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            cycleCategory(item.id);
                          }}
                        >
                          <Tag size={9} color={cat.color} />
                          <AppText style={[styles.interactiveCatText, { color: cat.color }]}>
                            {cat.name.toUpperCase()}
                          </AppText>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Right Amount */}
                    <View style={styles.txRight}>
                      <AppText
                        style={[
                          styles.txAmount,
                          isIncome && { color: expenseColors.accentGreen },
                        ]}
                      >
                        {isIncome ? '+' : '-'}{sym}{item.amount.toLocaleString('en-IN')}
                      </AppText>
                      {item.balance !== undefined ? (
                        <AppText style={styles.txBalanceText}>
                          Bal: {sym}{item.balance.toLocaleString('en-IN')}
                        </AppText>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* Floating Bottom Import CTA */}
        <View style={[styles.bottomFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[
              styles.importCtaBtn,
              selectedCount === 0 && styles.importCtaBtnDisabled,
            ]}
            disabled={selectedCount === 0}
            activeOpacity={0.85}
            onPress={handleImportClick}
          >
            <Sparkles size={17} color="#0F1015" />
            <AppText style={styles.importCtaText}>
              IMPORT {selectedCount} TRANSACTION{selectedCount !== 1 ? 'S' : ''} ({sym}{selectedTotal.toLocaleString('en-IN')})
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
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
    paddingVertical: 6,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3F50',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  bankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bankBadgeText: {
    color: expenseColors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  periodText: {
    color: expenseColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#232633',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  summaryCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    padding: 16,
    marginBottom: 14,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    color: expenseColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#2A2E3D',
  },
  reconciliationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  reconciledSuccess: {
    backgroundColor: 'rgba(92, 225, 142, 0.12)',
  },
  reconciledWarning: {
    backgroundColor: 'rgba(255, 184, 77, 0.12)',
  },
  reconciledSuccessText: {
    color: expenseColors.accentGreen,
    fontSize: 11,
    fontWeight: '700',
  },
  reconciledWarningText: {
    color: '#FFB84D',
    fontSize: 11,
    fontWeight: '700',
  },
  accountTabsContainer: {
    marginBottom: 12,
  },
  accountTabsScroll: {
    gap: 8,
  },
  accountTabPill: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  accountTabPillActive: {
    backgroundColor: '#FF9D66',
    borderColor: '#FF9D66',
  },
  accountTabPillText: {
    color: expenseColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  accountTabPillTextActive: {
    color: '#0F1015',
    fontWeight: '800',
  },
  duplicateNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(92, 225, 142, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(92, 225, 142, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  duplicateNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  duplicateNoticeText: {
    color: expenseColors.accentGreen,
    fontSize: 11,
    fontWeight: '700',
  },
  searchActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: expenseColors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: expenseColors.textPrimary,
    fontSize: 12,
    padding: 0,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  selectAllBtnText: {
    color: expenseColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  txListContainer: {
    gap: 8,
  },
  txItemWrapper: {},
  txItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: expenseColors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    padding: 12,
  },
  txItemRowDeselected: {
    opacity: 0.4,
  },
  txItemRowDuplicate: {
    borderColor: 'rgba(255, 157, 102, 0.3)',
  },
  checkboxWrapper: {
    marginRight: 10,
  },
  catIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  txMiddle: {
    flex: 1,
    marginRight: 8,
  },
  txNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  txNarration: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  duplicateTag: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  duplicateTagText: {
    color: '#FF9D66',
    fontSize: 9,
    fontWeight: '800',
  },
  txSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  txDateText: {
    color: expenseColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  txDotText: {
    color: expenseColors.textMuted,
    fontSize: 10,
  },
  txAccountText: {
    color: expenseColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  interactiveCatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  interactiveCatText: {
    fontSize: 9,
    fontWeight: '800',
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    color: expenseColors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  txBalanceText: {
    color: expenseColors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  bottomFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 16, 21, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#232633',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  importCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9D66',
    borderRadius: 16,
    paddingVertical: 14,
  },
  importCtaBtnDisabled: {
    opacity: 0.5,
  },
  importCtaText: {
    color: '#0F1015',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
