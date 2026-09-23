import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Car,
  ShoppingBag,
  UtensilsCrossed,
  Tv,
  MoreHorizontal,
  Star,
  CheckCircle2,
  Circle,
  Coins,
  Zap,
  Heart,
  Banknote,
  Trash2,
} from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { FixedBottomNav } from './FixedBottomNav';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseTransaction, ExpenseCategory } from '@/types/expense';
import { CategoryIcon, getCategoryBgColor } from './CategoryIcon';

export const ExpenseLedger: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    accounts,
    categories,
    activeAccountFilter,
    smartSearchQuery,
    selectedTransactionIds,
    setActiveAccountFilter,
    setSmartSearchQuery,
    getFilteredTransactions,
    toggleSelectTransaction,
    clearSelectedTransactions,
    selectAllTransactions,
    removeTransactions,
  } = useExpenseStore();

  const [isSelectMode, setIsSelectMode] = useState(false);

  const filteredTxs = getFilteredTransactions();

  // Group transactions by date
  const groupedTransactions: Record<string, ExpenseTransaction[]> = {};
  filteredTxs.forEach((tx) => {
    // Format date string for heading: e.g. "SEPTEMBER 22, 2026"
    const dateObj = new Date(tx.date);
    const dateHeading = dateObj
      .toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
      .toUpperCase();

    if (!groupedTransactions[dateHeading]) {
      groupedTransactions[dateHeading] = [];
    }
    groupedTransactions[dateHeading].push(tx);
  });

  const getCategoryObj = (catId: string) => {
    return categories.find((c) => c.id === catId) || categories[0];
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

        {/* Smart Search Card */}
        <View style={styles.smartSearchCard}>
          <AppText style={styles.smartSearchHeading}>✨ SMART SEARCH</AppText>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder='"How much did I spend at Amazon in Decemb...'
              placeholderTextColor={expenseColors.textMuted}
              value={smartSearchQuery}
              onChangeText={setSmartSearchQuery}
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Account Filters Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContainer}
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
                onPress={() => setActiveAccountFilter(filterName)}
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

        {/* Transaction Date Groups */}
        {Object.keys(groupedTransactions).length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <AppText style={styles.emptyStateTitle}>No transactions found</AppText>
            <AppText style={styles.emptyStateSubtitle}>
              Try adjusting your query or account filter.
            </AppText>
          </View>
        ) : (
          Object.entries(groupedTransactions).map(([dateHeading, txs]) => (
            <View key={dateHeading} style={styles.dateGroupContainer}>
              {/* Date Heading */}
              <AppText style={styles.dateHeadingText}>{dateHeading}</AppText>

              {/* Group Card */}
              <View style={styles.groupCard}>
                {txs.map((tx, idx) => {
                  const cat = getCategoryObj(tx.categoryId);
                  const isSelected = selectedTransactionIds.includes(tx.id);
                  const formattedDate = new Date(tx.date).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                  });
                  const isExpense = tx.type === 'expense';
                  const amountDisplay = `${isExpense ? '-' : '+'}\u20B9${tx.amount}`;

                  return (
                    <TouchableOpacity
                      key={tx.id}
                      style={[
                        styles.transactionRow,
                        idx < txs.length - 1 && styles.rowDivider,
                      ]}
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

                      {/* Left: Category Icon Circle */}
                      <View
                        style={[
                          styles.categoryIconCircle,
                          { backgroundColor: cat.color },
                        ]}
                      >
                        {renderCategoryIcon(cat)}
                      </View>

                      {/* Center: Title & Subtitle Badge */}
                      <View style={styles.transactionCenter}>
                        <AppText style={styles.transactionTitle} numberOfLines={1}>
                          {tx.note || cat.name.toUpperCase()}
                        </AppText>
                        <View style={styles.badgeRow}>
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
                          <AppText style={styles.transactionDateText}>
                            {formattedDate}
                          </AppText>
                        </View>
                      </View>

                      {/* Right: Amount */}
                      <AppText
                        style={[
                          styles.transactionAmountText,
                          isExpense ? styles.expenseAmount : styles.incomeAmount,
                        ]}
                      >
                        {amountDisplay}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Fixed Bottom Navigation */}
      <FixedBottomNav activeTab="ledger" />
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
  },
  smartSearchHeading: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: '#22242F',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    color: expenseColors.textPrimary,
    fontSize: 14,
    padding: 0,
  },
  filterScrollContainer: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
  },
  filterPillInactive: {
    backgroundColor: '#22242F',
  },
  filterPillText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#0F1015',
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    gap: 8,
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
  transactionAmountText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    marginLeft: 12,
  },
  expenseAmount: {
    color: expenseColors.accentRed,
  },
  incomeAmount: {
    color: expenseColors.accentGreen,
  },
  emptyStateContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateTitle: {
    color: expenseColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 13,
  },
});
