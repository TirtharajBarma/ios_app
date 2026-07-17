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
    case "bi-weekly":
      next = addWeeks(base, 2);
      break;
    case "monthly":
      next = addMonths(base, 1);
      break;
    case "quarterly":
      next = addMonths(base, 3);
      break;
    case "semi-yearly":
      next = addMonths(base, 6);
      break;
    case "yearly":
      next = addYears(base, 1);
      break;
    case "custom":
    default:
      next = addMonths(base, customMonths > 0 ? customMonths : 1);
      break;
  }
  return next.toISOString();
}

/** Advance a Date by one billing cycle. Supports raw custom cycles from forms. */
export function advanceCycleDate(
  date: Date,
  cycle: BillingCycle | string,
  customMonths = 1
): Date {
  const base = startOfDay(date);
  if (cycle === "weekly") return addWeeks(base, 1);
  if (cycle === "bi-weekly") return addWeeks(base, 2);
  if (cycle === "monthly") return addMonths(base, 1);
  if (cycle === "quarterly") return addMonths(base, 3);
  if (cycle === "semi-yearly") return addMonths(base, 6);
  if (cycle === "yearly") return addYears(base, 1);

  if (cycle.startsWith("custom:")) {
    const [, rawValue, rawUnit] = cycle.split(":");
    const value = Number(rawValue) || 1;
    const unit = rawUnit || "months";
    if (unit === "days") return addDays(base, value);
    if (unit === "weeks") return addWeeks(base, value);
    if (unit === "years") return addYears(base, value);
    return addMonths(base, value);
  }

  return addMonths(base, customMonths);
}

/**
 * Next renewal after the reference date, preserving the original billing day
 * and avoiding mid-month compression drift.
 */
export function getNextRenewalDate(
  startDate: Date,
  cycle: BillingCycle | string,
  customMonths = 1,
  referenceDate = today()
): Date {
  const reference = startOfDay(referenceDate);
  const start = startOfDay(startDate);
  
  if (start > reference) {
    return start;
  }

  let next = start;
  let periods = 0;
  const maxIterations = 5000; // Safe for daily cycles over ~13 years

  while (next <= reference && periods < maxIterations) {
    periods++;
    if (cycle === "weekly") {
      next = addWeeks(start, periods);
    } else if (cycle === "bi-weekly") {
      next = addWeeks(start, periods * 2);
    } else if (cycle === "monthly") {
      next = addMonths(start, periods);
    } else if (cycle === "quarterly") {
      next = addMonths(start, periods * 3);
    } else if (cycle === "semi-yearly") {
      next = addMonths(start, periods * 6);
    } else if (cycle === "yearly") {
      next = addYears(start, periods);
    } else if (typeof cycle === "string" && cycle.startsWith("custom:")) {
      const [, rawValue, rawUnit] = cycle.split(":");
      const value = Number(rawValue) || 1;
      const unit = rawUnit || "months";
      if (unit === "days") {
        next = addDays(start, periods * value);
      } else if (unit === "weeks") {
        next = addWeeks(start, periods * value);
      } else if (unit === "years") {
        next = addYears(start, periods * value);
      } else {
        next = addMonths(start, periods * value);
      }
    } else {
      const safeMonths = customMonths > 0 ? customMonths : 1;
      next = addMonths(start, periods * safeMonths);
    }
  }

  return next;
}

/** Number of billing periods per year (used to normalize costs). */
export function periodsPerYear(cycle: BillingCycle | string, customMonths = 1): number {
  if (typeof cycle === "string" && cycle.startsWith("custom:")) {
    const [, rawValue, rawUnit] = cycle.split(":");
    const value = Number(rawValue) || 1;
    const unit = rawUnit || "months";
    if (unit === "days") return 365 / value;
    if (unit === "weeks") return 52 / value;
    if (unit === "years") return 1 / value;
    return 12 / value;
  }

  switch (cycle) {
    case "weekly":
      return 52;
    case "bi-weekly":
      return 26;
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "semi-yearly":
      return 2;
    case "yearly":
      return 1;
    case "custom":
    default:
      return customMonths > 0 ? 12 / customMonths : 12;
  }
}

/** Convert a price-per-cycle into a monthly cost. */
export function toMonthly(
  price: number,
  cycle: BillingCycle | string,
  customMonths = 1
): number {
  const perYear = price * periodsPerYear(cycle, customMonths);
  return perYear / 12;
}

/** Convert a price-per-cycle into a yearly cost. */
export function toYearly(
  price: number,
  cycle: BillingCycle | string,
  customMonths = 1
): number {
  return price * periodsPerYear(cycle, customMonths);
}

/** ISO string for a reminder trigger: reminderDays before a renewal. */
export function reminderTriggerDate(iso: string, reminderDays: number): string {
  return addDays(toDate(iso), -reminderDays).toISOString();
}

/**
 * Format a billing cycle string into a human-readable label.
 * Handles standard cycles and custom cycle strings like "custom:3:months".
 */
export function formatBillingCycleLabel(
  rawCycle?: string,
  cycle?: string
): string {
  const value = rawCycle || cycle || "monthly";
  const lower = value.toLowerCase();
  if (lower === "monthly") return "Monthly";
  if (lower === "yearly") return "Yearly";
  if (lower === "weekly") return "Weekly";
  if (lower === "bi-weekly") return "Bi-weekly";
  if (lower === "quarterly") return "Quarterly";
  if (lower === "semi-yearly") return "Semi-yearly";
  if (lower.startsWith("custom:")) {
    const parts = lower.split(":");
    const num = parts[1] || "1";
    const unit = parts[2] || "months";
    const unitLabel = unit.charAt(0).toUpperCase() + unit.slice(1);
    return `Every ${num} ${unitLabel}`;
  }
  return value;
}

/** Calculate active price based on promo code and split details */
export function getSubscriptionActivePrice(sub: {
  price: number;
  isTrial?: boolean;
  promoEnabled?: boolean;
  promoPrice?: number;
  promoEndDate?: string;
  splitEnabled?: boolean;
  splitType?: "people" | "percentage" | "share";
  splitValue?: number;
}): number {
  if (sub.isTrial) return 0;

  let basePrice = sub.price;

  // 1. Promo / Introductory Pricing
  if (sub.promoEnabled && sub.promoPrice !== undefined && sub.promoEndDate) {
    try {
      const promoEnd = startOfDay(parseISO(sub.promoEndDate));
      const current = startOfDay(new Date());
      if (current <= promoEnd) {
        basePrice = sub.promoPrice;
      }
    } catch (e) {
      // Ignore parse errors, use regular price
    }
  }

  // 2. Splitting / Shared bill
  if (sub.splitEnabled && sub.splitType && sub.splitValue !== undefined) {
    if (sub.splitType === "people") {
      const count = Number(sub.splitValue) || 1;
      basePrice = basePrice / count;
    } else if (sub.splitType === "percentage") {
      const pct = Number(sub.splitValue) || 100;
      basePrice = basePrice * (pct / 100);
    } else if (sub.splitType === "share") {
      basePrice = Number(sub.splitValue) || basePrice;
    }
  }

  return basePrice;
}
