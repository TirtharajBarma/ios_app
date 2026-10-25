import { forecastMonthEnd, safeToSpendToday } from './coach';
import { getSubscriptionActivePrice, toLocalDateString } from './date';
import { convertCurrency } from './currency';

export type CoachInsightType = 'bill' | 'over' | 'buffer' | 'category' | 'forecast' | 'recap' | 'safe';

export interface CoachInsightAction {
  type: 'pay_bill' | 'open_goals' | 'filter_category';
  accountId?: string;
  categoryId?: string;
}

export interface CoachInsight {
  /** Ends with the day (yyyy-MM-dd) for daily insights or the month (yyyy-MM) for monthly ones, so a dismissal lasts that long. */
  id: string;
  type: CoachInsightType;
  title: string;
  sub: string;
  action?: CoachInsightAction;
}

export interface CoachInput {
  now: Date;
  budget: number; // effective monthly budget (0 = none)
  bufferLimit?: number; // dynamic monthly buffer from income surplus or liquid balance
  spentToDate: number; // this month, same definition as the Spent figure
  spentToday: number;
  /** Spend per day for the 14 days before today, oldest first (zeros included). */
  dailySpend: number[];
  upcomingFixed: number; // subscriptions still to renew this month
  /** Credit cards with a billed amount to pay, with days until it is due (0 = today). */
  bills: { id?: string; name: string; billed: number; dueInDays: number }[];
  liquid: number; // money in non-credit accounts
  /** Categories that have their own monthly budget, with this month's spend. */
  categories: { id: string; name: string; spent: number; budget: number }[];
  /** Previous month, when it had spending: for the month-start recap. */
  lastMonth: {
    label: string;
    spent: number;
    topCategory?: string;
    unspentBuffer?: number;
    isDeficit?: boolean;
    deficitAmount?: number;
  } | null;
  /** Optional breakdown of upcoming non-discretionary commitments (Rent, EMI, Utilities) */
  fixedCommitments?: {
    total: number;
    categories: number;
    breakdown: Array<{ name: string; amount: number }>;
  };
  format: (n: number) => string;
}

/**
 * Calculates upcoming subscriptions for the rest of the current month.
 * Fully accounts for active promos, trial states, and split billing rules
 * (personal share: people, percentage, or exact share amount).
 */
export function getUpcomingFixedSubscriptions(
  subscriptions: Array<{
    isPaused?: boolean;
    isTrial?: boolean;
    nextBillingDate?: string;
    price: number;
    currency?: string;
    splitEnabled?: boolean;
    splitType?: 'people' | 'percentage' | 'share';
    splitValue?: number;
    promoEnabled?: boolean;
    promoPrice?: number;
    promoEndDate?: string;
  }>,
  now: Date,
  currencyCode: string = 'INR'
): number {
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  let upcomingFixed = 0;
  for (const sub of subscriptions || []) {
    if (sub.isPaused || sub.isTrial || !sub.nextBillingDate) continue;
    const due = new Date(`${toLocalDateString(sub.nextBillingDate)}T12:00:00`);
    if (due > now && due <= monthEnd) {
      const price = getSubscriptionActivePrice(sub);
      upcomingFixed += sub.currency && sub.currency.toUpperCase() !== currencyCode.toUpperCase()
        ? convertCurrency(price, sub.currency, currencyCode)
        : price;
    }
  }
  return upcomingFixed;
}

/**
 * Detects fixed non-discretionary commitments (Rent, Utilities, Bills, Subscriptions, EMIs, Loans, Insurance, Fees, Maintenance).
 * These are lump sums that occur periodically, NOT daily repeatable lifestyle spending habits.
 */
