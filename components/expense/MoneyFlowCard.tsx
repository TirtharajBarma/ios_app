import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Sparkles, Flame, X, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore, isInMonth, monthKeyToYearMonth } from '@/store/useExpenseStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { getUpcomingFixedSubscriptions, getUpcomingFixedCommitments, isFixedCommitmentCategory } from '@/utils/coachInsight';
import { useShallow } from 'zustand/react/shallow';
import { expenseColors } from '@/constants/expenseColors';
import { parseTxDate } from '@/utils/localDate';

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
  categoryBudgets,
  categories,
  accounts,
  currencyCode,
  getTotalIncome,
  getTotalSpent,
  updateTransaction,
  getBudgetBufferAnalysis,
} = useExpenseStore(
  useShallow((s) => ({
    currencySymbol: s.currencySymbol,
    currencyCode: s.currencyCode,
    transactions: s.transactions,
    selectedMonth: s.selectedMonth,
    monthlyBudget: s.monthlyBudget,
    categoryBudgets: s.categoryBudgets,
    categories: s.categories,
    accounts: s.accounts,
    getTotalIncome: s.getTotalIncome,
    getTotalSpent: s.getTotalSpent,
    updateTransaction: s.updateTransaction,
    getBudgetBufferAnalysis: s.getBudgetBufferAnalysis,
  }))
);

  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const sym = currencySymbol || '₹';

  const { year, month } = useMemo(() => monthKeyToYearMonth(selectedMonth), [selectedMonth]);

  const totalIncome = getTotalIncome(selectedMonth);
  const totalSpent = getTotalSpent(selectedMonth);
  const bufferAnalysis = getBudgetBufferAnalysis(selectedMonth);

  const priorMonthUnallocatedSalary = useMemo(() => {
    if (totalIncome > 0) return null;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    return (
      transactions.find((t) => {
        if (t.type !== 'income' || t.allocatedMonth) return false;
        if (
          t.categoryId === 'cat_split_return' ||
          t.categoryId === 'cat_debt_repayment' ||
          t.settledTxId?.startsWith('split_settle:') ||
          t.settledTxId?.startsWith('debt_settle:')
        )
          return false;
        const parts = t.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!parts) return false;
        const y = parseInt(parts[1], 10);
        const m = parseInt(parts[2], 10) - 1;
        const d = parseInt(parts[3], 10);
        return y === prevYear && m === prevMonth && d >= 24;
      }) || null
    );
  }, [totalIncome, transactions, year, month]);

  const hasAllocatedIncome = useMemo(() => {
    const targetMonthNormalized = selectedMonth.trim().toLowerCase();
    return transactions.some(
      (t) =>
        t.type === 'income' &&
        t.allocatedMonth &&
        t.allocatedMonth.trim().toLowerCase() === targetMonthNormalized &&
        !isInMonth(t.date, year, month)
    );
  }, [transactions, selectedMonth, year, month]);

  const vaultDepositsThisMonth = useMemo(() => {
    const targetMonthNormalized = selectedMonth.trim().toLowerCase();
    return transactions
      .filter((t) =>
        t.type === 'vault_deposit' &&
        (t.allocatedMonth
          ? t.allocatedMonth.trim().toLowerCase() === targetMonthNormalized
          : isInMonth(t.date, year, month))
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, selectedMonth, year, month]);

  const vaultWithdrawsThisMonth = useMemo(() => {
    const targetMonthNormalized = selectedMonth.trim().toLowerCase();
    return transactions
      .filter((t) =>
        t.type === 'vault_withdraw' &&
        (t.allocatedMonth
          ? t.allocatedMonth.trim().toLowerCase() === targetMonthNormalized
          : isInMonth(t.date, year, month))
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, selectedMonth, year, month]);

  const [showStreakModal, setShowStreakModal] = useState(false);

  const committedSavings = Math.max(vaultDepositsThisMonth, bufferAnalysis.committedGoals || 0);
  const netCashFlow = totalIncome - totalSpent - committedSavings + vaultWithdrawsThisMonth;
  const savingsRate = totalIncome > 0
    ? Math.round((netCashFlow / totalIncome) * 100)
    : 0;

  // Same effective budget as the Budget card: the monthly limit, or the sum of category budgets when no limit is set
  const effectiveBudget =
    monthlyBudget > 0
      ? monthlyBudget
      : Object.values(categoryBudgets || {}).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
  const daysInSelectedMonth = new Date(year, month + 1, 0).getDate();
  const averageDailyLimit = effectiveBudget > 0 ? Math.round(effectiveBudget / daysInSelectedMonth) : 0; // no budget: no daily limit, no streak

  const now = new Date();
  const isCurMonth = year === now.getFullYear() && month === now.getMonth();
  const currentDay = isCurMonth ? now.getDate() : daysInSelectedMonth;
  const daysRemaining = isCurMonth ? Math.max(1, daysInSelectedMonth - currentDay + 1) : 0;
  const upcomingFixed = isCurMonth
    ? getUpcomingFixedCommitments({
        subscriptions,
        categories,
        categoryBudgets,
        transactions,
        accounts,
        now,
        selectedMonth,
        currencyCode: currencyCode || 'INR',
      }).total
    : 0;
  const budgetRunway = Math.max(0, effectiveBudget - totalSpent);
  const netBudgetRunway = Math.max(0, budgetRunway - upcomingFixed);
  const safeDailyPace = effectiveBudget > 0 && daysRemaining > 0
    ? Math.max(0, Math.round(netBudgetRunway / daysRemaining))
    : 0;

  // Streak Calculation
  const streakDays = useMemo(() => {
    const now = new Date();
    const { year: curY, month: curM } = monthKeyToYearMonth(selectedMonth);
    const isCur = curY === now.getFullYear() && curM === now.getMonth();
    // A month that has not started has no streak
    if (curY * 12 + curM > now.getFullYear() * 12 + now.getMonth()) return 0;
    const daysInSelMonth = new Date(curY, curM + 1, 0).getDate();
    const currentDay = isCur ? now.getDate() : daysInSelMonth;
    if (currentDay < 1) return 0;

    const dailySpendMap: Record<number, number> = {};
    for (let d = 1; d <= currentDay; d++) {
      dailySpendMap[d] = 0;
    }

    let anyExpense = false;
    transactions
      .filter((t) => {
        if (t.type !== 'expense' || t.categoryId === 'cat_debt_repayment') return false;
        const cat = categories.find((c) => c.id === t.categoryId);
        if (isFixedCommitmentCategory(cat)) return false;
        return true;
      })
      .forEach((t) => {
        const parts = t.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (parts) {
          const y = parseInt(parts[1], 10);
          const m = parseInt(parts[2], 10) - 1;
          const day = parseInt(parts[3], 10);
          if (m === curM && y === curY) {
            anyExpense = true;
            dailySpendMap[day] = (dailySpendMap[day] || 0) + (t.split ? t.split.yourShare : t.amount);
          }
        }
      });
    // Nothing logged this month: an empty month is not a "discipline streak"
    if (!anyExpense) return 0;

    let streak = 0;
    if (averageDailyLimit <= 0) return 0;
    for (let day = currentDay; day >= 1; day--) {
      const daySpend = dailySpendMap[day] || 0;
      if (daySpend <= averageDailyLimit * 1.25) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [transactions, selectedMonth, averageDailyLimit]);

  const isPacingDanger =
    effectiveBudget > 0 &&
    (totalSpent >= effectiveBudget ||
      (daysRemaining > 0 && safeDailyPace < Math.max(50, averageDailyLimit * 0.4)));
  const showStreakPill = streakDays > 0 && !isPacingDanger;

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

        {showStreakPill ? (
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
        ) : isCurMonth && daysRemaining > 0 ? (
          <View style={styles.daysLeftPill}>
            <AppText style={styles.daysLeftPillText}>{daysRemaining}d left</AppText>
          </View>
        ) : null}
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
          <AppText style={styles.tileAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {sym}{totalSpent.toLocaleString('en-IN')}
          </AppText>
          <AppText style={styles.tileSub} numberOfLines={1}>
            {vaultDepositsThisMonth > 0
              ? `+${sym}${vaultDepositsThisMonth.toLocaleString('en-IN')} in vaults`
              : committedSavings > 0
              ? `${sym}${committedSavings.toLocaleString('en-IN')} goals safe`
              : 'Total Outflow'}
          </AppText>
        </View>

        {/* Income Tile */}
        <View style={styles.metricTile}>
          <View style={styles.tileHeader}>
            <View style={[styles.arrowBadge, { backgroundColor: 'rgba(112, 214, 188, 0.12)' }]}>
              <ArrowUpRight size={12} color={pastelColors.mint} strokeWidth={2.5} />
            </View>
            <AppText style={styles.tileLabel}>INCOME</AppText>
          </View>
          <AppText style={styles.tileAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {sym}{totalIncome.toLocaleString('en-IN')}
          </AppText>
          <AppText style={styles.tileSub} numberOfLines={1}>
            {totalIncome > 0
              ? hasAllocatedIncome
                ? 'Includes allocated'
                : 'Total Inflow'
              : 'No Inflow'}
          </AppText>
        </View>
      </View>

      {/* 3. Footer Cashflow & Net Retention Summary */}
      <View style={styles.footerRow}>
        {totalIncome > 0 ? (
          <>
            <View style={styles.footerLeft}>
              <AppText style={styles.footerLabel}>Net Cash Flow</AppText>
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
        ) : priorMonthUnallocatedSalary ? (
          <View style={styles.allocateRow}>
            <View style={styles.allocateLeft}>
              <Sparkles size={12} color={pastelColors.mint} />
              <AppText style={styles.allocateText} numberOfLines={1}>
                {sym}{priorMonthUnallocatedSalary.amount.toLocaleString('en-IN')} on {parseTxDate(priorMonthUnallocatedSalary.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </AppText>
            </View>
            <TouchableOpacity
              style={styles.allocateBtn}
              activeOpacity={0.75}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                updateTransaction(priorMonthUnallocatedSalary.id, { allocatedMonth: selectedMonth });
              }}
            >
              <AppText style={styles.allocateBtnText}>
                Allocate to {new Date(year, month, 1).toLocaleDateString('en-US', { month: 'short' })}
              </AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.footerLeft}>
            <Sparkles size={12} color={pastelColors.purple} />
            <AppText style={styles.footerLabel}>
              Log monthly income to see net cash flow & unspent %
            </AppText>
          </View>
        )}
      </View>

      {/* Apple-Style Minimal Streak Sheet */}
      <Modal
        visible={showStreakModal}
        transparent
        statusBarTranslucent={true}
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
                  {monthlyBudget > 0 ? `${sym} ${monthlyBudget.toLocaleString('en-IN')}` : 'Not set'}
                </AppText>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <View>
                  <AppText style={styles.breakdownLabel}>Day-1 Baseline Target</AppText>
                  <AppText style={styles.breakdownFormula}>
                    {effectiveBudget > 0 ? `${sym} ${effectiveBudget.toLocaleString('en-IN')} ÷ ${daysInSelectedMonth} days` : 'Default baseline'}
                  </AppText>
                </View>
                <AppText style={styles.breakdownVal}>
                  {sym} {averageDailyLimit.toLocaleString('en-IN')}/day
                </AppText>
              </View>

              <View style={styles.breakdownDivider} />

              <View style={styles.breakdownRow}>
                <View>
                  <AppText style={styles.breakdownLabel}>Today's Safe Pace</AppText>
                  <AppText style={styles.breakdownFormula}>
                    {isCurMonth && safeDailyPace > 0
                      ? `${daysRemaining} days left • bills reserved`
                      : 'Active month pace'}
                  </AppText>
                </View>
                <AppText style={styles.breakdownValHighlight}>
                  {isCurMonth && safeDailyPace > 0
                    ? `${sym} ${safeDailyPace.toLocaleString('en-IN')}/day`
                    : `${sym} ${averageDailyLimit.toLocaleString('en-IN')}/day`}
                </AppText>
              </View>
            </View>

            {/* Explanatory Rule Note */}
            <AppText style={styles.modalFooterNote}>
              {isCurMonth && safeDailyPace > 0 && safeDailyPace < averageDailyLimit
                ? `You've kept a ${streakDays}-day streak of disciplined daily spending! Earlier expenses used most of this month's budget, so aim for ${sym} ${safeDailyPace.toLocaleString('en-IN')}/day to keep your streak and budget intact.`
                : `Each consecutive day your total spending stays under ${sym} ${Math.round(averageDailyLimit * 1.25).toLocaleString('en-IN')} adds +1 to your streak. Spending over this limit resets it.`}
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
  daysLeftPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  daysLeftPillText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
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
    fontWeight: '500',
    letterSpacing: -0.3,
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
    fontWeight: '600',
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
  allocateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  allocateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  allocateText: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  allocateBtn: {
    backgroundColor: 'rgba(112, 214, 188, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(112, 214, 188, 0.28)',
    flexShrink: 0,
  },
  allocateBtnText: {
    color: pastelColors.mint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
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
