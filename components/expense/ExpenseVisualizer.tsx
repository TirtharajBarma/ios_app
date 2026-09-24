import React, { useState, useRef, useMemo, useEffect } from 'react';
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
import { Flame, Trophy, Plus, Sparkles, TrendingUp, Calendar, Zap, Compass } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { FixedBottomNav } from './FixedBottomNav';
import { expenseColors } from '@/constants/expenseColors';

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
const CARD_P   = 14;           // compact card inner padding
const CARD_W   = SW - PAGE_M * 2;
const INNER_W  = CARD_W - CARD_P * 2;

// ── Calendar ─────────────────────────────────
const CAL_GAP      = 5;
const CAL_ROW_GAP  = 4;
const TILE_W       = Math.floor((INNER_W - CAL_GAP * 6) / 7);
const TILE_H       = 32;       // compact tile height to reduce card height

// ── Sankey ───────────────────────────────────
const INCOME_W  = 46;
const RLABEL_W  = 138;
const SVG_W     = INNER_W - INCOME_W - RLABEL_W;
const CHART_H   = 200;
const SRC_W     = 9;
const DST_W     = 9;
const DST_GAP   = 6;

// ─────────────────────────────────────────────
// FLOW CATEGORIES
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

function buildStreams(cats: FlowCat[], chartHeight: number): Stream[] {
  const active = cats.filter(c => c.amount > 0);
  const total  = active.reduce((s, c) => s + c.amount, 0);
  if (!total) return [];

  const totalDestGaps = (active.length - 1) * DST_GAP;
  const destAvail     = Math.max(chartHeight - totalDestGaps, 20);

  const srcRX = SRC_W;
  const dstLX = SVG_W - DST_W;
  const cp    = (dstLX - srcRX) * 0.44;

  let srcY = 0, dstY = 0;
  return active.map(cat => {
    const frac = cat.amount / total;
    const srcH = Math.max(frac * chartHeight, 2);
    const dstH = Math.max(frac * destAvail, 4);

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
    dstY = dY2 + DST_GAP;
    return { cat, path, dY1, dY2 };
  });
}

// ─────────────────────────────────────────────
// LABEL Y-POSITION RESOLVER
// ─────────────────────────────────────────────
const LABEL_H = 24;

