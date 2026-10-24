import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { X, ChevronRight, RotateCcw } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useShallow } from 'zustand/react/shallow';
import { AppText } from '@/components/ui';
import AsyncStorage from '@/utils/storage';
import { useExpenseStore, monthKeyOf } from '@/store/useExpenseStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { getAllCoachInsights, getUpcomingFixedSubscriptions, isFixedCommitmentCategory, COACH_DISMISSED_STORAGE_KEY, type CoachInsight, type CoachInsightType } from '@/utils/coachInsight';
import { getBilledDueDate } from '@/utils/creditCard';
import { getSubscriptionActivePrice, toLocalDateString } from '@/utils/date';
import { convertCurrency } from '@/utils/currency';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseAccount } from '@/types/expense';

const TONE: Record<CoachInsightType, string> = {
  bill: '#FF8A8A',
  over: '#FF9D66',
  category: '#FF9D66',
  forecast: '#FFC46B',
  recap: '#9DC6EB',
  safe: '#F48B8B',
};

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface CoachInsightCardProps {
  onPayBill?: (cardAccount: ExpenseAccount) => void;
  onOpenGoals?: () => void;
  onFilterCategory?: (categoryId: string) => void;
}

/**
 * The smart quiet coach line on Home.
 * Displays prioritized financial insights with waterfall dismissal, multi-tip cycling,
 * 4-second instant Undo recovery, and tap-to-action deep linking.
 */
