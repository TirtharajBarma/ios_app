import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Sparkles, Flame, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore, isInMonth, monthKeyToYearMonth } from '@/store/useExpenseStore';
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

  const { year, month } = useMemo(() => monthKeyToYearMonth(selectedMonth), [selectedMonth]);

  const totalIncome = getTotalIncome();
  const totalSpent = getTotalSpent();

  const vaultDepositsThisMonth = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'vault_deposit' && isInMonth(t.date, year, month))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, year, month]);

  const vaultWithdrawsThisMonth = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'vault_withdraw' && isInMonth(t.date, year, month))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, year, month]);

  const [showStreakModal, setShowStreakModal] = useState(false);

  const netCashFlow = totalIncome - totalSpent - vaultDepositsThisMonth + vaultWithdrawsThisMonth;
  const savingsRate = totalIncome > 0
    ? Math.round((netCashFlow / totalIncome) * 100)
    : 0;

  const averageDailyLimit = monthlyBudget > 0 ? Math.round(monthlyBudget / 30) : 1000;

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
        const parts = t.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (parts) {
          const y = parseInt(parts[1], 10);
          const m = parseInt(parts[2], 10) - 1;
          const day = parseInt(parts[3], 10);
          if (m === now.getMonth() && y === now.getFullYear()) {
            dailySpendMap[day] = (dailySpendMap[day] || 0) + (t.split ? t.split.yourShare : t.amount);
          }
        }
      });

    let streak = 0;
    for (let day = currentDay; day >= 1; day--) {
      const daySpend = dailySpendMap[day] || 0;
      if (daySpend <= averageDailyLimit * 1.25) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [transactions, averageDailyLimit]);

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
          <TouchableOpacity
            style={styles.streakPill}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setShowStreakModal(true);
            }}
          >
            <Flame size={12} color="#FF9D66" />
            <AppText style={styles.streakPillText}>{streakDays}d streak</AppText>
          </TouchableOpacity>
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

      {/* Apple-Style Minimal Streak Sheet */}
      <Modal
        visible={showStreakModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStreakModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowStreakModal(false)}
        >
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {/* Top Icon + Dismiss */}
            <View style={styles.modalTopRow}>
              <View style={styles.modalIconCircle}>
                <Flame size={20} color="#FF9D66" />
              </View>
              <TouchableOpacity
                onPress={() => setShowStreakModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.modalCloseCircle}
              >
                <X size={14} color="#8E919D" />
              </TouchableOpacity>
            </View>

            {/* Hero Header */}
            <AppText style={styles.modalHeroValue}>
              {streakDays} {streakDays === 1 ? 'Day' : 'Days'}
            </AppText>
            <AppText style={styles.modalHeroSub}>Budget Discipline Streak</AppText>

            {/* Formula & Calculation Breakdown Card */}
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownRow}>
                <AppText style={styles.breakdownLabel}>Monthly Budget</AppText>
                <AppText style={styles.breakdownVal}>
                  {monthlyBudget > 0 ? `${sym}${monthlyBudget.toLocaleString('en-IN')}` : 'Not set'}
                </AppText>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <View>
                  <AppText style={styles.breakdownLabel}>Daily Allowance</AppText>
                  <AppText style={styles.breakdownFormula}>
                    {monthlyBudget > 0 ? `${sym}${monthlyBudget.toLocaleString('en-IN')} ÷ 30 days` : 'Default baseline'}
                  </AppText>
                </View>
                <AppText style={styles.breakdownValHighlight}>
                  {sym}{averageDailyLimit.toLocaleString('en-IN')}/day
                </AppText>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <View>
                  <AppText style={styles.breakdownLabel}>Daily Grace Limit</AppText>
                  <AppText style={styles.breakdownFormula}>125% buffer for small spikes</AppText>
                </View>
                <AppText style={styles.breakdownVal}>
                  {sym}{Math.round(averageDailyLimit * 1.25).toLocaleString('en-IN')}/day
                </AppText>
              </View>
            </View>

            {/* Explanatory Rule Note */}
            <AppText style={styles.modalFooterNote}>
              Each consecutive day your total spending stays under {sym}{Math.round(averageDailyLimit * 1.25).toLocaleString('en-IN')} adds +1 to your streak. Spending over this limit resets it.
            </AppText>

            {/* Action Button */}
            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setShowStreakModal(false)}
              activeOpacity={0.8}
            >
              <AppText style={styles.modalDoneBtnText}>Done</AppText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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

  // Streak Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#181A22',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  modalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.22)',
  },
  modalCloseCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeroValue: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    paddingTop: 2,
    marginBottom: 2,
  },
  modalHeroSub: {
    color: '#8E919D',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 18,
  },
  breakdownCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  breakdownLabel: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  breakdownFormula: {
    color: '#6F7383',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  breakdownVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  breakdownValHighlight: {
    color: '#FF9D66',
    fontSize: 14,
    fontWeight: '800',
  },
  modalFooterNote: {
    color: '#6F7383',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    marginBottom: 18,
  },
  modalDoneBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    color: '#0A0B0E',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
