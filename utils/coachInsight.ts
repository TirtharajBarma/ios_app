import { forecastMonthEnd, safeToSpendToday } from './coach';

export type CoachInsightType = 'bill' | 'over' | 'category' | 'forecast' | 'recap' | 'safe';

export interface CoachInsight {
  /** Ends with the day (yyyy-MM-dd) for daily insights or the month (yyyy-MM) for monthly ones, so a dismissal lasts that long. */
  id: string;
  type: CoachInsightType;
  title: string;
  sub: string;
}

export interface CoachInput {
  now: Date;
  budget: number; // effective monthly budget (0 = none)
  spentToDate: number; // this month, same definition as the Spent figure
  spentToday: number;
  /** Spend per day for the 14 days before today, oldest first (zeros included). */
  dailySpend: number[];
  upcomingFixed: number; // subscriptions still to renew this month
  /** Credit cards with a billed amount to pay, with days until it is due (0 = today). */
  bills: { name: string; billed: number; dueInDays: number }[];
  liquid: number; // money in non-credit accounts
  /** Categories that have their own monthly budget, with this month's spend. */
  categories: { id: string; name: string; spent: number; budget: number }[];
  /** Previous month, when it had spending: for the month-start recap. */
  lastMonth: { label: string; spent: number; topCategory?: string } | null;
  format: (n: number) => string;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The single most useful thing to tell the user right now, or null when there is nothing worth saying.
 * Priority: a bill they may not cover > over budget > a category over budget > on pace to overspend >
 * a category near its limit > month-end / month-start recap > today's safe amount.
 * Quiet by design: little data means no insight, and wording hedges ("may", "about") where it is a prediction.
 */
export function buildCoachInsight(i: CoachInput): CoachInsight | null {
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
      },
    });
  }

  // Overall budget
  if (i.budget > 0) {
    if (i.spentToDate > i.budget) {
      candidates.push({
        p: 2,
        insight: {
          id: `over:${today}`,
          type: 'over',
          title: `${i.format(i.spentToDate - i.budget)} over this month's budget`,
          sub: daysRemaining > 1 ? `${daysRemaining - 1} days left in the month. A low-spend day helps.` : 'The month ends today.',
        },
      });
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
      if (enoughHistory) {
        const f = forecastMonthEnd({
          spentToDate: i.spentToDate,
          dailyVariable: i.dailySpend,
          daysLeft: daysInMonth - day,
          upcomingFixed: i.upcomingFixed,
        });
        if (f && f.low > i.budget * 1.03) {
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
          },
        });
      }
      if (safe && day >= 3) {
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
    const over = hot.spent >= hot.budget;
    const pct = Math.round((hot.spent / hot.budget) * 100);
    const perDay = daysRemaining > 0 ? Math.max(0, (hot.budget - hot.spent) / daysRemaining) : 0;
    candidates.push({
      p: over ? 3 : 5,
      insight: {
        id: `category:${hot.id}:${over ? 100 : 80}:${month}`,
        type: 'category',
        title: over ? `${hot.name} is ${i.format(hot.spent - hot.budget)} over its budget` : `${hot.name} has used ${pct}% of its budget`,
        sub: over
          ? `${daysRemaining > 1 ? `${daysRemaining - 1} days` : 'No days'} left in the month.`
          : `${i.format(hot.budget - hot.spent)} left with ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} to go, about ${i.format(perDay)} a day.`,
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
  return candidates[0]?.insight ?? null;
}
