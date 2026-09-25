import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Sparkles, Flame } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';

export const formatCompactCurrency = (amount: number, symbol: string = '₹'): string => {
  if (amount === 0) return `${symbol}0`;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const strip = (v: string) => (v.endsWith('.0') ? v.slice(0, -2) : v);
  if (abs >= 10000000) {
    return `${sign}${symbol}${strip((abs / 10000000).toFixed(1))}Cr`;
  }
  if (abs >= 100000) {
    return `${sign}${symbol}${strip((abs / 100000).toFixed(1))}L`;
  }
  if (abs >= 1000) {
    return `${sign}${symbol}${strip((abs / 1000).toFixed(1))}k`;
  }
  return `${sign}${symbol}${abs.toLocaleString('en-IN')}`;
};

// Pastel Accent Palette
const pastelColors = {
  mint: expenseColors.accentGreen,
  mintBg: 'rgba(112, 214, 188, 0.12)',
  peach: '#F8A888',
  peachBg: 'rgba(248, 168, 136, 0.12)',
  coral: expenseColors.accentRed,
  coralBg: 'rgba(244, 139, 139, 0.12)',
  purple: '#C4A7E7',
  purpleBg: 'rgba(196, 167, 231, 0.12)',
  muted: '#8E919D',
  subtle: '#6F7383',
};

export const MoneyFlowCard: React.FC = () => {
  const {
    currencySymbol,
    transactions,
    selectedMonth,
    monthlyBudget,
    getTotalIncome,
    getTotalSpent,
  } = useExpenseStore();

  const sym = currencySymbol || '₹';

  const totalIncome = getTotalIncome();
  const totalSpent = getTotalSpent();
  const netCashFlow = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0
    ? Math.round(((totalIncome - totalSpent) / totalIncome) * 100)
    : 0;

  // Streak Calculation
  const streakDays = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    if (currentDay <= 1) return 1;

    const dailySpendMap: Record<number, number> = {};
    for (let d = 1; d <= currentDay; d++) {
      dailySpendMap[d] = 0;
    }

    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const d = new Date(t.date);
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          const day = d.getDate();
          dailySpendMap[day] = (dailySpendMap[day] || 0) + (t.split ? t.split.yourShare : t.amount);
        }
      });

    const averageDailyLimit = monthlyBudget > 0 ? Math.round(monthlyBudget / 30) : 1000;
    let streak = 0;
    for (let day = currentDay; day >= 1; day--) {
      const daySpend = dailySpendMap[day] || 0;
      if (daySpend <= averageDailyLimit * 1.25) {
        streak++;
      } else {
        break;
      }
    }
    return Math.max(1, streak);
  }, [transactions, monthlyBudget]);

  return (
    <View style={styles.cardContainer}>
      {/* 1. Header: Icon + Title + Streak */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <View style={styles.iconCircle}>
            <TrendingUp size={13} color={pastelColors.purple} strokeWidth={2.5} />
          </View>
          <AppText style={styles.cardTitle}>CASH FLOW</AppText>
        </View>

        {streakDays > 0 && (
          <View style={styles.streakPill}>
            <Flame size={12} color="#FF9D66" />
            <AppText style={styles.streakPillText}>{streakDays}d streak</AppText>
          </View>
        )}
      </View>

      {/* 2. Inflow / Outflow Split Metric Tiles */}
      <View style={styles.tilesContainer}>
        {/* Spent Tile */}
        <View style={styles.metricTile}>
          <View style={styles.tileHeader}>
            <View style={[styles.arrowBadge, { backgroundColor: 'rgba(244, 139, 139, 0.12)' }]}>
              <ArrowDownLeft size={12} color={pastelColors.coral} strokeWidth={2.5} />
            </View>
            <AppText style={styles.tileLabel}>SPENT</AppText>
          </View>
          <AppText style={styles.tileAmount}>{sym}{totalSpent.toLocaleString('en-IN')}</AppText>
          <AppText style={styles.tileSub}>Total Outflow</AppText>
        </View>

        {/* Income Tile */}
        <View style={styles.metricTile}>
          <View style={styles.tileHeader}>
            <View style={[styles.arrowBadge, { backgroundColor: 'rgba(112, 214, 188, 0.12)' }]}>
              <ArrowUpRight size={12} color={pastelColors.mint} strokeWidth={2.5} />
            </View>
            <AppText style={styles.tileLabel}>INCOME</AppText>
          </View>
          <AppText style={styles.tileAmount}>
            {sym}{totalIncome.toLocaleString('en-IN')}
          </AppText>
          <AppText style={styles.tileSub} numberOfLines={1}>
            {totalIncome > 0 ? 'Total Inflow' : 'No Inflow'}
          </AppText>
        </View>
      </View>

      {/* 3. Footer Cashflow & Net Retention Summary */}
      <View style={styles.footerRow}>
        {totalIncome > 0 ? (
          <>
            <View style={styles.footerLeft}>
              <Sparkles size={12} color={pastelColors.purple} />
              <AppText style={styles.footerLabel}>Month Leftover</AppText>
              <AppText style={[styles.footerAmount, { color: netCashFlow >= 0 ? pastelColors.mint : pastelColors.coral }]}>
                {netCashFlow >= 0
                  ? `+${sym}${netCashFlow.toLocaleString('en-IN')}`
                  : `-${sym}${Math.abs(netCashFlow).toLocaleString('en-IN')}`}
              </AppText>
            </View>
            <View style={styles.ratePill}>
              <AppText style={styles.ratePillText}>
                {savingsRate >= 0 ? `${savingsRate}% unspent` : `${Math.abs(savingsRate)}% deficit`}
              </AppText>
            </View>
          </>
        ) : (
          <View style={styles.footerLeft}>
            <Sparkles size={12} color={pastelColors.purple} />
            <AppText style={styles.footerLabel}>
              Log monthly income to see month leftover & unspent %
            </AppText>
          </View>
        )}
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
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.22)',
  },
  streakPillText: {
    color: '#FF9D66',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
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
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  footerLabel: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
  },
  footerAmount: {
    fontSize: 11,
    fontWeight: '800',
  },
  ratePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
  },
  ratePillText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
});
