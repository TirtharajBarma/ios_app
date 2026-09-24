import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
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
    hasInitialAppLoaded,
    setHasInitialAppLoaded,
  } = useExpenseStore();

  const sym = currencySymbol || '₹';
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // Animated values for left balance and right arc staggered cascade
  const balanceAnim = useRef(new Animated.Value(hasInitialAppLoaded ? 1 : 0)).current;
  const chipFadeAnim = useRef(new Animated.Value(hasInitialAppLoaded ? 1 : 0)).current;
  const arcAnimValues = useRef<Animated.Value[]>([]).current;

  const totalBalance = getTotalBalance();
  const totalSpent = getTotalSpent();
  const remainingBudget = getRemainingBudget();
  const breakdown = getCategoryBreakdown();

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
    const candidates = [...categoriesWithSpend, ...categoriesZeroSpend];
    arcItems = candidates.slice(0, 6);
  }

  // Active category: user selection or the top category by default
  const currentCategoryInfo =
    (selectedCatId ? arcItems.find((c) => c.category.id === selectedCatId) : null) ||
    arcItems[0] ||
    null;

  const currentSelectedId = currentCategoryInfo?.category.id || null;
  const totalArcCount = arcItems.length;

  // Ensure arcAnimValues has enough animated values
  while (arcAnimValues.length < totalArcCount) {
    arcAnimValues.push(new Animated.Value(hasInitialAppLoaded ? 1 : 0));
  }

  useEffect(() => {
    if (hasInitialAppLoaded) {
      balanceAnim.setValue(1);
      chipFadeAnim.setValue(1);
      arcAnimValues.forEach((anim) => anim.setValue(1));
      return;
    }

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

    // Staggered arc cascade animation on app load
    arcAnimValues.forEach((anim) => anim.setValue(0));
    const animations = arcAnimValues.slice(0, totalArcCount).map((anim, i) => {
      return Animated.spring(anim, {
        toValue: 1,
        tension: 55,
        friction: 7,
        delay: i * 45,
        useNativeDriver: true,
      });
    });

    Animated.parallel(animations).start(() => {
      setHasInitialAppLoaded(true);
    });
  }, [hasInitialAppLoaded, totalArcCount]);

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

        {/* Primary Focus: Total Liquid Wealth Across Accounts */}
        <View style={styles.balanceSection}>
          <AppText style={styles.balanceTitle}>TOTAL BALANCE</AppText>

          <AppText style={styles.balanceAmount} numberOfLines={1}>
            {sym}{totalBalance.toLocaleString('en-IN')}
          </AppText>

          {/* Budget Allowance Subtext */}
          {monthlyBudget > 0 && (
            <View style={styles.budgetRow}>
              <View style={styles.paceBadge} />
              <AppText style={styles.budgetSub}>
                {sym}{remainingBudget.toLocaleString('en-IN')} budget left
              </AppText>
            </View>
          )}
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
              {currentCategoryInfo.category.name} {currentCategoryInfo.category.emoji || ''}
            </AppText>
            <AppText style={styles.categoryChipAmount}>
              {sym}{currentCategoryInfo.amount.toLocaleString('en-IN')}
            </AppText>
            <AppText style={styles.categoryChipPct}>
              ({currentCategoryInfo.percentage}%)
            </AppText>
          </Animated.View>
        ) : null}
      </Animated.View>

      {/* Right Column: Dynamic Floating Overlapping Category Arc */}
      <View style={styles.floatingMenuContainer}>
        {arcItems.map((item, index) => {
          const isSelected = currentSelectedId === item.category.id;
          const marginRight = getArcMarginRight(index, totalArcCount, isSelected);
          const isFilled =
            item.category.id === 'cat_cig' ||
            item.category.iconName === 'Star' ||
            item.category.iconName === 'Heart';

          const anim = arcAnimValues[index] || new Animated.Value(1);

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
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  paceBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paceBadgeText: {
    color: '#34D399',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  budgetSub: {
    color: '#707587',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
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
