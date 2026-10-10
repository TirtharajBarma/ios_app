import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
  PanResponder,
  LayoutAnimation,
  UIManager,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  Flame,
  Trophy,
  Plus,
  Zap,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Sparkles,
  RotateCcw,
} from 'lucide-react-native';
import { AppText, LiquidGlassSegmentedControl } from '@/components/ui';
import { useExpenseStore, getUserCategories, isSystemCategory, monthKeyOf } from '@/store/useExpenseStore';
import { useShallow } from 'zustand/react/shallow';
import * as Haptics from 'expo-haptics';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseTransaction } from '@/types/expense';
import { getSubscriptionActivePrice } from '@/utils/date';

import { useRouter, useFocusEffect, useScrollToTop } from 'expo-router';
import { handleTabFocus } from '@/services/navigation/tabTracker';
import { formatCompactCurrency } from './MoneyFlowCard';

export type TimeHorizon = '1W' | '1M' | '6M' | '1Y' | 'ALL';

// ─────────────────────────────────────────────
// ALL SIZES ARE COMPUTED FROM SCREEN WIDTH
// ─────────────────────────────────────────────
const PAGE_M   = 16;           // page horizontal margin
const CARD_P   = 16;           // compact card inner padding

// ── Calendar ─────────────────────────────────
const CAL_GAP              = 5;
const CAL_ROW_GAP          = 4;
const TILE_H               = 32;       // compact tile height to reduce card height
// 💡 GAP CONTROL: Adjust this value to manually increase or decrease the vertical gap
// between the calendar date grid and the bottom insight cards (HEAVIEST DAY / NO-SPEND STREAK).
export const CALENDAR_INSIGHT_GAP = 12
const WEEKDAYS             = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Sankey ───────────────────────────────────
const INCOME_W  = 50;
const CHART_H   = 200;         // stable constant height for Category Flow
const SRC_W     = 8;
const DST_W     = 8;

interface VizMetrics {
  CARD_W: number;
  INNER_W: number;
  TILE_W: number;
  RLABEL_W: number;
  SVG_W: number;
}

function getVizMetrics(width: number): VizMetrics {
  const CARD_W = width - PAGE_M * 2;
  const INNER_W = CARD_W - CARD_P * 2;
  const TILE_W = Math.floor((INNER_W - CAL_GAP * 6) / 7);
  const RLABEL_W = Math.max(92, Math.min(108, Math.round(INNER_W * 0.30)));
  return { CARD_W, INNER_W, TILE_W, RLABEL_W, SVG_W: INNER_W - INCOME_W - RLABEL_W };
}

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