export function isFixedCommitmentCategory(cat?: { id?: string; name?: string } | null): boolean {
  if (!cat) return false;
  const n = (cat.name || '').toLowerCase();
  const id = (cat.id || '').toLowerCase();
  return (
    id.includes('rent') ||
    id.includes('util') ||
    id.includes('bill') ||
    id.includes('subs') ||
    id.includes('emi') ||
    id.includes('loan') ||
    id.includes('insur') ||
    n.includes('rent') ||
    n.includes('electric') ||
    n.includes('power') ||
    n.includes('utility') ||
    n.includes('wifi') ||
    n.includes('broadband') ||
    n.includes('recharge') ||
    n.includes('subscription') ||
    n.includes('emi') ||
    n.includes('loan') ||
    n.includes('insurance') ||
    n.includes('mortgage') ||
    n.includes('fee') ||
    n.includes('tuition') ||
    n.includes('tax') ||
    n.includes('maintenance')
  );
}

export interface UpcomingFixedCommitmentsInput {
  subscriptions: Array<any>;
  categories: Array<{ id: string; name: string }>;
  categoryBudgets?: Record<string, number>;
  transactions: Array<{ date?: string; amount?: number; type?: string; categoryId?: string; isExcludedFromBudget?: boolean }>;
  accounts?: Array<{ type?: string; dueAmount?: number; unbilledDue?: number; isArchived?: boolean; billingDay?: number; dueDay?: number }>;
  now: Date;
  selectedMonth: string; // e.g. "2026-10"
  currencyCode?: string;
}

export interface UpcomingFixedCommitmentsResult {
  total: number;
  subscriptions: number;
  categories: number;
  cardDues: number;
  breakdown: Array<{ name: string; amount: number }>;
}

/**
 * Intelligent Fixed Commitment Engine:
 * Calculates upcoming non-discretionary commitments for the rest of the current month:
 * 1. Digital subscriptions renewing between now and month-end.
 * 2. Contractual fixed categories (Rent, EMI, Utilities, Tuition, WiFi) that have NOT been paid yet this month
 *    (using explicit category budget or previous month lookback pattern).
 * 3. Billed credit card statements due this month.
 */
