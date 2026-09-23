import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { Flame, Trophy, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { FixedBottomNav } from './FixedBottomNav';
import { expenseColors } from '@/constants/expenseColors';
import { formatCompactCurrency } from './MoneyFlowCard';

const SW = Dimensions.get('window').width;

// ─────────────────────────────────────────────
// ALL SIZES ARE COMPUTED FROM SCREEN WIDTH
// ─────────────────────────────────────────────
const PAGE_M   = 14;           // page horizontal margin
const CARD_P   = 12;           // compact card inner padding
const CARD_W   = SW - PAGE_M * 2;
const INNER_W  = CARD_W - CARD_P * 2;

// ── Calendar ─────────────────────────────────
const CAL_GAP      = 5;
const CAL_ROW_GAP  = 4;
const TILE_W       = Math.floor((INNER_W - CAL_GAP * 6) / 7);
const TILE_H       = 32;       // compact tile height to reduce card height

// ── Sankey ───────────────────────────────────
const INCOME_W  = 58;
const RLABEL_W  = 110;
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
  formatted: string;
  percent: number;
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

  return { year, month, daysInMonth, startOffset };
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export const ExpenseVisualizer: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { selectedMonth, getTotalSpent, getCategoryBreakdown, transactions, categories: storeCategories } = useExpenseStore();
  const { subscriptions } = useSubscriptionStore();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [displayedDay, setDisplayedDay] = useState<number | null>(null);

  // Animated values for professional expand/collapse and smooth cross-fade
  const expandAnim = useRef(new Animated.Value(0)).current;
  const contentFadeAnim = useRef(new Animated.Value(1)).current;

  // dynamic breakdown & total spent
  const totalSpent = getTotalSpent();
  const breakdown = getCategoryBreakdown();

  // Dynamic active spending categories sorted descending by spend (highest up, lowest down)
  const activeBreakdown = useMemo(() => {
    return breakdown
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [breakdown]);

  const cats: FlowCat[] = useMemo(() => {
    return activeBreakdown.map((item) => ({
      id: item.category.id,
      name: item.category.name.toUpperCase(),
      label: item.category.name.length > 10 ? item.category.name.slice(0, 9).toUpperCase() + '...' : item.category.name.toUpperCase(),
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

  // dynamic vs last month / active categories share
  const vsCategories: VsCat[] = useMemo(() => {
    return activeBreakdown.map((item) => {
      const pct = totalSpent > 0 ? Math.min(Math.round((item.amount / totalSpent) * 100), 100) : 0;
      const formatted = item.amount >= 1000 ? `₹${(item.amount / 1000).toFixed(1)}K` : `₹${item.amount.toLocaleString('en-IN')}`;
      return {
        id: item.category.id,
        name: item.category.name.toUpperCase(),
        emoji: item.category.emoji,
        formatted,
        percent: pct,
        color: item.category.color,
      };
    });
  }, [activeBreakdown, totalSpent]);

  // dynamic calendar calculation for any month/year (Sunday to Saturday)
  const { year: curYear, month: curMonth, daysInMonth, startOffset } = getMonthYearInfo(selectedMonth);
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Month-filtered expense transactions only
  const monthExpenses = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.type !== 'expense') return false;
      const txDate = new Date(tx.date);
      return txDate.getFullYear() === curYear && txDate.getMonth() === curMonth;
    });
  }, [transactions, curYear, curMonth]);

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

        {/* TITLE */}
        <View style={st.titleRow}>
          <AppText style={st.titleThe}>THE </AppText>
          <AppText style={st.titleViz}>VISUALIZER</AppText>
        </View>

        {/* ═══ CARD 1: INCOME FLOW ═══ */}
        <View style={st.card}>

          <View style={st.rowBetween}>
            <View>
              <AppText style={st.cardLabel}>INCOME FLOW</AppText>
              <AppText style={st.cardSub}>{selectedMonth}</AppText>
            </View>
            <AppText style={st.flowAmt}>₹{totalSpent.toLocaleString('en-IN')}</AppText>
          </View>

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
                {streams.map(s => (
                  <Path key={s.cat.id} d={s.path} fill={s.cat.color} opacity={0.88} />
                ))}
                {/* dest bars */}
                {streams.map(s => (
                  <Rect
                    key={`d${s.cat.id}`}
                    x={dstLX} y={s.dY1}
                    width={DST_W} height={s.dY2 - s.dY1}
                    rx={3} fill={s.cat.color}
                  />
                ))}
              </Svg>

              {/* right label column */}
              <View style={{ width: RLABEL_W, height: chartHeight, position: 'relative' }}>
                {streams.map((s, i) => (
                  <View key={`l${s.cat.id}`} style={[st.labelSlot, { top: labelTops[i] }]}>
                    <AppText style={[st.catLabel, { color: s.cat.color }]} numberOfLines={1}>
                      {s.cat.label}
                    </AppText>
                    <AppText style={st.catAmt} numberOfLines={1}>
                      – {formatCompactCurrency(s.cat.amount)}
                    </AppText>
                  </View>
                ))}
              </View>

            </View>
          )}
        </View>

        {/* ═══ CARD 2: SPENDING CALENDAR (Compact Height + Full Year Support) ═══ */}
        <View style={st.compactCard}>

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
                  Total: ₹{(dailySpend[displayedDay] || 0).toLocaleString('en-IN')}
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
                          ₹{item.amount.toLocaleString('en-IN')}
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

        </View>

        {/* ═══ CARD 3: WEEKLY RHYTHM (Exact Reference Match) ═══ */}
        <View style={st.card}>
          <AppText style={st.cardLabel}>WEEKLY RHYTHM</AppText>
          <View style={st.rhythmContainer}>
            {/* Y Axis */}
            <View style={st.yAxis}>
              {[maxRhythmAmount, Math.round(maxRhythmAmount * 0.66), Math.round(maxRhythmAmount * 0.33), 0].map(v => (
                <AppText key={v} style={st.yLbl}>₹{v}</AppText>
              ))}
            </View>

            {/* Chart Area */}
            <View style={st.rhythmChartArea}>
              {/* Dashed Average Line */}
              <View style={[st.avgLine, { bottom: 24 + Math.round(0.4 * RHYTHM_BAR_H) }]} />
              <AppText style={[st.avgLbl, { bottom: 24 + Math.round(0.4 * RHYTHM_BAR_H) - 6 }]}>
                avg
              </AppText>

              {/* Bars Row */}
              <View style={st.barsRow}>
                {rhythmData.map(rd => {
                  const barH = Math.round((rd.amt / maxRhythmAmount) * RHYTHM_BAR_H);
                  return (
                    <View key={rd.day} style={st.barCol}>
                      {/* Top Label (e.g. ₹244 or ₹0) */}
                      {rd.showLabel ? (
                        <AppText
                          style={[
                            st.barAmt,
                            rd.amt === 0 && st.barAmtZero,
                            { bottom: 24 + Math.max(barH + 4, 4) },
                          ]}
                        >
                          {rd.labelText}
                        </AppText>
                      ) : null}

                      {/* Bar Fill */}
                      {rd.amt > 0 ? (
                        <View style={[st.barFill, { height: Math.max(barH, 4) }]} />
                      ) : null}

                      {/* Day Label below axis */}
                      <AppText style={st.barDay}>{rd.day}</AppText>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* ═══ CARD 4: VS LAST MONTH (Exact Reference Match) ═══ */}
        <View style={st.card}>
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
                No category expenses recorded this month
              </AppText>
            </View>
          ) : (
            <View style={st.vsStack}>
              {vsCategories.map(cat => (
                <View key={cat.id} style={st.vsItem}>
                  {/* Top Row: [Dot + Name + Emoji] .............. [NEW pill + Amount] */}
                  <View style={st.vsTopRow}>
                    <View style={st.vsLeft}>
                      <View style={[st.vsDot, { backgroundColor: cat.color }]} />
                      <AppText style={st.vsCat}>
                        {cat.name}
                        {cat.emoji ? ` ${cat.emoji}` : ''}
                      </AppText>
                    </View>
                    <View style={st.vsRight}>
                      <View style={st.newPill}>
                        <AppText style={st.newTxt}>NEW</AppText>
                      </View>
                      <AppText style={st.vsAmt}>{cat.formatted}</AppText>
                    </View>
                  </View>

                  {/* Progress Bar (no background track) */}
                  <View
                    style={[
                      st.vsFill,
                      {
                        backgroundColor: cat.color,
                        width: `${cat.percent}%` as any,
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ═══ CARD 5: SUBSCRIPTION AUDIT ═══ */}
        <View style={st.card}>
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
        </View>

      </ScrollView>

      <FixedBottomNav activeTab="visualizer" />
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

  card: {
    width: CARD_W,
    marginHorizontal: PAGE_M,
    backgroundColor: expenseColors.bgCard,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },

  compactCard: {
    width: CARD_W,
    marginHorizontal: PAGE_M,
    backgroundColor: expenseColors.bgCard,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rowBetweenCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardLabel: { color: '#FFF', fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 1.2 },
  cardSub: { color: expenseColors.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '600', letterSpacing: 0.6, marginTop: 2 },

  // ── Flow ──
  flowAmt: { color: '#FFF', fontSize: 22, lineHeight: 28, fontWeight: '800' },
  flowBody: { flexDirection: 'row', alignItems: 'flex-start' },
  incomeLabel: { color: '#FFF', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  labelSlot: { position: 'absolute', left: 8, right: 0, height: LABEL_H },
  catLabel: { fontSize: 10, lineHeight: 12, fontWeight: '700', letterSpacing: 0.2 },
  catAmt: { color: '#FFF', fontSize: 10, lineHeight: 12, fontWeight: '500' },

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
    backgroundColor: '#12131A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 10,
    marginTop: 8,
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
  barDay: {
    position: 'absolute',
    bottom: 0,
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },

  // ── VS Last Month ──
  vsStack: {
    gap: 14,
    marginTop: 4,
  },
  vsItem: {
    gap: 6,
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
    fontSize: 12,
    lineHeight: 16,
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
  vsAmt: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
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
