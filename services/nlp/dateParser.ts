/**
 * Universal Temporal Date Parser (100% Offline, Microsecond Execution)
 *
 * Parses any natural language date, interval, relative timeframe, quarter,
 * calendar format, day-of-week, or festival into a normalized [startDate, endDate]
 * window formatted in YYYY-MM-DD.
 */

export interface ParsedDateRange {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  monthIndex?: number; // 0-11
  year?: number;
  dayOfWeek?: number; // 0-6 (0=Sun, 6=Sat)
  isWeekendOnly?: boolean;
  isWeekdayOnly?: boolean;
  label: string;
  matchedText: string;
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

const MONTH_SHORTS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
];

export function getMonthIndex(w: string): number {
  const s = w.toLowerCase().trim();
  let idx = MONTH_NAMES.findIndex((m) => m === s || m.startsWith(s));
  if (idx === -1) idx = MONTH_SHORTS.findIndex((m) => m === s);
  return idx;
}

const DAY_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

const DAY_SHORTS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(isoStr: string): Date {
  const parts = isoStr.split('-').map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(isoStr);
}

function daysAgo(d: Date, n: number): Date {
  const res = new Date(d);
  res.setDate(res.getDate() - n);
  return res;
}

function daysAhead(d: Date, n: number): Date {
  const res = new Date(d);
  res.setDate(res.getDate() + n);
  return res;
}

function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

function endOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0);
}

/**
 * Universal date parser that extracts any temporal timeframe from a query.
 */
