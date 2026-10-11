import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useShallow } from 'zustand/react/shallow';
import { AppText } from '@/components/ui';
import AsyncStorage from '@/utils/storage';
import { useExpenseStore, monthKeyOf } from '@/store/useExpenseStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { buildCoachInsight, type CoachInsight, type CoachInsightType } from '@/utils/coachInsight';
import { getBilledDueDate } from '@/utils/creditCard';
import { getSubscriptionActivePrice, toLocalDateString } from '@/utils/date';
import { convertCurrency } from '@/utils/currency';
import { expenseColors } from '@/constants/expenseColors';

const STORAGE_KEY = '@coach_dismissed_v1';

const TONE: Record<CoachInsightType, string> = {
  bill: '#FF8A8A',
  over: '#FF9D66',
  category: '#FF9D66',
  forecast: '#FFC46B',
  recap: '#9DC6EB',
  safe: '#70D6BC',
};

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The one quiet line on Home. It renders nothing unless there is something worth saying, and
 * dismissing it hides that insight for the rest of the day.
 */
export const CoachInsightCard: React.FC = () => {
  const { transactions, accounts, categories, monthlyBudget, categoryBudgets, selectedMonth, formatAmount, getTotalSpent, currencyCode } =
    useExpenseStore(
      useShallow((s) => ({
        transactions: s.transactions,
        accounts: s.accounts,
        categories: s.categories,
        monthlyBudget: s.monthlyBudget,
        categoryBudgets: s.categoryBudgets,
        selectedMonth: s.selectedMonth,
        formatAmount: s.formatAmount,
        getTotalSpent: s.getTotalSpent,
        currencyCode: s.currencyCode,
      }))
    );
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  const [dismissed, setDismissed] = useState<string[] | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw: string | null) => {
        const list: string[] = raw ? JSON.parse(raw) : [];
        // Keep only dismissals that still apply (today's, or this month's) so the list never grows
        const now = new Date();
        const dayEnd = dayKey(now);
        const monthEnd = dayEnd.slice(0, 7);
        if (alive) setDismissed(list.filter((id) => id.endsWith(dayEnd) || id.endsWith(monthEnd)));
      })
      .catch(() => alive && setDismissed([]));
    return () => {
      alive = false;
    };
  }, []);

  const insight: CoachInsight | null = useMemo(() => {
    const now = new Date();
    // Only for the month in progress
    if (selectedMonth !== monthKeyOf(now)) return null;

    const todayKey = dayKey(now);
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Spend per day (your share, no debt repayments), for today and the 14 days before it
    const perDay: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== 'expense' || t.categoryId === 'cat_debt_repayment') continue;
      const k = String(t.date).slice(0, 10);
      perDay[k] = (perDay[k] || 0) + (t.split ? t.split.yourShare : t.amount);
    }
    // This month's spend per category (for categories that have their own budget) and last month's recap
    const monthPrefix = todayKey.slice(0, 7);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevPrefix = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const catSpentThisMonth: Record<string, number> = {};
    const catSpentLastMonth: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== 'expense' || t.categoryId === 'cat_debt_repayment') continue;
      const k = String(t.date).slice(0, 7);
      const share = t.split ? t.split.yourShare : t.amount;
      if (k === monthPrefix) catSpentThisMonth[t.categoryId] = (catSpentThisMonth[t.categoryId] || 0) + share;
      else if (k === prevPrefix) catSpentLastMonth[t.categoryId] = (catSpentLastMonth[t.categoryId] || 0) + share;
    }
    const nameOf = (id: string) => categories.find((c) => c.id === id)?.name || 'Other';
    const categoriesWithBudget = Object.entries(categoryBudgets || {})
      .filter(([, b]) => b > 0)
      .map(([id, budget]) => ({ id, name: nameOf(id), spent: catSpentThisMonth[id] || 0, budget }));
    const lastTotal = Object.values(catSpentLastMonth).reduce((a, b) => a + b, 0);
    const topLast = Object.entries(catSpentLastMonth).sort((a, b) => b[1] - a[1])[0];
    const lastMonth =
      lastTotal > 0
        ? { label: prev.toLocaleDateString('en-US', { month: 'long' }), spent: lastTotal, topCategory: topLast ? nameOf(topLast[0]) : undefined }
        : null;

    const dailySpend: number[] = [];
    for (let back = 14; back >= 1; back--) {
      const d = new Date(todayMidnight);
      d.setDate(d.getDate() - back);
      dailySpend.push(perDay[dayKey(d)] || 0);
    }

    const totalAllocated = Object.values(categoryBudgets || {}).reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const budget = monthlyBudget > 0 ? monthlyBudget : totalAllocated;

    // Subscriptions still to renew this month (cannot yet be in the ledger)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    let upcomingFixed = 0;
    for (const sub of subscriptions) {
      if (sub.isPaused || sub.isTrial || !sub.nextBillingDate) continue;
      const due = new Date(`${toLocalDateString(sub.nextBillingDate)}T12:00:00`);
      if (due > now && due <= monthEnd) {
        const price = getSubscriptionActivePrice(sub);
        upcomingFixed += sub.currency && sub.currency.toUpperCase() !== (currencyCode || 'INR').toUpperCase()
          ? convertCurrency(price, sub.currency, currencyCode || 'INR')
          : price;
      }
    }

    const bills = accounts
      .filter((a) => a.type === 'credit' && !a.isArchived && a.dueDay)
      .map((a) => {
        const dueDate = getBilledDueDate(a.dueDay as number, a.billingDay, now);
        return {
          name: a.name,
          billed: Math.max(0, (a.dueAmount || 0) - (a.unbilledDue || 0)),
          dueInDays: Math.round((dueDate.getTime() - todayMidnight.getTime()) / 86400000),
        };
      });
    const liquid = accounts.filter((a) => a.type !== 'credit' && !a.isArchived).reduce((s, a) => s + (a.balance || 0), 0);

    return buildCoachInsight({
      now,
      budget,
      spentToDate: getTotalSpent(),
      spentToday: perDay[todayKey] || 0,
      dailySpend,
      upcomingFixed,
      bills,
      liquid,
      categories: categoriesWithBudget,
      lastMonth,
      format: formatAmount,
    });
  }, [transactions, accounts, categories, monthlyBudget, categoryBudgets, selectedMonth, subscriptions, formatAmount, getTotalSpent, currencyCode]);

  const visible = !!insight && dismissed !== null && !dismissed.includes(insight.id);
  const shownId = visible ? insight!.id : null;

  // Gentle fade when a new insight appears (opacity only, native)
  useEffect(() => {
    if (!shownId) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [shownId, fade]);

  if (!visible || !insight) return null;

  const dismiss = () => {
    Haptics.selectionAsync().catch(() => {});
    const next = [...(dismissed || []), insight.id];
    setDismissed(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  return (
    <Animated.View style={[styles.card, { opacity: fade }]}>
      <View style={[styles.dot, { backgroundColor: TONE[insight.type] }]} />
      <View style={styles.textCol}>
        <AppText style={styles.title} numberOfLines={2}>{insight.title}</AppText>
        <AppText style={styles.sub} numberOfLines={2}>{insight.sub}</AppText>
      </View>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Dismiss for today">
        <X size={14} color={expenseColors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  textCol: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  sub: { color: expenseColors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 2 },
});
