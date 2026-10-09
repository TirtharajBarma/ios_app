import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager, PanResponder, Easing } from 'react-native';
import { Zap, ArrowLeftRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore, monthKeyToYearMonth } from '@/store/useExpenseStore';
import { useShallow } from 'zustand/react/shallow';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseCategory } from '@/types/expense';
import { CategoryIcon } from './CategoryIcon';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const customSpringLayout = {
  duration: 250,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.spring,
    springDamping: 0.76,
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
    categoryBudgets,
    savingsVaults,
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
      categoryBudgets: s.categoryBudgets,
      savingsVaults: s.savingsVaults,
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
  const [heroMode, setHeroMode] = useState<'budget' | 'total_balance'>('budget');
  const isBudgetMode = heroMode === 'budget';

  // Left column entrance. Once per mount, never re-armed by a store flag.
  const balanceAnim = useRef(new Animated.Value(0)).current;
  const chipFadeAnim = useRef(new Animated.Value(0)).current;
  const heroFlipAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current; // 0 = budget, 1 = total_balance

  // Per-category entrance values, keyed by category id.
  const arcAnimMap = useRef(new Map<string, Animated.Value>()).current;
  const knownArcIds = useRef(new Set<string>());
  const hasRunArcEntrance = useRef(false);

  // Derive Effective Budget (fallback to sum of category budgets if monthlyBudget === 0)
  const totalAllocatedCategoryBudget = Object.values(categoryBudgets || {}).reduce(
    (sum, val) => sum + (val > 0 ? val : 0),
    0
  );
  const effectiveBudget = monthlyBudget > 0 ? monthlyBudget : totalAllocatedCategoryBudget;

  const now = new Date();
  const { year: selYear, month: selMonth } = monthKeyToYearMonth(selectedMonth);
  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth();
  const isPastMonth = selYear < now.getFullYear() || (selYear === now.getFullYear() && selMonth < now.getMonth());

  const totalBalance = getTotalBalance(selectedMonth);
  const totalSpent = getTotalSpent();
  const remainingBudget = getRemainingBudget();
  const breakdown = getCategoryBreakdown();

  // Active accounts breakdown for transparent net balance explanation
  const bankCash = accounts
    .filter((a) => a.type !== 'credit' && !a.isArchived)
    .reduce((sum, a) => sum + (a.balance || 0), 0);
  const cardDues = accounts
    .filter((a) => a.type === 'credit' && !a.isArchived)
    .reduce((sum, a) => sum + (a.dueAmount || 0), 0);

  // ── HERO SWITCH SPEED CONTROLS ───────────────────────────────────────────
  // Adjust `tension` (higher = faster) and `friction` (lower = bouncier) below.
  const HERO_SPRING_TENSION = 280; // Try 200 (medium) -> 350 (ultra fast)
  const HERO_SPRING_FRICTION = 18; // Try 14 (bouncier) -> 22 (tighter)

  const switchHeroMode = (targetMode: 'budget' | 'total_balance') => {
    if (targetMode === heroMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Instant state swap on the exact same frame (zero lag)
    setHeroMode(targetMode);

    // Micro-spring transition
    heroFlipAnim.setValue(0.5);
    Animated.parallel([
      Animated.spring(heroFlipAnim, {
        toValue: 1,
        tension: HERO_SPRING_TENSION,
        friction: HERO_SPRING_FRICTION,
        useNativeDriver: true,
      }),
      Animated.spring(dotAnim, {
        toValue: targetMode === 'budget' ? 0 : 1,
        tension: HERO_SPRING_TENSION,
        friction: HERO_SPRING_FRICTION,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const toggleHeroMode = () => {
    const nextMode = heroMode === 'budget' ? 'total_balance' : 'budget';
    switchHeroMode(nextMode);
  };

  // Smooth swipe gestures on hero
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -25) {
          switchHeroMode('total_balance');
        } else if (gestureState.dx > 25) {
          switchHeroMode('budget');
        }
      },
    })
  ).current;

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

  for (const item of arcItems) {
    if (!arcAnimMap.has(item.category.id)) {
      arcAnimMap.set(item.category.id, new Animated.Value(0));
    }
  }

  useEffect(() => {
    const isFirstRun = !hasRunArcEntrance.current;
    hasRunArcEntrance.current = true;

    const enteringIds = arcItems
      .map((item) => item.category.id)
      .filter((id) => !knownArcIds.current.has(id));
    knownArcIds.current = new Set(arcItems.map((item) => item.category.id));

    if (enteringIds.length === 0) return;

    if (!isFirstRun) {
      enteringIds.forEach((id) => arcAnimMap.get(id)?.setValue(0));
    }

    Animated.parallel(
      enteringIds.map((id, i) =>
        Animated.spring(arcAnimMap.get(id) as Animated.Value, {
          toValue: 1,
          tension: 140,
          friction: 10,
          delay: isFirstRun ? i * 20 : 0,
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
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(chipFadeAnim, {
        toValue: 1,
        duration: 180,
        delay: 60,
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
    chipFadeAnim.setValue(0.65);
    Animated.spring(chipFadeAnim, {
      toValue: 1,
      tension: 180,
      friction: 12,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      {/* Left Column: Date, Interactive Hero (Safe to Spend ⇄ Total Balance), Category Highlight */}
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
                  outputRange: [6, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* Clean, Uniform Month Label */}
        <AppText style={styles.monthLabel}>
          {(selectedMonth || '').toUpperCase()}
        </AppText>

        {/* Primary Focus: Tap / Swipe Hero (Safe to Spend ⇄ Total Balance) */}
        <View {...panResponder.panHandlers}>
          <TouchableOpacity
            style={styles.balanceSection}
            onPress={toggleHeroMode}
            activeOpacity={0.8}
          >
            <Animated.View
              style={{
                opacity: heroFlipAnim,
                transform: [
                  {
                    translateY: heroFlipAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [5, 0],
                    }),
                  },
                ],
              }}
            >
              <AppText style={styles.balanceTitle}>
                {isBudgetMode
                  ? effectiveBudget > 0
                    ? remainingBudget < 0
                      ? 'Over budget'
                      : isPastMonth
                      ? 'Saved / Unspent'
                      : 'Safe to spend'
                    : 'Total spent'
                  : isCurrentMonth
                  ? 'Total balance'
                  : 'Balance at month end'}
              </AppText>

              <AppText
                numberOfLines={1}
                style={[
                  styles.balanceAmount,
                  isBudgetMode && effectiveBudget > 0 && remainingBudget < 0 && styles.negativeAmount,
                  !isBudgetMode && totalBalance < 0 && styles.negativeAmount,
                ]}
              >
                {isBudgetMode
                  ? effectiveBudget > 0
                    ? remainingBudget < 0
                      ? formatAmount(Math.abs(remainingBudget))
                      : formatAmount(remainingBudget)
                    : formatAmount(totalSpent)
                  : formatAmount(totalBalance)}
              </AppText>

              {/* Symmetrical Context Badges Row (Same height, zero jump) */}
              <View style={styles.chipsRowContainer}>
                {isBudgetMode ? (
                  <View style={styles.accountChipsRow}>
                    <View style={styles.accountChip}>
                      <AppText style={styles.accountChipLabel}>Budget </AppText>
                      <AppText style={styles.accountChipVal}>
                        {effectiveBudget > 0 ? formatAmount(effectiveBudget) : 'No limit'}
                      </AppText>
                    </View>
                    <View style={styles.accountChip}>
                      <AppText style={styles.accountChipLabel}>Spent </AppText>
                      <AppText style={styles.accountChipVal}>{formatAmount(totalSpent)}</AppText>
                    </View>
                  </View>
                ) : (
                  <View style={styles.accountChipsRow}>
                    <View style={styles.accountChip}>
                      <AppText style={styles.accountChipLabel}>Bank </AppText>
                      <AppText style={styles.accountChipVal}>{formatAmount(bankCash)}</AppText>
                    </View>
                    {cardDues > 0 && (
                      <View style={[styles.accountChip, styles.accountChipDue]}>
                        <AppText style={styles.accountChipDueLabel}>Bills </AppText>
                        <AppText style={styles.accountChipDueVal}>{formatAmount(cardDues)}</AppText>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </Animated.View>
          </TouchableOpacity>

          {/* Interactive Pagination Indicator Dots */}
          <View style={styles.dotsRow}>
            <TouchableOpacity
              style={styles.dotTouch}
              onPress={() => switchHeroMode('budget')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Animated.View
                style={[
                  styles.dot,
                  {
                    width: dotAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 5],
                    }),
                    backgroundColor: dotAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['#FFFFFF', 'rgba(255, 255, 255, 0.25)'],
                    }),
                  },
                ]}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dotTouch}
              onPress={() => switchHeroMode('total_balance')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            >
              <Animated.View
                style={[
                  styles.dot,
                  {
                    width: dotAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [5, 16],
                    }),
                    backgroundColor: dotAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['rgba(255, 255, 255, 0.25)', '#FFFFFF'],
                    }),
                  },
                ]}
              />
            </TouchableOpacity>
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

      {/* Right Column: Dynamic Floating Overlapping Category Arc (Preserved!) */}
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
    marginTop: 45,
    marginBottom: 45,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 12,
    justifyContent: 'center',
  },
  monthLabel: {
    color: '#8E95A5',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  balanceSection: {
    marginBottom: 0,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  balanceTitle: {
    color: '#8E95A5',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0,
    marginBottom: 4,
  },
  balanceAmount: {
    color: expenseColors.textPrimary,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  negativeAmount: {
    color: '#FF6B6B',
  },
  chipsRowContainer: {
    minHeight: 28,
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    marginBottom: 0,
  },
  dotTouch: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 4.5,
    borderRadius: 2.5,
  },
  accountChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  accountChipLabel: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '500',
  },
  accountChipVal: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  accountChipDue: {
    backgroundColor: 'rgba(244, 139, 139, 0.1)',
  },
  accountChipDueLabel: {
    color: '#F48B8B',
    fontSize: 12,
    fontWeight: '500',
  },
  accountChipDueVal: {
    color: '#F48B8B',
    fontSize: 12,
    fontWeight: '700',
  },
  accountChipVault: {
    backgroundColor: 'rgba(169, 223, 191, 0.1)',
  },
  accountChipVaultLabel: {
    color: '#A9DFBF',
    fontSize: 12,
    fontWeight: '500',
  },
  accountChipVaultVal: {
    color: '#A9DFBF',
    fontSize: 12,
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
    flexShrink: 1,
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