export function getUpcomingFixedCommitments(input: UpcomingFixedCommitmentsInput): UpcomingFixedCommitmentsResult {
  const now = input.now;
  const currencyCode = input.currencyCode || 'INR';
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // 1. Digital Subscriptions (renewing in remainder of month)
  const subTotal = getUpcomingFixedSubscriptions(input.subscriptions || [], now, currencyCode);

  // 2. Fixed Categories (Rent, EMI, Utilities, etc.)
  let catTotal = 0;
  const breakdown: Array<{ name: string; amount: number }> = [];

  // Determine previous month key (e.g. "2026-09" from "2026-10")
  const [curYear, curMonthNum] = input.selectedMonth.split('-').map(Number);
  const prevDate = new Date(curYear, (curMonthNum || 1) - 2, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  // Pre-calculate spending by category for current month and previous month
  const spentThisMonthByCat: Record<string, number> = {};
  const spentPrevMonthByCat: Record<string, number> = {};

  for (const t of input.transactions || []) {
    if (t.type !== 'expense' || t.isExcludedFromBudget || !t.categoryId) continue;
    const tMonth = (t.date || '').slice(0, 7);
    const amt = Number(t.amount) || 0;
    if (tMonth === input.selectedMonth) {
      spentThisMonthByCat[t.categoryId] = (spentThisMonthByCat[t.categoryId] || 0) + amt;
    } else if (tMonth === prevMonthKey) {
      spentPrevMonthByCat[t.categoryId] = (spentPrevMonthByCat[t.categoryId] || 0) + amt;
    }
  }

  // Iterate over all fixed commitment categories
  for (const cat of input.categories || []) {
    if (!isFixedCommitmentCategory(cat)) continue;
    // Don't double count if the category represents digital subscriptions that are tracked in the subscription store
    const catNameLower = (cat.name || '').toLowerCase();
    if (cat.id === 'cat_subs' || (catNameLower === 'subscription' && subTotal > 0)) {
      continue;
    }

    const alreadySpent = spentThisMonthByCat[cat.id] || 0;
    const explicitBudget = input.categoryBudgets?.[cat.id] || 0;
    const prevMonthSpent = spentPrevMonthByCat[cat.id] || 0;

    // Expected commitment: explicit category budget takes precedence, otherwise look at past month lookback
    const expected = explicitBudget > 0 ? explicitBudget : prevMonthSpent;

    if (expected > 0) {
      const pending = Math.max(0, expected - alreadySpent);
      if (pending > 0) {
        catTotal += pending;
        breakdown.push({ name: cat.name, amount: pending });
      }
    }
  }

  // 3. Unpaid billed credit card dues payable this month
  let cardDuesTotal = 0;
  for (const acc of input.accounts || []) {
    if (acc.type !== 'credit' || acc.isArchived) continue;
    const billed = Math.max(0, (acc.dueAmount || 0) - (acc.unbilledDue || 0));
    if (billed > 0 && acc.dueDay) {
      // Check if due day falls between today and month end
      const dueDay = Math.min(acc.dueDay, monthEnd.getDate());
      const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay, 23, 59, 59);
      if (dueDate >= now && dueDate <= monthEnd) {
        cardDuesTotal += billed;
        breakdown.push({ name: 'Card Due', amount: billed });
      }
    }
  }

  return {
    total: subTotal + catTotal + cardDuesTotal,
    subscriptions: subTotal,
    categories: catTotal,
    cardDues: cardDuesTotal,
    breakdown,
  };
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * All useful insights for the user right now, sorted by urgency.
 * Priority: a bill they may not cover > over budget > a category over budget > on pace to overspend >
 * a category near its limit > month-end / month-start recap > today's safe amount.
 */
export function getAllCoachInsights(i: CoachInput): CoachInsight[] {
  const today = dayKey(i.now);
  const month = today.slice(0, 7);
  const day = i.now.getDate();
  const daysInMonth = new Date(i.now.getFullYear(), i.now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - day + 1; // includes today
  const candidates: { p: number; insight: CoachInsight }[] = [];

  // A bill due within 3 days that the accounts may not cover
  const soon = i.bills.filter((b) => b.billed > 0 && b.dueInDays >= 0 && b.dueInDays <= 3).sort((a, b) => a.dueInDays - b.dueInDays)[0];
  if (soon && i.liquid < soon.billed) {
    const when = soon.dueInDays === 0 ? 'today' : soon.dueInDays === 1 ? 'tomorrow' : `in ${soon.dueInDays} days`;
    candidates.push({
      p: 1,
      insight: {
        id: `bill:${soon.name}:${today}`,
        type: 'bill',
        title: `${soon.name} bill of ${i.format(soon.billed)} is due ${when}`,
        sub: `Your accounts hold ${i.format(Math.max(0, i.liquid))}, so you may fall short by about ${i.format(soon.billed - i.liquid)}.`,
        action: soon.id ? { type: 'pay_bill', accountId: soon.id } : undefined,
      },
    });
  }

  // Overall budget
  if (i.budget > 0) {
    if (i.spentToDate > i.budget) {
      const over = i.spentToDate - i.budget;
      const buffer = i.bufferLimit || 0;
      if (buffer > 0 && over <= buffer) {
        const bufferRemaining = Math.max(0, buffer - over);
        const bufferUsedPct = (over / buffer) * 100;
        const dailyBufferPace = daysRemaining > 0 ? Math.max(0, Math.round(Math.max(0, bufferRemaining - i.upcomingFixed) / daysRemaining)) : 0;

        let title = `${i.format(over)} over budget — covered by your buffer`;
        let sub = `${i.format(bufferRemaining)} buffer remaining. Your savings goals are safe.`;

        if (bufferUsedPct < 35) {
          title = `⚠️ Budget breached by ${i.format(over)}`;
          sub = dailyBufferPace > 0
            ? `Dipping into salary buffer. Keep spend under ${i.format(dailyBufferPace)}/day to protect your savings.`
            : `Dipping into salary buffer. Slow down to keep your locked savings safe.`;
        } else if (bufferUsedPct < 75) {
          title = `🚨 ${i.format(over)} of ${i.format(buffer)} buffer burned`;
          sub = `Only ${i.format(bufferRemaining)} buffer left before your locked savings take a direct hit.`;
        } else {
          title = `🛑 Safety buffer nearly exhausted`;
          sub = `Only ${i.format(bufferRemaining)} remaining. Any further spend eats directly into your locked savings!`;
        }

        candidates.push({
          p: 2,
          insight: {
            id: `buffer:${today}`,
            type: 'buffer',
            title,
            sub,
          },
        });
      } else {
        const deficit = buffer > 0 ? over - buffer : over;
        candidates.push({
          p: 2,
          insight: {
            id: `over:${today}`,
            type: 'over',
            title: buffer > 0 ? `${i.format(deficit)} over buffer limit` : `${i.format(over)} over this month's budget`,
            sub: buffer > 0
              ? 'Spending is now eating into your locked savings goals.'
              : daysRemaining > 1
              ? `${daysRemaining - 1} day${daysRemaining === 2 ? '' : 's'} left in the month. A low-spend day helps.`
              : 'The month ends today.',
          },
        });
      }
    } else {
      // Predictions need enough real history: 14 days with spending on at least 5 of them, and not the very start of the month
      const enoughHistory = i.dailySpend.length >= 14 && i.dailySpend.filter((v) => v > 0).length >= 5 && day >= 8;
      const safe = safeToSpendToday({
        budget: i.budget,
        spentBeforeToday: i.spentToDate - i.spentToday,
        spentToday: i.spentToday,
        upcomingFixed: i.upcomingFixed,
        daysRemaining,
      });
      let isOverPaceWarning = false;
      if (enoughHistory) {
        const f = forecastMonthEnd({
          spentToDate: i.spentToDate,
          dailyVariable: i.dailySpend,
          daysLeft: daysInMonth - day,
          upcomingFixed: i.upcomingFixed,
        });
        if (f && f.low > i.budget * 1.03) {
          isOverPaceWarning = true;
          candidates.push({
            p: 4,
            insight: {
              id: `forecast:${today}`,
              type: 'forecast',
              title: `On pace to overspend by about ${i.format(f.forecast - i.budget)}`,
              sub: safe && safe.perDay > 0 ? `About ${i.format(safe.perDay)} a day keeps you inside.` : 'Cutting back for a few days would bring it back.',
            },
          });
        }
      }
      // Month end: budget left over
      if (daysRemaining <= 3 && i.budget - i.spentToDate >= i.budget * 0.05) {
        candidates.push({
          p: 6,
          insight: {
            id: `recap-end:${month}`,
            type: 'recap',
            title: `${i.format(i.budget - i.spentToDate)} of this month's budget is unspent`,
            sub: 'Moving it into a goal makes it saved before it gets spent.',
            action: { type: 'open_goals' },
          },
        });
      }
      // Only show safe allowance card when NOT already displaying the over-pace forecast warning,
      // avoiding duplicate and contradictory advice in the deck.
      if (safe && day >= 3 && !isOverPaceWarning) {
        candidates.push({
          p: 8,
          insight: {
            id: `safe:${today}`,
            type: 'safe',
            title: safe.leftToday > 0 ? `${i.format(safe.leftToday)} safe to spend today` : "Today's allowance is used",
            sub: safe.leftToday > 0 ? 'That keeps you on budget for the rest of the month.' : 'Anything more comes out of tomorrow.',
          },
        });
      }
    }
  }

  // A category with its own budget: over (shown above the pace forecast) or at 80%+ (below it)
  const hot = i.categories
    .filter((c) => c.budget > 0 && c.spent >= c.budget * 0.8)
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget)[0];
  if (hot) {
    const over = hot.spent > hot.budget; // exactly 100% is used up, not over
    const pct = Math.round((hot.spent / hot.budget) * 100);
    const perDay = daysRemaining > 0 ? Math.max(0, (hot.budget - hot.spent) / daysRemaining) : 0;
    candidates.push({
      p: over ? 3 : 5,
      insight: {
        id: `category:${hot.id}:${over ? 100 : 80}:${month}`,
        type: 'category',
        title: over ? `${hot.name} is ${i.format(hot.spent - hot.budget)} over its budget` : `${hot.name} has used ${pct}% of its budget`,
        sub: over
          ? `${daysRemaining > 1 ? `${daysRemaining - 1} day${daysRemaining === 2 ? '' : 's'}` : 'No days'} left in the month.`
          : `${i.format(hot.budget - hot.spent)} left with ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} to go, about ${i.format(perDay)} a day.`,
        action: { type: 'filter_category', categoryId: hot.id },
      },
    });
  }

  // Month start: how last month went (Days 1–4 of the new month)
  if (day <= 4 && i.lastMonth && (i.lastMonth.spent > 0 || (i.lastMonth.unspentBuffer && i.lastMonth.unspentBuffer > 0))) {
    if (i.lastMonth.isDeficit && i.lastMonth.deficitAmount && i.lastMonth.deficitAmount > 0) {
      candidates.push({
        p: 2,
        insight: {
          id: `recap-deficit:${month}`,
          type: 'over',
          title: `${i.lastMonth.label} ended ${i.format(i.lastMonth.deficitAmount)} in deficit`,
          sub: `Spend carefully in ${i.now.toLocaleDateString('en-US', { month: 'long' })} to replenish your locked savings.`,
          action: { type: 'open_goals' },
        },
      });
    } else if (i.lastMonth.unspentBuffer && i.lastMonth.unspentBuffer > 0) {
      candidates.push({
        p: 6,
        insight: {
          id: `recap-buffer-sweep:${month}`,
          type: 'recap',
          title: `${i.lastMonth.label} Wrap-Up: ${i.format(i.lastMonth.unspentBuffer)} buffer protected 🎉`,
          sub: 'Tap to sweep your unspent buffer into your savings goals.',
          action: { type: 'open_goals' },
        },
      });
    } else {
      candidates.push({
        p: 7,
        insight: {
          id: `recap-start:${month}`,
          type: 'recap',
          title: `${i.lastMonth.label}: ${i.format(i.lastMonth.spent)} spent`,
          sub: i.lastMonth.topCategory ? `${i.lastMonth.topCategory} was the biggest category. A fresh month starts now.` : 'A fresh month starts now.',
        },
      });
    }
  }

  // Fixed obligations reminder (Rent, EMI, etc.) in the first half of the month
  if (i.fixedCommitments && i.fixedCommitments.categories > 0 && day <= 15) {
    const fixedList = i.fixedCommitments.breakdown.map((b) => b.name).slice(0, 2).join(' & ');
    candidates.push({
      p: 5,
      insight: {
        id: `fixed-commitments:${month}`,
        type: 'forecast',
        title: `${i.format(i.fixedCommitments.categories)} reserved for ${fixedList}`,
        sub: 'Locked aside from your daily allowance so your major bills stay fully protected.',
      },
    });
  }

  candidates.sort((a, b) => a.p - b.p);
  return candidates.map((c) => c.insight);
}

/**
 * The single most useful thing to tell the user right now, or null when there is nothing worth saying.
 */
export function buildCoachInsight(i: CoachInput): CoachInsight | null {
  const all = getAllCoachInsights(i);
  return all[0] ?? null;
}

export const COACH_DISMISSED_STORAGE_KEY = '@coach_dismissed_v1';

export async function resetDismissedCoachInsights(): Promise<void> {
  const AsyncStorage = (await import('@/utils/storage')).default;
  await AsyncStorage.removeItem(COACH_DISMISSED_STORAGE_KEY);
}
