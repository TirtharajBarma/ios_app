/**
 * Pure calculations behind the discipline coach. No UI, no stores: every function takes plain numbers so it can be
 * tested and reused by notifications, toasts and cards alike. Each returns null when there is too little data to be honest.
 */

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Mean of the values after dropping the highest and lowest 10%, so one big day does not dominate. */
export function trimmedMean(xs: number[], trim = 0.1): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const cut = Math.floor(s.length * trim);
  const kept = s.slice(cut, s.length - cut);
  return kept.reduce((a, b) => a + b, 0) / (kept.length || 1);
}

/**
 * What can be spent today and still stay on budget for the rest of the month.
 * `spentBeforeToday` excludes today's spending; `daysRemaining` includes today.
 */
export function safeToSpendToday(input: {
  budget: number;
  spentBeforeToday: number;
  spentToday: number;
  upcomingFixed: number; // subscriptions + billed card amounts still to be paid this month
  daysRemaining: number;
}): { perDay: number; leftToday: number } | null {
  const { budget, spentBeforeToday, spentToday, upcomingFixed, daysRemaining } = input;
  if (!(budget > 0) || daysRemaining < 1) return null;
  const perDay = Math.max(0, (budget - spentBeforeToday - upcomingFixed) / daysRemaining);
  return { perDay: Math.round(perDay), leftToday: Math.max(0, Math.round(perDay - spentToday)) };
}

/**
 * Where the month is heading: spent so far + typical variable spend for the days left + fixed bills still to come.
 * `dailyVariable` is the variable spend of each recent day (zeros included). Needs at least 7 days of history.
 */
export function forecastMonthEnd(input: {
  spentToDate: number;
  dailyVariable: number[];
  daysLeft: number;
  upcomingFixed: number;
}): { forecast: number; low: number; high: number; dailyBurn: number } | null {
  const { spentToDate, dailyVariable, daysLeft, upcomingFixed } = input;
  const recent = dailyVariable.slice(-14);
  if (recent.length < 7 || daysLeft < 0) return null;
  const burn = trimmedMean(recent);
  const mad = median(recent.map((v) => Math.abs(v - median(recent))));
  const base = spentToDate + upcomingFixed;
  return {
    dailyBurn: Math.round(burn),
    forecast: Math.round(base + burn * daysLeft),
    low: Math.round(base + Math.max(0, burn - mad) * daysLeft),
    high: Math.round(base + (burn + mad) * daysLeft),
  };
}

/** Did this spend push a category across 80% or 100% of its budget? Returns the threshold crossed, if any. */
export function budgetThresholdCrossed(spentBefore: number, spentAfter: number, budget: number): 80 | 100 | null {
  if (!(budget > 0)) return null;
  const before = spentBefore / budget;
  const after = spentAfter / budget;
  if (before < 1 && after >= 1) return 100;
  if (before < 0.8 && after >= 0.8) return 80;
  return null;
}

/**
 * Is `value` unusually large compared with `history` (robust z-score, median and MAD)?
 * Needs 8+ past values; with no spread it falls back to 1.5x the median and a floor of 200.
 */
export function isUnusuallyLarge(history: number[], value: number): boolean {
  if (history.length < 8) return false;
  const med = median(history);
  const mad = median(history.map((v) => Math.abs(v - med)));
  if (mad === 0) return value > med * 1.5 && value - med >= 200;
  return (0.6745 * (value - med)) / mad > 3.5;
}
