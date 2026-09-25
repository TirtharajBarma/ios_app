import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Flame, ShieldCheck, TrendingUp, Sparkles } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';

export const DisciplineScoreCard: React.FC = () => {
  const {
    transactions,
    monthlyBudget,
    selectedMonth,
    getTotalIncome,
    getTotalSpent,
    accounts,
    currencySymbol,
  } = useExpenseStore();

  const sym = currencySymbol || '₹';

  const totalIncome = getTotalIncome();
  const totalSpent = getTotalSpent();
  const netCashFlow = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalSpent) / totalIncome) * 100) : 0;

  // 1. Calculate Daily Discipline Streak
  const streakDays = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    if (currentDay <= 1) return 1;

    // Check expense transactions in the current month
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
      // Exclude huge fixed transactions (e.g. Rent > 5000) from daily streak break
      const daySpend = dailySpendMap[day] || 0;
      if (daySpend <= averageDailyLimit * 1.25) {
        streak++;
      } else {
        break;
      }
    }

    return Math.max(1, streak);
  }, [transactions, monthlyBudget]);

  // 2. Compute 0-100 Financial Health Score
  const { healthScore, scoreLabel, scoreColor } = useMemo(() => {
    let score = 0;

    // Savings Pillar (max 40 pts)
    if (savingsRate >= 25) {
      score += 40;
    } else if (savingsRate >= 15) {
      score += 30;
    } else if (savingsRate > 0) {
      score += 20;
    } else {
      score += 5;
    }

    // Budget Adherence Pillar (max 40 pts)
    if (monthlyBudget > 0) {
      if (totalSpent <= monthlyBudget * 0.8) {
        score += 40;
      } else if (totalSpent <= monthlyBudget) {
        score += 30;
      } else {
        score += 10;
      }
    } else {
      score += 35; // Default healthy if no overspending
    }

    // Debt & Liquidity Pillar (max 20 pts)
    const hasHighCreditDues = accounts.some(
      (a) => a.type === 'credit' && (a.dueAmount || 0) > (totalIncome > 0 ? totalIncome * 0.5 : 20000)
    );
    if (!hasHighCreditDues) {
      score += 20;
    } else {
      score += 5;
    }

    score = Math.min(100, Math.max(0, score));

    let label = 'Strong';
    let color = '#70D6BC';

    if (score >= 90) {
      label = 'Elite';
      color = '#70D6BC';
    } else if (score >= 75) {
      label = 'Healthy';
      color = '#70D6BC';
    } else if (score >= 50) {
      label = 'Moderate';
      color = '#FF9D66';
    } else {
      label = 'Needs Care';
      color = '#FF6B6B';
    }

    return { healthScore: score, scoreLabel: label, scoreColor: color };
  }, [savingsRate, monthlyBudget, totalSpent, accounts, totalIncome]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Left: Daily Streak */}
        <View style={styles.pillar}>
          <View style={styles.pillarHeader}>
            <View style={styles.iconCirclePeach}>
              <Flame size={13} color="#FF9D66" />
            </View>
            <AppText style={styles.pillarTitle}>STREAK</AppText>
          </View>
          <AppText style={styles.pillarValue}>{streakDays} Days</AppText>
          <AppText style={styles.pillarSub}>Within daily pace</AppText>
        </View>

        <View style={styles.divider} />

        {/* Middle: Savings Rate */}
        <View style={styles.pillar}>
          <View style={styles.pillarHeader}>
            <View style={styles.iconCirclePurple}>
              <TrendingUp size={13} color="#C4A7E7" />
            </View>
            <AppText style={styles.pillarTitle}>SAVINGS</AppText>
          </View>
          <AppText style={styles.pillarValue}>
            {savingsRate > 0 ? `${savingsRate}%` : '0%'}
          </AppText>
          <AppText style={styles.pillarSub}>Income retained</AppText>
        </View>

        <View style={styles.divider} />

        {/* Right: Financial Health Index */}
        <View style={styles.pillar}>
          <View style={styles.pillarHeader}>
            <View style={styles.iconCircleMint}>
              <ShieldCheck size={13} color="#70D6BC" />
            </View>
            <AppText style={styles.pillarTitle}>HEALTH</AppText>
          </View>
          <AppText style={[styles.pillarValue, { color: scoreColor }]}>
            {healthScore}/100
          </AppText>
          <AppText style={styles.pillarSub}>{scoreLabel}</AppText>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#16181D',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  pillar: {
    flex: 1,
    alignItems: 'center',
  },
  pillarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  iconCirclePeach: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCirclePurple: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(196, 167, 231, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleMint: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarTitle: {
    color: '#7E8394',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  pillarValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 1,
  },
  pillarSub: {
    color: '#656A7B',
    fontSize: 9,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
});
