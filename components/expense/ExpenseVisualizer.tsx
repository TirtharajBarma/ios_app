import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { Flame, Trophy, Plus, Zap, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseTransaction } from '@/types/expense';

import { useRouter, useFocusEffect } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const customSpringLayout = {
  duration: 300,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.spring,
    springDamping: 0.75,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};
import { formatCompactCurrency } from './MoneyFlowCard';

export type TimeHorizon = '1W' | '1M' | '6M' | '1Y' | 'ALL';

const SW = Dimensions.get('window').width;

// ─────────────────────────────────────────────
// ALL SIZES ARE COMPUTED FROM SCREEN WIDTH
// ─────────────────────────────────────────────
const PAGE_M   = 16;           // page horizontal margin
const CARD_P   = 16;           // compact card inner padding
const CARD_W   = SW - PAGE_M * 2;
const INNER_W  = CARD_W - CARD_P * 2;

// ── Calendar ─────────────────────────────────
const CAL_GAP      = 5;
const CAL_ROW_GAP  = 4;
const TILE_W       = Math.floor((INNER_W - CAL_GAP * 6) / 7);
const TILE_H       = 32;       // compact tile height to reduce card height

// ── Sankey ───────────────────────────────────
const INCOME_W  = 38;
const RLABEL_W  = Math.max(96, Math.min(112, Math.round(INNER_W * 0.31)));
const SVG_W     = INNER_W - INCOME_W - RLABEL_W;
const CHART_H   = 200;
const SRC_W     = 8;
const DST_W     = 8;
const DST_GAP   = 6;

// ─────────────────────────────────────────────
// FLOW CATEGORIES
// ─────────────────────────────────────────────
interface FlowCat {
  id: string;
  label: string;
  name: string;
  emoji?: string;
  amount: number;
  color: string;
}

// ─────────────────────────────────────────────
// SANKEY STREAM BUILDER
// ─────────────────────────────────────────────
interface Stream { cat: FlowCat; path: string; dY1: number; dY2: number; }

const MIN_SRC_H = 4;
const MIN_DST_H = 6;
const LABEL_H = 22;

function buildStreams(cats: FlowCat[], chartHeight: number): Stream[] {
  const active = cats.filter(c => c.amount > 0);
  const total  = active.reduce((s, c) => s + c.amount, 0);
  if (!total) return [];

  const n = active.length;
  // Adaptive gap between destination bars
  const gap = n > 1 ? Math.max(3, Math.min(6, Math.floor((chartHeight * 0.15) / (n - 1)))) : 0;
  const totalDestGaps = (n - 1) * gap;
  const destAvail     = Math.max(chartHeight - totalDestGaps, n * MIN_DST_H);

  const extraDest = Math.max(0, destAvail - n * MIN_DST_H);
  const extraSrc  = Math.max(0, chartHeight - n * MIN_SRC_H);

  const srcRX = SRC_W;
  const dstLX = SVG_W - DST_W;
  const cp    = (dstLX - srcRX) * 0.48;

  let srcY = 0, dstY = 0;
  return active.map(cat => {
    const weight = cat.amount / total;
    const srcH = MIN_SRC_H + weight * extraSrc;
    const dstH = MIN_DST_H + weight * extraDest;

    const sY1 = srcY, sY2 = srcY + srcH;
    const dY1 = dstY, dY2 = dstY + dstH;

    const path = [
      `M ${srcRX} ${sY1}`,
      `C ${srcRX + cp} ${sY1}, ${dstLX - cp} ${dY1}, ${dstLX} ${dY1}`,
      `L ${dstLX} ${dY2}`,
      `C ${dstLX - cp} ${dY2}, ${srcRX + cp} ${sY2}, ${srcRX} ${sY2}`,
      'Z',
    ].join(' ');

    srcY = sY2;
    dstY = dY2 + gap;
    return { cat, path, dY1, dY2 };
  });
}

// ─────────────────────────────────────────────
// LABEL Y-POSITION RESOLVER
// ─────────────────────────────────────────────
function resolveY(streams: Stream[], chartHeight: number): number[] {
  const n = streams.length;
  if (!n) return [];
  if (n === 1) return [Math.max(0, (streams[0].dY1 + streams[0].dY2) / 2 - LABEL_H / 2)];

  const MIN_SPACING = LABEL_H + 2; // 24px between label tops
  // Start at midpoints of destination bars
  const pos = streams.map(s => (s.dY1 + s.dY2) / 2 - LABEL_H / 2);

  // Forward pass: avoid top overlaps
  for (let i = 1; i < n; i++) {
    if (pos[i] < pos[i - 1] + MIN_SPACING) {
      pos[i] = pos[i - 1] + MIN_SPACING;
    }
  }

  // Backward pass: ensure bottom labels don't exceed chart bottom
  const maxBottom = chartHeight - LABEL_H;
  if (pos[n - 1] > maxBottom) {
    pos[n - 1] = maxBottom;
    for (let i = n - 2; i >= 0; i--) {
      if (pos[i] > pos[i + 1] - MIN_SPACING) {
        pos[i] = pos[i + 1] - MIN_SPACING;
      }
    }
  }

  // If top pushed above 0, uniformly distribute
  if (pos[0] < 0) {
    const span = (chartHeight - LABEL_H) / Math.max(n - 1, 1);
    for (let i = 0; i < n; i++) {
      pos[i] = Math.round(i * span);
    }
  }

  return pos;
}

// ─────────────────────────────────────────────
// DATA TYPES
// ─────────────────────────────────────────────
const RHYTHM_BAR_H = 110;

interface RhythmDay {
  day: string;
  amt: number;
  showLabel: boolean;
  labelText?: string;
}

interface VsCat {
  id: string;
  name: string;
  emoji?: string;
  thisAmount: number;
  lastAmount: number;
  formatted: string;
  thisPercent: number;
  lastPercent: number;
  changeBadge: string;
  isNew: boolean;
  isIncrease: boolean;
  color: string;
}

// ── Robust ISO Date Parser (Avoids UTC Midnight Timezone Shifts) ──
function parseTxDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  return new Date(dateStr);
}

