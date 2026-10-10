/**
 * Credit Card utilities: Due date calculations, billing cycle tracking, and quick settlement helpers.
 */

export interface CreditCardDueStatus {
  hasDueInfo: boolean;
  status: 'due_today' | 'overdue' | 'upcoming' | 'paid';
  badgeLabel: string;
  dueDateFormatted?: string;
  daysDiff?: number;
  isUrgent: boolean;
  billingCycleLabel?: string;
  isUnbilled?: boolean;
}

export function getOrdinalDay(n: number): string {
  if (!n || n < 1 || n > 31) return `${n}`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Latest statement closing date (yyyy-MM-dd) on or before refDate. Spend dated AFTER it is unbilled.
 */
export function getLastClosingDateStr(billingDay: number, refDate: Date = new Date()): string {
  const clampTo = (y: number, m: number) => Math.min(billingDay, new Date(y, m + 1, 0).getDate());
  let y = refDate.getFullYear();
  let m = refDate.getMonth();
  if (refDate.getDate() < clampTo(y, m)) {
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(clampTo(y, m)).padStart(2, '0')}`;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const clampDay = (y: number, m: number, d: number) => Math.min(d, new Date(y, m + 1, 0).getDate());

/** Due date of the statement closing on `closing`: first dueDay after it. */
function dueDateFor(closing: Date, dueDay: number, billingDay: number): Date {
  const at = (offset: number) => {
    const m = closing.getMonth() + offset;
    const ny = closing.getFullYear() + Math.floor(m / 12);
    const nm = m % 12;
    return new Date(ny, nm, clampDay(ny, nm, dueDay));
  };
  const same = at(dueDay > billingDay ? 0 : 1);
  // Short months can clamp the due day onto/before the closing day (e.g. bill 28th, due 30th in Feb).
  return same.getTime() > closing.getTime() ? same : at(1);
}

function getCycleAwareStatus(
  dueDay: number,
  billingDay: number,
  dueAmount: number,
  unbilledAmount: number,
  refDate: Date
): CreditCardDueStatus {
  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const [cy, cm, cd] = getLastClosingDateStr(billingDay, refDate).split('-').map(Number);
  const lastClose = new Date(cy, cm - 1, cd);
  const nextClose = new Date(cy, cm, clampDay(cy, cm, billingDay));
  const billed = dueAmount - unbilledAmount;
  const DAY = 1000 * 60 * 60 * 24;
  const billingCycleLabel = `Bill: ${getOrdinalDay(billingDay)} • Due: ${getOrdinalDay(dueDay)}`;
  const fmt = (d: Date) => `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;

  if (billed > 0) {
    const due = dueDateFor(lastClose, dueDay, billingDay);
    const diff = Math.round((due.getTime() - today.getTime()) / DAY);
    const status = diff === 0 ? 'due_today' : diff < 0 ? 'overdue' : 'upcoming';
    const badgeLabel =
      diff === 0 ? 'Due Today'
      : diff < 0 ? `Overdue ${-diff}d`
      : diff === 1 ? 'Due Tomorrow'
      : `Due in ${diff}d`;
    return { hasDueInfo: true, status, badgeLabel, dueDateFormatted: fmt(due), daysDiff: diff, isUrgent: diff <= 3, billingCycleLabel, isUnbilled: false };
  }

  const due = dueDateFor(nextClose, dueDay, billingDay);
  return {
    hasDueInfo: true,
    status: 'upcoming',
    badgeLabel: `Bill: ${getOrdinalDay(billingDay)}`,
    dueDateFormatted: fmt(due),
    daysDiff: Math.round((due.getTime() - today.getTime()) / DAY),
    isUrgent: false,
    billingCycleLabel,
    isUnbilled: true,
  };
}

/**
 * Due date (local midnight) of the bill payable now: the last closed statement when the card has a bill day,
 * otherwise this month's due day (or next month's once it has passed). Short months clamp the day.
 */
export function getBilledDueDate(dueDay: number, billingDay?: number, refDate: Date = new Date()): Date {
  if (billingDay && billingDay >= 1 && billingDay <= 31) {
    const [y, m, d] = getLastClosingDateStr(billingDay, refDate).split('-').map(Number);
    return dueDateFor(new Date(y, m - 1, d), dueDay, billingDay);
  }
  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), clampDay(today.getFullYear(), today.getMonth(), dueDay));
  if (thisMonth.getTime() >= today.getTime()) return thisMonth;
  const ny = today.getFullYear() + (today.getMonth() === 11 ? 1 : 0);
  const nm = (today.getMonth() + 1) % 12;
  return new Date(ny, nm, clampDay(ny, nm, dueDay));
}

