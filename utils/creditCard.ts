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
}

export function getOrdinalDay(n: number): string {
  if (!n || n < 1 || n > 31) return `${n}`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Computes the live due status, remaining days, and urgency for a credit card.
 */
export function getCreditCardDueStatus(
  dueDay?: number,
  billingDay?: number,
  dueAmount: number = 0,
  refDate: Date = new Date()
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
    } else if (diffDaysThisMonth > 0) {
      // Due date is in future of current calendar month
      status = 'upcoming';
      badgeLabel = diffDaysThisMonth === 1 ? 'Due Tomorrow' : `Due in ${diffDaysThisMonth}d`;
      isUrgent = diffDaysThisMonth <= 3;
      daysDiff = diffDaysThisMonth;
    } else {
      // Current day is past this month's due day (e.g. today is 29th, dueDay is 5th or 25th)
      const daysPassed = Math.abs(diffDaysThisMonth);

      // If billingDay is specified and billingDay > dueDay (e.g. Bill 18th, Due 5th)
      // or if more than 15 days have passed since dueDay (implying this is the start of next cycle's bill),
      // the upcoming target due date is next month's dueDay.
      const isNextCycle = (billingDay && billingDay > dueDay && currentDay >= billingDay) || (daysPassed > 15);

      if (isNextCycle) {
        const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextMaxDays = getDaysInMonth(nextMonthYear, nextMonth);
        targetDueDate = new Date(nextMonthYear, nextMonth, Math.min(dueDay, nextMaxDays), 0, 0, 0, 0);
        daysDiff = Math.round((targetDueDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
        status = 'upcoming';
        badgeLabel = daysDiff === 1 ? 'Due Tomorrow' : `Due in ${daysDiff}d`;
        isUrgent = daysDiff <= 3;
      } else {
        // Overdue from this month's due date
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
  };
}
