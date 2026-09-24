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
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { formatCompactCurrency } from './MoneyFlowCard';

export const formatBudgetLegendAmount = (amount: number, symbol: string = '₹'): string => {
  if (amount === 0) return `${symbol}0`;
  if (Math.abs(amount) >= 1000) {
    const kValue = (amount / 1000).toFixed(1);
    const formatted = kValue.endsWith('.0') ? kValue.slice(0, -2) : kValue;
    return `${symbol}${formatted}K`;
  }
  return `${symbol}${amount.toLocaleString('en-IN')}`;
};

export const BudgetCard: React.FC = () => {
  const {
    monthlyBudget,
    currencySymbol,
    getTotalSpent,
    getRemainingBudget,
    getCategoryBreakdown,
    categoryBudgets,
    transactions,
    categories,
  } = useExpenseStore();

  const sym = currencySymbol || '₹';

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

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

  const totalSpent = getTotalSpent();
  const remainingBudget = getRemainingBudget();
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

  // Active categories with spending, dynamically sorted descending by spending amount (highest to lowest)
  const activeBreakdown = breakdown
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const totalCategoriesSpent = activeBreakdown.reduce((sum, item) => sum + item.amount, 0);

  // Selected category info
  const selectedCategoryItem = selectedCatId
    ? activeBreakdown.find((item) => item.category.id === selectedCatId) || null
    : null;

  // Calculate arc offsets for category segments
  let cumulativeOffset = 0;
  const segments = activeBreakdown.map((item) => {
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

    // If tapped inside inner circle or on center text, reset selection if active
    if (distance <= innerRadius + 8) {
      if (selectedCatId !== null) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setSelectedCatId(null);
      }
      return;
    }

    // If outside donut ring bounds, ignore
    if (distance < innerRadius - 4 || distance > radius + strokeWidth / 2 + 16) {
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
  // 1. INNER THIN GREEN PROGRESS RING (ALWAYS OVERALL BUDGET)
  // ─────────────────────────────────────────────────────────
  const overallBudgetRatio = monthlyBudget > 0 ? Math.min(totalSpent / monthlyBudget, 1) : 0;
  const overallBudgetDash = overallBudgetRatio * innerCircumference;

  // ─────────────────────────────────────────────────────────
  // 2. CENTER CONTENT DISPLAY
  // ─────────────────────────────────────────────────────────
  let centerTitle = 'Budget';
  let centerAmount = formatCompactCurrency(remainingBudget);
  let centerSubLabel = 'left';
  let centerFootnote = `${formatCompactCurrency(totalSpent)} of ${formatCompactCurrency(monthlyBudget)}`;

  const hasFixedBudget = selectedCategoryItem && categoryBudgets[selectedCategoryItem.category.id] !== undefined;
  const catBudget = selectedCategoryItem && hasFixedBudget ? categoryBudgets[selectedCategoryItem.category.id] : 0;
  const catSpent = selectedCategoryItem ? selectedCategoryItem.amount : 0;

  if (selectedCategoryItem) {
    const catName = `${selectedCategoryItem.category.name} ${selectedCategoryItem.category.emoji || ''}`.trim();
    centerTitle = catName;

    if (hasFixedBudget && catBudget > 0) {
      const catRemaining = Math.max(catBudget - catSpent, 0);
      const catUsedPct = Math.round((catSpent / catBudget) * 100);

      centerAmount = formatCompactCurrency(catRemaining);
      centerSubLabel = 'remaining';
      centerFootnote = `${catUsedPct}% used of ${formatCompactCurrency(catBudget)}`;
    } else {
      centerAmount = formatCompactCurrency(catSpent);
      centerSubLabel = 'spent';
      centerFootnote = 'no budget set';
    }
  }

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
              const segDashlength = seg.percentage * segCircumference;

              // Subtle, hairline gap between segments
              const gap = segments.length > 1 ? 1.5 : 0;
              const visibleDashLength = Math.max(segDashlength - gap, 1);
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
                  strokeDasharray={`${visibleDashLength} ${segCircumference - visibleDashLength}`}
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
              fill="#1A1C24"
            />
            {overallBudgetDash > 0 && (
              <Circle
                cx={center}
                cy={center}
                r={innerRadius}
                stroke={expenseColors.accentGreen}
                strokeWidth={innerStrokeWidth}
                fill="transparent"
                strokeDasharray={`${overallBudgetDash} ${innerCircumference - overallBudgetDash}`}
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
          <AppText style={styles.centerBudgetLabel} numberOfLines={1}>
            {centerTitle}
          </AppText>
          <AppText style={styles.centerMainAmount} numberOfLines={1}>
            {centerAmount}
          </AppText>
          <AppText style={styles.centerLeftLabel}>{centerSubLabel}</AppText>
          <AppText style={styles.centerSubText} numberOfLines={1}>
            {centerFootnote}
          </AppText>
        </Animated.View>
      </View>

      {/* Dynamic Bottom Area */}
      {selectedCategoryItem ? (
        // Selected Category Detail Card (Smooth Animated)
        <Animated.View
          style={[
            styles.selectedDetailWrapper,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.selectedDetailCard}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setSelectedCatId(null);
            }}
          >
            <View style={styles.selectedLeft}>
              <View
                style={[
                  styles.selectedDot,
                  { backgroundColor: selectedCategoryItem.category.color },
                ]}
              />
              <View style={styles.selectedTextGroup}>
                <AppText style={styles.selectedName}>
                  {selectedCategoryItem.category.name}{' '}
                  {selectedCategoryItem.category.emoji || ''}
                </AppText>
                {hasFixedBudget && catBudget > 0 ? (
                  <AppText style={styles.selectedSpentLine}>
                    <AppText style={styles.selectedSpentAmount}>
                      {sym}{catSpent.toLocaleString('en-IN')}
                    </AppText>
                    <AppText style={styles.selectedBudgetTotal}>
                      {` of ${sym}${catBudget.toLocaleString('en-IN')}`}
                    </AppText>
                  </AppText>
                ) : (
                  <AppText style={styles.selectedSpentLine}>
                    <AppText style={styles.selectedSpentAmount}>
                      {sym}{catSpent.toLocaleString('en-IN')}
                    </AppText>
                    <AppText style={styles.selectedBudgetTotal}>
                      {' spent'}
                    </AppText>
                  </AppText>
                )}
              </View>
            </View>

            <View style={styles.selectedRight}>
              {hasFixedBudget && catBudget > 0 ? (
                <>
                  <AppText style={styles.selectedRemainingValue}>
                    {formatCompactCurrency(Math.max(catBudget - catSpent, 0))}
                  </AppText>
                  <AppText style={styles.selectedRemainingLabel}>left</AppText>
                </>
              ) : (
                <>
                  <AppText style={styles.selectedUnbudgetedValue}>
                    unbudgeted
                  </AppText>
                  <AppText style={styles.selectedRemainingLabel}>no limit</AppText>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      ) : sortedLeft.length === 0 && sortedRight.length === 0 ? (
        <View style={styles.emptyLegendNotice}>
          <AppText style={styles.emptyLegendText}>
            No expenses logged yet • Tap + to record your first transaction
          </AppText>
        </View>
      ) : (
        // 2-Column Legend for all active categories
        <View style={styles.legendContainer}>
          {/* Left Column */}
          <View style={styles.legendColumn}>
            {sortedLeft.map((item) => (
              <TouchableOpacity
                key={item.category.id}
                style={styles.legendRow}
                activeOpacity={0.7}
                onPress={() => handleSelectCategory(item.category.id)}
              >
                <View style={styles.legendLeft}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: item.category.color },
                    ]}
                  />
                  <AppText style={styles.legendCategoryName} numberOfLines={1}>
                    {item.category.name} {item.category.emoji || ''}
                  </AppText>
                </View>
                <AppText style={styles.legendAmount}>
                  {formatBudgetLegendAmount(item.amount, sym)}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Right Column */}
          <View style={styles.legendColumn}>
            {sortedRight.map((item) => (
              <TouchableOpacity
                key={item.category.id}
                style={styles.legendRow}
                activeOpacity={0.7}
                onPress={() => handleSelectCategory(item.category.id)}
              >
                <View style={styles.legendLeft}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: item.category.color },
                    ]}
                  />
                  <AppText style={styles.legendCategoryName} numberOfLines={1}>
                    {item.category.name} {item.category.emoji || ''}
                  </AppText>
                </View>
                <AppText style={styles.legendAmount}>
                  {formatBudgetLegendAmount(item.amount, sym)}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
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
    marginBottom: 8,
    textAlign: 'center',
  },
  chartContainer: {
    width: 296,
    height: 296,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 150,
  },
  centerBudgetLabel: {
    color: '#8E919D',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginBottom: 1,
    textAlign: 'center',
  },
  centerMainAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  centerLeftLabel: {
    color: '#8E919D',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: -1,
    marginBottom: 3,
    textAlign: 'center',
  },
  centerSubText: {
    color: '#656978',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 4,
  },
  legendColumn: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendCategoryName: {
    color: '#8E919D',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    flex: 1,
  },
  legendAmount: {
    color: '#A0A5B5',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  selectedDetailWrapper: {
    width: '100%',
    paddingHorizontal: 4,
  },
  selectedDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#232633',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  selectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  selectedTextGroup: {
    gap: 1,
  },
  selectedName: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  selectedSpentLine: {
    fontSize: 11,
    lineHeight: 14,
  },
  selectedSpentAmount: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectedBudgetTotal: {
    color: '#8E919D',
    fontWeight: '500',
  },
  selectedRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  selectedRemainingValue: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  selectedUnbudgetedValue: {
    color: '#8E919D',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  selectedRemainingLabel: {
    color: '#8E919D',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
  },
  emptyLegendNotice: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLegendText: {
    color: expenseColors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});
