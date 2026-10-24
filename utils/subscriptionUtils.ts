import { parseISO, isSameMonth } from "date-fns";
import type { Category, Subscription } from "@/types/subscription";
import { toMonthly as dateToMonthly, getSubscriptionActivePrice, periodsPerYear } from "./date";

/** Normalize any billing cycle to a monthly cost. Delegates to date.ts for accuracy. */
export function toMonthly(price: number, cycle: string, customIntervalMonths?: number): number {
  return dateToMonthly(price, cycle as any, customIntervalMonths);
}

/**
 * Calculates the total monthly spend across all paid subscriptions.
 * Uses the active price (promo/split-adjusted) rather than the raw price.
 */
export function calculateMonthlySpend(subscriptions: Subscription[]): number {
  return subscriptions.reduce((acc, sub) => {
    if (sub.isTrial || sub.isPaused) return acc;
    const activePrice = getSubscriptionActivePrice(sub);
    return acc + toMonthly(activePrice, sub.billingCycle, sub.customIntervalMonths);
  }, 0);
}

/**
 * @deprecated Use calculateMonthlySpend instead. This function returns a sum, not an average.
 */
export const calculateMonthlyAverage = calculateMonthlySpend;

/**
 * Calculates the total cost of subscriptions due in the current month.
 * Uses the active price (promo/split-adjusted) rather than the raw price.
 */
export function calculateDueThisMonth(
  subscriptions: Subscription[],
  referenceDate: Date = new Date()
): number {
  return subscriptions.reduce((acc, sub) => {
    if (sub.isTrial || sub.isPaused) return acc;
    const cost = getSubscriptionActivePrice(sub);
    try {
      const renewalDate = parseISO(sub.nextBillingDate);
      if (isSameMonth(renewalDate, referenceDate)) {
        return acc + cost;
      }
    } catch {
      // Invalid date — skip
    }
    return acc;
  }, 0);
}

/**
 * Canonical key for matching a subscription by name: case, punctuation, TLDs (.com) and
 * common company suffixes (India, Inc, Ltd...) are ignored. Returns "" for blank input.
 */
export function normalizeSubName(name: string | undefined | null): string {
  return (name || "")
    .toLowerCase()
    .replace(/\.(com|in|net|org|io|co|app|tv)\b/g, " ")
    .replace(/\b(india|inc|ltd|llc|pvt|private|limited|corp|corporation)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

const SUBSCRIPTION_CATEGORIES: Category[] = [
  "entertainment", "productivity", "health", "music", "news", "cloud",
  "ai", "education", "gaming", "finance", "shopping", "other",
];

/** Map any display/custom category name onto the Category union ("other" when unknown). */
export function toSubscriptionCategory(name: string | undefined | null): Category {
  const key = (name || "").trim().toLowerCase();
  return (SUBSCRIPTION_CATEGORIES as string[]).includes(key) ? (key as Category) : "other";
}

/**
 * Monthly amount a split saves: what the provider charges (promo included) minus the user's share.
 * A promo discount is not a split saving, so it is excluded.
 */
export function splitMonthlySaving(sub: Subscription): number {
  const charged = getSubscriptionActivePrice({ ...sub, splitEnabled: false });
  const perCycle = charged - getSubscriptionActivePrice(sub);
  return (perCycle * periodsPerYear(sub.rawBillingCycle || sub.billingCycle || "monthly", sub.customIntervalMonths)) / 12;
}