export const CoachInsightCard: React.FC<CoachInsightCardProps> = ({
  onPayBill,
  onOpenGoals,
  onFilterCategory,
}) => {
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
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [justDismissed, setJustDismissed] = useState<CoachInsight | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  // Sync dismissal state on mount and whenever returning to Home tab
  const syncDismissals = useCallback(() => {
    let alive = true;
    AsyncStorage.getItem(COACH_DISMISSED_STORAGE_KEY)
      .then((raw: string | null) => {
        const list: string[] = raw ? JSON.parse(raw) : [];
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

  useFocusEffect(syncDismissals);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const allInsights: CoachInsight[] = useMemo(() => {
    const now = new Date();
    // Only for the current month in progress
    if (selectedMonth !== monthKeyOf(now)) return [];

    const todayKey = dayKey(now);
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Spend per day (your share, no debt repayments), for today and the 14 days before it
    const perDay: Record<string, number> = {};
    const perDayVariable: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== 'expense' || t.categoryId === 'cat_debt_repayment') continue;
      const k = String(t.date).slice(0, 10);
      const share = t.split ? t.split.yourShare : t.amount;
      perDay[k] = (perDay[k] || 0) + share;

      const cat = categories.find((c) => c.id === t.categoryId);
      if (!isFixedCommitmentCategory(cat)) {
        perDayVariable[k] = (perDayVariable[k] || 0) + share;
      }
    }

    // This month's spend per category and last month's recap
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
      dailySpend.push(perDayVariable[dayKey(d)] || 0);
    }

    const totalAllocated = Object.values(categoryBudgets || {}).reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const budget = monthlyBudget > 0 ? monthlyBudget : totalAllocated;

    // Subscriptions still to renew this month (with split bill rules honored)
    const upcomingFixed = getUpcomingFixedSubscriptions(subscriptions, now, currencyCode || 'INR');

    const bills = accounts
      .filter((a) => a.type === 'credit' && !a.isArchived && a.dueDay)
      .map((a) => {
        const dueDate = getBilledDueDate(a.dueDay as number, a.billingDay, now);
        return {
          id: a.id,
          name: a.name,
          billed: Math.max(0, (a.dueAmount || 0) - (a.unbilledDue || 0)),
          dueInDays: Math.round((dueDate.getTime() - todayMidnight.getTime()) / 86400000),
        };
      });
    const liquid = accounts.filter((a) => a.type !== 'credit' && !a.isArchived).reduce((s, a) => s + (a.balance || 0), 0);

    const coachFormat = (n: number) => {
      const raw = formatAmount(n);
      if (raw.startsWith('₹') && !raw.startsWith('₹ ') && !raw.startsWith('₹\u00A0')) {
        return `₹\u00A0${raw.slice(1)}`;
      }
      return raw;
    };

    return getAllCoachInsights({
      now,
      budget,
      spentToDate: getTotalSpent(selectedMonth),
      spentToday: perDay[todayKey] || 0,
      dailySpend,
      upcomingFixed,
      bills,
      liquid,
      categories: categoriesWithBudget,
      lastMonth,
      format: coachFormat,
    });
  }, [transactions, accounts, categories, monthlyBudget, categoryBudgets, selectedMonth, subscriptions, formatAmount, getTotalSpent, currencyCode]);

  // Filter out any dismissed insights (Waterfall: next insight surfaces automatically)
  const activeInsights = useMemo(() => {
    if (dismissed === null) return [];
    return allInsights.filter((ins) => !dismissed.includes(ins.id));
  }, [allInsights, dismissed]);

  // Keep active index in bounds
  const safeIdx = Math.min(activeIdx, Math.max(0, activeInsights.length - 1));
  const currentInsight = activeInsights[safeIdx] || null;
  const shownId = currentInsight ? currentInsight.id : justDismissed ? 'undo-state' : null;

  // Gentle fade when insight changes
  useEffect(() => {
    if (!shownId) return;
    fade.setValue(0.35);
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [shownId]);

  // If all insights dismissed and no active undo prompt, stay quiet
  if (!currentInsight && !justDismissed) return null;

  const dismiss = () => {
    if (!currentInsight) return;
    Haptics.selectionAsync().catch(() => {});

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

    const dismissing = currentInsight;
    const next = [...(dismissed || []), dismissing.id];
    setDismissed(next);
    setJustDismissed(dismissing);
    AsyncStorage.setItem(COACH_DISMISSED_STORAGE_KEY, JSON.stringify(next)).catch(() => {});

    // Offer instant Undo for 4 seconds
    undoTimeoutRef.current = setTimeout(() => {
      setJustDismissed(null);
    }, 4000);
  };

  const handleUndo = () => {
    if (!justDismissed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

    const restoredId = justDismissed.id;
    const next = (dismissed || []).filter((id) => id !== restoredId);
    setDismissed(next);
    setJustDismissed(null);
    AsyncStorage.setItem(COACH_DISMISSED_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const handleNextTip = () => {
    if (activeInsights.length <= 1) return;
    Haptics.selectionAsync().catch(() => {});
    setActiveIdx((prev) => (prev + 1) % activeInsights.length);
  };

  const handleCardPress = () => {
    if (!currentInsight || !currentInsight.action) {
      if (activeInsights.length > 1) handleNextTip();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (currentInsight.action.type === 'pay_bill' && currentInsight.action.accountId) {
      const card = accounts.find((a) => a.id === currentInsight.action?.accountId);
      if (card && onPayBill) onPayBill(card);
    } else if (currentInsight.action.type === 'open_goals') {
      onOpenGoals?.();
    } else if (currentInsight.action.type === 'filter_category' && currentInsight.action.categoryId) {
      onFilterCategory?.(currentInsight.action.categoryId);
    }
  };

  // Solo undo card state (when the last/only insight was dismissed)
  if (!currentInsight && justDismissed) {
    return (
      <Animated.View style={[styles.card, styles.undoCard, { opacity: fade }]}>
        <View style={styles.undoLeft}>
          <View style={[styles.dot, { backgroundColor: '#F48B8B' }]} />
          <AppText style={styles.undoText}>Tip dismissed</AppText>
        </View>
        <TouchableOpacity
          onPress={handleUndo}
          style={styles.undoBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <RotateCcw size={12} color="#F48B8B" strokeWidth={2.5} />
          <AppText style={styles.undoBtnText}>Undo</AppText>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (!currentInsight) return null;

  return (
    <Animated.View style={[styles.card, { opacity: fade }]}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={handleCardPress}
        activeOpacity={currentInsight.action ? 0.75 : 1}
      >
        <View style={[styles.dot, { backgroundColor: TONE[currentInsight.type] }]} />
        <View style={styles.textCol}>
          <AppText style={styles.title} numberOfLines={2}>
            {currentInsight.title}
          </AppText>
          <AppText style={styles.sub} numberOfLines={2}>
            {currentInsight.sub}
          </AppText>
        </View>

        {currentInsight.action && (
          <View style={styles.actionPill}>
            <ChevronRight size={13} color={TONE[currentInsight.type]} strokeWidth={2.5} />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.actionsRight}>
        {justDismissed && (
          <TouchableOpacity
            style={styles.undoPillBtn}
            onPress={handleUndo}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <RotateCcw size={11} color="#F48B8B" strokeWidth={2.5} />
            <AppText style={styles.undoPillText}>Undo</AppText>
          </TouchableOpacity>
        )}

        {activeInsights.length > 1 && (
          <TouchableOpacity
            style={styles.badgeBtn}
            onPress={handleNextTip}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <AppText style={styles.badgeText}>
              {safeIdx + 1}/{activeInsights.length}
            </AppText>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={dismiss}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 10 }}
          style={styles.dismissBtn}
          accessibilityLabel="Dismiss for today"
        >
          <X size={13} color={expenseColors.textMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textCol: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  sub: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  actionPill: {
    marginRight: 2,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  badgeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: expenseColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  dismissBtn: {
    padding: 2,
  },
  undoCard: {
    justifyContent: 'space-between',
    paddingVertical: 10,
    backgroundColor: 'rgba(244, 139, 139, 0.08)',
    borderColor: 'rgba(244, 139, 139, 0.22)',
  },
  undoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  undoText: {
    color: expenseColors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(244, 139, 139, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  undoBtnText: {
    color: '#F48B8B',
    fontSize: 12,
    fontWeight: '700',
  },
  undoPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244, 139, 139, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  undoPillText: {
    color: '#F48B8B',
    fontSize: 11,
    fontWeight: '700',
  },
});
