import { parseISO, startOfDay, differenceInCalendarDays } from "date-fns";
import type { Subscription } from "@/types/subscription";
import { getSubscriptionActivePrice } from "@/utils/date";
import * as db from "@/database/database";

export interface SavingsItem {
  subscriptionId: string;
  name: string;
  status: "paused" | "trial" | "active";
  monthlyPrice: number;
  monthsSkipped: number;
  totalSaved: number;
  logoUrl?: string;
  color?: string;
  website?: string;
  currency?: string;
}

export interface TrialWarning {
  subscriptionId: string;
  name: string;
  trialEndDate: string;
  logoUrl?: string;
  color?: string;
  website?: string;
}

export interface BillSplitSaving {
  subscriptionId: string;
  name: string;
  fullPrice: number;
  userShare: number;
  monthlySaving: number;
  splitType: "people" | "percentage" | "share";
  splitValue: number;
  logoUrl?: string;
  color?: string;
  website?: string;
}

export interface SavingsResult {
  totalSavings: number;
  savingsBreakdown: SavingsItem[];
  vaultMode: "saved" | "advisor";
  advisorType: "trials" | "splits" | "suggestions" | null;
  trialWarnings: TrialWarning[];
  splitSavings: BillSplitSaving[];
  advisorMessage: string;
}

function computeExpectedCycles(
  startDate: string | undefined,
  createdAt: string,
  billingCycle: string,
  customIntervalMonths?: number,
): number {
  const start = startOfDay(startDate ? parseISO(startDate) : parseISO(createdAt));
  const today = startOfDay(new Date());
  const diffDays = differenceInCalendarDays(today, start);
  if (diffDays <= 0) return 0;

  const cycleLower = billingCycle.toLowerCase();
  let periodsPerCycle: number;

  if (cycleLower === "weekly") {
    periodsPerCycle = diffDays / 7;
  } else if (cycleLower === "bi-weekly") {
    periodsPerCycle = diffDays / 14;
  } else if (cycleLower === "monthly") {
    periodsPerCycle = diffDays / 30.44;
  } else if (cycleLower === "quarterly") {
    periodsPerCycle = diffDays / 91.31;
  } else if (cycleLower === "semi-yearly") {
    periodsPerCycle = diffDays / 182.62;
  } else if (cycleLower === "yearly") {
    periodsPerCycle = diffDays / 365.25;
  } else if (cycleLower.startsWith("custom:")) {
    const parts = cycleLower.split(":");
    const val = Number(parts[1]) || 1;
    const unit = parts[2] || "months";
    if (unit === "days") {
      periodsPerCycle = diffDays / val;
    } else if (unit === "weeks") {
      periodsPerCycle = diffDays / (val * 7);
    } else if (unit === "years") {
      periodsPerCycle = diffDays / (val * 365.25);
    } else {
      periodsPerCycle = diffDays / (val * 30.44);
    }
  } else {
    const safeMonths = customIntervalMonths || 1;
    periodsPerCycle = diffDays / (safeMonths * 30.44);
  }

  return Math.floor(periodsPerCycle);
}