export function parseUniversalDateRange(
  rawQuery: string,
  referenceDate = new Date()
): ParsedDateRange | null {
  const q = rawQuery.toLowerCase().trim();
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refTodayIso = formatIsoDate(referenceDate);

  // 1. EXACT RELATIVE DAYS
  if (/\b(today|tonight)\b/.test(q)) {
    return {
      startDate: refTodayIso,
      endDate: refTodayIso,
      label: 'Today',
      matchedText: 'today',
    };
  }

  if (/\b(yesterday)\b/.test(q)) {
    const yDay = formatIsoDate(daysAgo(referenceDate, 1));
    return {
      startDate: yDay,
      endDate: yDay,
      label: 'Yesterday',
      matchedText: 'yesterday',
    };
  }

  if (/\b(day before yesterday)\b/.test(q)) {
    const dby = formatIsoDate(daysAgo(referenceDate, 2));
    return {
      startDate: dby,
      endDate: dby,
      label: 'Day before yesterday',
      matchedText: 'day before yesterday',
    };
  }

  // 2. "LAST / PAST N DAYS" (e.g. "last 3 days", "past 30 days", "last 90 days")
  const pastDaysMatch = q.match(/\b(?:last|past)\s+(\d{1,3})\s+days?\b/);
  if (pastDaysMatch) {
    const num = parseInt(pastDaysMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      const start = formatIsoDate(daysAgo(referenceDate, num));
      return {
        startDate: start,
        endDate: refTodayIso,
        label: `Past ${num} days`,
        matchedText: pastDaysMatch[0],
      };
    }
  }

  // "N DAYS AGO" (e.g. "3 days ago")
  const daysAgoMatch = q.match(/\b(\d{1,3})\s+days?\s+ago\b/);
  if (daysAgoMatch) {
    const num = parseInt(daysAgoMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      const target = formatIsoDate(daysAgo(referenceDate, num));
      return {
        startDate: target,
        endDate: target,
        label: `${num} days ago`,
        matchedText: daysAgoMatch[0],
      };
    }
  }

  // 3. WEEKS
  if (/\b(this week)\b/.test(q)) {
    // Start on Monday of current week
    const day = referenceDate.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const startOfWeek = formatIsoDate(daysAgo(referenceDate, diffToMonday));
    return {
      startDate: startOfWeek,
      endDate: refTodayIso,
      label: 'This week',
      matchedText: 'this week',
    };
  }

  if (/\b(last week|past week)\b/.test(q)) {
    const day = referenceDate.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const endOfLastWeek = daysAgo(referenceDate, diffToMonday + 1);
    const startOfLastWeek = daysAgo(endOfLastWeek, 6);
    return {
      startDate: formatIsoDate(startOfLastWeek),
      endDate: formatIsoDate(endOfLastWeek),
      label: 'Last week',
      matchedText: 'last week',
    };
  }

  const pastWeeksMatch = q.match(/\b(?:last|past)\s+(\d{1,2})\s+weeks?\b/);
  if (pastWeeksMatch) {
    const num = parseInt(pastWeeksMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      return {
        startDate: formatIsoDate(daysAgo(referenceDate, num * 7)),
        endDate: refTodayIso,
        label: `Past ${num} weeks`,
        matchedText: pastWeeksMatch[0],
      };
    }
  }

  // 4. WEEKENDS & WEEKDAYS
  if (/\b(last weekend)\b/.test(q)) {
    const day = referenceDate.getDay(); // 0 is Sun, 6 is Sat
    const daysSinceSunday = day === 0 ? 7 : day;
    const lastSunday = daysAgo(referenceDate, daysSinceSunday);
    const lastSaturday = daysAgo(lastSunday, 1);
    return {
      startDate: formatIsoDate(lastSaturday),
      endDate: formatIsoDate(lastSunday),
      isWeekendOnly: true,
      label: 'Last weekend',
      matchedText: 'last weekend',
    };
  }

  if (/\b(this weekend)\b/.test(q)) {
    const day = referenceDate.getDay();
    const daysToSat = 6 - day;
    const sat = daysAhead(referenceDate, daysToSat);
    const sun = daysAhead(sat, 1);
    return {
      startDate: formatIsoDate(sat),
      endDate: formatIsoDate(sun),
      isWeekendOnly: true,
      label: 'This weekend',
      matchedText: 'this weekend',
    };
  }

  if (/\b(weekends?)\b/.test(q)) {
    return {
      isWeekendOnly: true,
      label: 'On Weekends',
      matchedText: 'weekend',
    };
  }

  if (/\b(weekdays?)\b/.test(q)) {
    return {
      isWeekdayOnly: true,
      label: 'On Weekdays',
      matchedText: 'weekday',
    };
  }

  // 5. RELATIVE MONTHS (e.g. "this month", "last month", "past 3 months", "2 months ago")
  if (/\b(this month)\b/.test(q)) {
    const start = formatIsoDate(startOfMonth(refYear, refMonth));
    const end = formatIsoDate(endOfMonth(refYear, refMonth));
    return {
      startDate: start,
      endDate: end,
      monthIndex: refMonth,
      year: refYear,
      label: `${MONTH_NAMES[refMonth].toUpperCase()} ${refYear}`,
      matchedText: 'this month',
    };
  }

  if (/\b(last month|previous month|past month)\b/.test(q)) {
    const lYear = refMonth === 0 ? refYear - 1 : refYear;
    const lMonth = refMonth === 0 ? 11 : refMonth - 1;
    const start = formatIsoDate(startOfMonth(lYear, lMonth));
    const end = formatIsoDate(endOfMonth(lYear, lMonth));
    return {
      startDate: start,
      endDate: end,
      monthIndex: lMonth,
      year: lYear,
      label: `${MONTH_NAMES[lMonth].toUpperCase()} ${lYear}`,
      matchedText: 'last month',
    };
  }

  const pastMonthsMatch = q.match(/\b(?:last|past)\s+(\d{1,2})\s+months?\b/);
  if (pastMonthsMatch) {
    const num = parseInt(pastMonthsMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      const start = new Date(refYear, refMonth - num + 1, 1);
      return {
        startDate: formatIsoDate(start),
        endDate: refTodayIso,
        label: `Past ${num} months`,
        matchedText: pastMonthsMatch[0],
      };
    }
  }

  const monthsAgoMatch = q.match(/\b(\d{1,2})\s+months?\s+ago\b/);
  if (monthsAgoMatch) {
    const num = parseInt(monthsAgoMatch[1], 10);
    if (!isNaN(num) && num > 0) {
      const targetDate = new Date(refYear, refMonth - num, 1);
      const tYear = targetDate.getFullYear();
      const tMonth = targetDate.getMonth();
      return {
        startDate: formatIsoDate(startOfMonth(tYear, tMonth)),
        endDate: formatIsoDate(endOfMonth(tYear, tMonth)),
        monthIndex: tMonth,
        year: tYear,
        label: `${MONTH_NAMES[tMonth].toUpperCase()} ${tYear}`,
        matchedText: monthsAgoMatch[0],
      };
    }
  }

  // 6. QUARTERS (Q1, Q2, Q3, Q4)
  const quarterMatch = q.match(/\b(?:q([1-4])|quarter\s+([1-4]))(?:\s+(?:of\s+)?(202[0-9]))?\b/);
  if (quarterMatch) {
    const qNum = parseInt(quarterMatch[1] || quarterMatch[2], 10);
    const qYear = quarterMatch[3] ? parseInt(quarterMatch[3], 10) : refYear;
    const startMonth = (qNum - 1) * 3;
    const endMonth = startMonth + 2;
    return {
      startDate: formatIsoDate(startOfMonth(qYear, startMonth)),
      endDate: formatIsoDate(endOfMonth(qYear, endMonth)),
      year: qYear,
      label: `Q${qNum} ${qYear}`,
      matchedText: quarterMatch[0],
    };
  }

  // 6b. HALVES OF THE YEAR (H1, H2, First Half, Second Half)
  const halfMatch = q.match(/\b(?:h([12])|(first|second)\s+half)(?:\s+(?:of\s+)?(202[0-9]))?\b/);
  if (halfMatch) {
    const isFirst = halfMatch[1] === '1' || halfMatch[2] === 'first';
    const hYear = halfMatch[3] ? parseInt(halfMatch[3], 10) : refYear;
    return {
      startDate: isFirst ? `${hYear}-01-01` : `${hYear}-07-01`,
      endDate: isFirst ? `${hYear}-06-30` : `${hYear}-12-31`,
      year: hYear,
      label: isFirst ? `H1 (Jan–Jun) ${hYear}` : `H2 (Jul–Dec) ${hYear}`,
      matchedText: halfMatch[0],
    };
  }

  // 6c. SUB-MONTH PHASES (e.g. "early november", "mid october", "late december", "end of march")
  const subMonthMatch = q.match(/\b(early|mid|late|end of)\s+([a-zA-Z]+)(?:\s+(202[0-9]))?\b/);
  if (subMonthMatch) {
    const phase = subMonthMatch[1].trim();
    const mWord = subMonthMatch[2].toLowerCase();
    const mIdx = getMonthIndex(mWord);
    if (mIdx !== -1) {
      const year = subMonthMatch[3] ? parseInt(subMonthMatch[3], 10) : refYear;
      const lastDay = endOfMonth(year, mIdx).getDate();
      let startDay = 1;
      let endDay = 10;
      if (phase === 'mid') {
        startDay = 11;
        endDay = 20;
      } else if (phase === 'late' || phase === 'end of') {
        startDay = 21;
        endDay = lastDay;
      }
      const padM = String(mIdx + 1).padStart(2, '0');
      return {
        startDate: `${year}-${padM}-${String(startDay).padStart(2, '0')}`,
        endDate: `${year}-${padM}-${String(endDay).padStart(2, '0')}`,
        monthIndex: mIdx,
        year,
        label: `${phase.toUpperCase()} ${MONTH_NAMES[mIdx].toUpperCase()} ${year}`,
        matchedText: subMonthMatch[0],
      };
    }
  }

  // 6d. MULTI-MONTH SPANS (e.g. "october to december", "between march and may 2024", "from jan to apr")
  const multiMonthMatch = q.match(/\b(?:between|from)?\s*([a-zA-Z]+)\s+(?:to|and|-)\s+([a-zA-Z]+)(?:\s+(?:of\s+)?(202[0-9]))?\b/);
  if (multiMonthMatch) {
    const w1 = multiMonthMatch[1].toLowerCase();
    const w2 = multiMonthMatch[2].toLowerCase();
    const idx1 = getMonthIndex(w1);
    const idx2 = getMonthIndex(w2);
    if (idx1 !== -1 && idx2 !== -1) {
      const year = multiMonthMatch[3] ? parseInt(multiMonthMatch[3], 10) : refYear;
      const startM = Math.min(idx1, idx2);
      const endM = Math.max(idx1, idx2);
      return {
        startDate: formatIsoDate(startOfMonth(year, startM)),
        endDate: formatIsoDate(endOfMonth(year, endM)),
        year,
        label: `${MONTH_NAMES[startM].toUpperCase()} – ${MONTH_NAMES[endM].toUpperCase()} ${year}`,
        matchedText: multiMonthMatch[0],
      };
    }
  }

  // 7. RELATIVE YEARS
  if (/\b(this year)\b/.test(q)) {
    return {
      startDate: `${refYear}-01-01`,
      endDate: `${refYear}-12-31`,
      year: refYear,
      label: `${refYear}`,
      matchedText: 'this year',
    };
  }

  if (/\b(last year|previous year)\b/.test(q)) {
    const prevYear = refYear - 1;
    return {
      startDate: `${prevYear}-01-01`,
      endDate: `${prevYear}-12-31`,
      year: prevYear,
      label: `${prevYear}`,
      matchedText: 'last year',
    };
  }

  // 8. DAY OF WEEK (e.g. "on fridays", "last friday", "every sunday")
  for (let idx = 0; idx < DAY_NAMES.length; idx++) {
    const dayName = DAY_NAMES[idx];
    const regex = new RegExp(`\\b(?:on\\s+)?(?:(last|this)\\s+)?(${dayName}|${DAY_SHORTS[idx]})(?:s)?\\b`);
    const match = q.match(regex);
    if (match) {
      const modifier = match[1];
      if (modifier === 'last') {
        const curDay = referenceDate.getDay();
        const diff = (curDay - idx + 7) % 7 || 7;
        const targetDate = formatIsoDate(daysAgo(referenceDate, diff));
        return {
          startDate: targetDate,
          endDate: targetDate,
          dayOfWeek: idx,
          label: `Last ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}`,
          matchedText: match[0],
        };
      }
      return {
        dayOfWeek: idx,
        label: `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s`,
        matchedText: match[0],
      };
    }
  }

  // 9. FESTIVALS & SPECIAL WINDOWS
  if (/\b(diwali|deepavali)\b/.test(q)) {
    // Near late Oct / early Nov
    return {
      startDate: `${refYear}-10-25`,
      endDate: `${refYear}-11-08`,
      label: `Diwali Season ${refYear}`,
      matchedText: 'diwali',
    };
  }

  if (/\b(new year|new years|new year's eve)\b/.test(q)) {
    return {
      startDate: `${refYear}-12-30`,
      endDate: `${refYear + 1}-01-02`,
      label: `New Year ${refYear}`,
      matchedText: 'new year',
    };
  }

  if (/\b(christmas|xmas)\b/.test(q)) {
    return {
      startDate: `${refYear}-12-20`,
      endDate: `${refYear}-12-27`,
      label: `Christmas ${refYear}`,
      matchedText: 'christmas',
    };
  }

  if (/\b(holi)\b/.test(q)) {
    return {
      startDate: `${refYear}-03-15`,
      endDate: `${refYear}-03-28`,
      label: `Holi ${refYear}`,
      matchedText: 'holi',
    };
  }

  if (/\b(navratri|durga puja)\b/.test(q)) {
    return {
      startDate: `${refYear}-10-01`,
      endDate: `${refYear}-10-15`,
      label: `Navratri / Durga Puja ${refYear}`,
      matchedText: 'navratri',
    };
  }

  // 10. DATE RANGES: "between X and Y" / "from X to Y" / "X to Y"
  const rangeMatch = q.match(
    /\b(?:between|from)\s+([a-zA-Z0-9\s/-]+?)\s+(?:and|to)\s+([a-zA-Z0-9\s/-]+?)(?:\s+(202[0-9]))?(?:\s+(?:in|on|at|via|with|for)\b.*)?$/
  );
  if (rangeMatch) {
    const d1 = parseFlexibleSingleDate(rangeMatch[1], refYear);
    const d2 = parseFlexibleSingleDate(rangeMatch[2], rangeMatch[3] ? parseInt(rangeMatch[3], 10) : refYear);
    if (d1 && d2) {
      const start = d1 < d2 ? d1 : d2;
      const end = d1 < d2 ? d2 : d1;
      return {
        startDate: start,
        endDate: end,
        label: `${start} to ${end}`,
        matchedText: rangeMatch[0],
      };
    }
  }

  // 11. "SINCE / AFTER / BEFORE <DATE>"
  const sinceMatch = q.match(/\b(?:since|after)\s+([a-zA-Z0-9\s/-]+)\b/);
  if (sinceMatch) {
    const d = parseFlexibleSingleDate(sinceMatch[1], refYear);
    if (d) {
      return {
        startDate: d,
        endDate: refTodayIso,
        label: `Since ${d}`,
        matchedText: sinceMatch[0],
      };
    }
  }

  const beforeMatch = q.match(/\b(?:before|until|prior to)\s+([a-zA-Z0-9\s/-]+)\b/);
  if (beforeMatch) {
    const d = parseFlexibleSingleDate(beforeMatch[1], refYear);
    if (d) {
      return {
        startDate: '2020-01-01',
        endDate: d,
        label: `Before ${d}`,
        matchedText: beforeMatch[0],
      };
    }
  }

  // 12. EXPLICIT SINGLE DATE: "15th oct", "october 15", "15-10-2024", "2024-10-15"
  const singleDate = parseFlexibleSingleDate(q, refYear);
  if (singleDate) {
    return {
      startDate: singleDate,
      endDate: singleDate,
      label: singleDate,
      matchedText: singleDate,
    };
  }

  // 13. MONTH NAME + OPTIONAL YEAR (e.g. "september", "in march 2024", "nov 2023")
  for (let idx = 0; idx < MONTH_NAMES.length; idx++) {
    const mName = MONTH_NAMES[idx];
    const mShort = MONTH_SHORTS[idx];
    const regex = new RegExp(`\\b(${mName}|${mShort})(?:\\s+(202[0-9]))?\\b`);
    const match = q.match(regex);
    if (match) {
      const explicitYear = match[2] ? parseInt(match[2], 10) : undefined;
      const year = explicitYear ?? refYear;
      const start = formatIsoDate(startOfMonth(year, idx));
      const end = formatIsoDate(endOfMonth(year, idx));
      return {
        startDate: start,
        endDate: end,
        monthIndex: idx,
        year,
        label: `${mName.toUpperCase()} ${year}`,
        matchedText: match[0],
      };
    }
  }

  // 14. STANDALONE YEAR (e.g. "in 2024", "year 2023")
  const yearMatch = q.match(/\b(202[0-9])\b/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10);
    return {
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
      year: y,
      label: `${y}`,
      matchedText: yearMatch[0],
    };
  }

  return null;
}

