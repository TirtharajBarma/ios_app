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

export const formatBudgetLegendAmount = (amount: number): string => {
  if (amount === 0) return '₹0';
  if (Math.abs(amount) >= 1000) {
    const kValue = (amount / 1000).toFixed(1);
    const formatted = kValue.endsWith('.0') ? kValue.slice(0, -2) : kValue;
    return `₹${formatted}K`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
};

export const BudgetCard: React.FC = () => {
  const {
    monthlyBudget,
    getTotalSpent,
    getRemainingBudget,
    getCategoryBreakdown,
    categoryBudgets,
    transactions,
    categories,
  } = useExpenseStore();

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

  // Grand, bigger donut chart dimensions
  const chartSize = 280;
  const center = chartSize / 2;
  const radius = 98;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;

  // Inner ring dimensions
  const innerRadius = 66;
  const innerStrokeWidth = 4;
  const innerCircumference = 2 * Math.PI * innerRadius;

  // Active categories with spending
  const activeBreakdown = breakdown.filter((item) => item.amount > 0);
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

    // If tapped inside inner circle, reset selection
    if (distance <= innerRadius + 6) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedCatId(null);
      return;
    }

    // If outside donut ring bounds, ignore
    if (distance < innerRadius - 6 || distance > radius + strokeWidth / 2 + 14) {
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setSelectedCatId((prev) => (prev === seg.category.id ? null : seg.category.id));
        return;
      }
      currentAngle += segSpanDeg;
    }
  };

  const handleSelectCategory = (catId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedCatId((prev) => (prev === catId ? null : catId));
  };

  // Center display calculations
  let centerTitle = 'Budget';
  let centerAmount = formatCompactCurrency(remainingBudget);
  let centerSubLabel = 'left';
  let centerFootnote = `${formatCompactCurrency(totalSpent)} of ${formatCompactCurrency(monthlyBudget)}`;
  let innerDash = (monthlyBudget > 0 ? Math.min(totalSpent / monthlyBudget, 1) : 0) * innerCircumference;

  const hasFixedBudget = selectedCategoryItem && categoryBudgets[selectedCategoryItem.category.id] !== undefined;
  const catBudget = selectedCategoryItem && hasFixedBudget ? categoryBudgets[selectedCategoryItem.category.id] : 0;
  const catSpent = selectedCategoryItem ? selectedCategoryItem.amount : 0;
  const catTxCount = selectedCategoryItem
    ? transactions.filter((t) => t.categoryId === selectedCategoryItem.category.id).length
    : 0;

  if (selectedCategoryItem) {
    const catName = `${selectedCategoryItem.category.name} ${selectedCategoryItem.category.emoji || ''}`.trim();
    centerTitle = catName;

    if (hasFixedBudget && catBudget > 0) {
      const catRemaining = Math.max(catBudget - catSpent, 0);
      const catUsedPct = Math.min(Math.round((catSpent / catBudget) * 100), 100);
      const catUsedRatio = Math.min(catSpent / catBudget, 1);

      innerDash = catUsedRatio * innerCircumference;
      centerAmount = formatCompactCurrency(catRemaining);
      centerSubLabel = 'remaining';
      centerFootnote = `${catUsedPct}% used of ${formatCompactCurrency(catBudget)}`;
    } else {
      // Category budget NOT fixed: show total spent & % of total
      const pctOfTotal = totalSpent > 0 ? Math.round((catSpent / totalSpent) * 100) : 0;
      innerDash = (totalSpent > 0 ? Math.min(catSpent / totalSpent, 1) : 0) * innerCircumference;
      centerAmount = formatCompactCurrency(catSpent);
      centerSubLabel = 'spent';
      centerFootnote = `${pctOfTotal}% of total spend • ${catTxCount} txns`;
    }
  }

  // Sort active categories strictly according to user-selected category order
  const sortedBreakdown = [...activeBreakdown].sort((a, b) => {
    const idxA = categories.findIndex((c) => c.id === a.category.id);
    const idxB = categories.findIndex((c) => c.id === b.category.id);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  // Split into left and right columns evenly
  const half = Math.ceil(sortedBreakdown.length / 2);
  const sortedLeft = sortedBreakdown.slice(0, half);
  const sortedRight = sortedBreakdown.slice(half);

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
              stroke="#1C1E27"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Category Donut Segments */}
            {segments.map((seg) => {
              const isSelected = selectedCatId === seg.category.id;
              const hasSelection = selectedCatId !== null;
              const strokeColor = hasSelection
                ? isSelected
                  ? seg.category.color
                  : 'rgba(44, 48, 59, 0.45)'
                : seg.category.color;

              return (
                <Circle
                  key={seg.category.id}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                  fill="transparent"
                  strokeDasharray={`${seg.strokeDashlength} ${circumference - seg.strokeDashlength}`}
                  strokeDashoffset={-seg.offset}
                  strokeLinecap="butt"
                />
              );
            })}

            {/* Inner Ring Detail */}
            <Circle
              cx={center}
              cy={center}
              r={innerRadius}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={innerStrokeWidth}
              fill="#12131A"
            />
            {innerDash > 0 && (
              <Circle
                cx={center}
                cy={center}
                r={innerRadius}
                stroke={selectedCategoryItem?.category.color || expenseColors.accentGreen}
                strokeWidth={innerStrokeWidth}
                fill="transparent"
                strokeDasharray={`${innerDash} ${innerCircumference - innerDash}`}
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
                      ₹{catSpent.toLocaleString('en-IN')}
                    </AppText>
                    <AppText style={styles.selectedBudgetTotal}>
                      {` of ₹${catBudget.toLocaleString('en-IN')}`}
                    </AppText>
                  </AppText>
                ) : (
                  <AppText style={styles.selectedSpentLine}>
                    <AppText style={styles.selectedSpentAmount}>
                      ₹{catSpent.toLocaleString('en-IN')}
                    </AppText>
                    <AppText style={styles.selectedBudgetTotal}>
                      {` (${catTxCount} transaction${catTxCount !== 1 ? 's' : ''})`}
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
                  <AppText style={styles.selectedRemainingValue}>
                    {formatCompactCurrency(catSpent)}
                  </AppText>
                  <AppText style={styles.selectedRemainingLabel}>total spent</AppText>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
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
                  {formatBudgetLegendAmount(item.amount)}
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
                  {formatBudgetLegendAmount(item.amount)}
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
    padding: 20,
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
    marginBottom: 14,
    textAlign: 'center',
  },
  chartContainer: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 18,
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
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
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
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
  },
  selectedDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#161822',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  selectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  selectedTextGroup: {
    gap: 2,
  },
  selectedName: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  selectedSpentLine: {
    fontSize: 12,
    lineHeight: 16,
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
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  selectedRemainingLabel: {
    color: '#8E919D',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
});
