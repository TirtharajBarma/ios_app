import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';

export const formatCompactCurrency = (amount: number): string => {
  if (amount === 0) return '\u20B90';
  if (Math.abs(amount) >= 1000) {
    const kValue = (amount / 1000).toFixed(1);
    const formatted = kValue.endsWith('.0') ? kValue.slice(0, -2) : kValue;
    return `\u20B9${formatted}K`;
  }
  return `\u20B9${amount.toLocaleString('en-IN')}`;
};

export const MoneyFlowCard: React.FC = () => {
  const {
    monthlyBudget,
    getTotalIncome,
    getTotalSpent,
    getRemainingBudget,
    getOverspentPercentage,
  } = useExpenseStore();

  const totalIncome = getTotalIncome();
  const totalSpent = getTotalSpent();
  const remainingBudget = getRemainingBudget();
  const overspentPct = getOverspentPercentage();

  const spentProgressPct = monthlyBudget > 0 ? Math.min(Math.max((totalSpent / monthlyBudget) * 100, 0), 100) : 0;
  const incomeProgressPct = totalIncome > 0 ? 100 : 0;

  const isOverspent = overspentPct > 0;

  return (
    <View style={styles.cardContainer}>
      {/* Header Row: Title */}
      <View style={styles.headerRow}>
        <AppText style={styles.cardTitle}>MONEY FLOW</AppText>
      </View>

      {/* Status Pill on its own row below title */}
      <View style={styles.statusPillRow}>
        <View style={[styles.statusPill, isOverspent ? styles.overspentPill : styles.healthyPill]}>
          <AppText style={[styles.statusPillText, isOverspent ? styles.overspentText : styles.healthyText]}>
            {isOverspent ? `Overspent by ${overspentPct}%` : remainingBudget > 0 ? `Within budget (₹${remainingBudget.toLocaleString('en-IN')} left)` : 'On budget'}
          </AppText>
        </View>
      </View>

      {/* Income & Spent Summary line */}
      <AppText style={styles.summarySubtext}>
        Income <AppText style={styles.boldValue}>{formatCompactCurrency(totalIncome)}</AppText>
        <AppText style={styles.dotSeparator}>  •  </AppText>
        Spent <AppText style={styles.boldValue}>{formatCompactCurrency(totalSpent)}</AppText>
      </AppText>

      {/* Budget status banner (compact pill aligned left) */}
      <View style={styles.budgetBannerContainer}>
        <View style={styles.checkIconBox}>
          <Check size={12} color={expenseColors.accentGreen} strokeWidth={3} />
        </View>
        <AppText style={styles.budgetBannerText}>
          Budget: {formatCompactCurrency(remainingBudget)} remaining
        </AppText>
      </View>

      {/* Spent Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <AppText style={styles.progressLabel}>Spent</AppText>
          <AppText style={styles.progressValue}>{formatCompactCurrency(totalSpent)}</AppText>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              styles.spentFill,
              { width: totalSpent > 0 ? `${Math.max(spentProgressPct, 4)}%` : '0%' },
            ]}
          />
        </View>
      </View>

      {/* Income Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <AppText style={styles.progressLabel}>Income</AppText>
          <AppText style={styles.progressValue}>{formatCompactCurrency(totalIncome)}</AppText>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              styles.incomeFill,
              { width: totalIncome > 0 ? `${incomeProgressPct}%` : '0%' },
            ]}
          />
        </View>
      </View>
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
    borderColor: expenseColors.borderCard,
  },
  headerRow: {
    marginBottom: 8,
  },
  cardTitle: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  statusPillRow: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  overspentPill: {
    backgroundColor: expenseColors.accentRedBg,
  },
  healthyPill: {
    backgroundColor: expenseColors.accentRedBg,
  },
  statusPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  overspentText: {
    color: expenseColors.accentRed,
  },
  healthyText: {
    color: expenseColors.accentRed,
  },
  summarySubtext: {
    color: expenseColors.textSubtle,
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 14,
  },
  boldValue: {
    color: expenseColors.textPrimary,
    fontWeight: '700',
  },
  dotSeparator: {
    color: 'rgba(255, 255, 255, 0.25)',
  },
  budgetBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: expenseColors.accentGreenBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginBottom: 18,
    gap: 8,
  },
  checkIconBox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(46, 204, 113, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetBannerText: {
    color: expenseColors.accentGreen,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  progressSection: {
    marginBottom: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    color: expenseColors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  progressValue: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  track: {
    height: 28,
    backgroundColor: expenseColors.trackBg,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 8,
  },
  spentFill: {
    backgroundColor: expenseColors.spentProgressFill,
  },
  incomeFill: {
    backgroundColor: expenseColors.accentGreen,
  },
});