function buildStreams(cats: FlowCat[], chartHeight: number, SVG_W: number): Stream[] {
  const active = cats.filter(c => c.amount > 0);
  const total  = active.reduce((s, c) => s + c.amount, 0);
  if (!total) return [];

  const n = active.length;
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

  const MIN_SPACING = LABEL_H + 2;
  const pos = streams.map(s => (s.dY1 + s.dY2) / 2 - LABEL_H / 2);

  for (let i = 1; i < n; i++) {
    if (pos[i] < pos[i - 1] + MIN_SPACING) {
      pos[i] = pos[i - 1] + MIN_SPACING;
    }
  }

  const maxBottom = chartHeight - LABEL_H;
  if (pos[n - 1] > maxBottom) {
    pos[n - 1] = maxBottom;
    for (let i = n - 2; i >= 0; i--) {
      if (pos[i] > pos[i + 1] - MIN_SPACING) {
        pos[i] = pos[i + 1] - MIN_SPACING;
      }
    }
  }

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

// ── Robust ISO Date Parser ──
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

function stepMonthKey(monthStr: string, delta: number): string {
  const { year, month } = getMonthYearInfo(monthStr);
  const nextDate = new Date(year, month + delta, 1);
  return monthKeyOf(nextDate);
}

function isCurrentCalendarMonth(monthStr: string): boolean {
  const now = new Date();
  const { year, month } = getMonthYearInfo(monthStr);
  return year === now.getFullYear() && month === now.getMonth();
}

function canGoNextMonth(monthStr: string): boolean {
  const now = new Date();
  const { year, month } = getMonthYearInfo(monthStr);
  if (year > now.getFullYear()) return false;
  if (year === now.getFullYear() && month >= now.getMonth()) return false;
  return true;
}

// ── Horizon time window ──────
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
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      return { start, end };
    } else {
      const end = new Date(curYear, curMonth, daysInMonth, 23, 59, 59, 999);
      const start = new Date(curYear, curMonth, Math.max(1, daysInMonth - 6), 0, 0, 0, 0);
      return { start, end };
    }
  }
  if (timeHorizon === '1M') {
    return {
      start: new Date(curYear, curMonth, 1, 0, 0, 0, 0),
      end: isCurrentMonth
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        : new Date(curYear, curMonth, daysInMonth, 23, 59, 59, 999),
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
  const expenseTimes = transactions
    .filter((t) => t.type === 'expense')
    .map((t) => parseTxDate(t.date).getTime());
  const earliestMs = expenseTimes.length > 0 ? Math.min(...expenseTimes) : null;
  const start = earliestMs !== null
    ? new Date(new Date(earliestMs).getFullYear(), new Date(earliestMs).getMonth(), 1, 0, 0, 0, 0)
    : new Date(curYear, curMonth, 1, 0, 0, 0, 0);
  return { start, end: new Date(curYear + 10, 11, 31, 23, 59, 59, 999) };
}

interface MonthHeatmapGridProps {
  monthKey: string;
  transactions: ExpenseTransaction[];
  subscriptions: any[];
  selectedDay: number | null;
  onDayPress: (day: number) => void;
  TILE_W: number;
  INNER_W: number;
}

/**
 * Days of a month on which a subscription renews: weekly and bi-weekly repeat through the month,
 * and a day that does not exist in a short month (the 31st in April) clamps to the last day.
 */
function renewalDaysInMonth(cycle: string, ref: Date, year: number, month: number, daysInMonth: number): number[] {
  const dayIdx = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / 86400000);
  if (cycle === 'weekly' || cycle === 'bi-weekly') {
    const step = cycle === 'weekly' ? 7 : 14;
    const refIdx = dayIdx(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const startIdx = dayIdx(year, month, 1);
    const first = startIdx + ((((refIdx - startIdx) % step) + step) % step);
    const days: number[] = [];
    for (let i = first; i < startIdx + daysInMonth; i += step) days.push(i - startIdx + 1);
    return days;
  }
  if (cycle === 'yearly' && ref.getMonth() !== month) return [];
  if (cycle !== 'monthly' && cycle !== 'daily' && cycle !== 'yearly' && !(ref.getFullYear() === year && ref.getMonth() === month)) return [];
  return [Math.min(ref.getDate(), daysInMonth)];
}

const MonthHeatmapGrid = React.memo(function MonthHeatmapGrid({
  monthKey,
  transactions,
  subscriptions,
  selectedDay,
  onDayPress,
  TILE_W,
  INNER_W,
}: MonthHeatmapGridProps) {
  const { year, month, daysInMonth, startOffset } = useMemo(() => getMonthYearInfo(monthKey), [monthKey]);

  const monthExpenses = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.type !== 'expense' || tx.categoryId === 'cat_debt_repayment') return false;
      const txDate = parseTxDate(tx.date);
      return txDate.getFullYear() === year && txDate.getMonth() === month;
    });
  }, [transactions, year, month]);

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
      const [v1, v2] = nonZero;
      return { q1: v1, q2: (v1 + v2) / 2, q3: v2 };
    }
    const q1 = nonZero[Math.floor(nonZero.length * 0.25)] || 1;
    const q2 = nonZero[Math.floor(nonZero.length * 0.50)] || 2;
    const q3 = nonZero[Math.floor(nonZero.length * 0.75)] || 3;
    const safeQ1 = q1;
    const safeQ2 = Math.max(q2, safeQ1 + 1);
    const safeQ3 = Math.max(q3, safeQ2 + 1);
    return { q1: safeQ1, q2: safeQ2, q3: safeQ3 };
  }, [dailySpend]);

  const heatColor = useCallback((day: number) => {
    const a = dailySpend[day] || 0;
    if (a === 0) return '#1D1F2A';
    if (a <= heatmapThresholds.q1) return '#FCA5A5';
    if (a <= heatmapThresholds.q2) return '#EF4444';
    if (a <= heatmapThresholds.q3) return '#B91C1C';
    return '#7F1D1D';
  }, [dailySpend, heatmapThresholds]);

  const heatTextColor = useCallback((day: number) => {
    const a = dailySpend[day] || 0;
    if (a === 0) return expenseColors.textSubtle;
    if (a <= heatmapThresholds.q1) return '#000000';
    return '#FFFFFF';
  }, [dailySpend, heatmapThresholds]);

  const upcomingSubscriptionsByDay = useMemo(() => {
    const map: Record<number, { id: string; name: string; amount: number; color: string; cycle: string }[]> = {};
    if (!subscriptions || subscriptions.length === 0) return map;

    subscriptions.forEach((sub) => {
      if (sub.isPaused) return;
      const activePrice = getSubscriptionActivePrice(sub);
      const subColor = sub.color || expenseColors.accentPeach;

      const cycle = sub.billingCycle || 'monthly';
      const refDateStr = sub.nextBillingDate || sub.startDate;
      if (!refDateStr) return;
      const d = parseTxDate(refDateStr);

      renewalDaysInMonth(cycle, d, year, month, daysInMonth).forEach((renewalDay) => {
        if (!map[renewalDay]) map[renewalDay] = [];
        map[renewalDay].push({
          id: sub.id,
          name: sub.name,
          amount: activePrice,
          color: subColor,
          cycle,
        });
      });
    });

    return map;
  }, [subscriptions, daysInMonth, month, year]);

  const calendarRows: (number | null)[][] = useMemo(() => {
    const rows: (number | null)[][] = [];
    let curRow: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) {
      curRow.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      curRow.push(d);
      if (curRow.length === 7) {
        rows.push(curRow);
        curRow = [];
      }
    }
    if (curRow.length > 0) {
      while (curRow.length < 7) {
        curRow.push(null);
      }
      rows.push(curRow);
    }
    return rows;
  }, [startOffset, daysInMonth]);

  return (
    <View style={{ width: INNER_W }}>
      {/* weekday row: Sun to Sat */}
      <View style={[st.weekRow, { gap: CAL_GAP, marginBottom: 6 }]}>
        {WEEKDAYS.map(d => (
          <View key={d} style={{ width: TILE_W, height: 16, alignItems: 'center', justifyContent: 'center' }}>
            <AppText style={st.weekDay}>{d}</AppText>
          </View>
        ))}
      </View>

      {/* grid in explicit 7-item rows */}
      <View style={{ gap: CAL_ROW_GAP }}>
        {calendarRows.map((row, rIdx) => (
          <View key={`r-${rIdx}`} style={[st.weekRow, { gap: CAL_GAP }]}>
            {row.map((day, cIdx) => {
              if (day === null) {
                return <View key={`b-${cIdx}`} style={{ width: TILE_W, height: TILE_H }} />;
              }
              const hasCommittedSubs = Boolean(
                upcomingSubscriptionsByDay[day] && upcomingSubscriptionsByDay[day].length > 0
              );
              return (
                <TouchableOpacity
                  key={`d-${day}`}
                  activeOpacity={0.75}
                  onPress={() => onDayPress(day)}
                  style={[
                    st.tile,
                    { width: TILE_W, height: TILE_H, backgroundColor: heatColor(day) },
                    selectedDay === day && st.tileSel,
                  ]}
                >
                  <AppText style={[st.tileNum, { color: heatTextColor(day) }]}>{day}</AppText>
                  {hasCommittedSubs && (
                    <View
                      style={[
                        st.tileSubMarker,
                        {
                          backgroundColor:
                            upcomingSubscriptionsByDay[day][0]?.color || '#FF9D66',
                        },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
});

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export const ExpenseVisualizer: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    selectedMonth,
    setSelectedMonth,
    transactions,
    storeCategories,
    currencySymbol,
  } = useExpenseStore(
    useShallow((s) => ({
      selectedMonth: s.selectedMonth,
      setSelectedMonth: s.setSelectedMonth,
      transactions: s.transactions,
      storeCategories: s.categories,
      currencySymbol: s.currencySymbol,
    }))
  );
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
      setSelectedBandId(null);
    } else {
      setSelectedBandId(catId);
    }
  };

  const scrollRef = useRef<ScrollView>(null);

  const { width: vizWidth } = useWindowDimensions();
  const { CARD_W, INNER_W, TILE_W, RLABEL_W, SVG_W } = useMemo(
    () => getVizMetrics(vizWidth),
    [vizWidth]
  );
  const cardWidthStyle = useMemo(() => ({ width: CARD_W }), [CARD_W]);

  useScrollToTop(scrollRef);

  useFocusEffect(
    useCallback(() => {
      handleTabFocus('visualizer', () => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    }, [])
  );

  const canNext = useMemo(() => canGoNextMonth(selectedMonth), [selectedMonth]);
  const isCurrentMonthView = useMemo(() => isCurrentCalendarMonth(selectedMonth), [selectedMonth]);

  // Interactive Touch Scrubbing for Weekly Rhythm Chart
  const [scrubbedRhythmIndex, setScrubbedRhythmIndex] = useState<number | null>(null);
  const rhythmScrubAnim = useRef(new Animated.Value(0)).current;

  // Refs mirror the selection so rapid touch events never read a stale index.
  const rhythmIdxRef = useRef<number | null>(null);
  const rhythmWidthRef = useRef(0);
  const rhythmGrantIdxRef = useRef<number | null>(null);
  const rhythmMovedRef = useRef(false);

  const selectRhythm = useCallback(
    (idx: number | null) => {
      if (rhythmIdxRef.current === idx) return;
      rhythmIdxRef.current = idx;
      setScrubbedRhythmIndex(idx);
      if (idx === null) {
        rhythmScrubAnim.setValue(0);
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      rhythmScrubAnim.stopAnimation();
      Animated.spring(rhythmScrubAnim, {
        toValue: 1,
        damping: 20,
        stiffness: 300,
        useNativeDriver: true,
      }).start();
    },
    [rhythmScrubAnim]
  );

  const rhythmIndexAt = useCallback((locationX: number) => {
    const w = rhythmWidthRef.current;
    if (!w || w <= 0) return null;
    return Math.min(Math.max(0, Math.floor(locationX / (w / 7))), 6);
  }, []);

  // Selection belongs to one month's data, so clear it when the month changes.
  useEffect(() => {
    rhythmIdxRef.current = null;
    setScrubbedRhythmIndex(null);
  }, [selectedMonth]);

  // Generate a continuous, stable strip of the past 36 calendar months ending at current calendar month
  const monthList = useMemo(() => {
    const list: string[] = [];
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth();
    for (let i = 36; i >= 0; i--) {
      const d = new Date(curY, curM - i, 1);
      list.push(monthKeyOf(d));
    }
    return list;
  }, []);

  const curMonthIndex = useMemo(() => {
    const idx = monthList.indexOf(selectedMonth);
    return idx >= 0 ? idx : monthList.length - 1;
  }, [monthList, selectedMonth]);

  // Native 120Hz Apple Liquid Paged Calendar Carousel
  const calScrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef(false);

  // Sync scroll position with selectedMonth when not actively dragging
  useEffect(() => {
    if (!isUserScrolling.current) {
      calScrollRef.current?.scrollTo({ x: curMonthIndex * INNER_W, animated: false });
    }
  }, [curMonthIndex, INNER_W]);

  const handleScrollBegin = useCallback(() => {
    isUserScrolling.current = true;
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isUserScrolling.current = false;
      const offsetX = e.nativeEvent.contentOffset.x;
      const idx = Math.min(
        Math.max(0, Math.round(offsetX / INNER_W)),
        monthList.length - 1
      );
      const targetMonth = monthList[idx];
      if (targetMonth && targetMonth !== selectedMonth) {
        setSelectedMonth(targetMonth);
        setSelectedDay(null);
        setDisplayedDay(null);
      }
    },
    [INNER_W, monthList, selectedMonth, setSelectedMonth]
  );

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // If momentum won't fire (e.g. slow drag without momentum on Android)
      if (Platform.OS === 'android' && Math.abs(e.nativeEvent.velocity?.x || 0) < 0.05) {
        handleMomentumScrollEnd(e);
      }
    },
    [handleMomentumScrollEnd]
  );

  // Month navigation handlers (no vibrations, no scroll jumping)
  const handleStepMonth = useCallback(
    (delta: number) => {
      const targetIdx = curMonthIndex + delta;
      if (targetIdx < 0 || targetIdx >= monthList.length) return;
      const nextKey = monthList[targetIdx];
      isUserScrolling.current = true;
      calScrollRef.current?.scrollTo({ x: targetIdx * INNER_W, animated: true });
      setSelectedMonth(nextKey);
      setSelectedDay(null);
      setDisplayedDay(null);
      setTimeout(() => {
        isUserScrolling.current = false;
      }, 350);
    },
    [curMonthIndex, monthList, INNER_W, setSelectedMonth]
  );

  const handleJumpToCurrentMonth = useCallback(() => {
    const nowKey = monthKeyOf(new Date());
    const idx = monthList.indexOf(nowKey);
    if (idx >= 0) {
      calScrollRef.current?.scrollTo({ x: idx * INNER_W, animated: true });
    }
    setSelectedMonth(nowKey);
    setSelectedDay(null);
    setDisplayedDay(null);
  }, [monthList, INNER_W, setSelectedMonth]);

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

  const barGrowAnim = useRef(new Animated.Value(1)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      barGrowAnim.setValue(1);
      return;
    }

    barGrowAnim.setValue(0);
    Animated.timing(barGrowAnim, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [timeHorizon, selectedMonth]);

  // Dynamic calendar carousel height based on active month rows (5 rows for Oct, 6 rows for Aug)
  const { year: curYear, month: curMonth, daysInMonth, startOffset, lastYear, lastMonth } = getMonthYearInfo(selectedMonth);
  const curMonthRows = Math.ceil((startOffset + daysInMonth) / 7);
  const targetCalHeight = 22 + curMonthRows * TILE_H + (curMonthRows - 1) * CAL_ROW_GAP;
  const animCalHeight = useRef(new Animated.Value(targetCalHeight)).current;

  useEffect(() => {
    Animated.timing(animCalHeight, {
      toValue: targetCalHeight,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [targetCalHeight, animCalHeight]);

  // Month-filtered expense transactions only
  const monthExpenses = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.type !== 'expense' || tx.categoryId === 'cat_debt_repayment') return false;
      const txDate = parseTxDate(tx.date);
      return txDate.getFullYear() === curYear && txDate.getMonth() === curMonth;
    });
  }, [transactions, curYear, curMonth]);

  // Horizon-filtered expense transactions
  const horizonExpenses = useMemo(() => {
    if (timeHorizon === 'ALL') {
      return transactions.filter(t => t.type === 'expense' && t.categoryId !== 'cat_debt_repayment');
    }
    const { start, end } = horizonWindow(timeHorizon, curYear, curMonth, daysInMonth, transactions);
    const startTime = start.getTime();
    const endTime = end.getTime();
    return transactions.filter(t => {
      if (t.type !== 'expense' || t.categoryId === 'cat_debt_repayment') return false;
      const tDate = parseTxDate(t.date);
      const tTime = tDate.getTime();
      return tTime >= startTime && tTime <= endTime;
    });
  }, [transactions, timeHorizon, curYear, curMonth, daysInMonth]);

  const horizonTotalSpent = useMemo(() => {
    return horizonExpenses.reduce((sum, t) => sum + (t.split ? t.split.yourShare : t.amount), 0);
  }, [horizonExpenses]);

  // Subscriptions Forecasting for Calendar Grid
  const upcomingSubscriptionsByDay = useMemo(() => {
    const map: Record<number, { id: string; name: string; amount: number; color: string; cycle: string }[]> = {};
    if (!subscriptions || subscriptions.length === 0) return map;

    subscriptions.forEach((sub) => {
      if (sub.isPaused) return;
      const activePrice = getSubscriptionActivePrice(sub);
      const subColor = sub.color || expenseColors.accentPeach;

      const cycle = sub.billingCycle || 'monthly';
      const refDateStr = sub.nextBillingDate || sub.startDate;
      if (!refDateStr) return;
      const d = parseTxDate(refDateStr);

      renewalDaysInMonth(cycle, d, curYear, curMonth, daysInMonth).forEach((renewalDay) => {
        if (!map[renewalDay]) map[renewalDay] = [];
        map[renewalDay].push({
          id: sub.id,
          name: sub.name,
          amount: activePrice,
          color: subColor,
          cycle,
        });
      });
    });

    return map;
  }, [subscriptions, daysInMonth, curMonth, curYear]);

  const remainingCommittedSubs = useMemo(() => {
    const now = new Date();
    const startDay = isCurrentMonthView ? now.getDate() : 1;

    let total = 0;
    let count = 0;
    Object.entries(upcomingSubscriptionsByDay).forEach(([dayStr, subs]) => {
      const day = Number(dayStr);
      if (!isCurrentMonthView || day >= startDay) {
        subs.forEach((s) => {
          total += s.amount;
          count += 1;
        });
      }
    });
    return { total, count };
  }, [upcomingSubscriptionsByDay, isCurrentMonthView]);

  // Weekend vs Weekday Contrast Algorithm
  const weekendVsWeekday = useMemo(() => {
    const exp = timeHorizon === 'ALL'
      ? transactions.filter(t => t.type === 'expense' && t.categoryId !== 'cat_debt_repayment')
      : horizonExpenses;

    let weekdaySum = 0;
    let weekendSum = 0;
    let weekdayTxCount = 0;
    let weekendTxCount = 0;
    const weekdayCatMap: Record<string, number> = {};
    const weekendCatMap: Record<string, number> = {};

    exp.forEach(tx => {
      const tDate = parseTxDate(tx.date);
      const day = tDate.getDay();
      const share = tx.split ? tx.split.yourShare : tx.amount;
      const catId = tx.categoryId || 'other';
      if (day === 0 || day === 6) {
        weekendSum += share;
        weekendTxCount += 1;
        weekendCatMap[catId] = (weekendCatMap[catId] || 0) + share;
      } else {
        weekdaySum += share;
        weekdayTxCount += 1;
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

    const avgWeekend = weekendDays > 0 ? weekendSum / weekendDays : 0;
    const avgWeekday = weekdayDays > 0 ? weekdaySum / weekdayDays : 0;

    const hasBaseline = weekdaySum > 0 && weekendSum > 0;
    const totalTxCount = weekdayTxCount + weekendTxCount;
    const excessBurnDaily = avgWeekend - avgWeekday;
    const rawWeekendTax = excessBurnDaily * weekendDays;

    const isSurge =
      totalTxCount >= 2 &&
      ((weekdaySum === 0 && weekendSum >= 400) ||
        (hasBaseline && avgWeekday > 0 && avgWeekend > avgWeekday * 1.25 && rawWeekendTax >= 150));
    const rawRatio = avgWeekday > 0 ? avgWeekend / avgWeekday : weekendSum > 0 ? 9.9 : 1.0;
    const clampedRatio = Math.min(Math.max(1.0, rawRatio), 9.9);
    const ratio = clampedRatio >= 9.9 ? '9.9+' : clampedRatio.toFixed(1);
    const weekendTax = isSurge ? Math.round(rawWeekendTax > 0 ? rawWeekendTax : weekendSum) : 0;

    let topLeakCatId = '';
    let maxLeakAmount = 0;

    if (isSurge) {
      const allCatIds = Array.from(new Set([...Object.keys(weekdayCatMap), ...Object.keys(weekendCatMap)]));
      allCatIds.forEach(catId => {
        const wEndAmt = weekendCatMap[catId] || 0;
        const wDayAmt = weekdayCatMap[catId] || 0;
        const avgWDay = weekdayDays > 0 ? wDayAmt / weekdayDays : 0;
        const avgWEnd = weekendDays > 0 ? wEndAmt / weekendDays : 0;
        const catExcess = Math.max(0, (avgWEnd - avgWDay) * weekendDays);
        if (catExcess > maxLeakAmount) {
          maxLeakAmount = catExcess;
          topLeakCatId = catId;
        }
      });
    }

    const topLeakCategory = topLeakCatId ? storeCategories.find(c => c.id === topLeakCatId) : null;
    const isFixedDriver = Boolean(
      topLeakCategory && (
        topLeakCategory.id.toLowerCase().includes('rent') ||
        topLeakCategory.id.toLowerCase().includes('util') ||
        topLeakCategory.id.toLowerCase().includes('bill') ||
        topLeakCategory.id.toLowerCase().includes('subs') ||
        topLeakCategory.id.toLowerCase().includes('emi') ||
        topLeakCategory.id.toLowerCase().includes('loan') ||
        topLeakCategory.id.toLowerCase().includes('insurance') ||
        topLeakCategory.name.toLowerCase().includes('rent') ||
        topLeakCategory.name.toLowerCase().includes('utility') ||
        topLeakCategory.name.toLowerCase().includes('bill') ||
        topLeakCategory.name.toLowerCase().includes('subscription') ||
        topLeakCategory.name.toLowerCase().includes('loan') ||
        topLeakCategory.name.toLowerCase().includes('insurance')
      )
    );

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
      isSurge,
      isFixedDriver,
    };
  }, [transactions, horizonExpenses, timeHorizon, curYear, curMonth, daysInMonth, storeCategories]);

  // Multi-Month Trend calculation for 6M, 1Y, ALL
  const multiMonthTrend = useMemo(() => {
    const result: { label: string; year: number; month: number; amount: number; isCurrent: boolean }[] = [];
    const { start } = horizonWindow(timeHorizon, curYear, curMonth, daysInMonth, transactions);
    const lastMonthStart = new Date(curYear, curMonth, 1);

    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    let guard = 0;
    while (cursor.getTime() <= lastMonthStart.getTime() && guard < 360) {
      guard += 1;
      const mYear = cursor.getFullYear();
      const mMonth = cursor.getMonth();
      const label = cursor.toLocaleDateString('en-US', { month: 'short' });

      const spentInMonth = transactions
        .filter(t => {
          if (t.type !== 'expense' || t.categoryId === 'cat_debt_repayment') return false;
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

  // Dynamic active spending categories sorted descending by spend
  const activeBreakdown = useMemo(() => {
    const catMap: Record<string, number> = {};
    horizonExpenses.forEach(tx => {
      const share = tx.split ? tx.split.yourShare : tx.amount;
      catMap[tx.categoryId] = (catMap[tx.categoryId] || 0) + share;
    });

    const userCats = getUserCategories(storeCategories);
    const knownCatIds = new Set(userCats.map(c => c.id));
    const list = userCats
      .map(cat => ({
        category: cat,
        amount: catMap[cat.id] || 0,
      }))
      .filter(item => item.amount > 0);

    Object.keys(catMap).forEach(catId => {
      if (!isSystemCategory(catId) && !knownCatIds.has(catId) && catMap[catId] > 0) {
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

    return list.sort((a, b) => b.amount - a.amount);
  }, [horizonExpenses, storeCategories]);

  const cats: FlowCat[] = useMemo(() => {
    if (activeBreakdown.length <= 6) {
      return activeBreakdown.map((item) => ({
        id: item.category.id,
        name: item.category.name.toUpperCase(),
        label: item.category.name.toUpperCase(),
        color: item.category.color,
        amount: item.amount,
      }));
    }

    const top5 = activeBreakdown.slice(0, 5).map((item) => ({
      id: item.category.id,
      name: item.category.name.toUpperCase(),
      label: item.category.name.toUpperCase(),
      color: item.category.color,
      amount: item.amount,
    }));

    const otherAmount = activeBreakdown.slice(5).reduce((sum, item) => sum + item.amount, 0);
    if (otherAmount > 0) {
      top5.push({
        id: 'other',
        name: 'OTHER',
        label: 'OTHER',
        color: '#8E8E93',
        amount: otherAmount,
      });
    }

    return top5;
  }, [activeBreakdown]);

  // Constant stable chart height to completely prevent vertical jumps when switching months
  const chartHeight = CHART_H;

  const streams   = useMemo(() => buildStreams(cats, chartHeight, SVG_W), [cats, chartHeight, SVG_W]);
  const labelTops = useMemo(() => resolveY(streams, chartHeight), [streams, chartHeight]);
  const dstLX     = SVG_W - DST_W;

  // Last month expense transactions for month-over-month comparison
  const lastMonthExpenses = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.type !== 'expense' || tx.categoryId === 'cat_debt_repayment') return false;
      const txDate = parseTxDate(tx.date);
      return txDate.getFullYear() === lastYear && txDate.getMonth() === lastMonth;
    });
  }, [transactions, lastYear, lastMonth]);

  // 'auto' = same days, unless last month had nothing in those days but does have data overall.
  const [vsMode, setVsMode] = useState<'auto' | 'same' | 'full'>('auto');

  // MoM Ghost Benchmark Pace
  const momBenchmark = useMemo(() => {
    const now = new Date();
    const targetDay = isCurrentMonthView ? now.getDate() : daysInMonth;
    const lastMonthDays = new Date(lastYear, lastMonth + 1, 0).getDate();
    // Same day-range of both months (e.g. 1st–10th vs 1st–10th) is the fair pace test mid-month.
    const sameDaysEnd = isCurrentMonthView ? Math.min(lastMonthDays, targetDay) : lastMonthDays;

    const shareOf = (tx: { split?: { yourShare: number } | null; amount: number }) => (tx.split ? tx.split.yourShare : tx.amount);
    let lastSameDays = 0;
    let lastMonthTotal = 0;
    lastMonthExpenses.forEach((tx) => {
      if (tx.categoryId === 'cat_debt_repayment') return;
      const share = shareOf(tx);
      lastMonthTotal += share;
      if (parseTxDate(tx.date).getDate() <= sameDaysEnd) lastSameDays += share;
    });

    const autoFull = isCurrentMonthView && lastSameDays === 0 && lastMonthTotal > 0;
    const isFullLast = !isCurrentMonthView || (vsMode === 'full' ? true : vsMode === 'same' ? false : autoFull);
    const lastTargetDay = isFullLast ? lastMonthDays : sameDaysEnd;

    let thisMonthCumulative = 0;
    monthExpenses.forEach((tx) => {
      if (tx.categoryId === 'cat_debt_repayment') return; // not real spending, same as the app-wide Spent figure
      const d = parseTxDate(tx.date).getDate();
      if (d <= targetDay) {
        const share = tx.split ? tx.split.yourShare : tx.amount;
        thisMonthCumulative += share;
      }
    });

    const lastMonthCumulative = isFullLast ? lastMonthTotal : lastSameDays;

    const diff = thisMonthCumulative - lastMonthCumulative;
    const isEqual = Math.abs(diff) < 0.01;
    const pctDiff = lastMonthCumulative > 0 ? Math.round((Math.abs(diff) / lastMonthCumulative) * 100) : 0;
    const isLower = diff < -0.01;
    const isHigher = diff > 0.01;

    return {
      targetDay,
      lastTargetDay,
      thisMonthCumulative,
      lastMonthCumulative,
      lastMonthTotal,
      isFullLast,
      diff: Math.abs(diff),
      pctDiff,
      isLower,
      isHigher,
      isEqual,
      hasBaseline: lastMonthCumulative > 0,
    };
  }, [isCurrentMonthView, daysInMonth, monthExpenses, lastMonthExpenses, lastYear, lastMonth, vsMode]);

  const thisMonthShort = new Date(curYear, curMonth, 1).toLocaleDateString('en-US', { month: 'short' });
  const lastMonthShort = new Date(lastYear, lastMonth, 1).toLocaleDateString('en-US', { month: 'short' });
  const vsPeriodLabel = !isCurrentMonthView
    ? `${thisMonthShort} vs ${lastMonthShort} (full months)`
    : momBenchmark.isFullLast
    ? `${thisMonthShort} 1–${momBenchmark.targetDay} vs ${lastMonthShort} full month`
    : `${thisMonthShort} 1–${momBenchmark.targetDay} vs ${lastMonthShort} 1–${momBenchmark.lastTargetDay}`;

  // Dynamic VS Last Month comparison algorithm
  const vsCategories: VsCat[] = useMemo(() => {
    const thisMonthMap: Record<string, number> = {};
    const lastMonthMap: Record<string, number> = {};
    const lastMonthFullMap: Record<string, number> = {};

    monthExpenses.forEach(tx => {
      if (tx.categoryId === 'cat_debt_repayment') return;
      // Same day-range as the banner above, so the rows add up to it.
      if (parseTxDate(tx.date).getDate() > momBenchmark.targetDay) return;
      const share = tx.split ? tx.split.yourShare : tx.amount;
      thisMonthMap[tx.categoryId] = (thisMonthMap[tx.categoryId] || 0) + share;
    });

    lastMonthExpenses.forEach(tx => {
      if (tx.categoryId === 'cat_debt_repayment') return;
      const fullShare = tx.split ? tx.split.yourShare : tx.amount;
      lastMonthFullMap[tx.categoryId] = (lastMonthFullMap[tx.categoryId] || 0) + fullShare;
      // Same day-range as this month so far; otherwise early-month badges always show a big drop.
      if (parseTxDate(tx.date).getDate() > momBenchmark.lastTargetDay) return;
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
          if ((lastMonthFullMap[catId] || 0) === 0) {
            // Truly new: nothing in this category all of last month.
            changeBadge = 'NEW';
            isNew = true;
          } else {
            // Spent in this category last month, just not in the same days yet: "vs ₹0" already says it.
            changeBadge = '';
          }
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
  }, [monthExpenses, lastMonthExpenses, storeCategories, sym, momBenchmark.lastTargetDay, momBenchmark.targetDay]);

  // Calendar Grid Rows
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
      const [v1, v2] = nonZero;
      return { q1: v1, q2: (v1 + v2) / 2, q3: v2 };
    }
    const q1 = nonZero[Math.floor(nonZero.length * 0.25)] || 1;
    const q2 = nonZero[Math.floor(nonZero.length * 0.50)] || 2;
    const q3 = nonZero[Math.floor(nonZero.length * 0.75)] || 3;
    const safeQ1 = q1;
    const safeQ2 = Math.max(q2, safeQ1 + 1);
    const safeQ3 = Math.max(q3, safeQ2 + 1);
    return { q1: safeQ1, q2: safeQ2, q3: safeQ3 };
  }, [dailySpend]);

  const heatColor = (day: number) => {
    const a = dailySpend[day] || 0;
    if (a === 0) return '#1D1F2A';
    if (a <= heatmapThresholds.q1) return '#FCA5A5';
    if (a <= heatmapThresholds.q2) return '#EF4444';
    if (a <= heatmapThresholds.q3) return '#B91C1C';
    return '#7F1D1D';
  };

  const heatTextColor = (day: number) => {
    const a = dailySpend[day] || 0;
    if (a === 0) return '#8E919D';
    if (a <= heatmapThresholds.q1) return '#181920';
    return '#FFFFFF';
  };

  const heaviestDayInfo = useMemo(() => {
    let peakDay = 0;
    let peakAmt = 0;
    Object.entries(dailySpend).forEach(([dayStr, amt]) => {
      const d = Number(dayStr);
      if (amt > peakAmt) {
        peakAmt = amt;
        peakDay = d;
      }
    });

    if (peakDay === 0 || peakAmt === 0) {
      return { label: 'None', amount: 0, day: null };
    }

    const date = new Date(curYear, curMonth, peakDay);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const label = `${dayNames[date.getDay()]}, ${peakDay} ${monthNames[curMonth]}`;
    return { label, amount: peakAmt, day: peakDay };
  }, [dailySpend, curYear, curMonth]);

  const noSpendStreak = useMemo(() => {
    if (monthExpenses.length === 0) return 0;

    const now = new Date();
    const isCur = isCurrentMonthView;
    const todayNum = now.getDate();
    // Exclude unelapsed current day unless an expense was already recorded today
    const limitDay = isCur ? (dailySpend[todayNum] ? todayNum : Math.max(0, todayNum - 1)) : daysInMonth;

    if (limitDay <= 0) return 0;

    let prevTrailingStreak = 0;
    if (isCur) {
      const prevMonthLastDay = new Date(curYear, curMonth, 0).getDate();
      const prevSpendMap: Record<number, number> = {};
      lastMonthExpenses.forEach((tx) => {
        const d = parseTxDate(tx.date).getDate();
        prevSpendMap[d] = (prevSpendMap[d] || 0) + (tx.split ? tx.split.yourShare : tx.amount);
      });
      for (let pd = prevMonthLastDay; pd >= 1; pd--) {
        if (!prevSpendMap[pd]) {
          prevTrailingStreak++;
        } else {
          break;
        }
      }
    }

    // A trailing streak from the previous month only continues into this month if day 1 is also zero spend
    let cur = !dailySpend[1] ? prevTrailingStreak : 0;
    let best = 0;
    for (let d = 1; d <= limitDay; d++) {
      if (!dailySpend[d]) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
    }
    return best;
  }, [dailySpend, daysInMonth, isCurrentMonthView, curYear, curMonth, lastMonthExpenses, monthExpenses.length]);

  // Dynamic Weekly Rhythm
  const rhythmData = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = isCurrentMonthView;
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let daysList = [];
    let dateRangeLabel = '';

    if (isCurrentMonth) {
      const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dYear = d.getFullYear();
        const dMonth = d.getMonth();
        const dDate = d.getDate();
        const dayOfWeek = dayNames[d.getDay()];
        const isToday = dDate === now.getDate() && dMonth === now.getMonth() && dYear === now.getFullYear();

        const daySpend = transactions
          .filter((t) => {
            if (t.type !== 'expense' || t.categoryId === 'cat_debt_repayment') return false;
            const tDate = parseTxDate(t.date);
            return (
              tDate.getFullYear() === dYear &&
              tDate.getMonth() === dMonth &&
              tDate.getDate() === dDate
            );
          })
          .reduce((sum, t) => sum + (t.split ? t.split.yourShare : t.amount), 0);

        daysList.push({
          day: dayOfWeek,
          dateNum: dDate,
          dateLabel: `${dDate} ${monthNames[dMonth]}`,
          amt: Math.round(daySpend),
          isToday,
          showLabel: daySpend > 0,
          labelText: formatCompactCurrency(Math.round(daySpend), sym),
        });
      }

      const startLabel = `${startDate.getDate()} ${monthNames[startDate.getMonth()]}`;
      const endLabel = `${endDate.getDate()} ${monthNames[endDate.getMonth()]}`;
      dateRangeLabel = `${startLabel} – ${endLabel}`;
    } else {
      // Past month: compute Day-of-Week averages across the full month
      const dowSpend = [0, 0, 0, 0, 0, 0, 0];
      const dowCount = [0, 0, 0, 0, 0, 0, 0];

      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(curYear, curMonth, d).getDay();
        dowCount[dow]++;
      }

      monthExpenses.forEach((t) => {
        const tDate = parseTxDate(t.date);
        const dow = tDate.getDay();
        const share = t.split ? t.split.yourShare : t.amount;
        dowSpend[dow] += share;
      });

      for (let dow = 0; dow < 7; dow++) {
        const count = dowCount[dow] || 1;
        const avgDow = Math.round(dowSpend[dow] / count);
        daysList.push({
          day: dayNames[dow],
          dateNum: count,
          dateLabel: `${dayNames[dow]} avg (${count}d)`,
          amt: avgDow,
          isToday: false,
          showLabel: avgDow > 0,
          labelText: formatCompactCurrency(avgDow, sym),
        });
      }
      dateRangeLabel = `Full Month Average (${monthNames[curMonth]} ${curYear})`;
    }

    const totalWeekSpend = daysList.reduce((sum, d) => sum + d.amt, 0);
    const avgDailySpend = Math.round(totalWeekSpend / 7);

    return {
      days: daysList,
      totalWeekSpend,
      dateRangeLabel,
      avgDailySpend,
      isCurrentMonth,
    };
  }, [transactions, curYear, curMonth, daysInMonth, sym, isCurrentMonthView, monthExpenses]);

  const maxRhythmAmount = useMemo(() => {
    const maxVal = Math.max(...rhythmData.days.map((r) => r.amt), 100);
    return Math.max(Math.ceil(maxVal / 100) * 100, 100);
  }, [rhythmData.days]);

  const avgRhythmAmount = useMemo(() => {
    return rhythmData.avgDailySpend;
  }, [rhythmData.avgDailySpend]);

  const handleDayPress = (day: number) => {
    if (selectedDay === day) {
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
    outputRange: [0, 260],
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingTop: 6 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ═══ TITLE & HEADER MONTH NAVIGATOR ═══ */}
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
          {/* Main Title with generous spacing gap below */}
          <View style={st.titleRow}>
            <AppText style={st.titleThe}>THE </AppText>
            <AppText style={st.titleViz}>VISUALIZER</AppText>
          </View>

          {/* Clean Gap */}
          <View style={{ height: 12 }} />

          {/* ═══ HEADER MONTH SWITCHER (<  OCTOBER 2026  > (extreme ends)) ═══ */}
          <View style={st.monthNavigatorRow}>
            <TouchableOpacity
              style={st.monthArrowBtn}
              onPress={() => handleStepMonth(-1)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
            >
              <ChevronLeft size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={st.monthPill}>
              <Calendar size={13} color="#FF9D66" style={{ marginRight: 8 }} />
              <AppText style={st.monthPillText}>{selectedMonth}</AppText>
            </View>

            <TouchableOpacity
              style={[st.monthArrowBtn, !canNext && st.monthArrowBtnDisabled]}
              onPress={() => {
                if (canNext) handleStepMonth(1);
              }}
              disabled={!canNext}
              activeOpacity={canNext ? 0.7 : 1}
              hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
            >
              <ChevronRight size={16} color={canNext ? '#FFFFFF' : 'rgba(255, 255, 255, 0.28)'} />
            </TouchableOpacity>
          </View>

          {/* Clean Gap */}
          <View style={{ height: 6 }} />

          {/* ═══ MULTI-HORIZON TIME SWITCHER (APPLE LIQUID GLASS) ═══ */}
          <LiquidGlassSegmentedControl<TimeHorizon>
            values={['1W', '1M', '6M', '1Y', 'ALL']}
            selectedValue={timeHorizon}
            onValueChange={setTimeHorizon}
            style={{ marginHorizontal: PAGE_M, marginBottom: 16 }}
          />
        </Animated.View>

        {/* ═══ MULTI-MONTH TREND (6M / 1Y / ALL) ═══ */}
        {(timeHorizon === '6M' || timeHorizon === '1Y' || timeHorizon === 'ALL') && (
          <Animated.View
            style={[
              st.card,
              cardWidthStyle,
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
              {multiMonthTrend.avgMonthly > 0 && (
                <View
                  style={[
                    st.trendAvgLine,
                    {
                      bottom: 24 + Math.min(Math.round((multiMonthTrend.avgMonthly / multiMonthTrend.maxAmt) * 110), 110),
                    },
                  ]}
                  pointerEvents="none"
                />
              )}
              {multiMonthTrend.data.map((item, idx) => {
                const barH = Math.max(Math.round((item.amount / multiMonthTrend.maxAmt) * 110), 4);
                const barCount = multiMonthTrend.data.length;
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

        {/* ═══ CARD 1: CATEGORY FLOW (Sankey - Stable Constant Height) ═══ */}
        <Animated.View
          style={[
            st.card,
            cardWidthStyle,
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

          {cats.length === 0 ? (
            <View style={{ height: chartHeight, justifyContent: 'center', alignItems: 'center' }}>
              <AppText style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 4 }}>
                No Expenses Logged
              </AppText>
              <AppText style={{ color: expenseColors.textMuted, fontSize: 11, textAlign: 'center' }}>
                No expense transactions recorded for this time period.
              </AppText>
            </View>
          ) : (
            <View style={[st.flowBody, { height: chartHeight }]}>
              <View style={{ width: INCOME_W, height: chartHeight, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 6 }}>
                <AppText style={st.incomeLabel} numberOfLines={1}>Income</AppText>
              </View>

              <Svg width={SVG_W} height={chartHeight}>
                <Rect x={0} y={0} width={SRC_W} height={chartHeight} rx={4} fill={expenseColors.accentGreen} />
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

        {/* ═══ CARD 2: SWIPEABLE SPENDING CALENDAR HEATMAP ═══ */}
        <Animated.View
          style={[
            st.compactCard,
            cardWidthStyle,
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
          {/* Header with Title on Left & Legend on Right */}
          <View style={st.calHeaderRow}>
            <View style={st.calTitleCol}>
              <AppText style={st.calEyebrow}>SPENDING CALENDAR</AppText>
              <AppText style={st.calMonthTitle}>{selectedMonth}</AppText>
              <AppText style={st.calSwipeHint}>
                {canNext ? 'Swipe right for past · left for next' : 'Swipe right to see previous months'}
              </AppText>
            </View>

            <View style={st.legendRow}>
              <AppText style={st.legendTxt}>Less</AppText>
              {['#1D1F2A', '#FCA5A5', '#EF4444', '#B91C1C', '#7F1D1D'].map(c => (
                <View key={c} style={[st.legendBox, { backgroundColor: c }]} />
              ))}
              <AppText style={st.legendTxt}>More</AppText>
            </View>
          </View>

          {/* Continuous Native Paged Apple Liquid Calendar Carousel */}
          <Animated.View style={{ width: INNER_W, height: animCalHeight, overflow: 'hidden' }}>
            <ScrollView
              ref={calScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              directionalLockEnabled
              bounces={true}
              contentOffset={{ x: curMonthIndex * INNER_W, y: 0 }}
              onScrollBeginDrag={handleScrollBegin}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              style={{ width: INNER_W, height: '100%' }}
            >
              {monthList.map((mKey, idx) => {
                const isNear = Math.abs(idx - curMonthIndex) <= 2;
                if (!isNear) {
                  return <View key={mKey} style={{ width: INNER_W, height: targetCalHeight }} />;
                }
                return (
                  <MonthHeatmapGrid
                    key={mKey}
                    monthKey={mKey}
                    transactions={transactions}
                    subscriptions={subscriptions}
                    selectedDay={mKey === selectedMonth ? selectedDay : null}
                    onDayPress={handleDayPress}
                    TILE_W={TILE_W}
                    INNER_W={INNER_W}
                  />
                );
              })}
            </ScrollView>
          </Animated.View>

          {/* dynamic insight cards */}
          <View style={st.insightRow}>
            <TouchableOpacity
              style={st.insightCard}
              activeOpacity={heaviestDayInfo.day ? 0.7 : 1}
              onPress={() => {
                if (heaviestDayInfo.day) {
                  handleDayPress(heaviestDayInfo.day);
                }
              }}
            >
              <View style={st.insightHeadRow}>
                <Flame size={12} color="#FF9D66" />
                <AppText style={st.insightHead}>HEAVIEST DAY</AppText>
              </View>
              <AppText style={st.insightVal} numberOfLines={1} adjustsFontSizeToFit>
                {heaviestDayInfo.amount > 0 ? `${heaviestDayInfo.label} (${formatCompactCurrency(heaviestDayInfo.amount, sym)})` : 'None'}
              </AppText>
              <AppText style={st.insightSub}>Largest single spend date</AppText>
            </TouchableOpacity>
            <View style={st.insightCard}>
              <View style={st.insightHeadRow}>
                <Trophy size={12} color="#FBBF24" />
                <AppText style={st.insightHead}>NO-SPEND STREAK</AppText>
              </View>
              <AppText style={st.insightVal} numberOfLines={1} adjustsFontSizeToFit>
                {monthExpenses.length === 0 ? '—' : `${noSpendStreak} ${noSpendStreak === 1 ? 'day' : 'days'}`}
              </AppText>
              <AppText style={st.insightSub}>Consecutive {sym}0 spend days</AppText>
            </View>
          </View>

          {/* Selected Day Spending Breakdown Popup */}
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
                  Total Spent: {sym}{(dailySpend[displayedDay] || 0).toLocaleString('en-IN')}
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
                    No expense logged on this day ✨
                  </AppText>
                )}

                {upcomingSubscriptionsByDay[displayedDay] && upcomingSubscriptionsByDay[displayedDay].length > 0 && (
                  <View style={st.daySubSection}>
                    <View style={st.daySubHeaderRow}>
                      <Calendar size={11} color="#FF9D66" />
                      <AppText style={st.daySubHeader}>
                        {isCurrentMonthView && displayedDay >= new Date().getDate()
                          ? 'UPCOMING BILLS & SUBSCRIPTIONS'
                          : 'RECURRING SUBSCRIPTION BILLS'}
                      </AppText>
                    </View>
                    <View style={st.daySubList}>
                      {upcomingSubscriptionsByDay[displayedDay].map((subItem) => (
                        <View key={subItem.id} style={st.daySubItemRow}>
                          <View style={st.daySubLeft}>
                            <View style={[st.daySubColorDot, { backgroundColor: subItem.color }]} />
                            <AppText style={st.daySubName} numberOfLines={1}>
                              {subItem.name}
                            </AppText>
                          </View>
                          <AppText style={st.daySubAmt}>
                            {sym}{subItem.amount.toLocaleString('en-IN')}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>

        {/* ═══ CARD 3: WEEKLY RHYTHM ═══ */}
        <Animated.View
          style={[
            st.card,
            cardWidthStyle,
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
                {rhythmData.isCurrentMonth
                  ? `Current Week (${rhythmData.dateRangeLabel})`
                  : `Week of ${rhythmData.dateRangeLabel}`}
                {rhythmData.totalWeekSpend > 0 ? ` • Total: ${sym}${rhythmData.totalWeekSpend.toLocaleString('en-IN')}` : ''}
              </AppText>
            </View>
          </View>

          <View style={st.rhythmContainer}>
            <View style={st.yAxis}>
              {[maxRhythmAmount, Math.round(maxRhythmAmount * 0.66), Math.round(maxRhythmAmount * 0.33), 0].map(v => (
                <AppText key={v} style={st.yLbl}>{sym}{v}</AppText>
              ))}
            </View>

            <View
              style={st.rhythmChartArea}
              // box-only: touches always report locationX relative to this chart, never to a bar or label inside it
              pointerEvents="box-only"
              onLayout={(e) => {
                rhythmWidthRef.current = e.nativeEvent.layout.width;
              }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={(e) => {
                rhythmGrantIdxRef.current = rhythmIdxRef.current;
                rhythmMovedRef.current = false;
                selectRhythm(rhythmIndexAt(e.nativeEvent.locationX));
              }}
              onResponderMove={(e) => {
                const idx = rhythmIndexAt(e.nativeEvent.locationX);
                if (idx !== rhythmIdxRef.current) rhythmMovedRef.current = true;
                selectRhythm(idx);
              }}
              onResponderRelease={() => {
                // Selection stays after release; tapping the already-selected bar again clears it.
                if (!rhythmMovedRef.current && rhythmGrantIdxRef.current === rhythmIdxRef.current) {
                  selectRhythm(null);
                }
              }}
            >
              {/* Floating Glass Scrub Tooltip */}
              {scrubbedRhythmIndex !== null && rhythmData.days[scrubbedRhythmIndex] && (
                <Animated.View
                  style={[
                    st.rhythmTooltip,
                    {
                      opacity: rhythmScrubAnim,
                      transform: [
                        {
                          scale: rhythmScrubAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.85, 1],
                          }),
                        },
                      ],
                      left: `${Math.min((scrubbedRhythmIndex / 7) * 100 + 7, 62)}%`,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <AppText style={st.rhythmTooltipDay}>
                    {rhythmData.days[scrubbedRhythmIndex].day} · {rhythmData.days[scrubbedRhythmIndex].dateNum}
                  </AppText>
                  <AppText style={st.rhythmTooltipAmt}>
                    {sym}{rhythmData.days[scrubbedRhythmIndex].amt.toLocaleString('en-IN')}
                  </AppText>
                </Animated.View>
              )}

              <View
                style={[st.gridDashedLine, { bottom: 28 + Math.round(RHYTHM_BAR_H * 0.33) }]}
                pointerEvents="none"
              />
              <View
                style={[st.gridDashedLine, { bottom: 28 + Math.round(RHYTHM_BAR_H * 0.66) }]}
                pointerEvents="none"
              />

              {avgRhythmAmount > 0 && (
                <>
                  <View
                    style={[
                      st.avgLine,
                      {
                        bottom: 28 + Math.min(Math.round((avgRhythmAmount / maxRhythmAmount) * RHYTHM_BAR_H), RHYTHM_BAR_H),
                      },
                    ]}
                  />
                  <AppText
                    style={[
                      st.avgLbl,
                      {
                        bottom: 28 + Math.min(Math.round((avgRhythmAmount / maxRhythmAmount) * RHYTHM_BAR_H), RHYTHM_BAR_H) - 6,
                      },
                    ]}
                  >
                    avg
                  </AppText>
                </>
              )}

              <View style={st.barsRow}>
                {rhythmData.days.map((rd, dIdx) => {
                  const barH = Math.round((rd.amt / maxRhythmAmount) * RHYTHM_BAR_H);
                  const isHeaviest = rd.amt > 0 && rd.amt === Math.max(...rhythmData.days.map(r => r.amt));
                  const isScrubbed = scrubbedRhythmIndex === dIdx;
                  return (
                    <View key={`${rd.day}-${rd.dateNum}`} style={st.barCol}>
                      {rd.showLabel && scrubbedRhythmIndex === null ? (
                        <AppText
                          style={[
                            st.barAmt,
                            isHeaviest && st.barAmtHighlight,
                            rd.amt === 0 && st.barAmtZero,
                            { bottom: 30 + Math.max(barH + 4, 4) },
                          ]}
                          numberOfLines={1}
                        >
                          {rd.labelText}
                        </AppText>
                      ) : null}

                      {rd.amt > 0 ? (
                        <Animated.View
                          style={[
                            st.barFill,
                            isHeaviest && st.barFillHighlight,
                            rd.isToday && st.barFillToday,
                            isScrubbed && { backgroundColor: '#FFB885', shadowColor: '#FF9D66', shadowOpacity: 0.6, shadowRadius: 8 },
                            {
                              height: barGrowAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [4, Math.max(barH, 4)],
                              }),
                            },
                          ]}
                        />
                      ) : null}

                      <View style={st.barLabelStack}>
                        <AppText style={[st.barDay, (isHeaviest || isScrubbed) && st.barDayHighlight, rd.isToday && st.barDayToday]}>
                          {rd.day}
                        </AppText>
                        <AppText style={[st.barDateNum, (rd.isToday || isScrubbed) && st.barDateNumToday]}>
                          {rd.dateNum}
                        </AppText>
                      </View>
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
            cardWidthStyle,
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
                  : weekendVsWeekday.weekdaySum === 0 && weekendVsWeekday.weekendSum > 0
                  ? (weekendVsWeekday.isFixedDriver && weekendVsWeekday.topLeakCategory
                    ? `⚡ Weekend Spike: Driven by ${weekendVsWeekday.topLeakCategory.name}`
                    : '⚡ 100% Weekend concentration · High leisure burn')
                  : weekendVsWeekday.weekendSum === 0 && weekendVsWeekday.weekdaySum > 0
                  ? 'Weekday spending · Awaiting weekend baseline'
                  : weekendVsWeekday.isSurge
                  ? (weekendVsWeekday.isFixedDriver && weekendVsWeekday.topLeakCategory
                    ? `⚡ Weekend Spike: Driven by ${weekendVsWeekday.topLeakCategory.name}`
                    : `⚡ Weekend Surge: ${weekendVsWeekday.ratio}x higher daily burn`)
                  : weekendVsWeekday.avgWeekday > (weekendVsWeekday.avgWeekend * 1.25)
                  ? '🛡️ Steady weekday pace · Low weekend burn'
                  : '⚖️ Balanced weekday vs weekend rhythm'}
              </AppText>
            </View>
          </View>

          <View style={st.contrastTrack}>
            <Animated.View
              style={[
                st.contrastBarWeekday,
                {
                  width: barGrowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', `${weekendVsWeekday.weekdayPct}%`],
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
                    outputRange: ['0%', `${weekendVsWeekday.weekendPct}%`],
                  }) as any,
                },
              ]}
            />
          </View>

          <View style={st.contrastStatsRow}>
            <View style={st.contrastStatCol}>
              <View style={st.statDotRow}>
                <View style={[st.miniDot, { backgroundColor: '#C4A7E7' }]} />
                <AppText style={st.statLabel}>Weekdays (Mon-Fri)</AppText>
              </View>
              <AppText style={st.statAmount}>{sym}{Math.round(weekendVsWeekday.weekdaySum).toLocaleString('en-IN')}</AppText>
              <AppText style={st.statSub}>~{sym}{Math.round(weekendVsWeekday.avgWeekday).toLocaleString('en-IN')}/day</AppText>
            </View>

            <View style={st.contrastDivider} />

            <View style={st.contrastStatCol}>
              <View style={st.statDotRow}>
                <View style={[st.miniDot, { backgroundColor: expenseColors.accentPeach }]} />
                <AppText style={st.statLabel}>Weekends (Sat-Sun)</AppText>
              </View>
              <AppText style={st.statAmount}>{sym}{Math.round(weekendVsWeekday.weekendSum).toLocaleString('en-IN')}</AppText>
              <AppText style={st.statSub}>~{sym}{Math.round(weekendVsWeekday.avgWeekend).toLocaleString('en-IN')}/day</AppText>
            </View>
          </View>

          {weekendVsWeekday.isSurge && weekendVsWeekday.weekendTax > 0 && (
            <View style={st.leisureBanner}>
              <View style={st.leisureIconPill}>
                <Zap size={14} color="#FF9D66" />
              </View>
              <View style={st.leisureContent}>
                <View style={st.leisureTopRow}>
                  <AppText style={st.leisureSurgeLabel}>
                    {weekendVsWeekday.isFixedDriver ? 'WEEKEND SPIKE' : 'WEEKEND SURGE'}
                  </AppText>
                  <AppText style={st.leisureSurgeAmount}>
                    +{sym}{weekendVsWeekday.weekendTax.toLocaleString('en-IN')}
                  </AppText>
                </View>
                <AppText style={st.leisureSubtext} numberOfLines={2}>
                  {weekendVsWeekday.topLeakCategory
                    ? (weekendVsWeekday.isFixedDriver
                      ? `Driven by fixed commitment: ${weekendVsWeekday.topLeakCategory.emoji ? weekendVsWeekday.topLeakCategory.emoji + ' ' : ''}${weekendVsWeekday.topLeakCategory.name}`
                      : `Driven primarily by ${weekendVsWeekday.topLeakCategory.emoji ? weekendVsWeekday.topLeakCategory.emoji + ' ' : ''}${weekendVsWeekday.topLeakCategory.name}`)
                    : 'Higher daily spending rhythm on weekends'}
                </AppText>
              </View>
            </View>
          )}
        </Animated.View>

        {/* ═══ CARD 5: VS LAST MONTH & MoM GHOST BENCHMARK (1M Horizon) ═══ */}
        {timeHorizon === '1M' && (
          <Animated.View
            style={[
              st.card,
              cardWidthStyle,
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
              <View style={{ flex: 1 }}>
                <AppText style={st.cardLabel}>VS LAST MONTH</AppText>
                <AppText style={st.cardSub} numberOfLines={1}>{vsPeriodLabel}</AppText>
              </View>
              {isCurrentMonthView && (
                <View style={st.vsSeg}>
                  {([['same', 'Same days'], ['full', 'Full month']] as const).map(([mode, label]) => {
                    const active = (mode === 'full') === momBenchmark.isFullLast;
                    return (
                      <TouchableOpacity
                        key={mode}
                        activeOpacity={0.7}
                        style={[st.vsSegItem, active && st.vsSegItemActive]}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setVsMode(mode);
                        }}
                      >
                        <AppText style={[st.vsSegTxt, active && st.vsSegTxtActive]}>{label}</AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* No summary box: the header says what is compared and every row shows its own change.
                Only explain when there is nothing to compare. */}
            {!momBenchmark.hasBaseline && (
              <View style={{ paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#181920', borderRadius: 12, marginBottom: 16 }}>
                <AppText style={{ color: expenseColors.textMuted, fontSize: 12, lineHeight: 17 }}>
                  {momBenchmark.lastMonthTotal > 0
                    ? `Nothing was spent on ${lastMonthShort} 1–${momBenchmark.lastTargetDay}, so there is no pace to compare yet. Switch to Full month to compare with the whole month. ${lastMonthShort} total: ${sym}${Math.round(momBenchmark.lastMonthTotal).toLocaleString('en-IN')}.`
                    : `No spending recorded in ${lastMonthShort}, so there is nothing to compare with.`}
                </AppText>
              </View>
            )}

            {vsCategories.length === 0 ? (
              <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                <AppText style={{ color: expenseColors.textMuted, fontSize: 12 }}>
                  No category expenses recorded for comparison
                </AppText>
              </View>
            ) : (
              <View style={st.vsStack}>
                {vsCategories.filter(c => c.thisAmount > 0).map(cat => (
                  <View key={cat.id} style={st.vsItem}>
                    <View style={st.vsTopRow}>
                      <View style={st.vsLeft}>
                        <View style={[st.vsDot, { backgroundColor: cat.color }]} />
                        <AppText style={st.vsCat} numberOfLines={1}>{cat.name.charAt(0) + cat.name.slice(1).toLowerCase()}</AppText>
                        {cat.changeBadge !== '' && (
                          <AppText
                            style={[
                              st.vsDelta,
                              cat.isNew ? st.vsDeltaNew : cat.isIncrease ? st.vsDeltaUp : st.vsDeltaDown,
                            ]}
                          >
                            {cat.isNew ? 'New' : `${cat.isIncrease ? '↑' : '↓'} ${cat.changeBadge.replace(/^[+-]/, '')}`}
                          </AppText>
                        )}
                      </View>
                      <View style={st.vsRight}>
                        <AppText style={st.vsAmt}>{cat.formatted}</AppText>
                      </View>
                    </View>

                    {/* One track: fill = this month, white tick = last month */}
                    <View style={st.vsBarTrack}>
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
                      {cat.lastPercent > 0 && (
                        <View style={[st.vsTick, { left: `${Math.min(cat.lastPercent, 99)}%` }]} />
                      )}
                    </View>
                  </View>
                ))}

                {vsCategories.some(c => c.thisAmount === 0) && (
                  <AppText style={st.vsQuiet} numberOfLines={2}>
                    Nothing yet in {vsCategories
                      .filter(c => c.thisAmount === 0)
                      .map(c => `${c.name.charAt(0)}${c.name.slice(1).toLowerCase()}`)
                      .join(', ')}
                  </AppText>
                )}

                <AppText style={st.vsKey}>Bar: {thisMonthShort} · Tick: {lastMonthShort}</AppText>
              </View>
            )}
          </Animated.View>
        )}

        {/* ═══ CARD 6: SUBSCRIPTION AUDIT ═══ */}
        <Animated.View
          style={[
            st.card,
            cardWidthStyle,
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
                  : `${subscriptions.filter((x) => !x.isPaused).length} active subscription${subscriptions.filter((x) => !x.isPaused).length !== 1 ? 's' : ''} tracked${subscriptions.some((x) => x.isPaused) ? ` · ${subscriptions.filter((x) => x.isPaused).length} paused` : ''}`}
              </AppText>
            </View>
            <TouchableOpacity
              style={st.addBtn}
              activeOpacity={0.7}
              onPress={() => router.push('/add/search' as any)}
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

                const activePrice = getSubscriptionActivePrice(sub);
                const isSplitSub = sub.splitEnabled && activePrice < sub.price;

                return (
                  <TouchableOpacity
                    key={sub.id}
                    style={st.subRowItem}
                    activeOpacity={0.75}
                    onPress={() => router.push(`/subscription/${sub.id}` as any)}
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
                      <View style={{ alignItems: 'flex-end' }}>
                        <AppText style={st.subCostText}>
                          {sym}{activePrice.toLocaleString('en-IN')}
                        </AppText>
                        {isSplitSub && (
                          <AppText style={{ fontSize: 10, color: '#7E8394', fontWeight: '500' }}>
                            Your share
                          </AppText>
                        )}
                      </View>
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

  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingTop: 10 },
  titleThe: {
    color: '#FFF', fontSize: 24, lineHeight: 30, fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    letterSpacing: 0.5,
  },
  titleViz: { color: '#FFF', fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: 1.5 },

  // ── Month Navigator ──
  monthNavigatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: PAGE_M,
    marginBottom: 8,
  },
  monthArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E2129',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  monthArrowBtnDisabled: {
    backgroundColor: '#181A20',
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2129',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
  },
  monthPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

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
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 4,
    minHeight: 140,
  },
  trendAvgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.20)',
    borderStyle: 'dashed',
    zIndex: 1,
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
    height: 38,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.14)',
    borderStyle: 'dashed',
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
  leisureBanner: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 157, 102, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leisureIconPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 157, 102, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  leisureContent: {
    flex: 1,
    minWidth: 0,
  },
  leisureTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  leisureSurgeLabel: {
    color: '#FF9D66',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  leisureSurgeAmount: {
    color: '#FF9D66',
    fontSize: 13,
    fontWeight: '800',
  },
  leisureSubtext: {
    color: '#A0A5B5',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },

  card: {
    marginHorizontal: PAGE_M,
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: CARD_P,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  compactCard: {
    marginHorizontal: PAGE_M,
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: CARD_P,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
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
  calHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calTitleCol: {
    flex: 1,
    paddingRight: 10,
  },
  calEyebrow: {
    color: '#FF9D66',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  calMonthTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  calSwipeHint: {
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginTop: 4,
  },
  calSubsHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 157, 102, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.15)',
  },
  calSubsHintText: {
    color: '#FF9D66',
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendTxt: { color: expenseColors.textMuted, fontSize: 10, lineHeight: 14, marginLeft: 4 },
  legendBox: { width: 9, height: 9, borderRadius: 2, marginLeft: 3 },
  legendSq: { width: 9, height: 9, borderRadius: 2 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { color: expenseColors.textSubtle, fontSize: 10, lineHeight: 14, fontWeight: '500' },
  tile: { borderRadius: 8, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tileSel: { borderWidth: 2, borderColor: '#FFF' },
  tileNum: { color: '#FFF', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  tileSubMarker: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  calendarDashedDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderStyle: 'dashed',
    marginVertical: 6,
  },
  insightRow: { flexDirection: 'row', gap: 8, marginTop: CALENDAR_INSIGHT_GAP },
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
  insightSub: {
    color: '#8E919D',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
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
  daySubSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  daySubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  daySubHeader: {
    color: '#FF9D66',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  daySubList: {
    gap: 6,
  },
  daySubItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  daySubLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  daySubColorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  daySubName: {
    color: '#E0E3EB',
    fontSize: 11,
    fontWeight: '600',
  },
  daySubAmt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
  rhythmTooltip: {
    position: 'absolute',
    top: -24,
    transform: [{ translateX: -36 }],
    backgroundColor: '#1E2129',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.35)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 10,
  },
  rhythmTooltipDay: {
    color: '#FF9D66',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  rhythmTooltipAmt: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 1,
  },
  gridDashedLine: {
    position: 'absolute',
    left: 0,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    borderStyle: 'dashed',
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
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
    width: 32,
    height: RHYTHM_BAR_H + 30,
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
    width: 40,
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
    bottom: 28,
    width: 22,
    backgroundColor: '#FF9D66',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  barFillHighlight: {
    backgroundColor: '#FF8A4C',
  },
  barFillToday: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  barLabelStack: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  barDay: {
    color: expenseColors.textMuted,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  barDayHighlight: {
    color: '#FF9D66',
    fontWeight: '800',
  },
  barDayToday: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  barDateNum: {
    color: '#5E6272',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
  },
  barDateNumToday: {
    color: '#FF9D66',
    fontWeight: '800',
  },

  // ── MoM Ghost Benchmark ──
  momPaceSub: {
    color: '#8E919D',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginTop: 1,
  },

  // ── VS Last Month ──
  vsSeg: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  vsSegItem: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  vsSegItemActive: { backgroundColor: 'rgba(255, 157, 102, 0.2)' },
  vsSegTxt: { color: expenseColors.textMuted, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  vsSegTxtActive: { color: '#FF9D66' },
  vsDelta: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  vsDeltaUp: { color: expenseColors.textMuted },
  vsDeltaDown: { color: expenseColors.textMuted },
  vsDeltaNew: { color: expenseColors.textMuted },
  vsTick: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  vsQuiet: { color: expenseColors.textMuted, fontSize: 11, lineHeight: 16 },
  vsKey: { color: expenseColors.textMuted, fontSize: 10, lineHeight: 14, opacity: 0.7 },
  vsStack: {
    gap: 14,
    marginTop: 4,
  },
  vsItem: {
    gap: 7,
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
    flexShrink: 1,
  },
  vsDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  vsCat: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  vsRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
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
    fontWeight: '600',
  },
  // One compact track: this month (category colour) on top, last month (grey) as a thinner bar underneath.
  vsBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
  },
  vsLastTxt: {
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
  },
  vsFill: {
    height: 6,
    borderRadius: 3,
  },

  // ── Subscription Audit ──
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
