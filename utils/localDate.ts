/** Parse a "YYYY-MM-DD[...]" transaction date as that LOCAL calendar day (noon). `new Date('YYYY-MM-DD')` is UTC and shifts a day west of UTC. */
export function parseTxDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  return new Date(dateStr);
}

/**
 * Days of (year, month) on which a subscription renews, for every billing cycle
 * (daily, weekly, bi-weekly, monthly, quarterly, semi-yearly, yearly, custom:N:unit, legacy custom months).
 * `ref` is any known renewal date (the schedule repeats both ways from it); renewals before `start` are skipped.
 * Month-based cycles clamp a day that does not exist in a short month (the 31st in April) to the last day,
 * matching date-fns addMonths as used by getNextRenewalDate.
 */
export function renewalDaysInMonth(
  cycle: string,
  ref: Date,
  year: number,
  month: number,
  customMonths = 1,
  start?: Date
): number[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayIdx = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m, d) / 86400000);
  const startIdx = start ? dayIdx(start.getFullYear(), start.getMonth(), start.getDate()) : -Infinity;
  const monthStartIdx = dayIdx(year, month, 1);

  let stepDays = 0;
  let stepMonths = 0;
  const c = String(cycle || 'monthly').toLowerCase();
  if (c === 'daily') stepDays = 1;
  else if (c === 'weekly') stepDays = 7;
  else if (c === 'bi-weekly') stepDays = 14;
  else if (c === 'monthly') stepMonths = 1;
  else if (c === 'quarterly') stepMonths = 3;
  else if (c === 'semi-yearly') stepMonths = 6;
  else if (c === 'yearly') stepMonths = 12;
  else if (c.startsWith('custom:')) {
    const [, rawValue, rawUnit] = c.split(':');
    const value = Math.max(1, Math.floor(Math.abs(Number(rawValue) || 1)));
    const unit = rawUnit || 'months';
    if (unit === 'days') stepDays = value;
    else if (unit === 'weeks') stepDays = 7 * value;
    else if (unit === 'years') stepMonths = 12 * value;
    else stepMonths = value;
  } else {
    stepMonths = Math.max(1, Math.round(customMonths) || 1);
  }

  if (stepDays) {
    const refIdx = dayIdx(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const first = monthStartIdx + ((((refIdx - monthStartIdx) % stepDays) + stepDays) % stepDays);
    const days: number[] = [];
    for (let i = first; i < monthStartIdx + daysInMonth; i += stepDays) {
      if (i >= startIdx) days.push(i - monthStartIdx + 1);
    }
    return days;
  }

  const diff = (year - ref.getFullYear()) * 12 + (month - ref.getMonth());
  if (diff % stepMonths !== 0) return [];
  const day = Math.min(ref.getDate(), daysInMonth);
  return dayIdx(year, month, day) >= startIdx ? [day] : [];
}
