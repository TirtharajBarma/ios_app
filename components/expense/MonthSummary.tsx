import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useShallow } from 'zustand/react/shallow';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseCategory } from '@/types/expense';
import { CategoryIcon } from './CategoryIcon';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const customSpringLayout = {
  duration: 320,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.spring,
    springDamping: 0.72,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

interface MonthSummaryProps {
  onCategorySelect?: (categoryId: string) => void;
}

export const MonthSummary: React.FC<MonthSummaryProps> = ({ onCategorySelect }) => {
  const {
  selectedMonth,
  currencySymbol,
  monthlyBudget,
  getTotalBalance,
  getTotalSpent,
  getRemainingBudget,
  getCategoryBreakdown,
  accounts,
  transactions,
  formatAmount,
} = useExpenseStore(
  useShallow((s) => ({
    selectedMonth: s.selectedMonth,
    currencySymbol: s.currencySymbol,
    monthlyBudget: s.monthlyBudget,
    getTotalBalance: s.getTotalBalance,
    getTotalSpent: s.getTotalSpent,
    getRemainingBudget: s.getRemainingBudget,
    getCategoryBreakdown: s.getCategoryBreakdown,
    accounts: s.accounts,
    transactions: s.transactions,
    formatAmount: s.formatAmount,
  }))
);

  const sym = currencySymbol || '₹';
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // Left column entrance. Once per mount, never re-armed by a store flag.
  const balanceAnim = useRef(new Animated.Value(0)).current;
  const chipFadeAnim = useRef(new Animated.Value(0)).current;

  // Per-category entrance values, keyed by category id.
  //
  // This used to be a positional array indexed by render order, while
  // `categoriesWithSpend` is sorted by amount descending. Adding a transaction
  // therefore reshuffled which category sat at each index, and any value created
  // after the entrance effect had already run was left at 0 forever — invisible.
  // Keying by id means a value belongs to its category for the component's
  // lifetime, and the effect below can animate in exactly the ones that are new.
  const arcAnimMap = useRef(new Map<string, Animated.Value>()).current;
  const knownArcIds = useRef(new Set<string>());
  const hasRunArcEntrance = useRef(false);

  const totalBalance = getTotalBalance();
  const totalSpent = getTotalSpent();
  const remainingBudget = getRemainingBudget();
  const breakdown = getCategoryBreakdown();

  // Active accounts breakdown for transparent net balance explanation
  const bankCash = accounts
    .filter((a) => a.type !== 'credit' && !a.isArchived)
    .reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  const cardDues = accounts
    .filter((a) => a.type === 'credit' && !a.isArchived)
    .reduce((sum, a) => sum + (a.dueAmount || 0), 0);

  // ── Predictive Runway Algorithm ──
  const now = new Date();
  const currentDay = Math.max(now.getDate(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(daysInMonth - currentDay, 1);
  const safeDailyAllowance = remainingBudget > 0 ? Math.round(remainingBudget / remainingDays) : 0;

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
    arcItems = categoriesWithSpend;
  }

  // Active category: user selection or the top category by default
  const currentCategoryInfo =
    (selectedCatId ? arcItems.find((c) => c.category.id === selectedCatId) : null) ||
    (arcItems.length > 0 ? arcItems[0] : null);

  const currentSelectedId = currentCategoryInfo?.category.id || null;
  const totalArcCount = arcItems.length;

  // Idempotent cache fill so the very first paint already has a value bound to
  // every arc. Mutating a ref here is safe because it is keyed by a stable id
  // and only ever adds — unlike the positional array it replaces, it can never
  // hand a category someone else's animation value.
  for (const item of arcItems) {
    if (!arcAnimMap.has(item.category.id)) {
      arcAnimMap.set(item.category.id, new Animated.Value(0));
    }
  }

  useEffect(() => {
    const isFirstRun = !hasRunArcEntrance.current;
    hasRunArcEntrance.current = true;

    // Animate only the arcs that are new since the previous run. On mount that
    // is every arc (the staggered cascade); afterwards it is just a category
    // that has newly appeared because a transaction was added to it.
    const enteringIds = arcItems
      .map((item) => item.category.id)
      .filter((id) => !knownArcIds.current.has(id));
    knownArcIds.current = new Set(arcItems.map((item) => item.category.id));

    if (enteringIds.length === 0) return;

    if (!isFirstRun) {
      // A category that dropped out of the breakdown and came back is already
      // sitting at 1, so rewind it to replay the entrance.
      enteringIds.forEach((id) => arcAnimMap.get(id)?.setValue(0));
    }

    Animated.parallel(
      enteringIds.map((id, i) =>
        Animated.spring(arcAnimMap.get(id) as Animated.Value, {
          toValue: 1,
          tension: 55,
          friction: 7,
          delay: isFirstRun ? i * 45 : 0,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [arcItems]);

  useEffect(() => {
    // Left balance entrance on app load
    balanceAnim.setValue(0);
    chipFadeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(balanceAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(chipFadeAnim, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Center alignment along the smooth arc curve
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
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(customSpringLayout);
    setSelectedCatId(catId);
    onCategorySelect?.(catId);

    // Quick chip bump
    chipFadeAnim.setValue(0.3);
    Animated.spring(chipFadeAnim, {
      toValue: 1,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      {/* Left Column: Date, Total Liquid Balance, Budget Runway, Category Highlight */}
      <Animated.View
        style={[
          styles.leftColumn,
          arcItems.length === 0 && { paddingRight: 0 },
          {
            opacity: balanceAnim,
            transform: [
              {
                translateY: balanceAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* Month Label */}
        <AppText style={styles.monthLabel}>{selectedMonth}</AppText>

        {/* Primary Focus: Total Net Balance Across Accounts */}
        <View style={styles.balanceSection}>
          <AppText style={styles.balanceTitle}>TOTAL BALANCE</AppText>

          <AppText
            style={styles.balanceAmount}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
          >
            {formatAmount(totalBalance)}
          </AppText>

          {/* Clean, separated breakdown badges */}
          <View style={styles.accountChipsRow}>
            <View style={styles.accountChip}>
              <AppText style={styles.accountChipLabel}>Bank </AppText>
              <AppText style={styles.accountChipVal}>{formatAmount(bankCash)}</AppText>
            </View>
            {cardDues > 0 ? (
              <View style={[styles.accountChip, styles.accountChipDue]}>
                <AppText style={styles.accountChipDueLabel}>Bills </AppText>
                <AppText style={styles.accountChipDueVal}>{formatAmount(cardDues)}</AppText>
              </View>
            ) : null}
          </View>
        </View>

        {/* Selected Category Highlight Chip */}
        {currentCategoryInfo && currentCategoryInfo.amount > 0 ? (
          <Animated.View
            style={[
              styles.categoryChip,
              {
                borderColor: `${currentCategoryInfo.category.color}44`,
                opacity: chipFadeAnim,
                transform: [
                  {
                    scale: chipFadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: currentCategoryInfo.category.color },
              ]}
            />
            <AppText style={styles.categoryChipName} numberOfLines={1}>
              {currentCategoryInfo.category.name}
            </AppText>
            <AppText style={styles.categoryChipAmount}>
              {formatAmount(currentCategoryInfo.amount)}
            </AppText>
            <AppText style={styles.categoryChipPct}>
              ({currentCategoryInfo.percentage}%)
            </AppText>
          </Animated.View>
        ) : null}
      </Animated.View>

      {/* Right Column: Dynamic Floating Overlapping Category Arc */}
      {arcItems.length > 0 && (
        <View style={styles.floatingMenuContainer}>
          {arcItems.map((item, index) => {
            const isSelected = currentSelectedId === item.category.id;
            const marginRight = getArcMarginRight(index, totalArcCount, isSelected);
            const isFilled =
              item.category.id === 'cat_cig' ||
              item.category.iconName === 'Star' ||
              item.category.iconName === 'Heart';

            const anim = arcAnimMap.get(item.category.id) as Animated.Value;

            return (
              <Animated.View
                key={item.category.id}
                style={{
                  opacity: anim,
                  transform: [
                    {
                      scale: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.35, 1],
                      }),
                    },
                    {
                      translateX: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    },
                  ],
                }}
              >
                <TouchableOpacity
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
              </Animated.View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 32,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 12,
    justifyContent: 'center',
  },
  monthLabel: {
    color: '#9CA3AF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  balanceSection: {
    marginBottom: 14,
  },
  balanceTitle: {
    color: '#8E95A5',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  balanceAmount: {
    color: expenseColors.textPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  accountChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  accountChipLabel: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
  },
  accountChipVal: {
    color: '#E1E4EA',
    fontSize: 11,
    fontWeight: '700',
  },
  accountChipDue: {
    backgroundColor: 'rgba(244, 139, 139, 0.08)',
    borderColor: 'rgba(244, 139, 139, 0.18)',
  },
  accountChipDueLabel: {
    color: '#F48B8B',
    fontSize: 11,
    fontWeight: '600',
  },
  accountChipDueVal: {
    color: '#F48B8B',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryChipName: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipAmount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChipPct: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '500',
  },
  floatingMenuContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    width: 96,
  },
  selectedMenuCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#101114',
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
    borderColor: '#101114',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
