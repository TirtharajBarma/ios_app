import { parseISO, isSameMonth } from "date-fns";
import type { Subscription } from "@/types/subscription";

/**
 * Calculates the monthly average across all subscriptions.
 * Yearly subscriptions are divided by 12.
 */
export function calculateMonthlyAverage(subscriptions: Subscription[]): number {
  return subscriptions.reduce((acc, sub) => {
    const cost = sub.isTrial ? 0 : sub.price;
    if (sub.billingCycle === "yearly") {
      return acc + cost / 12;
    }
    return acc + cost;
  }, 0);
}

/**
 * Calculates the total cost of subscriptions due in the current month.
 */
export function calculateDueThisMonth(
  subscriptions: Subscription[],
  referenceDate: Date = new Date()
): number {
  return subscriptions.reduce((acc, sub) => {
    const cost = sub.isTrial ? 0 : sub.price;
    const renewalDate = parseISO(sub.nextBillingDate);
    if (isSameMonth(renewalDate, referenceDate)) {
      return acc + cost;
    }
    return acc;
  }, 0);
}
