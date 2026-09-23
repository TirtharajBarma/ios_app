import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseCategory } from '@/types/expense';
import { CategoryIcon } from './CategoryIcon';

interface MonthSummaryProps {
  onCategorySelect?: (categoryId: string) => void;
}

export const MonthSummary: React.FC<MonthSummaryProps> = ({ onCategorySelect }) => {
  const {
    selectedMonth,
    categories,
    transactions,
    getTotalBalance,
    getNetBalance,
    getCategoryBreakdown,
  } = useExpenseStore();

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  const totalBalance = getTotalBalance();
  const netBalance = getNetBalance();
  const breakdown = getCategoryBreakdown();

  // Filter categories excluding income, prioritizing categories with spend sorted descending
  const categoriesWithSpend = breakdown
    .filter((item) => item.category.id !== 'cat_income' && item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const categoriesZeroSpend = breakdown
    .filter((item) => item.category.id !== 'cat_income' && item.amount === 0);

  // If more than 6 active categories, show Top 5 + Aggregated "OTHER (N)" 6th item
  let arcItems: Array<{
    category: ExpenseCategory;
    amount: number;
    percentage: number;
  }> = [];

  if (categoriesWithSpend.length > 6) {
    const top5 = categoriesWithSpend.slice(0, 5);
    const rest = categoriesWithSpend.slice(5);
    const otherAmount = rest.reduce((sum, item) => sum + item.amount, 0);
    const otherPercentage = Number(rest.reduce((sum, item) => sum + item.percentage, 0).toFixed(1));
    const otherCategory: ExpenseCategory = {
      id: 'cat_other_aggregate',
      name: `OTHER (${rest.length})`,
      emoji: '⋯',
      color: '#8E95A5',
      iconName: 'MoreHorizontal',
    };
    arcItems = [
      ...top5,
      {
        category: otherCategory,
        amount: otherAmount,
        percentage: otherPercentage,
      },
    ];
  } else {
    // 6 or fewer categories with spend: display all active, backfill with zero-spend if < 6
    const candidates = [...categoriesWithSpend, ...categoriesZeroSpend];
    arcItems = candidates.slice(0, 6);
  }

  // Active category: user selection or the top category by default
  const currentCategoryInfo =
    (selectedCatId ? arcItems.find((c) => c.category.id === selectedCatId) : null) ||
    arcItems[0] ||
    null;

  const currentSelectedId = currentCategoryInfo?.category.id || null;

  const formattedBalance = `\u20B9${totalBalance.toLocaleString('en-IN')}`;
  const isNetNegative = netBalance < 0;
  const formattedNet = `${isNetNegative ? '-' : '+'}\u20B9${Math.abs(netBalance).toLocaleString('en-IN')}`;

  const totalArcCount = arcItems.length;

  // Center alignment along the smooth arc curve (bowing outward towards right edge at middle)
  const getArcMarginRight = (index: number, total: number, isSelected: boolean) => {
    if (total <= 1) return isSelected ? 2 : 8;
    const t = index / (total - 1);
    const apexOffset = 2; // distance from right edge at middle
    const curveDepth = 24; // inward curvature depth for top & bottom ends
    const inwardAmount = (1 - Math.sin(t * Math.PI)) * curveDepth;
    const centerDistFromRight = apexOffset + inwardAmount + 20;
    const diameter = isSelected ? 56 : 40;
    return Math.max(0, Math.round(centerDistFromRight - diameter / 2));
  };

  const handleCategoryPress = (catId: string) => {
    setSelectedCatId(catId);
    onCategorySelect?.(catId);
  };

  return (
    <View style={styles.container}>
      {/* Left Column: Date, Balance, Net, Category Highlight */}
      <View style={styles.leftColumn}>
        {/* Month Label */}
        <AppText style={styles.monthLabel}>{selectedMonth}</AppText>

        {/* Total Balance */}
        <View style={styles.balanceSection}>
          <AppText style={styles.balanceTitle}>Total balance</AppText>
          <AppText style={styles.balanceAmount} numberOfLines={1}>
            {formattedBalance}
          </AppText>
        </View>

        {/* Net Badge */}
        <View style={styles.netPill}>
          <AppText style={styles.netLabel}>Net </AppText>
          <AppText style={styles.netValue}>
            {formattedNet}
          </AppText>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Selected or Top Category Highlight */}
        {currentCategoryInfo ? (
          <View style={styles.topCategorySection}>
            <View style={styles.topCategoryHeader}>
              <View
                style={[
                  styles.categoryDot,
                  { backgroundColor: currentCategoryInfo.category.color },
                ]}
              />
              <AppText style={styles.topCategoryName}>
                {currentCategoryInfo.category.name.toUpperCase()}{' '}
                {currentCategoryInfo.category.emoji || ''}
              </AppText>
            </View>

            <View style={styles.topCategoryValues}>
              <AppText style={styles.topCategoryAmount}>
                {`\u20B9${currentCategoryInfo.amount.toLocaleString('en-IN')}`}
              </AppText>
              <AppText style={styles.topCategoryPercentage}>
                {`${currentCategoryInfo.percentage}%`}
              </AppText>
            </View>
          </View>
        ) : (
          <View style={styles.topCategorySection}>
            <View style={styles.topCategoryHeader}>
              <View style={[styles.categoryDot, { backgroundColor: expenseColors.textMuted }]} />
              <AppText style={styles.topCategoryName}>NO EXPENSES</AppText>
            </View>
            <View style={styles.topCategoryValues}>
              <AppText style={styles.topCategoryAmount}>{`\u20B90`}</AppText>
              <AppText style={styles.topCategoryPercentage}>0%</AppText>
            </View>
          </View>
        )}
      </View>

      {/* Right Column: Dynamic Floating Overlapping Category Arc */}
      <View style={styles.floatingMenuContainer}>
        {arcItems.map((item, index) => {
          const isSelected = currentSelectedId === item.category.id;
          const marginRight = getArcMarginRight(index, totalArcCount, isSelected);
          const isFilled =
            item.category.id === 'cat_cig' ||
            item.category.iconName === 'Star' ||
            item.category.iconName === 'Heart';

          return (
            <TouchableOpacity
              key={item.category.id}
              style={[
                isSelected
                  ? [
                      styles.selectedMenuCircle,
                      {
                        backgroundColor: item.category.color,
                        marginRight,
                        shadowColor: item.category.color,
                        marginTop: index === 0 ? 0 : -6,
                        zIndex: 30,
                      },
                    ]
                  : [
                      styles.menuCircle,
                      {
                        marginRight,
                        marginTop: index === 0 ? 0 : -6,
                        zIndex: 10 - index,
                      },
                    ],
              ]}
              activeOpacity={0.8}
              onPress={() => handleCategoryPress(item.category.id)}
            >
              <CategoryIcon
                category={item.category}
                size={isSelected ? 26 : 18}
                color={isSelected ? '#0F1015' : item.category.color}
                strokeWidth={isSelected ? 2.5 : 2}
                fill={isFilled}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 36,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 12,
    justifyContent: 'center',
  },
  monthLabel: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 14,
  },
  balanceSection: {
    marginBottom: 8,
  },
  balanceTitle: {
    color: expenseColors.textSubtle,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceAmount: {
    color: expenseColors.textPrimary,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  netPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#1C1F2A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 12,
    marginBottom: 20,
  },
  netLabel: {
    color: expenseColors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  netValue: {
    color: expenseColors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    width: 140,
    marginBottom: 20,
  },
  topCategorySection: {
    gap: 6,
  },
  topCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topCategoryName: {
    color: expenseColors.textSecondary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  topCategoryValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  topCategoryAmount: {
    color: expenseColors.textPrimary,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
  },
  topCategoryPercentage: {
    color: expenseColors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  floatingMenuContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 6,
    width: 92,
  },
  selectedMenuCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#12141C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  menuCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#202430',
    borderWidth: 2,
    borderColor: '#12141C',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