/**
 * Parses flexible date notations:
 * - "15th oct", "15 oct", "oct 15", "15th october"
 * - "2024-10-15", "15/10/2024", "15-10-2024"
 */
function parseFlexibleSingleDate(str: string, defaultYear: number): string | null {
  const s = str.trim().toLowerCase();

  // ISO: 2024-10-15
  const isoMatch = s.match(/\b(202[0-9])-([0-1]?[0-9])-([0-3]?[0-9])\b/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/\b([0-3]?[0-9])[/-]([0-1]?[0-9])[/-](202[0-9])\b/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // "15th oct 2024" or "15 oct" or "15th october"
  const dayFirstMatch = s.match(/\b([0-3]?[0-9])(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(202[0-9]))?\b/);
  if (dayFirstMatch) {
    const day = parseInt(dayFirstMatch[1], 10);
    const monthWord = dayFirstMatch[2].toLowerCase();
    const year = dayFirstMatch[3] ? parseInt(dayFirstMatch[3], 10) : defaultYear;
    let mIdx = MONTH_NAMES.findIndex((m) => m === monthWord || m.startsWith(monthWord));
    if (mIdx === -1) {
      mIdx = MONTH_SHORTS.findIndex((m) => m === monthWord);
    }
    if (mIdx >= 0 && day >= 1 && day <= 31) {
      return `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // "oct 15th 2024" or "october 15"
  const monthFirstMatch = s.match(/\b([a-zA-Z]+)\s+([0-3]?[0-9])(?:st|nd|rd|th)?(?:\s+(202[0-9]))?\b/);
  if (monthFirstMatch) {
    const monthWord = monthFirstMatch[1].toLowerCase();
    const day = parseInt(monthFirstMatch[2], 10);
    const year = monthFirstMatch[3] ? parseInt(monthFirstMatch[3], 10) : defaultYear;
    let mIdx = MONTH_NAMES.findIndex((m) => m === monthWord || m.startsWith(monthWord));
    if (mIdx === -1) {
      mIdx = MONTH_SHORTS.findIndex((m) => m === monthWord);
    }
    if (mIdx >= 0 && day >= 1 && day <= 31) {
      return `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}