/**
 * Computes the live due status, remaining days, and urgency for a credit card.
 */
export function getCreditCardDueStatus(
  dueDay?: number,
  billingDay?: number,
  dueAmount: number = 0,
  refDate: Date = new Date(),
  unbilledAmount?: number
): CreditCardDueStatus {
  if (!dueDay || dueDay < 1 || dueDay > 31) {
    let billingLabel: string | undefined;
    if (billingDay && billingDay >= 1 && billingDay <= 31) {
      billingLabel = `Bill date: ${getOrdinalDay(billingDay)}`;
    }
    return {
      hasDueInfo: false,
      status: dueAmount > 0 ? 'upcoming' : 'paid',
      badgeLabel: dueAmount > 0 ? 'Bill Due' : 'No Due',
      isUrgent: false,
      billingCycleLabel: billingLabel,
    };
  }

  // Cycle-aware path: the store knows how much of the due is billed vs. still unbilled.
  if (unbilledAmount !== undefined && billingDay && billingDay >= 1 && billingDay <= 31 && dueAmount > 0) {
    return getCycleAwareStatus(dueDay, billingDay, dueAmount, unbilledAmount, refDate);
  }

  const currentYear = refDate.getFullYear();
  const currentMonth = refDate.getMonth();
  const currentDay = refDate.getDate();

  // Helper for days in month
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  // Construct this month's due date
  const thisMonthMaxDays = getDaysInMonth(currentYear, currentMonth);
  const thisMonthDueDayClamped = Math.min(dueDay, thisMonthMaxDays);
  const thisMonthDueDate = new Date(currentYear, currentMonth, thisMonthDueDayClamped, 0, 0, 0, 0);

  const todayMidnight = new Date(currentYear, currentMonth, currentDay, 0, 0, 0, 0);
  const diffDaysThisMonth = Math.round((thisMonthDueDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

  let status: 'due_today' | 'overdue' | 'upcoming' | 'paid' = 'upcoming';
  let badgeLabel = '';
  let targetDueDate = thisMonthDueDate;
  let daysDiff = diffDaysThisMonth;
  let isUrgent = false;
  let isUnbilled = false;

  if (dueAmount <= 0) {
    // Card is settled
    status = 'paid';
    // Next due date is upcoming cycle
    if (diffDaysThisMonth <= 0) {
      const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextMaxDays = getDaysInMonth(nextMonthYear, nextMonth);
      targetDueDate = new Date(nextMonthYear, nextMonth, Math.min(dueDay, nextMaxDays), 0, 0, 0, 0);
      daysDiff = Math.round((targetDueDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
    }
    badgeLabel = 'Settled';
    isUrgent = false;
  } else {
    // Card has positive due balance
    if (diffDaysThisMonth === 0) {
      status = 'due_today';
      badgeLabel = 'Due Today';
      isUrgent = true;
      daysDiff = 0;
      isUnbilled = false;
    } else if (diffDaysThisMonth > 0) {
      // Due date is in future of current calendar month (e.g. today is 2nd, due is 25th)
      // Check if billingDay is in the same month before dueDay and hasn't occurred yet (e.g. Bill 5th, Due 25th, today 2nd)
      if (billingDay && billingDay < dueDay && currentDay < billingDay) {
        status = 'upcoming';
        isUnbilled = true;
        badgeLabel = `Bill: ${getOrdinalDay(billingDay)}`;
        isUrgent = false;
        daysDiff = diffDaysThisMonth;
      } else {
        status = 'upcoming';
        badgeLabel = diffDaysThisMonth === 1 ? 'Due Tomorrow' : `Due in ${diffDaysThisMonth}d`;
        isUrgent = diffDaysThisMonth <= 3;
        daysDiff = diffDaysThisMonth;
        isUnbilled = false;
      }
    } else {
      // Current day is past this month's due day (e.g. today is 9th, dueDay was 4th)
      const daysPassed = Math.abs(diffDaysThisMonth);
      const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextMaxDays = getDaysInMonth(nextMonthYear, nextMonth);
      const nextMonthDueDate = new Date(nextMonthYear, nextMonth, Math.min(dueDay, nextMaxDays), 0, 0, 0, 0);
      const daysUntilNextDue = Math.round((nextMonthDueDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

      if (billingDay && billingDay > dueDay) {
        // e.g. Bill 17th, Due 4th
        targetDueDate = nextMonthDueDate;
        daysDiff = daysUntilNextDue;
        status = 'upcoming';

        if (currentDay < billingDay) {
          // Between due day and billing day (e.g. Oct 5 - Oct 16):
          // Fresh spend is UNBILLED. It will be billed on the 17th and payable on next month's 4th.
          isUnbilled = true;
          badgeLabel = `Bill: ${getOrdinalDay(billingDay)}`;
          isUrgent = false;
        } else {
          // Bill has generated on the 17th, payable on next month's 4th
          isUnbilled = false;
          badgeLabel = daysDiff === 1 ? 'Due Tomorrow' : `Due in ${daysDiff}d`;
          isUrgent = daysDiff <= 3;
        }
      } else if (billingDay && billingDay <= dueDay) {
        // e.g. Bill 5th, Due 25th, today is 28th
        // Past this month's due day; next statement is on 5th of next month, due on 25th of next month
        targetDueDate = nextMonthDueDate;
        daysDiff = daysUntilNextDue;
        status = 'upcoming';
        isUnbilled = true;
        badgeLabel = `Bill: ${getOrdinalDay(billingDay)}`;
        isUrgent = false;
      } else if (daysPassed > 15) {
        // No billingDay configured, but more than 15 days passed: assume next cycle
        targetDueDate = nextMonthDueDate;
        daysDiff = daysUntilNextDue;
        status = 'upcoming';
        badgeLabel = daysDiff === 1 ? 'Due Tomorrow' : `Due in ${daysDiff}d`;
        isUrgent = daysDiff <= 3;
      } else {
        // No billingDay configured and < 15 days: mark as overdue
        status = 'overdue';
        badgeLabel = daysPassed === 1 ? 'Overdue 1d' : `Overdue ${daysPassed}d`;
        isUrgent = true;
        daysDiff = -daysPassed;
      }
    }
  }

  const dueDateFormatted = `${MONTH_SHORT[targetDueDate.getMonth()]} ${targetDueDate.getDate()}`;

  let billingCycleLabel: string | undefined;
  if (billingDay && billingDay >= 1 && billingDay <= 31) {
    billingCycleLabel = `Bill: ${getOrdinalDay(billingDay)} • Due: ${getOrdinalDay(dueDay)}`;
  } else {
    billingCycleLabel = `Due: ${getOrdinalDay(dueDay)} every month`;
  }

  return {
    hasDueInfo: true,
    status,
    badgeLabel,
    dueDateFormatted,
    daysDiff,
    isUrgent,
    billingCycleLabel,
    isUnbilled,
  };
}