function resolveY(streams: Stream[], chartHeight: number): number[] {
  if (!streams.length) return [];
  const pos = streams.map(s => (s.dY1 + s.dY2) / 2 - LABEL_H / 2);
  for (let i = 1; i < pos.length; i++) {
    if (pos[i] < pos[i-1] + LABEL_H + 2) pos[i] = pos[i-1] + LABEL_H + 2;
  }
  if (pos[0] < 0) {
    const shift = -pos[0];
    for (let i = 0; i < pos.length; i++) pos[i] += shift;
  }
  const last = pos.length - 1;
  if (pos[last] + LABEL_H > chartHeight) {
    const shift = pos[last] + LABEL_H - chartHeight;
    for (let i = 0; i <= last; i++) pos[i] = Math.max(0, pos[i] - shift);
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

// ── Dynamic Month/Year Parser ─────────────────
function getMonthYearInfo(monthStr: string) {
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthShorts = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  const str = (monthStr || 'September 2026').toLowerCase();
  let year = 2026;
  let month = 8; // September default (0-indexed)

  const yr = str.match(/\b(20\d\d)\b/);
  if (yr) year = parseInt(yr[1], 10);

  monthNames.forEach((m, i) => { if (str.includes(m)) month = i; });
  if (month === 8 && !str.includes('september')) {
    monthShorts.forEach((m, i) => { if (str.includes(m)) month = i; });
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon, 2 = Tue...

  const lastMonth = month === 0 ? 11 : month - 1;
  const lastYear = month === 0 ? year - 1 : year;

  return { year, month, daysInMonth, startOffset, lastYear, lastMonth };
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export const ExpenseVisualizer: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { selectedMonth, getTotalSpent, getCategoryBreakdown, transactions, categories: storeCategories, currencySymbol } = useExpenseStore();
  const sym = currencySymbol || '₹';
  const { subscriptions } = useSubscriptionStore();
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('1M');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [displayedDay, setDisplayedDay] = useState<number | null>(null);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);

  const toggleBandSelection = (catId: string) => {
    if (selectedBandId === catId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedBandId(null);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setSelectedBandId(catId);
    }
  };

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

  // dynamic breakdown & total spent
  const totalSpent = getTotalSpent();
  const breakdown = getCategoryBreakdown();

  // dynamic calendar calculation for any month/year (Sunday to Saturday)
  const { year: curYear, month: curMonth, daysInMonth, startOffset, lastYear, lastMonth } = getMonthYearInfo(selectedMonth);
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Month-filtered expense transactions only
  const monthExpenses = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.type !== 'expense') return false;
      const txDate = new Date(tx.date);
      return txDate.getFullYear() === curYear && txDate.getMonth() === curMonth;
    });
  }, [transactions, curYear, curMonth]);

  // Weekend vs Weekday Contrast Algorithm
  const weekendVsWeekday = useMemo(() => {
    let weekdaySum = 0;
    let weekendSum = 0;

    const targetTxs = timeHorizon === '1W'
      ? transactions.filter(t => {
          if (t.type !== 'expense') return false;
          const refTime = new Date(curYear, curMonth, daysInMonth).getTime();
          const weekAgo = refTime - 7 * 86400000;
          const tTime = new Date(t.date).getTime();
          return tTime >= weekAgo && tTime <= refTime;
        })
      : timeHorizon === '1M'
      ? monthExpenses
      : transactions.filter(t => {
          if (t.type !== 'expense') return false;
          const monthCount = timeHorizon === '6M' ? 6 : 12;
          const startRange = new Date(curYear, curMonth - monthCount + 1, 1).getTime();
          const endRange = new Date(curYear, curMonth + 1, 0, 23, 59, 59).getTime();
          const tTime = new Date(t.date).getTime();
          return tTime >= startRange && tTime <= endRange;
        });

    targetTxs.forEach(tx => {
      const day = new Date(tx.date).getDay();
      const isWeekend = day === 0 || day === 6;
      const share = tx.split ? tx.split.yourShare : tx.amount;
      if (isWeekend) {
        weekendSum += share;
      } else {
        weekdaySum += share;
      }
    });

    const total = weekdaySum + weekendSum;
    const weekendPct = total > 0 ? Math.round((weekendSum / total) * 100) : 0;
    const weekdayPct = total > 0 ? 100 - weekendPct : 0;

    // Daily averages
    const avgWeekend = weekendSum / 8; // approx 8 weekend days in a month
    const avgWeekday = weekdaySum / 22; // approx 22 weekdays
    const ratio = avgWeekday > 0 ? (avgWeekend / avgWeekday).toFixed(1) : '1.0';

    return {
      weekdaySum,
      weekendSum,
      weekendPct,
      weekdayPct,
      avgWeekend,
      avgWeekday,
      ratio,
    };
  }, [transactions, monthExpenses, timeHorizon, curYear, curMonth, daysInMonth]);

  // Multi-Month Trend calculation for 6M, 1Y, ALL (Anchored to selectedMonth)
  const multiMonthTrend = useMemo(() => {
    const monthCount = timeHorizon === '6M' ? 6 : timeHorizon === '1Y' ? 12 : 12;
    const result: { label: string; year: number; month: number; amount: number; isCurrent: boolean }[] = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      const mYear = d.getFullYear();
      const mMonth = d.getMonth();
      const label = d.toLocaleDateString('en-US', { month: 'short' });

      const spentInMonth = transactions
        .filter(t => {
          if (t.type !== 'expense') return false;
          const tDate = new Date(t.date);
          return tDate.getFullYear() === mYear && tDate.getMonth() === mMonth;
        })
        .reduce((sum, t) => sum + (t.split ? t.split.yourShare : t.amount), 0);

      result.push({
        label,
        year: mYear,
        month: mMonth,
        amount: spentInMonth,
        isCurrent: i === 0,
      });
    }

    const maxAmt = Math.max(...result.map(r => r.amount), 100);
    const totalSpentInHorizon = result.reduce((s, r) => s + r.amount, 0);
    const avgMonthly = Math.round(totalSpentInHorizon / Math.max(monthCount, 1));
    return { data: result, maxAmt, totalSpentInHorizon, avgMonthly };
  }, [transactions, timeHorizon, curYear, curMonth]);

  // Horizon-filtered expense transactions
  const horizonExpenses = useMemo(() => {
    if (timeHorizon === '1M') {
      return monthExpenses;
    }
    if (timeHorizon === '1W') {
      const refTime = new Date(curYear, curMonth, daysInMonth).getTime();
      const weekAgo = refTime - 7 * 86400000;
      return transactions.filter(t => {
        if (t.type !== 'expense') return false;
        const tTime = new Date(t.date).getTime();
        return tTime >= weekAgo && tTime <= refTime;
      });
    }
    if (timeHorizon === '6M' || timeHorizon === '1Y') {
      const monthCount = timeHorizon === '6M' ? 6 : 12;
      const startRange = new Date(curYear, curMonth - monthCount + 1, 1).getTime();
      const endRange = new Date(curYear, curMonth + 1, 0, 23, 59, 59).getTime();
      return transactions.filter(t => {
        if (t.type !== 'expense') return false;
        const tTime = new Date(t.date).getTime();
        return tTime >= startRange && tTime <= endRange;
      });
    }
    return transactions.filter(t => t.type === 'expense');
  }, [transactions, timeHorizon, monthExpenses, curYear, curMonth, daysInMonth]);

  const horizonTotalSpent = useMemo(() => {
    return horizonExpenses.reduce((sum, t) => sum + (t.split ? t.split.yourShare : t.amount), 0);
  }, [horizonExpenses]);

  // Dynamic active spending categories sorted descending by spend for chosen horizon
  const activeBreakdown = useMemo(() => {
    const catMap: Record<string, number> = {};
    horizonExpenses.forEach(tx => {
      const share = tx.split ? tx.split.yourShare : tx.amount;
      catMap[tx.categoryId] = (catMap[tx.categoryId] || 0) + share;
    });

    return storeCategories
      .map(cat => ({
        category: cat,
        amount: catMap[cat.id] || 0,
      }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [horizonExpenses, storeCategories]);

  const cats: FlowCat[] = useMemo(() => {
    return activeBreakdown.map((item) => ({
      id: item.category.id,
      name: item.category.name.toUpperCase(),
      label: item.category.name.toUpperCase(),
      emoji: item.category.emoji,
      color: item.category.color,
      amount: item.amount,
    }));
  }, [activeBreakdown]);

  // Dynamic Chart Height based on active categories
  const chartHeight = useMemo(() => {
    return Math.min(260, Math.max(150, cats.length * 36));
  }, [cats.length]);

  // sankey
  const streams   = useMemo(() => buildStreams(cats, chartHeight), [cats, chartHeight]);
  const labelTops = useMemo(() => resolveY(streams, chartHeight), [streams, chartHeight]);
  const dstLX     = SVG_W - DST_W;

  // Last month expense transactions for month-over-month comparison
  const lastMonthExpenses = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.type !== 'expense') return false;
      const txDate = new Date(tx.date);
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
    storeCategories.forEach(cat => {
      const thisAmt = thisMonthMap[cat.id] || 0;
      const lastAmt = lastMonthMap[cat.id] || 0;

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

        const formatted = thisAmt >= 1000 ? `${sym}${(thisAmt / 1000).toFixed(1)}K` : `${sym}${thisAmt.toLocaleString('en-IN')}`;

        activeList.push({
          id: cat.id,
          name: cat.name.toUpperCase(),
          emoji: cat.emoji,
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
  }, [monthExpenses, lastMonthExpenses, storeCategories]);

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
      const d = new Date(tx.date).getDate();
      map[d] = (map[d] || 0) + tx.amount;
    });
    return map;
  }, [monthExpenses]);

  const maxDaySpend = useMemo(() => {
    const values = Object.values(dailySpend);
    return values.length > 0 ? Math.max(...values, 1) : 1;
  }, [dailySpend]);

  const heatColor = (day: number) => {
    const a = dailySpend[day] || 0;
    if (a === 0) return '#1D1F2A';
    const ratio = a / maxDaySpend;
    if (ratio < 0.2) return '#3A2E28';
    if (ratio < 0.5) return '#7A4828';
    if (ratio < 0.8) return '#C96B35';
    return '#E84040';
  };

  // Heaviest weekday dynamically calculated
  const weekdayTotals = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0]; // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    monthExpenses.forEach(tx => {
      const dayIdx = new Date(tx.date).getDay();
      totals[dayIdx] += tx.amount;
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

  // Dynamic Weekly Rhythm
  const rhythmData = useMemo(() => {
    const spendByMonSun = [0, 0, 0, 0, 0, 0, 0]; // Mon (0) to Sun (6)
    monthExpenses.forEach(tx => {
      const jsDay = new Date(tx.date).getDay(); // 0 is Sun
      const idx = jsDay === 0 ? 6 : jsDay - 1;
      spendByMonSun[idx] += tx.amount;
    });

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, idx) => ({
      day,
      amt: spendByMonSun[idx],
      showLabel: spendByMonSun[idx] > 0,
      labelText: formatCompactCurrency(spendByMonSun[idx]),
    }));
  }, [monthExpenses]);

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
    const dayTxs = monthExpenses.filter(tx => new Date(tx.date).getDate() === day);
    if (dayTxs.length === 0) return [];

    const grouped: Record<string, { category: string; emoji?: string; color: string; amount: number }> = {};
    dayTxs.forEach(tx => {
      const cat = storeCategories.find(c => c.id === tx.categoryId) || {
        name: 'Expense',
        emoji: '',
        color: '#FF9D66',
      };
      if (!grouped[tx.categoryId]) {
        grouped[tx.categoryId] = {
          category: cat.name,
          emoji: cat.emoji || '',
          color: cat.color || '#FF9D66',
          amount: 0,
        };
      }
      grouped[tx.categoryId].amount += tx.amount;
    });

    return Object.values(grouped);
  };

  return (
    <View style={st.screen}>
      <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary }} />

      <ScrollView
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
                return (
                  <View key={idx} style={st.trendCol}>
                    {item.amount > 0 ? (
                      <AppText style={st.trendAmtLabel} numberOfLines={1}>
                        {formatCompactCurrency(item.amount)}
                      </AppText>
                    ) : (
                      <View style={{ height: 14 }} />
                    )}
                    <View style={st.trendTrack}>
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
                    <AppText style={[st.trendMonthLabel, item.isCurrent && st.trendMonthLabelCurrent]}>
                      {item.label}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ═══ WEEKEND VS WEEKDAY CONTRAST CARD ═══ */}
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
            <View>
              <AppText style={st.cardLabel}>WEEKEND VS WEEKDAY</AppText>
              <AppText style={st.cardSub}>
                {weekendVsWeekday.weekendPct >= 50
                  ? `⚡ Weekend Surge: ${weekendVsWeekday.ratio}x higher daily burn`
                  : '⚖️ Balanced weekday vs weekend rhythm'}
              </AppText>
            </View>
            <View style={st.weekendBadge}>
              <Zap size={10} color="#FF725E" />
              <AppText style={st.weekendBadgeText}>{weekendVsWeekday.weekendPct}% Sat-Sun</AppText>
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
                    outputRange: ['0%', `${Math.max(weekendVsWeekday.weekdayPct, 4)}%`],
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
                    outputRange: ['0%', `${Math.max(weekendVsWeekday.weekendPct, 4)}%`],
                  }) as any,
                },
              ]}
            />
          </View>

          {/* Stats Grid */}
          <View style={st.contrastStatsRow}>
            <View style={st.contrastStatCol}>
              <View style={st.statDotRow}>
                <View style={[st.miniDot, { backgroundColor: '#9B8AFB' }]} />
                <AppText style={st.statLabel}>Weekdays (Mon-Fri)</AppText>
              </View>
              <AppText style={st.statAmount}>{sym}{weekendVsWeekday.weekdaySum.toLocaleString('en-IN')}</AppText>
              <AppText style={st.statSub}>~{sym}{Math.round(weekendVsWeekday.avgWeekday).toLocaleString('en-IN')}/day</AppText>
            </View>

            <View style={st.contrastDivider} />

            <View style={st.contrastStatCol}>
              <View style={st.statDotRow}>
                <View style={[st.miniDot, { backgroundColor: '#FF725E' }]} />
                <AppText style={st.statLabel}>Weekends (Sat-Sun)</AppText>
              </View>
              <AppText style={st.statAmount}>{sym}{weekendVsWeekday.weekendSum.toLocaleString('en-IN')}</AppText>
              <AppText style={st.statSub}>~{sym}{Math.round(weekendVsWeekday.avgWeekend).toLocaleString('en-IN')}/day</AppText>
            </View>
          </View>
        </Animated.View>

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
                Log transactions this month to visualize your category flow.
              </AppText>
            </View>
          ) : (
            <View style={st.flowBody}>

              {/* Income label */}
              <View style={{ width: INCOME_W, height: chartHeight, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 8 }}>
                <AppText style={st.incomeLabel} numberOfLines={1}>Income</AppText>
              </View>

              {/* SVG */}
              <Svg width={SVG_W} height={chartHeight}>
                {/* source bar */}
                <Rect x={0} y={0} width={SRC_W} height={chartHeight} rx={4} fill="#5CE49A" />
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
                  const pct = totalSpent > 0 ? ((s.cat.amount / totalSpent) * 100).toFixed(1) : '0';

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
                        >
                          – {formatCompactCurrency(s.cat.amount)}
                        </AppText>
                        {isSelected && (
                          <AppText
                            style={[
                              st.catPctText,
                              { color: s.cat.color },
                            ]}
                            numberOfLines={1}
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

        {/* ═══ CARD 2: SPENDING CALENDAR (Active in 1M view) ═══ */}
        {timeHorizon === '1M' && (
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
                {['#1D1F2A','#3A2E28','#7A4828','#C96B35','#E84040'].map(c => (
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
                        <AppText style={st.tileNum}>{day}</AppText>
                      </TouchableOpacity>
                    ) : (
                      <View key={`b-${cIdx}`} style={{ width: TILE_W, height: TILE_H }} />
                    )
                  ))}
                </View>
              ))}
            </View>

            {/* insight cards */}
            <View style={st.insightRow}>
              <View style={st.insightCard}>
                <Flame size={14} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <AppText style={st.insightHead}>Heaviest:</AppText>
                  <AppText style={st.insightSub}>{heaviestDayName}</AppText>
                </View>
                <AppText style={st.insightVal}>{formatCompactCurrency(heaviestDayAmount)}</AppText>
              </View>
              <View style={st.insightCard}>
                <Trophy size={14} color="#FFFFFF" />
                <AppText style={st.insightStreak}>{noSpendStreak}-day no-spend streak</AppText>
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
                          <View style={st.dayPill}>
                            <AppText style={[st.dayPillText, { color: item.color || '#FF9D66' }]}>
                              {item.category}{item.emoji ? ` ${item.emoji}` : ''}
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
        )}

        {/* ═══ CARD 3: WEEKLY RHYTHM (1M and 1W views) ═══ */}
        {(timeHorizon === '1M' || timeHorizon === '1W') && (
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
              <AppText style={st.cardLabel}>WEEKLY RHYTHM</AppText>
              {avgRhythmAmount > 0 && (
                <AppText style={st.cardSub}>
                  Avg: {sym}{avgRhythmAmount.toLocaleString('en-IN')}/day
                </AppText>
              )}
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
        )}

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
                          {cat.emoji ? ` ${cat.emoji}` : ''}
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
            <AppText style={st.cardLabel}>SUBSCRIPTION AUDIT</AppText>
            <TouchableOpacity style={st.addBtn}>
              <Plus size={14} color="#FFFFFF" />
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
            <View style={{ paddingVertical: 10, alignItems: 'center' }}>
              <AppText style={{ color: expenseColors.accentGreen, fontSize: 12, fontWeight: '600' }}>
                {subscriptions.length} active subscription{subscriptions.length !== 1 ? 's' : ''} tracked
              </AppText>
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
    borderColor: 'rgba(255, 114, 94, 0.25)',
  },
  weekendBadgeText: {
    color: '#FF725E',
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
    backgroundColor: '#9B8AFB',
    borderRadius: 3,
  },
  contrastBarWeekend: {
    height: '100%',
    backgroundColor: '#FF725E',
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

  card: {
    width: CARD_W,
    marginHorizontal: PAGE_M,
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  compactCard: {
    width: CARD_W,
    marginHorizontal: PAGE_M,
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: 18,
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
  labelSlot: { position: 'absolute', left: 8, right: 0, height: LABEL_H },
  catLabel: { fontSize: 10, lineHeight: 12, fontWeight: '700', letterSpacing: 0.2 },
  catAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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

  insightRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  insightCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#22242F', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, gap: 6,
  },
  insightHead: { color: '#FFF', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  insightSub: { color: expenseColors.textMuted, fontSize: 9, lineHeight: 12 },
  insightVal: { color: '#FFF', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  insightStreak: { color: '#FFF', fontSize: 10, lineHeight: 14, fontWeight: '600', flex: 1 },

  // ── Selected Day Popup Card ──
  dayDetailWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  dayDetailCard: {
    backgroundColor: '#1A1D23',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    marginTop: 10,
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
    marginBottom: 8,
  },
  dayItemsStack: {
    gap: 6,
  },
  dayItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayPill: {
    backgroundColor: '#231D1F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dayPillText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  dayItemAmt: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
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
    color: '#FF5B5B',
    fontSize: 9,
    fontWeight: '800',
  },
  decreasePill: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  decreaseTxt: {
    color: '#2ECC71',
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
});
