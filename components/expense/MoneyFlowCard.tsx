import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Sparkles, Calendar } from 'lucide-react-native';
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

// Pastel Accent Palette
const pastelColors = {
  mint: '#7CD9A8',
  mintBg: 'rgba(124, 217, 168, 0.12)',
  peach: '#FFB088',
  peachBg: 'rgba(255, 176, 136, 0.12)',
  coral: '#F28B82',
  coralBg: 'rgba(242, 139, 130, 0.12)',
  purple: '#9B8AFB',
  purpleBg: 'rgba(155, 138, 251, 0.12)',
  muted: '#8E919D',
  subtle: '#6F7383',
};

export const MoneyFlowCard: React.FC = () => {
  const {
    monthlyBudget,
    currencySymbol,
    getTotalIncome,
    getTotalSpent,
    getTotalBalance,
    getRemainingBudget,
    getOverspentPercentage,
    hasInitialAppLoaded,
  } = useExpenseStore();

  const sym = currencySymbol || '₹';
  const progressAnim = useRef(new Animated.Value(hasInitialAppLoaded ? 1 : 0)).current;

  useEffect(() => {
    if (hasInitialAppLoaded) {
      progressAnim.setValue(1);
      return;
    }

    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 800,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [hasInitialAppLoaded]);

  const totalIncome = getTotalIncome();
  const totalSpent = getTotalSpent();
  const totalBalance = getTotalBalance();
  const remainingBudget = getRemainingBudget();
  const overspentPct = getOverspentPercentage();
  const netBalance = totalIncome - totalSpent;

  const spentPct = monthlyBudget > 0 ? Math.round((totalSpent / monthlyBudget) * 100) : 0;
  const spentProgressPct = Math.min(Math.max(spentPct, 0), 100);
  const isOverspent = overspentPct > 0;

  // ── Predictive Runway Algorithm ──
  const now = new Date();
  const currentDay = Math.max(now.getDate(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(daysInMonth - currentDay, 1);

  const dailyVelocity = totalSpent > 0 ? Math.round(totalSpent / currentDay) : 0;
  const projectedSpend = dailyVelocity * daysInMonth;

  // Safe daily allowance capped by physical cash balance so we never recommend spending more than what exists in the bank
  const theoreticalDaily = remainingBudget > 0 ? Math.round(remainingBudget / remainingDays) : 0;
  const maxDailyFromCash = totalBalance > 0 ? Math.round(totalBalance / remainingDays) : 0;
  const safeDailyAllowance = Math.min(theoreticalDaily, maxDailyFromCash);
  const isVelocityHigh = monthlyBudget > 0 && projectedSpend > monthlyBudget && remainingBudget > 0;

  return (
    <View style={styles.cardContainer}>
      {/* 1. Header: Icon + Title + Dynamic Status Badge */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <View style={styles.iconCircle}>
            <TrendingUp size={13} color={pastelColors.purple} strokeWidth={2.5} />
          </View>
          <AppText style={styles.cardTitle}>MONEY FLOW</AppText>
        </View>

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
              {safeDailyAllowance > 0 ? `${sym}${safeDailyAllowance}/day limit` : '🟢 On track'}
            </AppText>
          </View>
        )}
      </View>

      {/* 2. Inflow / Outflow Split Metric Tiles */}
      <View style={styles.tilesContainer}>
        {/* Spent Tile */}
        <View style={styles.metricTile}>
          <View style={styles.tileHeader}>
            <View style={[styles.arrowBadge, { backgroundColor: 'rgba(242, 139, 130, 0.12)' }]}>
              <ArrowDownLeft size={12} color={pastelColors.coral} strokeWidth={2.5} />
            </View>
            <AppText style={styles.tileLabel}>SPENT</AppText>
          </View>
          <AppText style={styles.tileAmount}>{sym}{totalSpent.toLocaleString('en-IN')}</AppText>
          <AppText style={styles.tileSub}>
            Pace: ~{sym}{dailyVelocity}/day
          </AppText>
        </View>

        {/* Income Tile */}
        <View style={styles.metricTile}>
          <View style={styles.tileHeader}>
            <View style={[styles.arrowBadge, { backgroundColor: 'rgba(124, 217, 168, 0.12)' }]}>
              <ArrowUpRight size={12} color={pastelColors.mint} strokeWidth={2.5} />
            </View>
            <AppText style={styles.tileLabel}>INCOME</AppText>
          </View>
          <AppText style={[styles.tileAmount, totalIncome > 0 && { color: pastelColors.mint }]}>
            {sym}{totalIncome.toLocaleString('en-IN')}
          </AppText>
          <AppText style={styles.tileSub}>
            Net:{' '}
            <AppText
              style={{
                color: netBalance >= 0 ? pastelColors.mint : pastelColors.coral,
                fontWeight: '700',
              }}
            >
              {netBalance >= 0 ? '+' : ''}{sym}{netBalance.toLocaleString('en-IN')}
            </AppText>
          </AppText>
        </View>
      </View>

      {/* 3. Budget Consumption Progress Bar */}
      {monthlyBudget > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeaderRow}>
            <AppText style={styles.progressLabel}>BUDGET UTILIZATION</AppText>
            <AppText style={styles.progressValue}>
              {spentPct}% ({formatCompactCurrency(totalSpent, sym)} of {formatCompactCurrency(monthlyBudget, sym)})
            </AppText>
          </View>

          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                {
                  backgroundColor: isOverspent
                    ? pastelColors.coral
                    : spentPct > 85
                    ? pastelColors.peach
                    : pastelColors.mint,
                  width: totalSpent > 0
                    ? progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', `${Math.max(spentProgressPct, 3)}%`],
                      })
                    : '0%',
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* 4. Footer Insight Bar */}
      <View style={styles.footerRow}>
        <View style={styles.footerItem}>
          <Sparkles size={12} color={pastelColors.purple} />
          <AppText style={styles.footerText}>
            On Track: ~{sym}{projectedSpend.toLocaleString('en-IN')} by month-end
          </AppText>
        </View>
        <View style={styles.footerItem}>
          <Calendar size={11} color={pastelColors.subtle} />
          <AppText style={styles.footerSub}>
            {remainingDays}d left in {now.toLocaleString('default', { month: 'short' })}
          </AppText>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#16181D',
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(155, 138, 251, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tilesContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricTile: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  arrowBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    color: pastelColors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  tileAmount: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 4,
  },
  tileSub: {
    color: pastelColors.subtle,
    fontSize: 11,
    fontWeight: '500',
  },
  progressSection: {
    marginBottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: pastelColors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  progressValue: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '600',
  },
  track: {
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
  },
  footerSub: {
    color: pastelColors.subtle,
    fontSize: 11,
    fontWeight: '500',
  },
});
