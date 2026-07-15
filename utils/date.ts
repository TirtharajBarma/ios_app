/**
 * Date utilities (date-fns backed)
 *
 * Thin, well-named wrappers over date-fns so call-sites read clearly and
 * timezones stay consistent (we always work in UTC midnight to avoid
 * off-by-one renewal-day bugs across devices).
 */
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  parseISO,
  startOfDay,
} from "date-fns";
import type { BillingCycle } from "@/types/subscription";

/** Parse an ISO-8601 date string into a Date (UTC midnight normalized). */
export function toDate(iso: string): Date {
  const parsed = parseISO(iso);
  return startOfDay(parsed);
}

/** Today at local midnight. */
export function today(): Date {
  return startOfDay(new Date());
}

/** Format an ISO date for display, e.g. "Jul 15, 2026". */
export function formatDate(iso: string, pattern = "MMM d, yyyy"): string {
  try {
    return format(toDate(iso), pattern);
  } catch {
    return iso;
  }
}

/** Days from today until the given date (negative if already passed). */
export function daysUntil(iso: string): number {
  return differenceInCalendarDays(toDate(iso), today());
}

/** Human label like "in 3 days" or "2 days ago" for a renewal date. */
export function relativeLabel(iso: string): string {
  return formatDistanceToNowStrict(toDate(iso), { addSuffix: true });
}

/** Advance a date by one billing cycle, returning an ISO-8601 string. */
export function advanceCycle(
  iso: string,
  cycle: BillingCycle,
  customMonths = 1
): string {
  const base = toDate(iso);
  let next: Date;
  switch (cycle) {
    case "weekly":
      next = addWeeks(base, 1);
      break;
    case "monthly":
      next = addMonths(base, 1);
      break;
    case "quarterly":
      next = addMonths(base, 3);
      break;
    case "yearly":
      next = addYears(base, 1);
      break;
    case "custom":
    default:
      next = addMonths(base, customMonths);
      break;
  }
  return next.toISOString();
}

/** Number of billing periods per year (used to normalize costs). */
export function periodsPerYear(cycle: BillingCycle, customMonths = 1): number {
  switch (cycle) {
    case "weekly":
      return 52;
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "yearly":
      return 1;
    case "custom":
    default:
      return 12 / customMonths;
  }
}

/** Convert a price-per-cycle into a monthly cost. */
export function toMonthly(
  price: number,
  cycle: BillingCycle,
  customMonths = 1
): number {
  const perYear = price * periodsPerYear(cycle, customMonths);
  return perYear / 12;
}

/** Convert a price-per-cycle into a yearly cost. */
export function toYearly(
  price: number,
  cycle: BillingCycle,
  customMonths = 1
): number {
  return price * periodsPerYear(cycle, customMonths);
}

/** ISO string for a reminder trigger: reminderDays before a renewal. */
export function reminderTriggerDate(iso: string, reminderDays: number): string {
  return addDays(toDate(iso), -reminderDays).toISOString();
}
