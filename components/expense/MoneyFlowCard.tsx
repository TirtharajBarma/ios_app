import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';

export const formatCompactCurrency = (amount: number, symbol: string = '₹'): string => {
  if (amount === 0) return `${symbol}0`;
  if (Math.abs(amount) >= 1000) {
    const kValue = (amount / 1000).toFixed(1);
    const formatted = kValue.endsWith('.0') ? kValue.slice(0, -2) : kValue;
    return `${symbol}${formatted}K`;
  }
  return `${symbol}${amount.toLocaleString('en-IN')}`;
};

// Pastel Color Palette
const pastelColors = {
  mint: '#7CD9A8',       // Soft pastel green
  mintBg: 'rgba(124, 217, 168, 0.14)',
  peach: '#FFB088',      // Soft pastel peach
  peachBg: 'rgba(255, 176, 136, 0.14)',
  coral: '#F28B82',      // Soft pastel red/coral
  coralBg: 'rgba(242, 139, 130, 0.14)',
  muted: '#8E919D',
  subtle: '#7C8092',
};

export const MoneyFlowCard: React.FC = () => {
  const {
    monthlyBudget,
    currencySymbol,
    getTotalIncome,
    getTotalSpent,
    getRemainingBudget,
    getOverspentPercentage,
  } = useExpenseStore();

  const sym = currencySymbol || '₹';

  const totalIncome = getTotalIncome();
  const totalSpent = getTotalSpent();
  const remainingBudget = getRemainingBudget();
  const overspentPct = getOverspentPercentage();
  const netBalance = totalIncome - totalSpent;

  const spentProgressPct = monthlyBudget > 0 ? Math.min(Math.max((totalSpent / monthlyBudget) * 100, 0), 100) : 0;
  const isOverspent = overspentPct > 0;

  // ── Predictive Runway Algorithm ──
  const now = new Date();
  const currentDay = Math.max(now.getDate(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(daysInMonth - currentDay, 1);

  const dailyVelocity = totalSpent > 0 ? Math.round(totalSpent / currentDay) : 0;
  const projectedSpend = dailyVelocity * daysInMonth;
  const safeDailyAllowance = remainingBudget > 0 ? Math.round(remainingBudget / remainingDays) : 0;
  const isVelocityHigh = monthlyBudget > 0 && projectedSpend > monthlyBudget && remainingBudget > 0;

  return (
    <View style={styles.cardContainer}>
      {/* Header Row: Title & Clean Runway Status Pill in Pastel */}
      <View style={styles.headerRow}>
        <AppText style={styles.cardTitle}>MONEY FLOW</AppText>
        {isOverspent ? (
          <View style={[styles.statusPill, { backgroundColor: pastelColors.coralBg }]}>
            <AppText style={[styles.statusPillText, { color: pastelColors.coral }]}>
              Overspent by {overspentPct}%
            </AppText>
          </View>
        ) : isVelocityHigh ? (
          <View style={[styles.statusPill, { backgroundColor: pastelColors.peachBg }]}>
            <AppText style={[styles.statusPillText, { color: pastelColors.peach }]}>
              Pace: {sym}{dailyVelocity}/day
            </AppText>
          </View>
        ) : (
          <View style={[styles.statusPill, { backgroundColor: pastelColors.mintBg }]}>
            <AppText style={[styles.statusPillText, { color: pastelColors.mint }]}>
              {sym}{safeDailyAllowance}/day runway
            </AppText>
          </View>
        )}
      </View>

      {/* Main Figures Row: Spent vs Income */}
      <View style={styles.metricsRow}>
        {/* Spent Metric */}
        <View style={styles.metricCol}>
          <AppText style={styles.metricLabel}>SPENT</AppText>
          <AppText style={styles.metricValueSpent}>{sym}{totalSpent.toLocaleString('en-IN')}</AppText>
          <AppText style={styles.metricSub}>
            {monthlyBudget > 0 ? `${Math.round((totalSpent / monthlyBudget) * 100)}% of ${formatCompactCurrency(monthlyBudget, sym)}` : 'No budget set'}
          </AppText>
        </View>

        <View style={styles.verticalDivider} />

        {/* Income Metric */}
        <View style={styles.metricCol}>
          <AppText style={styles.metricLabel}>INCOME</AppText>
          <AppText style={styles.metricValueIncome}>{sym}{totalIncome.toLocaleString('en-IN')}</AppText>
          <AppText style={styles.metricSub}>
            Net:{' '}
            <AppText
              style={{
                color: netBalance >= 0 ? pastelColors.mint : pastelColors.coral,
                fontWeight: '700',
                fontSize: 11,
              }}
            >
              {netBalance >= 0 ? '+' : ''}{sym}{netBalance.toLocaleString('en-IN')}
            </AppText>
          </AppText>
        </View>
      </View>

      {/* Budget Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                backgroundColor: isOverspent ? pastelColors.coral : pastelColors.peach,
                width: totalSpent > 0 ? `${Math.max(spentProgressPct, 3)}%` : '0%',
              },
            ]}
          />
        </View>
      </View>

      {/* Clean Footer Insight */}
      <View style={styles.footerRow}>
        <AppText style={styles.footerText}>
          Projected: {sym}{projectedSpend.toLocaleString('en-IN')} by month-end
        </AppText>
        <AppText style={styles.footerSub}>
          {remainingDays} days left in {now.toLocaleString('default', { month: 'short' })}
        </AppText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metricCol: {
    flex: 1,
  },
  verticalDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 16,
  },
  metricLabel: {
    color: pastelColors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metricValueSpent: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  metricValueIncome: {
    color: pastelColors.mint,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  metricSub: {
    color: pastelColors.subtle,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  progressContainer: {
    marginBottom: 12,
  },
  track: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
  },
  footerText: {
    color: pastelColors.muted,
    fontSize: 11,
    fontWeight: '500',
  },
  footerSub: {
    color: pastelColors.subtle,
    fontSize: 11,
    fontWeight: '500',
  },
});
