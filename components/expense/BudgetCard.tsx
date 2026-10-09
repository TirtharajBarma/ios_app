import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useExpenseStore, monthKeyToYearMonth } from '@/store/useExpenseStore';
import { useShallow } from 'zustand/react/shallow';
import { expenseColors } from '@/constants/expenseColors';
import { formatCompactCurrency } from './MoneyFlowCard';

export const formatBudgetLegendAmount = (amount: number, symbol: string = '₹'): string => {
  return formatCompactCurrency(amount, symbol);
};

export const BudgetCard: React.FC = () => {
  const {
  monthlyBudget,
  currencySymbol,
  selectedMonth,
  getTotalSpent,
  getRemainingBudget,
  getCategoryBreakdown,
  categoryBudgets,
  transactions,
  categories,
} = useExpenseStore(
  useShallow((s) => ({
    monthlyBudget: s.monthlyBudget,
    currencySymbol: s.currencySymbol,
    selectedMonth: s.selectedMonth,
    getTotalSpent: s.getTotalSpent,
    getRemainingBudget: s.getRemainingBudget,
    getCategoryBreakdown: s.getCategoryBreakdown,
    categoryBudgets: s.categoryBudgets,
    transactions: s.transactions,
    categories: s.categories,
  }))
);

  const router = useRouter();
  const sym = currencySymbol || '₹';

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [sweepProgress, setSweepProgress] = useState<number>(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const chartProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initial chart sweep draw animation, once per mount.
    chartProgress.setValue(0);
    const listenerId = chartProgress.addListener(({ value }) => {
      setSweepProgress(value);
    });

    Animated.timing(chartProgress, {
      toValue: 1,
      duration: 850,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      chartProgress.removeListener(listenerId);
      setSweepProgress(1);
    });

    return () => {
      chartProgress.removeListener(listenerId);
    };
  }, []);

  useEffect(() => {
    // Smooth transition when selection changes
    fadeAnim.setValue(0);
    slideAnim.setValue(4);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [selectedCatId]);

  // Derive Effective Budget: if monthlyBudget > 0, use it.
  // If monthlyBudget === 0 but user configured category budgets, use their sum!
  const totalAllocatedCategoryBudget = Object.values(categoryBudgets || {}).reduce(
    (sum, val) => sum + (val > 0 ? val : 0),
    0
  );
  const effectiveBudget = monthlyBudget > 0 ? monthlyBudget : totalAllocatedCategoryBudget;

  const totalSpent = getTotalSpent();
  const breakdown = getCategoryBreakdown();

  // Scaled donut chart dimensions to match reference proportions
  const chartSize = 296;
  const center = chartSize / 2;
  const radius = 112;
  const strokeWidth = 30;
  const circumference = 2 * Math.PI * radius;

  // Inner ring dimensions
  const innerRadius = 78;
  const innerStrokeWidth = 4;
  const innerCircumference = 2 * Math.PI * innerRadius;

  // Active categories: either have spending > 0 OR have an active budget > 0 configured
  const activeBreakdown = breakdown
    .filter((item) => {
      const catBudget = categoryBudgets[item.category.id] || 0;
      return item.amount > 0 || catBudget > 0;
    })
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      const bBudget = categoryBudgets[b.category.id] || 0;
      const aBudget = categoryBudgets[a.category.id] || 0;
      return bBudget - aBudget;
    });
  const totalCategoriesSpent = activeBreakdown.reduce((sum, item) => sum + item.amount, 0);

  // Selected category info
  const selectedCategoryItem = selectedCatId
    ? activeBreakdown.find((item) => item.category.id === selectedCatId) || null
    : null;

  // Calculate arc offsets for category segments (only for categories with actual spending > 0)
  let cumulativeOffset = 0;
  const segments = activeBreakdown
    .filter((item) => item.amount > 0)
    .map((item) => {
      const percentage = totalCategoriesSpent > 0 ? item.amount / totalCategoriesSpent : 0;
      const strokeDashlength = percentage * circumference;
      const offset = cumulativeOffset;
      cumulativeOffset += strokeDashlength;
      return {
        ...item,
        strokeDashlength,
        offset,
        percentage,
      };
    });

  // Accurate Polar Angle Touch Handler
  const handleChartTouch = (evt: GestureResponderEvent) => {
    const { locationX, locationY } = evt.nativeEvent;
    const dx = locationX - center;
    const dy = locationY - center;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If tapped inside inner circle or on center text
    if (distance <= innerRadius - 2) {
      if (selectedCatId !== null) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setSelectedCatId(null);
      } else if (effectiveBudget <= 0) {
        Haptics.selectionAsync().catch(() => {});
        router.push('/settings/budget');
      }
      return;
    }

    // If outside donut ring bounds, ignore
    if (distance < innerRadius - 2 || distance > radius + strokeWidth / 2 + 16) {
      return;
    }

    // Angle in degrees (-180 to 180), where 0 is 3 o'clock
    const angleRad = Math.atan2(dy, dx);
    let angleDeg = (angleRad * 180) / Math.PI;
    // Normalize so 12 o'clock is 0 deg (clockwise 0 to 360)
    let normalizedAngle = (angleDeg + 90 + 360) % 360;

    let currentAngle = 0;
    for (const seg of segments) {
      const segSpanDeg = seg.percentage * 360;
      if (normalizedAngle >= currentAngle && normalizedAngle < currentAngle + segSpanDeg) {
        if (selectedCatId === seg.category.id) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setSelectedCatId(null);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          setSelectedCatId(seg.category.id);
        }
        return;
      }
      currentAngle += segSpanDeg;
    }
  };

  const handleSelectCategory = (catId: string) => {
    if (selectedCatId === catId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedCatId(null);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setSelectedCatId(catId);
    }
  };

  // ─────────────────────────────────────────────────────────
  // 1. INNER THIN GREEN PROGRESS RING (TRACKS EFFECTIVE BUDGET)
  // ─────────────────────────────────────────────────────────
  const overallBudgetRatio = effectiveBudget > 0 ? Math.min(totalSpent / effectiveBudget, 1) : 0;
  const overallBudgetDash = overallBudgetRatio * innerCircumference;

  // Dynamic Daily Safe Pace & Adaptive Split Burnout Forecasting
  const now = new Date();
  const { year: selYear, month: selMonth } = monthKeyToYearMonth(selectedMonth);
  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth();
  const isPastMonth = selYear < now.getFullYear() || (selYear === now.getFullYear() && selMonth < now.getMonth());
  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const currentDay = isCurrentMonth ? now.getDate() : isPastMonth ? daysInMonth : 0;
  const daysRemaining = isCurrentMonth ? Math.max(1, daysInMonth - currentDay + 1) : isPastMonth ? 0 : daysInMonth;

  // ─────────────────────────────────────────────────────────
  // 2. CENTER CONTENT DISPLAY
  // ─────────────────────────────────────────────────────────
  let centerTitle = isPastMonth ? 'UNSPENT / SAVED' : 'LEFT TO SPEND';
  let centerAmount = formatCompactCurrency(Math.max(0, effectiveBudget - totalSpent), sym);
  let centerFootnote = `${formatCompactCurrency(totalSpent, sym)} of ${formatCompactCurrency(effectiveBudget, sym)} used`;
  let isCenterOverBudget = false;

  const hasFixedBudget = selectedCategoryItem && categoryBudgets[selectedCategoryItem.category.id] !== undefined;
  const catBudget = selectedCategoryItem && hasFixedBudget ? (categoryBudgets[selectedCategoryItem.category.id] || 0) : 0;
  const catSpent = selectedCategoryItem ? selectedCategoryItem.amount : 0;

  if (selectedCategoryItem) {
    const catName = selectedCategoryItem.category.name;
    centerTitle = catName;

    if (hasFixedBudget && catBudget > 0) {
      const isCatOver = catSpent > catBudget;
      if (isCatOver) {
        centerAmount = formatCompactCurrency(catSpent - catBudget, sym);
        centerFootnote = `Over ${formatCompactCurrency(catBudget, sym)} limit`;
        isCenterOverBudget = true;
      } else {
        centerAmount = formatCompactCurrency(catBudget - catSpent, sym);
        centerFootnote = `${formatCompactCurrency(catSpent, sym)} of ${formatCompactCurrency(catBudget, sym)} used`;
      }
    } else {
      centerAmount = formatCompactCurrency(catSpent, sym);
      centerFootnote = 'No limit set';
    }
  } else {
    // Unselected state
    if (effectiveBudget > 0) {
      const isOverallOver = totalSpent > effectiveBudget;
      if (isOverallOver) {
        centerTitle = 'OVER BUDGET';
        centerAmount = formatCompactCurrency(totalSpent - effectiveBudget, sym);
        centerFootnote = `${formatCompactCurrency(totalSpent, sym)} spent of ${formatCompactCurrency(effectiveBudget, sym)} limit`;
        isCenterOverBudget = true;
      } else {
        centerTitle = isPastMonth ? 'UNSPENT / SAVED' : 'LEFT TO SPEND';
        centerAmount = formatCompactCurrency(effectiveBudget - totalSpent, sym);
        centerFootnote = isPastMonth
          ? `${formatCompactCurrency(totalSpent, sym)} spent of ${formatCompactCurrency(effectiveBudget, sym)} limit`
          : `${formatCompactCurrency(totalSpent, sym)} of ${formatCompactCurrency(effectiveBudget, sym)} used`;
      }
    } else {
      centerTitle = 'TOTAL SPENT';
      centerAmount = formatCompactCurrency(totalSpent, sym);
      centerFootnote = 'No budget set • Tap to set';
    }
  }

  // Helper to identify fixed non-discretionary commitments (Rent, Utilities, Subscriptions, EMIs)
  const isFixedCommitment = (cat: { id: string; name: string }) => {
    const n = (cat.name || '').toLowerCase();
    const id = (cat.id || '').toLowerCase();
    return (
      id.includes('rent') ||
      id.includes('util') ||
      id.includes('bill') ||
      id.includes('subs') ||
      n.includes('rent') ||
      n.includes('electric') ||
      n.includes('power') ||
      n.includes('utility') ||
      n.includes('wifi') ||
      n.includes('subscription') ||
      n.includes('emi') ||
      n.includes('loan') ||
      n.includes('insurance')
    );
  };

  const fixedSpent = breakdown.reduce((sum, item) => {
    return sum + (isFixedCommitment(item.category) ? item.amount : 0);
  }, 0);

  const variableSpent = Math.max(0, totalSpent - fixedSpent);
  const variableDailyBurn = currentDay > 0 ? Math.round(variableSpent / currentDay) : 0;
  const budgetRunway = Math.max(0, effectiveBudget - totalSpent);
  const safeDailyPace = effectiveBudget > 0 && daysRemaining > 0 ? Math.max(0, Math.round(budgetRunway / daysRemaining)) : 0;

  // Over-pacing is strictly based on variable burn rate, requiring at least 3 days elapsed to avoid Day 1 false alarms
  const isOverPacing =
    isCurrentMonth &&
    currentDay >= 3 &&
    effectiveBudget > 0 &&
    variableSpent > 0 &&
    variableDailyBurn > safeDailyPace * 1.15 &&
    budgetRunway > 0;

  const isExceeded = effectiveBudget > 0 && totalSpent >= effectiveBudget;

  const projectedBurnoutDay =
    variableDailyBurn > 0 && budgetRunway > 0
      ? Math.min(daysInMonth, Math.round(currentDay + budgetRunway / variableDailyBurn))
      : daysInMonth;

  // Split active categories into left and right columns for the legend (highest to lowest spend)
  const half = Math.ceil(activeBreakdown.length / 2);
  const sortedLeft = activeBreakdown.slice(0, half);
  const sortedRight = activeBreakdown.slice(half);

  return (
    <View style={styles.cardContainer}>
      {/* Title */}
      <AppText style={styles.cardTitle}>BUDGET</AppText>

      {/* Donut Chart Container with Exact Polar Touch Responder */}
      <View
        style={styles.chartContainer}
        onStartShouldSetResponder={() => true}
        onResponderRelease={handleChartTouch}
      >
        <Svg width={chartSize} height={chartSize} pointerEvents="none">
          <G rotation="-90" origin={`${center}, ${center}`}>
            {/* Background Track */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#101114"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Category Donut Segments (With thin dark gap separator between each category) */}
            {segments.map((seg) => {
              const isSelected = selectedCatId === seg.category.id;
              const hasSelection = selectedCatId !== null;
              const segmentOpacity = hasSelection ? (isSelected ? 1.0 : 0.42) : 1.0;
              const segRadius = isSelected ? radius + 1.5 : radius;
              const segStrokeWidth = isSelected ? strokeWidth + 4 : strokeWidth;
              const segCircumference = 2 * Math.PI * segRadius;
              const segDashlength = seg.percentage * segCircumference * sweepProgress;

              // Subtle, hairline gap between segments
              const gap = segments.length > 1 ? 1.5 : 0;
              const visibleDashLength = Math.max(segDashlength - gap, 0.1);
              const segOffset = (seg.offset / circumference) * segCircumference + gap / 2;

              return (
                <Circle
                  key={seg.category.id}
                  cx={center}
                  cy={center}
                  r={segRadius}
                  stroke={seg.category.color}
                  opacity={segmentOpacity}
                  strokeWidth={segStrokeWidth}
                  fill="transparent"
                  strokeDasharray={`${visibleDashLength} ${Math.max(0, segCircumference - visibleDashLength)}`}
                  strokeDashoffset={-segOffset}
                  strokeLinecap="butt"
                />
              );
            })}

            {/* Inner Ring Detail (NEVER CHANGES - ALWAYS OVERALL BUDGET) */}
            <Circle
              cx={center}
              cy={center}
              r={innerRadius}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={innerStrokeWidth}
              fill="#1A1D23"
            />
            {overallBudgetDash > 0 && (
              <Circle
                cx={center}
                cy={center}
                r={innerRadius}
                stroke={expenseColors.accentGreen}
                strokeWidth={innerStrokeWidth}
                fill="transparent"
                strokeDasharray={`${overallBudgetDash * sweepProgress} ${Math.max(0, innerCircumference - (overallBudgetDash * sweepProgress))}`}
                strokeDashoffset={0}
                strokeLinecap="round"
              />
            )}
          </G>
        </Svg>

        {/* Center Content Overlay */}
        <Animated.View
          style={[
            styles.centerOverlay,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          pointerEvents="none"
        >
          <AppText
            style={styles.centerBudgetLabel}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.7}
          >
            {centerTitle}
          </AppText>
          <AppText
            style={[
              styles.centerMainAmount,
              isCenterOverBudget && styles.centerMainAmountOver,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.55}
          >
            {centerAmount}
          </AppText>
          {effectiveBudget <= 0 && !selectedCategoryItem ? (
            <View style={styles.noBudgetFootnoteContainer}>
              <AppText style={styles.centerSubText}>No budget set</AppText>
              <AppText style={styles.centerTapToSetText}>Tap to set</AppText>
            </View>
          ) : (
            <AppText
              style={styles.centerSubText}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}
            >
              {centerFootnote}
            </AppText>
          )}
        </Animated.View>
      </View>

      {/* 2-Column Legend for all active categories */}
      {sortedLeft.length === 0 && sortedRight.length === 0 ? (
        <View style={styles.emptyLegendNotice}>
          <AppText style={styles.emptyLegendText}>
            No expenses logged yet • Tap + to record your first transaction
          </AppText>
        </View>
      ) : (
        <View style={styles.legendContainer}>
          {/* Left Column */}
          <View style={styles.legendColumn}>
            {sortedLeft.map((item) => {
              const isSelected = selectedCatId === item.category.id;
              const hasSelection = selectedCatId !== null;
              const itemOpacity = hasSelection ? (isSelected ? 1.0 : 0.35) : 1.0;

              return (
                <TouchableOpacity
                  key={item.category.id}
                  style={[
                    styles.legendRow,
                    isSelected && styles.legendRowSelected,
                    { opacity: itemOpacity },
                  ]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  onPress={() => handleSelectCategory(item.category.id)}
                >
                  <View style={styles.legendLeft}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: item.category.color },
                        isSelected && styles.legendDotSelected,
                      ]}
                    />
                    <AppText
                      style={[
                        styles.legendCategoryName,
                        isSelected && styles.legendCategoryNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.category.name}
                    </AppText>
                  </View>
                  <AppText
                    style={[
                      styles.legendAmount,
                      isSelected && styles.legendAmountSelected,
                    ]}
                  >
                    {formatBudgetLegendAmount(item.amount, sym)}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Right Column */}
          <View style={styles.legendColumn}>
            {sortedRight.map((item) => {
              const isSelected = selectedCatId === item.category.id;
              const hasSelection = selectedCatId !== null;
              const itemOpacity = hasSelection ? (isSelected ? 1.0 : 0.35) : 1.0;

              return (
                <TouchableOpacity
                  key={item.category.id}
                  style={[
                    styles.legendRow,
                    isSelected && styles.legendRowSelected,
                    { opacity: itemOpacity },
                  ]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  onPress={() => handleSelectCategory(item.category.id)}
                >
                  <View style={styles.legendLeft}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: item.category.color },
                        isSelected && styles.legendDotSelected,
                      ]}
                    />
                    <AppText
                      style={[
                        styles.legendCategoryName,
                        isSelected && styles.legendCategoryNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.category.name}
                    </AppText>
                  </View>
                  <AppText
                    style={[
                      styles.legendAmount,
                      isSelected && styles.legendAmountSelected,
                    ]}
                  >
                    {formatBudgetLegendAmount(item.amount, sym)}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Seamless Daily Safe Allowance Pacing Footer */}
      {effectiveBudget > 0 && (
        <View style={styles.pacingFooter}>
          {isPastMonth ? (
            <View style={styles.pacingFooterPast}>
              <AppText style={styles.pacingPastText}>
                {totalSpent > effectiveBudget
                  ? `Limit exceeded by ${sym}${(totalSpent - effectiveBudget).toLocaleString('en-IN')}`
                  : `Ended within budget • ${sym}${(effectiveBudget - totalSpent).toLocaleString('en-IN')} saved`}
              </AppText>
            </View>
          ) : (
            <>
              <View style={styles.pacingFooterLeft}>
                <Zap
                  size={12}
                  color={
                    isExceeded
                      ? '#FF6B6B'
                      : isOverPacing
                      ? '#FF9D66'
                      : expenseColors.accentGreen
                  }
                />
                <AppText style={styles.pacingValueText}>
                  {sym}{safeDailyPace.toLocaleString('en-IN')}/day
                </AppText>
                <AppText style={styles.pacingLabelText}>daily limit</AppText>
              </View>

              <View
                style={[
                  styles.pacingStatusPill,
                  isExceeded
                    ? styles.pacingPillExceeded
                    : isOverPacing
                    ? styles.pacingPillWarning
                    : styles.pacingPillGood,
                ]}
              >
                <AppText
                  style={[
                    styles.pacingStatusText,
                    isExceeded
                      ? styles.pacingTextExceeded
                      : isOverPacing
                      ? styles.pacingTextWarning
                      : styles.pacingTextGood,
                  ]}
                >
                  {isExceeded
                    ? 'Limit Exceeded'
                    : isOverPacing
                    ? `Burnout ~Day ${projectedBurnoutDay}`
                    : fixedSpent > 0 && variableSpent === 0
                    ? `Bills Paid • ${daysRemaining}d left`
                    : `${daysRemaining} days left`}
                </AppText>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 24,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  chartContainer: {
    width: 296,
    height: 296,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 144,
    maxWidth: 144,
    paddingHorizontal: 4,
    gap: 2,
  },
  centerBudgetLabel: {
    color: '#8E919D',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
    maxWidth: 136,
  },
  centerMainAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '400',
    letterSpacing: -0.5,
    textAlign: 'center',
    maxWidth: 136,
  },
  centerMainAmountOver: {
    color: '#F48B8B',
  },
  centerSubText: {
    color: '#8E919D',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 136,
  },
  legendContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 2,
  },
  legendColumn: {
    flex: 1,
    gap: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  legendRowSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendDotSelected: {
    transform: [{ scale: 1.25 }],
  },
  legendCategoryName: {
    color: '#8E919D',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
    flex: 1,
  },
  legendCategoryNameSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  legendAmount: {
    color: '#A0A5B5',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  legendAmountSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  noBudgetFootnoteContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  centerTapToSetText: {
    color: expenseColors.accentPeach,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  emptyLegendNotice: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLegendText: {
    color: expenseColors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  pacingFooter: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  pacingFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  pacingValueText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  pacingLabelText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  pacingStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pacingPillGood: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pacingPillWarning: {
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
  },
  pacingPillExceeded: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.25)',
  },
  pacingStatusText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  pacingTextGood: {
    color: '#D1D5DB',
  },
  pacingTextWarning: {
    color: '#FF9D66',
  },
  pacingTextExceeded: {
    color: '#FF6B6B',
  },
  pacingFooterPast: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pacingPastText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
  },
});