// ── Dynamic Month/Year Parser ─────────────────
function getMonthYearInfo(monthStr: string) {
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthShorts = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  const now = new Date();
  const str = (monthStr || `${monthNames[now.getMonth()]} ${now.getFullYear()}`).toLowerCase();
  let year = now.getFullYear();
  let month = now.getMonth();

  const yr = str.match(/\b(\d{4})\b/);
  if (yr) year = parseInt(yr[1], 10);

  let matchedFullName = false;
  monthNames.forEach((m, i) => { if (str.includes(m)) { month = i; matchedFullName = true; } });
  if (!matchedFullName) {
    monthShorts.forEach((m, i) => { if (str.includes(m)) month = i; });
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon, 2 = Tue...

  const lastMonth = month === 0 ? 11 : month - 1;
  const lastYear = month === 0 ? year - 1 : year;

  return { year, month, daysInMonth, startOffset, lastYear, lastMonth };
}

// ── Horizon time window (shared by trend, contrast, and breakdown) ──────
function horizonWindow(
  timeHorizon: TimeHorizon,
  curYear: number,
  curMonth: number,
  daysInMonth: number,
  transactions: ExpenseTransaction[]
): { start: Date; end: Date } {
  const now = new Date();
  const isCurrentMonth = curYear === now.getFullYear() && curMonth === now.getMonth();

  if (timeHorizon === '1W') {
    if (isCurrentMonth) {
      // Rolling 7 days up to end of today
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      return { start, end };
    } else {
      // Past/future selected month: last 7 days of that month
      const end = new Date(curYear, curMonth, daysInMonth, 23, 59, 59, 999);
      const start = new Date(curYear, curMonth, Math.max(1, daysInMonth - 6), 0, 0, 0, 0);
      return { start, end };
    }
  }
  if (timeHorizon === '1M') {
    return {
      start: new Date(curYear, curMonth, 1, 0, 0, 0, 0),
      end: new Date(curYear, curMonth, daysInMonth, 23, 59, 59, 999),
    };
  }
  if (timeHorizon === '6M') {
    return {
      start: new Date(curYear, curMonth - 5, 1, 0, 0, 0, 0),
      end: new Date(curYear, curMonth + 1, 0, 23, 59, 59, 999),
    };
  }
  if (timeHorizon === '1Y') {
    return {
      start: new Date(curYear, curMonth - 11, 1, 0, 0, 0, 0),
      end: new Date(curYear, curMonth + 1, 0, 23, 59, 59, 999),
    };
  }
  // ALL: from the earliest expense on record to future
  const expenseTimes = transactions
    .filter((t) => t.type === 'expense')
    .map((t) => parseTxDate(t.date).getTime());
  const earliestMs = expenseTimes.length > 0 ? Math.min(...expenseTimes) : null;
  const start = earliestMs !== null
    ? new Date(new Date(earliestMs).getFullYear(), new Date(earliestMs).getMonth(), 1, 0, 0, 0, 0)
    : new Date(curYear, curMonth, 1, 0, 0, 0, 0);
  return { start, end: new Date(curYear + 10, 11, 31, 23, 59, 59, 999) };
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export const ExpenseVisualizer: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedMonth, transactions, categories: storeCategories, currencySymbol } = useExpenseStore();
  const sym = currencySymbol || '₹';
  const { subscriptions, isLoaded: isSubsLoaded, loadSubscriptions } = useSubscriptionStore();
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('1M');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [displayedDay, setDisplayedDay] = useState<number | null>(null);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSubsLoaded) {
      loadSubscriptions();
    }
  }, [isSubsLoaded, loadSubscriptions]);

  const toggleBandSelection = (catId: string) => {
    if (selectedBandId === catId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedBandId(null);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setSelectedBandId(catId);
    }
  };

  const scrollRef = useRef<ScrollView>(null);

  // Reset scroll to top on tab focus
  useFocusEffect(
    useCallback(() => {
      const rafId = requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
      return () => cancelAnimationFrame(rafId);
    }, [])
  );

  // Animated values for professional expand/collapse and smooth cross-fade
  const expandAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(1)).current;

  // Staggered page entrance animations
  const animHeader = useRef(new Animated.Value(1)).current;
  const animTrend = useRef(new Animated.Value(1)).current;
  const animContrast = useRef(new Animated.Value(1)).current;
  const animFlow = useRef(new Animated.Value(1)).current;
  const animCalendar = useRef(new Animated.Value(1)).current;
  const animRhythm = useRef(new Animated.Value(1)).current;
  const animVs = useRef(new Animated.Value(1)).current;
  const animAudit = useRef(new Animated.Value(1)).current;

  // Dynamic bar growth animation for user-triggered horizon changes
  const barGrowAnim = useRef(new Animated.Value(1)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      barGrowAnim.setValue(1);
      return;
    }

    // Smooth bar growth when user switches time horizon
    barGrowAnim.setValue(0);
    Animated.timing(barGrowAnim, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [timeHorizon]);

  // dynamic calendar calculation for any month/year (Sunday to Saturday)
  const { year: curYear, month: curMonth, daysInMonth, startOffset, lastYear, lastMonth } = getMonthYearInfo(selectedMonth);
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Month-filtered expense transactions only
  const monthExpenses = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.type !== 'expense') return false;
      const txDate = parseTxDate(tx.date);
      return txDate.getFullYear() === curYear && txDate.getMonth() === curMonth;
    });
  }, [transactions, curYear, curMonth]);

  // Horizon-filtered expense transactions
  const horizonExpenses = useMemo(() => {
    if (timeHorizon === 'ALL') {
      return transactions.filter(t => t.type === 'expense');
    }
    const { start, end } = horizonWindow(timeHorizon, curYear, curMonth, daysInMonth, transactions);
    const startTime = start.getTime();
    const endTime = end.getTime();
    return transactions.filter(t => {
      if (t.type !== 'expense') return false;
      const tDate = parseTxDate(t.date);
      const tTime = tDate.getTime();
      return tTime >= startTime && tTime <= endTime;
    });
  }, [transactions, timeHorizon, curYear, curMonth, daysInMonth]);

  const horizonTotalSpent = useMemo(() => {
    return horizonExpenses.reduce((sum, t) => sum + (t.split ? t.split.yourShare : t.amount), 0);
  }, [horizonExpenses]);

  // Weekend vs Weekday Contrast Algorithm
  const weekendVsWeekday = useMemo(() => {
    const exp = timeHorizon === 'ALL'
      ? transactions.filter(t => t.type === 'expense')
      : horizonExpenses;

    let weekdaySum = 0;
    let weekendSum = 0;
    const weekdayCatMap: Record<string, number> = {};
    const weekendCatMap: Record<string, number> = {};

    exp.forEach(tx => {
      const tDate = parseTxDate(tx.date);
      const day = tDate.getDay();
      const share = tx.split ? tx.split.yourShare : tx.amount;
      const catId = tx.categoryId || 'other';
      if (day === 0 || day === 6) {
        weekendSum += share;
        weekendCatMap[catId] = (weekendCatMap[catId] || 0) + share;
      } else {
        weekdaySum += share;
        weekdayCatMap[catId] = (weekdayCatMap[catId] || 0) + share;
      }
    });

    const { start: wStart, end: wEnd } = horizonWindow(timeHorizon, curYear, curMonth, daysInMonth, transactions);
    let weekdayDays = 0;
    let weekendDays = 0;

    if (timeHorizon === 'ALL') {
      const expenseTimes = exp.map(t => parseTxDate(t.date).getTime());
      const minTime = expenseTimes.length > 0 ? Math.min(...expenseTimes) : new Date().getTime();
      const maxTime = expenseTimes.length > 0 ? Math.max(...expenseTimes, new Date().getTime()) : new Date().getTime();
      const cursor = new Date(minTime);
      cursor.setHours(0, 0, 0, 0);
      const lastDate = new Date(maxTime);
      lastDate.setHours(0, 0, 0, 0);
      let guard = 0;
      while (cursor.getTime() <= lastDate.getTime() && guard < 3650) {
        guard++;
        const dow = cursor.getDay();
        if (dow === 0 || dow === 6) weekendDays += 1;
        else weekdayDays += 1;
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      const cursor = new Date(wStart.getFullYear(), wStart.getMonth(), wStart.getDate());
      const lastDate = new Date(wEnd.getFullYear(), wEnd.getMonth(), wEnd.getDate());
      let guard = 0;
      while (cursor.getTime() <= lastDate.getTime() && guard < 3650) {
        guard++;
        const dow = cursor.getDay();
        if (dow === 0 || dow === 6) weekendDays += 1;
        else weekdayDays += 1;
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const total = weekdaySum + weekendSum;
    const weekendPct = total > 0 ? Math.round((weekendSum / total) * 100) : 0;
    const weekdayPct = total > 0 ? 100 - weekendPct : 0;

    // Daily averages
    const avgWeekend = weekendDays > 0 ? weekendSum / weekendDays : 0;
    const avgWeekday = weekdayDays > 0 ? weekdaySum / weekdayDays : 0;
    const ratio = avgWeekday > 0 ? (avgWeekend / avgWeekday).toFixed(1) : (avgWeekend > 0 ? '∞' : '1.0');

    // Leisure Leak algorithm: identify which category surges most on weekends vs weekday pace
    let topLeakCatId = '';
    let maxLeakAmount = 0;

    const allCatIds = Array.from(new Set([...Object.keys(weekdayCatMap), ...Object.keys(weekendCatMap)]));
    allCatIds.forEach(catId => {
      const wEndAmt = weekendCatMap[catId] || 0;
      const wDayAmt = weekdayCatMap[catId] || 0;
      const avgWEnd = weekendDays > 0 ? wEndAmt / weekendDays : 0;
      const avgWDay = weekdayDays > 0 ? wDayAmt / weekdayDays : 0;
      const diffDaily = avgWEnd - avgWDay;
      const excessSpend = Math.max(0, wEndAmt - (avgWDay * weekendDays));
      if (diffDaily > 0 && excessSpend > maxLeakAmount) {
        maxLeakAmount = excessSpend;
        topLeakCatId = catId;
      }
    });

    const topLeakCategory = topLeakCatId ? storeCategories.find(c => c.id === topLeakCatId) : null;
    const weekendTax = Math.max(0, Math.round((avgWeekend - avgWeekday) * weekendDays));

    return {
      weekdaySum,
      weekendSum,
      weekendPct,
      weekdayPct,
      avgWeekend,
      avgWeekday,
      ratio,
      topLeakCategory,
      weekendTax,
    };
  }, [transactions, horizonExpenses, timeHorizon, curYear, curMonth, daysInMonth, storeCategories]);

  // Multi-Month Trend calculation for 6M, 1Y, ALL (Anchored to selectedMonth)
  const multiMonthTrend = useMemo(() => {
    const result: { label: string; year: number; month: number; amount: number; isCurrent: boolean }[] = [];
    const { start } = horizonWindow(timeHorizon, curYear, curMonth, daysInMonth, transactions);
    const lastMonthStart = new Date(curYear, curMonth, 1);

    // ALL walks the real monthly history; 6M / 1Y derive exactly 6 / 12 months.
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    let guard = 0;
    while (cursor.getTime() <= lastMonthStart.getTime() && guard < 360) {
      guard += 1;
      const mYear = cursor.getFullYear();
      const mMonth = cursor.getMonth();
      const label = cursor.toLocaleDateString('en-US', { month: 'short' });

      const spentInMonth = transactions
        .filter(t => {
          if (t.type !== 'expense') return false;
          const tDate = parseTxDate(t.date);
          return tDate.getFullYear() === mYear && tDate.getMonth() === mMonth;
        })
        .reduce((sum, t) => sum + (t.split ? t.split.yourShare : t.amount), 0);

      result.push({
        label,
        year: mYear,
        month: mMonth,
        amount: spentInMonth,
        isCurrent: mYear === curYear && mMonth === curMonth,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const monthCount = result.length;
    const maxAmt = Math.max(...result.map(r => r.amount), 100);
    const totalSpentInHorizon = result.reduce((s, r) => s + r.amount, 0);
    const avgMonthly = Math.round(totalSpentInHorizon / Math.max(monthCount, 1));
    return { data: result, maxAmt, totalSpentInHorizon, avgMonthly };
  }, [transactions, timeHorizon, curYear, curMonth, daysInMonth]);

  // Dynamic active spending categories sorted descending by spend for chosen horizon
  const activeBreakdown = useMemo(() => {
    const catMap: Record<string, number> = {};
    horizonExpenses.forEach(tx => {
      const share = tx.split ? tx.split.yourShare : tx.amount;
      catMap[tx.categoryId] = (catMap[tx.categoryId] || 0) + share;
    });

    const knownCatIds = new Set(storeCategories.map(c => c.id));
    const list = storeCategories
      .filter(c => c.id !== 'cat_income')
      .map(cat => ({
        category: cat,
        amount: catMap[cat.id] || 0,
      }))
      .filter(item => item.amount > 0);

    // Include any custom/unlisted category IDs
    Object.keys(catMap).forEach(catId => {
      if (catId !== 'cat_income' && !knownCatIds.has(catId) && catMap[catId] > 0) {
        list.push({
          category: {
            id: catId,
            name: catId.replace(/^cat_/, '').toUpperCase(),
            color: '#FF9D66',
          },
          amount: catMap[catId],
        });
      }
    });

    // Strictly order highest spending amount at top → lowest spending amount at bottom
    return list.sort((a, b) => b.amount - a.amount);
  }, [horizonExpenses, storeCategories]);

  const cats: FlowCat[] = useMemo(() => {
    return activeBreakdown.map((item) => ({
      id: item.category.id,
      name: item.category.name.toUpperCase(),
      label: item.category.name.toUpperCase(),
      color: item.category.color,
      amount: item.amount,
    }));
  }, [activeBreakdown]);

  // Dynamic Chart Height based on active categories (ensures minimum 180 and at least 32px per category)
  const chartHeight = useMemo(() => {
    return Math.max(180, cats.length * 32);
  }, [cats.length]);

  // sankey
  const streams   = useMemo(() => buildStreams(cats, chartHeight), [cats, chartHeight]);
  const labelTops = useMemo(() => resolveY(streams, chartHeight), [streams, chartHeight]);
  const dstLX     = SVG_W - DST_W;

  // Last month expense transactions for month-over-month comparison
  const lastMonthExpenses = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.type !== 'expense') return false;
      const txDate = parseTxDate(tx.date);
      return txDate.getFullYear() === lastYear && txDate.getMonth() === lastMonth;
    });
  }, [transactions, lastYear, lastMonth]);

  // Dynamic VS Last Month comparison algorithm
  const vsCategories: VsCat[] = useMemo(() => {
    const thisMonthMap: Record<string, number> = {};
    const lastMonthMap: Record<string, number> = {};

    monthExpenses.forEach(tx => {
      const share = tx.split ? tx.split.yourShare : tx.amount;
      thisMonthMap[tx.categoryId] = (thisMonthMap[tx.categoryId] || 0) + share;
    });

    lastMonthExpenses.forEach(tx => {
      const share = tx.split ? tx.split.yourShare : tx.amount;
      lastMonthMap[tx.categoryId] = (lastMonthMap[tx.categoryId] || 0) + share;
    });

    const activeList: VsCat[] = [];
    const allCatIds = Array.from(new Set([
      ...storeCategories.map(c => c.id),
      ...Object.keys(thisMonthMap),
      ...Object.keys(lastMonthMap),
    ]));

    allCatIds.forEach(catId => {
      const cat = storeCategories.find(c => c.id === catId) || {
        id: catId,
        name: catId.replace(/^cat_/, '').toUpperCase(),
        emoji: '',
        color: '#FF9D66',
      };
      const thisAmt = thisMonthMap[catId] || 0;
      const lastAmt = lastMonthMap[catId] || 0;

      if (thisAmt > 0 || lastAmt > 0) {
        let changeBadge = 'NEW';
        let isNew = false;
        let isIncrease = false;

        if (lastAmt === 0 && thisAmt > 0) {
          changeBadge = 'NEW';
          isNew = true;
        } else if (thisAmt === 0 && lastAmt > 0) {
          changeBadge = '-100%';
          isIncrease = false;
        } else if (lastAmt > 0 && thisAmt > 0) {
          const diff = thisAmt - lastAmt;
          const pct = Math.round((diff / lastAmt) * 100);
          if (pct > 0) {
            changeBadge = `+${pct}%`;
            isIncrease = true;
          } else if (pct < 0) {
            changeBadge = `${pct}%`;
            isIncrease = false;
          } else {
            changeBadge = '0%';
            isIncrease = false;
          }
        }

        const formatted = formatCompactCurrency(thisAmt, sym);

        activeList.push({
          id: cat.id,
          name: cat.name.toUpperCase(),
          thisAmount: thisAmt,
          lastAmount: lastAmt,
          formatted,
          thisPercent: 0,
          lastPercent: 0,
          changeBadge,
          isNew,
          isIncrease,
          color: cat.color,
        });
      }
    });

    const maxVal = Math.max(...activeList.map(c => Math.max(c.thisAmount, c.lastAmount)), 1);
    activeList.forEach(c => {
      c.thisPercent = Math.min(Math.round((c.thisAmount / maxVal) * 100), 100);
      c.lastPercent = Math.min(Math.round((c.lastAmount / maxVal) * 100), 100);
    });

    return activeList.sort((a, b) => b.thisAmount - a.thisAmount);
  }, [monthExpenses, lastMonthExpenses, storeCategories, sym]);

  // Construct explicit 7-column rows to guarantee zero wrapping glitches
  const calendarRows: (number | null)[][] = [];
  let curRow: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) {
    curRow.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    curRow.push(d);
    if (curRow.length === 7) {
      calendarRows.push(curRow);
      curRow = [];
    }
  }
  if (curRow.length > 0) {
    while (curRow.length < 7) {
      curRow.push(null);
    }
    calendarRows.push(curRow);
  }

  // Daily spend calculation strictly from real transactions
  const dailySpend = useMemo(() => {
    const map: Record<number, number> = {};
    monthExpenses.forEach(tx => {
      const d = parseTxDate(tx.date).getDate();
      const share = tx.split ? tx.split.yourShare : tx.amount;
      map[d] = (map[d] || 0) + share;
    });
    return map;
  }, [monthExpenses]);

  const heatmapThresholds = useMemo(() => {
    const nonZero = Object.values(dailySpend).filter((v) => v > 0).sort((a, b) => a - b);
    if (nonZero.length === 0) return { q1: 1, q2: 2, q3: 3 };
    if (nonZero.length === 1) {
      const v = nonZero[0];
      return { q1: v * 0.33, q2: v * 0.66, q3: v * 0.99 };
    }
    if (nonZero.length === 2) {
      return { q1: nonZero[0], q2: (nonZero[0] + nonZero[1]) / 2, q3: nonZero[1] };
    }
    if (nonZero.length === 3) {
      return { q1: nonZero[0], q2: nonZero[1], q3: nonZero[2] };
    }
    const q1 = nonZero[Math.floor(nonZero.length * 0.25)];
    const q2 = nonZero[Math.floor(nonZero.length * 0.50)];
    const q3 = nonZero[Math.floor(nonZero.length * 0.75)];
    return { q1, q2, q3 };
  }, [dailySpend]);

  // 4 clearly distinguishable red levels: Lowest spending = lightest, Highest spending = darkest
  const heatColor = (day: number) => {
    const a = dailySpend[day] || 0;
    if (a === 0) return '#1D1F2A';
    if (a <= heatmapThresholds.q1) return '#FCA5A5'; // Level 1: Lightest soft red
    if (a <= heatmapThresholds.q2) return '#EF4444'; // Level 2: Medium vibrant red
    if (a <= heatmapThresholds.q3) return '#B91C1C'; // Level 3: Deep strong red
    return '#7F1D1D';                                // Level 4: Darkest crimson
  };

  const heatTextColor = (day: number) => {
    const a = dailySpend[day] || 0;
    if (a === 0) return '#8E919D';
    if (a <= heatmapThresholds.q1) return '#181920'; // Dark readable text on light red tile
    return '#FFFFFF';                                // White text on dark red tiles
  };

  // Heaviest weekday dynamically calculated
  const weekdayTotals = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0]; // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    monthExpenses.forEach(tx => {
      const dayIdx = parseTxDate(tx.date).getDay();
      const share = tx.split ? tx.split.yourShare : tx.amount;
      totals[dayIdx] += share;
    });
    return totals;
  }, [monthExpenses]);

  const WDN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let heaviestIdx = 0;
  weekdayTotals.forEach((amt, i) => {
    if (amt > weekdayTotals[heaviestIdx]) heaviestIdx = i;
  });
  const heaviestDayName = weekdayTotals[heaviestIdx] > 0 ? WDN[heaviestIdx] : 'None';
  const heaviestDayAmount = weekdayTotals[heaviestIdx];

  // Longest no-spend streak dynamically calculated
  const noSpendStreak = useMemo(() => {
    let cur = 0, best = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (!dailySpend[d]) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
    }
    return best;
  }, [dailySpend, daysInMonth]);

  // Dynamic Weekly Rhythm calculated from horizonExpenses
  const rhythmData = useMemo(() => {
    const spendByMonSun = [0, 0, 0, 0, 0, 0, 0]; // Mon (0) to Sun (6)
    horizonExpenses.forEach(tx => {
      const jsDay = parseTxDate(tx.date).getDay(); // 0 is Sun
      const idx = jsDay === 0 ? 6 : jsDay - 1;
      const share = tx.split ? tx.split.yourShare : tx.amount;
      spendByMonSun[idx] += share;
    });

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, idx) => ({
      day,
      amt: spendByMonSun[idx],
      showLabel: spendByMonSun[idx] > 0,
      labelText: formatCompactCurrency(spendByMonSun[idx], sym),
    }));
  }, [horizonExpenses, sym]);

  const maxRhythmAmount = useMemo(() => {
    const maxVal = Math.max(...rhythmData.map(r => r.amt), 100);
    return Math.max(Math.ceil(maxVal / 100) * 100, 100);
  }, [rhythmData]);

  const avgRhythmAmount = useMemo(() => {
    const total = rhythmData.reduce((sum, r) => sum + r.amt, 0);
    return Math.round(total / 7);
  }, [rhythmData]);

  const handleDayPress = (day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (selectedDay === day) {
      // Smooth collapse & close
      setSelectedDay(null);
      Animated.parallel([
        Animated.timing(expandAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
          useNativeDriver: false,
        }),
        Animated.timing(contentFadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setDisplayedDay(null);
      });
    } else if (selectedDay === null) {
      // Smooth expand from closed state
      setSelectedDay(day);
      setDisplayedDay(day);
      contentFadeAnim.setValue(1);
      Animated.spring(expandAnim, {
        toValue: 1,
        damping: 18,
        stiffness: 160,
        mass: 0.8,
        useNativeDriver: false,
      }).start();
    } else {
      // Switching between dates while already open: smooth cross-fade without collapsing
      setSelectedDay(day);
      Animated.sequence([
        Animated.timing(contentFadeAnim, {
          toValue: 0,
          duration: 70,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setDisplayedDay(day);
      }, 70);
    }
  };

  const popupHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  const popupOpacity = expandAnim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.7, 1],
  });

  const formatDayDate = (day: number) => {
    const date = new Date(curYear, curMonth, day);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${day}`;
  };

  const getDayItems = (day: number) => {
    const dayTxs = monthExpenses.filter(tx => parseTxDate(tx.date).getDate() === day);
    if (dayTxs.length === 0) return [];

    const grouped: Record<string, { category: string; color: string; amount: number }> = {};
    dayTxs.forEach(tx => {
      const cat = storeCategories.find(c => c.id === tx.categoryId) || {
        name: tx.categoryId.replace(/^cat_/, '').toUpperCase(),
        color: '#FF9D66',
      };
      if (!grouped[tx.categoryId]) {
        grouped[tx.categoryId] = {
          category: cat.name,
          color: cat.color || '#FF9D66',
          amount: 0,
        };
      }
      const share = tx.split ? tx.split.yourShare : tx.amount;
      grouped[tx.categoryId].amount += share;
    });

    return Object.values(grouped);
  };

  return (
    <View style={st.screen}>
      <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary }} />

      <ScrollView
        ref={scrollRef}
        style={st.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      >

        {/* TITLE & MULTI-HORIZON TIME SWITCHER */}
        <Animated.View
          style={{
            opacity: animHeader,
            transform: [
              {
                translateY: animHeader.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          }}
        >
          <View style={st.titleRow}>
            <AppText style={st.titleThe}>THE </AppText>
            <AppText style={st.titleViz}>VISUALIZER</AppText>
          </View>

          {/* ═══ MULTI-HORIZON TIME SWITCHER ═══ */}
          <View style={st.horizonContainer}>
            {(['1W', '1M', '6M', '1Y', 'ALL'] as TimeHorizon[]).map((hz) => {
              const isSelected = timeHorizon === hz;
              return (
                <TouchableOpacity
                  key={hz}
                  style={[st.horizonPill, isSelected && st.horizonPillActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    LayoutAnimation.configureNext(customSpringLayout);
                    setTimeHorizon(hz);
                  }}
                  activeOpacity={0.75}
                >
                  <AppText style={[st.horizonPillText, isSelected && st.horizonPillTextActive]}>
                    {hz}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* ═══ MULTI-MONTH TREND (6M / 1Y / ALL) ═══ */}
        {(timeHorizon === '6M' || timeHorizon === '1Y' || timeHorizon === 'ALL') && (
          <Animated.View
            style={[
              st.card,
              {
                opacity: animTrend,
                transform: [
                  {
                    translateY: animTrend.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={st.rowBetween}>
              <View>
                <AppText style={st.cardLabel}>MULTI-MONTH TREND</AppText>
                <AppText style={st.cardSub}>
                  {timeHorizon === '6M' ? 'Last 6 Months' : timeHorizon === '1Y' ? 'Last 12 Months' : 'All Time History'}
                </AppText>
              </View>
              <AppText style={st.flowAmt}>
                {sym}{multiMonthTrend.data.reduce((s, d) => s + d.amount, 0).toLocaleString('en-IN')}
              </AppText>
            </View>

            <View style={st.trendChartContainer}>
              {multiMonthTrend.data.map((item, idx) => {
                const barH = Math.max(Math.round((item.amount / multiMonthTrend.maxAmt) * 110), 4);
                const barCount = multiMonthTrend.data.length;
                // Shrink the bars so long all-time histories stay readable
                const trackW = Math.max(4, Math.min(22, (INNER_W / Math.max(barCount, 1)) - 6));
                const showLabel = barCount <= 12 || idx === 0 || idx === barCount - 1 || item.isCurrent;
                return (
                  <View key={idx} style={st.trendCol}>
                    {item.amount > 0 ? (
                      <AppText style={st.trendAmtLabel} numberOfLines={1}>
                        {formatCompactCurrency(item.amount, sym)}
                      </AppText>
                    ) : (
                      <View style={{ height: 14 }} />
                    )}
                    <View style={[st.trendTrack, { width: trackW }]}>
                      <Animated.View
                        style={[
                          st.trendBar,
                          {
                            height: barGrowAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [4, barH],
                            }),
                          },
                          item.isCurrent && st.trendBarCurrent,
                        ]}
                      />
                    </View>
                    {showLabel ? (
                      <AppText style={[st.trendMonthLabel, item.isCurrent && st.trendMonthLabelCurrent]}>
                        {item.label}
                      </AppText>
                    ) : (
                      <View style={{ height: 14 }} />
                    )}
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ═══ CARD 1: CATEGORY FLOW ═══ */}
        <Animated.View
          style={[
            st.card,
            {
              opacity: animFlow,
              transform: [
                {
                  translateY: animFlow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >

          {(() => {
            const selectedStream = streams.find(s => s.cat.id === selectedBandId);
            const displayAmt = selectedStream ? selectedStream.cat.amount : horizonTotalSpent;
            const pctOfTotal = horizonTotalSpent > 0 && selectedStream ? ((selectedStream.cat.amount / horizonTotalSpent) * 100).toFixed(1) : null;
            const horizonLabel =
              timeHorizon === '1M'
                ? selectedMonth
                : timeHorizon === '1W'
                ? 'Last 7 Days'
                : timeHorizon === '6M'
                ? 'Past 6 Months'
                : timeHorizon === '1Y'
                ? 'Past 12 Months'
                : 'All Recorded Time';

            return (
              <View style={st.rowBetween}>
                <View>
                  <AppText style={st.cardLabel}>CATEGORY FLOW</AppText>
                  <AppText style={st.cardSub}>
                    {selectedStream ? `${selectedStream.cat.name} • ${pctOfTotal}% OF TOTAL` : horizonLabel}
                  </AppText>
                </View>
                <AppText style={st.flowAmt}>{sym}{displayAmt.toLocaleString('en-IN')}</AppText>
              </View>
            );
          })()}

          {/* flow body */}
          {cats.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <AppText style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
                No Expenses Logged
              </AppText>
              <AppText style={{ color: expenseColors.textMuted, fontSize: 11, textAlign: 'center' }}>
                No expense transactions recorded for this time period.
              </AppText>
            </View>
          ) : (
            <View style={st.flowBody}>

              {/* Income label */}
              <View style={{ width: INCOME_W, height: chartHeight, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 6 }}>
                <AppText style={st.incomeLabel} numberOfLines={1}>Income</AppText>
              </View>

              {/* SVG */}
              <Svg width={SVG_W} height={chartHeight}>
                {/* source bar */}
                <Rect x={0} y={0} width={SRC_W} height={chartHeight} rx={4} fill={expenseColors.accentGreen} />
                {/* ribbons */}
                {streams.map(s => {
                  const isSelected = selectedBandId === s.cat.id;
                  const hasSelection = selectedBandId !== null;
                  const opacity = isSelected ? 1.0 : (hasSelection ? 0.22 : 0.88);
                  return (
                    <Path
                      key={s.cat.id}
                      d={s.path}
                      fill={s.cat.color}
                      opacity={opacity}
                      stroke={isSelected ? '#FFFFFF' : 'none'}
                      strokeWidth={isSelected ? 1.5 : 0}
                      onPress={() => toggleBandSelection(s.cat.id)}
                    />
                  );
                })}
                {/* dest bars */}
                {streams.map(s => {
                  const isSelected = selectedBandId === s.cat.id;
                  const hasSelection = selectedBandId !== null;
                  const opacity = isSelected ? 1.0 : (hasSelection ? 0.22 : 1.0);
                  return (
                    <Rect
                      key={`d${s.cat.id}`}
                      x={dstLX} y={s.dY1}
                      width={DST_W} height={s.dY2 - s.dY1}
                      rx={3} fill={s.cat.color}
                      opacity={opacity}
                      stroke={isSelected ? '#FFFFFF' : 'none'}
                      strokeWidth={isSelected ? 1.5 : 0}
                      onPress={() => toggleBandSelection(s.cat.id)}
                    />
                  );
                })}
              </Svg>

              {/* right label column with interactive percentage */}
              <View style={{ width: RLABEL_W, height: chartHeight, position: 'relative' }}>
                {streams.map((s, i) => {
                  const isSelected = selectedBandId === s.cat.id;
                  const hasSelection = selectedBandId !== null;
                  const opacity = isSelected ? 1.0 : (hasSelection ? 0.35 : 1.0);
                  const pct = horizonTotalSpent > 0 ? ((s.cat.amount / horizonTotalSpent) * 100).toFixed(1) : '0';

                  return (
                    <TouchableOpacity
                      key={`l${s.cat.id}`}
                      style={[st.labelSlot, { top: labelTops[i], opacity }]}
                      activeOpacity={0.7}
                      onPress={() => toggleBandSelection(s.cat.id)}
                    >
                      <AppText
                        style={[
                          st.catLabel,
                          { color: s.cat.color, fontWeight: isSelected ? '800' : '700' },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {s.cat.label}
                      </AppText>
                      <View style={st.catAmountRow}>
                        <AppText
                          style={[
                            st.catAmt,
                            isSelected && { color: '#FFFFFF', fontWeight: '800' },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          – {formatCompactCurrency(s.cat.amount, sym)}
                        </AppText>
                        {isSelected && (
                          <AppText
                            style={[
                              st.catPctText,
                              { color: s.cat.color },
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {pct}%
                          </AppText>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

            </View>
          )}
        </Animated.View>

        {/* ═══ CARD 2: SPENDING CALENDAR (Always visible, adapts dynamically to selected month/period) ═══ */}
        <Animated.View
          style={[
            st.compactCard,
            {
              opacity: animCalendar,
              transform: [
                {
                  translateY: animCalendar.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >

          {/* header */}
          <View style={st.rowBetweenCompact}>
            <AppText style={st.cardLabel}>SPENDING CALENDAR</AppText>
            <View style={st.legendRow}>
              <AppText style={st.legendTxt}>Less</AppText>
              {['#1D1F2A', '#FCA5A5', '#EF4444', '#B91C1C', '#7F1D1D'].map(c => (
                <View key={c} style={[st.legendBox, { backgroundColor: c }]} />
              ))}
              <AppText style={st.legendTxt}>More</AppText>
            </View>
          </View>

          {/* weekday row: Sun to Sat */}
          <View style={[st.weekRow, { gap: CAL_GAP }]}>
            {WEEKDAYS.map(d => (
              <View key={d} style={{ width: TILE_W, alignItems: 'center' }}>
                <AppText style={st.weekDay}>{d}</AppText>
              </View>
            ))}
          </View>

          {/* grid in explicit 7-item rows */}
          <View style={{ gap: CAL_ROW_GAP, marginBottom: 8 }}>
            {calendarRows.map((row, rIdx) => (
              <View key={`r-${rIdx}`} style={[st.weekRow, { gap: CAL_GAP }]}>
                {row.map((day, cIdx) => (
                  day !== null ? (
                    <TouchableOpacity
                      key={`d-${day}`}
                      activeOpacity={0.75}
                      onPress={() => handleDayPress(day)}
                      style={[
                        st.tile,
                        { width: TILE_W, height: TILE_H, backgroundColor: heatColor(day) },
                        selectedDay === day && st.tileSel,
                      ]}
                    >
                      <AppText style={[st.tileNum, { color: heatTextColor(day) }]}>{day}</AppText>
                    </TouchableOpacity>
                  ) : (
                    <View key={`b-${cIdx}`} style={{ width: TILE_W, height: TILE_H }} />
                  )
                ))}
              </View>
            ))}
          </View>

          {/* dynamic insight cards with responsive, non-truncating layout */}
          <View style={st.insightRow}>
            <View style={st.insightCard}>
              <View style={st.insightHeadRow}>
                <Flame size={12} color="#FF9D66" />
                <AppText style={st.insightHead}>HEAVIEST DAY</AppText>
              </View>
              <AppText style={st.insightVal} numberOfLines={1} adjustsFontSizeToFit>
                {heaviestDayAmount > 0 ? `${heaviestDayName} (${formatCompactCurrency(heaviestDayAmount, sym)})` : 'None'}
              </AppText>
            </View>
            <View style={st.insightCard}>
              <View style={st.insightHeadRow}>
                <Trophy size={12} color="#FBBF24" />
                <AppText style={st.insightHead}>NO-SPEND STREAK</AppText>
              </View>
              <AppText style={st.insightVal} numberOfLines={1} adjustsFontSizeToFit>
                {noSpendStreak} {noSpendStreak === 1 ? 'day' : 'days'} streak
              </AppText>
            </View>
          </View>

          {/* Selected Day Spending Breakdown Popup (Professional Butter-Smooth Animation) */}
          <Animated.View
            style={[
              st.dayDetailWrapper,
              {
                maxHeight: popupHeight,
                opacity: popupOpacity,
              },
            ]}
          >
            {displayedDay !== null && (
              <Animated.View
                style={[
                  st.dayDetailCard,
                  {
                    opacity: contentFadeAnim,
                    transform: [
                      {
                        translateY: contentFadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [6, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <AppText style={st.dayDetailDate}>
                  {formatDayDate(displayedDay)}
                </AppText>
                <AppText style={st.dayDetailTotal}>
                  Total: {sym}{(dailySpend[displayedDay] || 0).toLocaleString('en-IN')}
                </AppText>

                {getDayItems(displayedDay).length > 0 ? (
                  <View style={st.dayItemsStack}>
                    {getDayItems(displayedDay).map((item, idx) => (
                      <View key={idx} style={st.dayItemRow}>
                        <View
                          style={[
                            st.dayPill,
                            {
                              backgroundColor: `${item.color}1F`,
                              borderColor: `${item.color}45`,
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <View style={[st.dayPillDot, { backgroundColor: item.color }]} />
                          <AppText style={[st.dayPillText, { color: item.color }]}>
                            {item.category}
                          </AppText>
                        </View>
                        <AppText style={st.dayItemAmt}>
                          {sym}{item.amount.toLocaleString('en-IN')}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : (
                  <AppText style={st.dayNoSpendText}>
                    No spending on this day ✨
                  </AppText>
                )}
              </Animated.View>
            )}
          </Animated.View>

        </Animated.View>

        {/* ═══ CARD 3: WEEKLY RHYTHM (All horizons: 1W, 1M, 6M, 1Y, ALL) ═══ */}
        <Animated.View
          style={[
            st.card,
            {
              opacity: animRhythm,
              transform: [
                {
                  translateY: animRhythm.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={st.rowBetween}>
            <View>
              <AppText style={st.cardLabel}>WEEKLY RHYTHM</AppText>
              <AppText style={st.cardSub}>
                {timeHorizon === '1W'
                  ? 'Last 7 Days'
                  : timeHorizon === '1M'
                  ? 'Monthly Pattern'
                  : timeHorizon === '6M'
                  ? '6-Month Pattern'
                  : timeHorizon === '1Y'
                  ? '12-Month Pattern'
                  : 'All-Time Pattern'}
                {avgRhythmAmount > 0 ? ` • Avg: ${sym}${avgRhythmAmount.toLocaleString('en-IN')}/day` : ''}
              </AppText>
            </View>
          </View>

          <View style={st.rhythmContainer}>
            {/* Y Axis */}
            <View style={st.yAxis}>
              {[maxRhythmAmount, Math.round(maxRhythmAmount * 0.66), Math.round(maxRhythmAmount * 0.33), 0].map(v => (
                <AppText key={v} style={st.yLbl}>{sym}{v}</AppText>
              ))}
            </View>

            {/* Chart Area */}
            <View style={st.rhythmChartArea}>
              {/* Dashed Average Line at mathematically correct height */}
              {avgRhythmAmount > 0 && (
                <>
                  <View
                    style={[
                      st.avgLine,
                      {
                        bottom: 24 + Math.min(Math.round((avgRhythmAmount / maxRhythmAmount) * RHYTHM_BAR_H), RHYTHM_BAR_H),
                      },
                    ]}
                  />
                  <AppText
                    style={[
                      st.avgLbl,
                      {
                        bottom: 24 + Math.min(Math.round((avgRhythmAmount / maxRhythmAmount) * RHYTHM_BAR_H), RHYTHM_BAR_H) - 6,
                      },
                    ]}
                  >
                    avg
                  </AppText>
                </>
              )}

              {/* Bars Row */}
              <View style={st.barsRow}>
                {rhythmData.map(rd => {
                  const barH = Math.round((rd.amt / maxRhythmAmount) * RHYTHM_BAR_H);
                  const isHeaviest = rd.amt > 0 && rd.amt === Math.max(...rhythmData.map(r => r.amt));
                  return (
                    <View key={rd.day} style={st.barCol}>
                      {/* Top Label (e.g. ₹244 or ₹0) */}
                      {rd.showLabel ? (
                        <AppText
                          style={[
                            st.barAmt,
                            isHeaviest && st.barAmtHighlight,
                            rd.amt === 0 && st.barAmtZero,
                            { bottom: 24 + Math.max(barH + 4, 4) },
                          ]}
                          numberOfLines={1}
                        >
                          {rd.labelText}
                        </AppText>
                      ) : null}

                      {/* Bar Fill */}
                      {rd.amt > 0 ? (
                        <Animated.View
                          style={[
                            st.barFill,
                            isHeaviest && st.barFillHighlight,
                            {
                              height: barGrowAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [4, Math.max(barH, 4)],
                              }),
                            },
                          ]}
                        />
                      ) : null}

                      {/* Day Label below axis */}
                      <AppText style={[st.barDay, isHeaviest && st.barDayHighlight]}>
                        {rd.day}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ═══ CARD 4: WEEKEND VS WEEKDAY CONTRAST CARD ═══ */}
        <Animated.View
          style={[
            st.card,
            {
              opacity: animContrast,
              transform: [
                {
                  translateY: animContrast.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={st.rowBetween}>
            <View style={{ flex: 1 }}>
              <AppText style={st.cardLabel}>WEEKEND VS WEEKDAY</AppText>
              <AppText style={st.cardSub}>
                {weekendVsWeekday.weekdaySum + weekendVsWeekday.weekendSum === 0
                  ? 'No expenses logged in this period'
                  : weekendVsWeekday.weekendPct >= 50
                  ? `⚡ Weekend Surge: ${weekendVsWeekday.ratio}x higher daily burn`
                  : '⚖️ Balanced weekday vs weekend rhythm'}
              </AppText>
            </View>
          </View>

          {/* Dual Split Bar */}
          <View style={st.contrastTrack}>
            <Animated.View
              style={[
                st.contrastBarWeekday,
                {
                  width: barGrowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', `${weekendVsWeekday.weekdayPct > 0 ? Math.max(weekendVsWeekday.weekdayPct, 4) : 0}%`],
                  }) as any,
                },
              ]}
            />
            <Animated.View
              style={[
                st.contrastBarWeekend,
                {
                  width: barGrowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', `${weekendVsWeekday.weekendPct > 0 ? Math.max(weekendVsWeekday.weekendPct, 4) : 0}%`],
                  }) as any,
                },
              ]}
            />
          </View>

          {/* Stats Grid */}
          <View style={st.contrastStatsRow}>
            <View style={st.contrastStatCol}>
              <View style={st.statDotRow}>
                <View style={[st.miniDot, { backgroundColor: '#C4A7E7' }]} />
                <AppText style={st.statLabel}>Weekdays (Mon-Fri)</AppText>
              </View>
              <AppText style={st.statAmount}>{sym}{weekendVsWeekday.weekdaySum.toLocaleString('en-IN')}</AppText>
              <AppText style={st.statSub}>~{sym}{Math.round(weekendVsWeekday.avgWeekday).toLocaleString('en-IN')}/day</AppText>
            </View>

            <View style={st.contrastDivider} />

            <View style={st.contrastStatCol}>
              <View style={st.statDotRow}>
                <View style={[st.miniDot, { backgroundColor: expenseColors.accentPeach }]} />
                <AppText style={st.statLabel}>Weekends (Sat-Sun)</AppText>
              </View>
              <AppText style={st.statAmount}>{sym}{weekendVsWeekday.weekendSum.toLocaleString('en-IN')}</AppText>
              <AppText style={st.statSub}>~{sym}{Math.round(weekendVsWeekday.avgWeekend).toLocaleString('en-IN')}/day</AppText>
            </View>
          </View>

          {/* Natural Weekend Insight Footnote */}
          {weekendVsWeekday.weekendTax > 0 && (
            <View style={st.leisureFootnote}>
              <AppText style={st.leisureFootnoteText} numberOfLines={1}>
                <AppText style={{ color: '#FF9D66', fontWeight: '700' }}>+{sym}{weekendVsWeekday.weekendTax.toLocaleString('en-IN')} weekend surge</AppText>
                {weekendVsWeekday.topLeakCategory ? ` driven primarily by ${weekendVsWeekday.topLeakCategory.emoji ? weekendVsWeekday.topLeakCategory.emoji + ' ' : ''}${weekendVsWeekday.topLeakCategory.name}` : ''}
              </AppText>
            </View>
          )}
        </Animated.View>

        {/* ═══ CARD 4: VS LAST MONTH (Month-over-Month Comparison in 1M) ═══ */}
        {timeHorizon === '1M' && (
          <Animated.View
            style={[
              st.card,
              {
                opacity: animVs,
                transform: [
                  {
                    translateY: animVs.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={st.rowBetween}>
              <AppText style={st.cardLabel}>VS LAST MONTH</AppText>
              <View style={st.legendRow}>
                <View style={[st.legendSq, { backgroundColor: '#2C2D35' }]} />
                <AppText style={st.legendTxt}>Last</AppText>
                <View style={[st.legendSq, { backgroundColor: '#FFFFFF', marginLeft: 8 }]} />
                <AppText style={st.legendTxt}>This</AppText>
              </View>
            </View>
            {vsCategories.length === 0 ? (
              <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <AppText style={{ color: expenseColors.textMuted, fontSize: 12 }}>
                  No category expenses recorded for comparison
                </AppText>
              </View>
            ) : (
              <View style={st.vsStack}>
                {vsCategories.map(cat => (
                  <View key={cat.id} style={st.vsItem}>
                    {/* Top Row: [Dot + Name + Emoji] .............. [Comparison Badge + Amount] */}
                    <View style={st.vsTopRow}>
                      <View style={st.vsLeft}>
                        <View style={[st.vsDot, { backgroundColor: cat.color }]} />
                        <AppText style={st.vsCat}>
                          {cat.name}
                        </AppText>
                      </View>
                      <View style={st.vsRight}>
                        <View
                          style={[
                            st.newPill,
                            !cat.isNew && (cat.isIncrease ? st.increasePill : st.decreasePill),
                          ]}
                        >
                          <AppText
                            style={[
                              st.newTxt,
                              !cat.isNew && (cat.isIncrease ? st.increaseTxt : st.decreaseTxt),
                            ]}
                          >
                            {cat.changeBadge}
                          </AppText>
                        </View>
                        <AppText style={st.vsAmt}>{cat.formatted}</AppText>
                      </View>
                    </View>

                    {/* Dual Comparison Bar: Last Month (Grey) & This Month (Color) */}
                    <View style={st.vsBarTrack}>
                      {cat.lastPercent > 0 && (
                        <Animated.View
                          style={[
                            st.vsLastBar,
                            {
                              width: barGrowAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', `${cat.lastPercent}%`],
                              }) as any,
                            },
                          ]}
                        />
                      )}
                      {cat.thisPercent > 0 && (
                        <Animated.View
                          style={[
                            st.vsFill,
                            {
                              backgroundColor: cat.color,
                              width: barGrowAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', `${cat.thisPercent}%`],
                              }) as any,
                            },
                          ]}
                        />
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* ═══ CARD 5: SUBSCRIPTION AUDIT ═══ */}
        <Animated.View
          style={[
            st.card,
            {
              opacity: animAudit,
              transform: [
                {
                  translateY: animAudit.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={st.rowBetween}>
            <View>
              <AppText style={st.cardLabel}>SUBSCRIPTION AUDIT</AppText>
              <AppText style={st.cardSub}>
                {subscriptions.length === 0
                  ? 'No active subscriptions tracked'
                  : `${subscriptions.length} active subscription${subscriptions.length !== 1 ? 's' : ''} tracked`}
              </AppText>
            </View>
            <TouchableOpacity
              style={st.addBtn}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push('/add/search' as any);
              }}
            >
              <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          {subscriptions.length === 0 ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <AppText style={{ color: '#FFF', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
                No subscriptions tracked
              </AppText>
              <AppText style={{ color: expenseColors.textMuted, fontSize: 11, textAlign: 'center' }}>
                Add your recurring subscriptions to track billing dates.
              </AppText>
            </View>
          ) : (
            <View style={st.subListStack}>
              {subscriptions.map((sub) => {
                const renewalFormatted = sub.nextBillingDate
                  ? new Date(sub.nextBillingDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'N/A';
                const subColor = sub.color || expenseColors.accentPeach;

                return (
                  <TouchableOpacity
                    key={sub.id}
                    style={st.subRowItem}
                    activeOpacity={0.75}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      router.push(`/subscription/${sub.id}` as any);
                    }}
                  >
                    <View style={st.subRowLeft}>
                      <View style={[st.subColorDot, { backgroundColor: subColor }]} />
                      <View style={{ flexShrink: 1 }}>
                        <AppText style={st.subName} numberOfLines={1}>
                          {sub.name}
                        </AppText>
                        <AppText style={st.subMetaText} numberOfLines={1}>
                          {(sub.billingCycle || 'monthly').toUpperCase()} • Renews {renewalFormatted}
                        </AppText>
                      </View>
                    </View>

                    <View style={st.subRowRight}>
                      <AppText style={st.subCostText}>
                        {sym}{sub.price.toLocaleString('en-IN')}
                      </AppText>
                      <ChevronRight size={14} color="#7E8394" />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Animated.View>

      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: expenseColors.bgPrimary },
  scroll: { flex: 1 },

  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingVertical: 10 },
  titleThe: {
    color: '#FFF', fontSize: 24, lineHeight: 30, fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    letterSpacing: 0.5,
  },
  titleViz: { color: '#FFF', fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: 1.5 },

  // ── Horizon Switcher ──
  horizonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: PAGE_M,
    marginBottom: 16,
    backgroundColor: '#1A1D23',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  horizonPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 10,
  },
  horizonPillActive: {
    backgroundColor: '#272224',
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.4)',
  },
  horizonPillText: {
    color: '#7C8092',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  horizonPillTextActive: {
    color: '#FF9D66',
    fontWeight: '800',
  },

  // ── Multi-Month Trend ──
  trendChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 4,
    minHeight: 140,
  },
  trendCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  trendAmtLabel: {
    color: '#8E919D',
    fontSize: 9,
    fontWeight: '600',
  },
  trendTrack: {
    width: 22,
    height: 110,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 5,
  },
  trendBar: {
    width: '100%',
    backgroundColor: '#383B4C',
    borderRadius: 5,
  },
  trendBarCurrent: {
    backgroundColor: '#FF9D66',
  },
  trendMonthLabel: {
    color: '#7C8092',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  trendMonthLabelCurrent: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // ── Weekend vs Weekday Contrast ──
  weekendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 114, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 177, 149, 0.25)',
  },
  weekendBadgeText: {
    color: expenseColors.accentPeach,
    fontSize: 10,
    fontWeight: '800',
  },
  contrastTrack: {
    height: 8,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 14,
  },
  contrastBarWeekday: {
    height: '100%',
    backgroundColor: '#C4A7E7',
    borderRadius: 3,
  },
  contrastBarWeekend: {
    height: '100%',
    backgroundColor: expenseColors.accentPeach,
    borderRadius: 3,
  },
  contrastStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contrastStatCol: {
    flex: 1,
    gap: 3,
  },
  contrastDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 12,
  },
  statDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statLabel: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
  },
  statAmount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  statSub: {
    color: '#7C8092',
    fontSize: 11,
    fontWeight: '500',
  },
  leisureFootnote: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  leisureFootnoteText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '500',
  },

  card: {
    width: CARD_W,
    marginHorizontal: PAGE_M,
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: CARD_P,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  compactCard: {
    width: CARD_W,
    marginHorizontal: PAGE_M,
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: CARD_P,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  rowBetweenCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardLabel: { color: '#FFF', fontSize: 13, lineHeight: 17, fontWeight: '800', letterSpacing: 1.2 },
  cardSub: { color: expenseColors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '600', letterSpacing: 0.6, marginTop: 2 },

  // ── Flow ──
  flowAmt: { color: '#FFF', fontSize: 22, lineHeight: 28, fontWeight: '800' },
  flowBody: { flexDirection: 'row', alignItems: 'flex-start' },
  incomeLabel: { color: '#FFF', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  labelSlot: { position: 'absolute', left: 6, right: 0, height: LABEL_H },
  catLabel: { fontSize: 10, lineHeight: 12, fontWeight: '700', letterSpacing: 0.2 },
  catAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  catAmt: { color: '#FFF', fontSize: 10, lineHeight: 12, fontWeight: '500' },
  catPctText: { fontSize: 10, lineHeight: 12, fontWeight: '800', letterSpacing: 0.3 },

  // ── Calendar ──
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendTxt: { color: expenseColors.textMuted, fontSize: 10, lineHeight: 14, marginLeft: 4 },
  legendBox: { width: 9, height: 9, borderRadius: 2, marginLeft: 3 },
  legendSq: { width: 9, height: 9, borderRadius: 2 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { color: expenseColors.textSubtle, fontSize: 10, lineHeight: 14, fontWeight: '500' },
  tile: { borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tileSel: { borderWidth: 2, borderColor: '#FFF' },
  tileNum: { color: '#FFF', fontSize: 12, lineHeight: 16, fontWeight: '600' },

  insightRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  insightCard: {
    flex: 1,
    backgroundColor: '#22242F',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  insightHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  insightHead: {
    color: '#8E919D',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  insightVal: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },

  // ── Selected Day Popup Card ──
  dayDetailWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  dayDetailCard: {
    backgroundColor: '#161922',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    marginTop: 12,
  },
  dayDetailDate: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  dayDetailTotal: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 10,
  },
  dayItemsStack: {
    gap: 8,
  },
  dayItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dayPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dayPillText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  dayItemAmt: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  dayNoSpendText: {
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // ── Weekly Rhythm ──
  rhythmContainer: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'flex-start',
  },
  yAxis: {
    width: 34,
    height: RHYTHM_BAR_H,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  yLbl: {
    color: expenseColors.textMuted,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
  },
  rhythmChartArea: {
    flex: 1,
    height: RHYTHM_BAR_H + 24,
    position: 'relative',
    marginLeft: 4,
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderStyle: 'dashed',
  },
  avgLbl: {
    position: 'absolute',
    right: 2,
    color: expenseColors.textMuted,
    fontSize: 10,
    fontWeight: '500',
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: RHYTHM_BAR_H + 24,
    paddingRight: 28,
  },
  barCol: {
    width: 28,
    height: RHYTHM_BAR_H + 24,
    alignItems: 'center',
    position: 'relative',
  },
  barAmt: {
    position: 'absolute',
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: 36,
  },
  barAmtHighlight: {
    color: '#FF9D66',
    fontWeight: '800',
  },
  barAmtZero: {
    color: expenseColors.textMuted,
  },
  barFill: {
    position: 'absolute',
    bottom: 24,
    width: 24,
    backgroundColor: '#FF9D66',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  barFillHighlight: {
    backgroundColor: '#FF8A4C',
  },
  barDay: {
    position: 'absolute',
    bottom: 0,
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  barDayHighlight: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ── VS Last Month ──
  vsStack: {
    gap: 16,
    marginTop: 4,
  },
  vsItem: {
    gap: 8,
  },
  vsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vsDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  vsCat: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  vsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newPill: {
    backgroundColor: '#2E1E1A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newTxt: {
    color: '#FF9D66',
    fontSize: 9,
    fontWeight: '800',
  },
  increasePill: {
    backgroundColor: 'rgba(255, 91, 91, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  increaseTxt: {
    color: expenseColors.accentRed,
    fontSize: 9,
    fontWeight: '800',
  },
  decreasePill: {
    backgroundColor: expenseColors.accentGreenBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  decreaseTxt: {
    color: expenseColors.accentGreen,
    fontSize: 9,
    fontWeight: '800',
  },
  vsAmt: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  vsBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  vsLastBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#2C2D35',
    borderRadius: 3,
  },
  vsFill: {
    height: 6,
    borderRadius: 3,
  },

  addBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#22242F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subListStack: {
    marginTop: 12,
    gap: 8,
  },
  subRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  subRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  subColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subName: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  subMetaText: {
    color: '#7E8394',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  subRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  subCostText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