export async function computeSavings(
  subscriptions: Subscription[],
): Promise<SavingsResult> {
  const savingsBreakdown: SavingsItem[] = [];
  let totalSavings = 0;
  const trialWarnings: TrialWarning[] = [];
  const splitSavings: BillSplitSaving[] = [];

  const today = startOfDay(new Date());

  for (const sub of subscriptions) {
    const activePrice = getSubscriptionActivePrice(sub);

    if (sub.isPaused) {
      const expectedCycles = computeExpectedCycles(
        sub.startDate,
        sub.createdAt,
        sub.rawBillingCycle || sub.billingCycle,
        sub.customIntervalMonths,
      );

      let actualTransactions = 0;
      try {
        const txs = await db.getTransactionsBySubscriptionId(sub.id);
        actualTransactions = txs.length;
      } catch {
        actualTransactions = 0;
      }

      const skippedCycles = Math.max(0, expectedCycles - actualTransactions);
      const saved = skippedCycles * sub.price;

      if (skippedCycles > 0 && saved > 0) {
        savingsBreakdown.push({
          subscriptionId: sub.id,
          name: sub.name,
          status: "paused",
          monthlyPrice: sub.price,
          monthsSkipped: skippedCycles,
          totalSaved: saved,
          logoUrl: sub.logoUrl,
          color: sub.color,
          website: sub.website,
          currency: sub.currency,
        });
        totalSavings += saved;
      }
    }

    if (sub.isTrial && !sub.isPaused) {
      try {
        const trialEnd = sub.trialEndDate ? parseISO(sub.trialEndDate) : null;
        if (trialEnd && trialEnd > today) {
          trialWarnings.push({
            subscriptionId: sub.id,
            name: sub.name,
            trialEndDate: sub.trialEndDate!,
            logoUrl: sub.logoUrl,
            color: sub.color,
            website: sub.website,
          });
        }
      } catch {
        // Skip parse errors
      }
    }

    if (
      sub.splitEnabled &&
      sub.splitType &&
      sub.splitValue !== undefined &&
      sub.splitValue !== null &&
      !sub.isTrial &&
      !sub.isPaused
    ) {
      const fullPrice = sub.price;
      const userShare = activePrice;
      const monthlySaving = fullPrice - userShare;

      if (monthlySaving > 0) {
        splitSavings.push({
          subscriptionId: sub.id,
          name: sub.name,
          fullPrice,
          userShare,
          monthlySaving,
          splitType: sub.splitType,
          splitValue: sub.splitValue,
          logoUrl: sub.logoUrl,
          color: sub.color,
          website: sub.website,
        });
      }
    }
  }

  totalSavings = Math.round(totalSavings * 100) / 100;

  let vaultMode: "saved" | "advisor" = "saved";
  let advisorType: "trials" | "splits" | "suggestions" | null = null;
  let advisorMessage = "";

  if (totalSavings > 0) {
    vaultMode = "saved";
  } else if (trialWarnings.length > 0) {
    vaultMode = "advisor";
    advisorType = "trials";
    const earliestEnd = trialWarnings.reduce(
      (earliest, t) => {
        const end = parseISO(t.trialEndDate);
        return end < earliest ? end : earliest;
      },
      parseISO(trialWarnings[0].trialEndDate),
    );
    const formattedEnd = `${earliestEnd.toLocaleString("default", { month: "short" })} ${earliestEnd.getDate()}`;
    const totalTrialCost = trialWarnings.reduce((sum, t) => {
      const sub = subscriptions.find((s) => s.id === t.subscriptionId);
      return sum + (sub ? sub.price : 0);
    }, 0);
    advisorMessage = `You have ${trialWarnings.length} active trial${trialWarnings.length > 1 ? "s" : ""}. Cancel before ${formattedEnd} to avoid paying ${subscriptions[0]?.currency === "INR" ? "₹" : "$"}${totalTrialCost.toFixed(0)}.`;
  } else if (splitSavings.length > 0) {
    vaultMode = "advisor";
    advisorType = "splits";
    const totalSplitSaving = splitSavings.reduce((s, sp) => s + sp.monthlySaving, 0);
    const roundSplit = Math.round(totalSplitSaving * 100) / 100;
    advisorMessage = `Your shared subscriptions save you ${subscriptions[0]?.currency === "INR" ? "₹" : "$"}${roundSplit.toFixed(0)} every month.`;
  } else {
    vaultMode = "advisor";
    advisorType = "suggestions";
    advisorMessage =
      "No savings yet. Pause subscriptions you haven\u2019t used recently to start building your Savings Vault.";
  }

  return {
    totalSavings,
    savingsBreakdown,
    vaultMode,
    advisorType,
    trialWarnings,
    splitSavings,
    advisorMessage,
  };
}
