import { parseISO, isSameMonth } from "date-fns";
import type { Subscription } from "@/types/subscription";
import { toMonthly as dateToMonthly, getSubscriptionActivePrice } from "./date";

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
    if (sub.isTrial) return acc;
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
    if (sub.isTrial) return acc;
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
