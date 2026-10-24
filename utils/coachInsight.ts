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
  bufferLimit?: number; // dynamic monthly cushion from income surplus or liquid balance
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
  lastMonth: { label: string; spent: number; topCategory?: string } | null;
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
        candidates.push({
          p: 2,
          insight: {
            id: `buffer:${today}`,
            type: 'buffer',
            title: `${i.format(over)} absorbed by salary buffer`,
            sub: `${i.format(bufferRemaining)} buffer remaining. Your savings goals are safe.`,
          },
        });
      } else {
        const deficit = buffer > 0 ? over - buffer : over;
        candidates.push({
          p: 2,
          insight: {
            id: `over:${today}`,
            type: 'over',
            title: buffer > 0 ? `${i.format(deficit)} beyond buffer capacity` : `${i.format(over)} over this month's budget`,
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

  // Month start: how last month went
  if (day <= 2 && i.lastMonth && i.lastMonth.spent > 0) {
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
