import { parseISO, startOfDay, differenceInCalendarDays, differenceInCalendarMonths } from "date-fns";
import type { Subscription } from "@/types/subscription";
import type { BrandLogoVariantKey } from "@/assets/data/services";
import { getSubscriptionActivePrice } from "@/utils/date";
import { getCurrencySymbol } from "@/constants";
import { convertCurrency } from "@/utils/currency";
import { splitMonthlySaving } from "@/utils/subscriptionUtils";
import * as db from "@/database/database";

export interface SavingsItem {
  subscriptionId: string;
  name: string;
  status: "paused" | "trial" | "active";
  monthlyPrice: number;
  monthsSkipped: number;
  totalSaved: number;
  logoUrl?: string;
  serviceId?: string;
  brandVariant?: BrandLogoVariantKey;
  logoIcon?: string;
  logoImageUri?: string;
  color?: string;
  website?: string;
  currency?: string;
}

export interface TrialWarning {
  subscriptionId: string;
  name: string;
  trialEndDate: string;
  price?: number;
  currency?: string;
  billingCycle?: string;
  rawBillingCycle?: string;
  logoUrl?: string;
  serviceId?: string;
  brandVariant?: BrandLogoVariantKey;
  logoIcon?: string;
  logoImageUri?: string;
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
  serviceId?: string;
  brandVariant?: BrandLogoVariantKey;
  logoIcon?: string;
  logoImageUri?: string;
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
    periodsPerCycle = diffDays / 30.4375;
  } else if (cycleLower === "quarterly") {
    periodsPerCycle = diffDays / (3 * 30.4375);
  } else if (cycleLower === "semi-yearly") {
    periodsPerCycle = diffDays / (6 * 30.4375);
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

/** Display currency; savings from different subscription currencies are summed in this one. */
function getAppCurrency(): string {
  try {
    return require("@/store/useSettingsStore").useSettingsStore.getState().currencyCode || "INR";
  } catch {
    return "INR";
  }
}

export async function computeSavings(
  subscriptions: Subscription[],
): Promise<SavingsResult> {
  const savingsBreakdown: SavingsItem[] = [];
  let totalSavings = 0;
  const trialWarnings: TrialWarning[] = [];
  const splitSavings: BillSplitSaving[] = [];

  const today = startOfDay(new Date());
  const appCurrency = getAppCurrency();
  const toApp = (amount: number, from?: string) =>
    from && from.toUpperCase() !== appCurrency.toUpperCase() ? convertCurrency(amount, from, appCurrency) : amount;

  for (const sub of subscriptions) {
    const activePrice = getSubscriptionActivePrice(sub);

    if (sub.isPaused) {
      // Cycles skipped = cycles elapsed since the last payment (rows are newest first), not since the
      // subscription began: everything before the pause was actually paid.
      let lastPaid: string | undefined;
      try {
        const txs = await db.getTransactionsBySubscriptionId(sub.id);
        lastPaid = txs[0]?.date;
      } catch {
        lastPaid = undefined;
      }
      const skippedCycles = computeExpectedCycles(
        lastPaid || sub.startDate,
        sub.createdAt,
        sub.rawBillingCycle || sub.billingCycle,
        sub.customIntervalMonths,
      );
      const saved = skippedCycles * activePrice;

      if (skippedCycles > 0 && saved > 0) {
        savingsBreakdown.push({
          subscriptionId: sub.id,
          name: sub.name,
          status: "paused",
          monthlyPrice: activePrice,
          monthsSkipped: skippedCycles,
          totalSaved: saved,
          logoUrl: sub.logoUrl,
          serviceId: sub.serviceId,
          brandVariant: sub.brandVariant,
          logoIcon: sub.logoIcon,
          logoImageUri: sub.logoImageUri,
          color: sub.color,
          website: sub.website,
          currency: sub.currency,
        });
        totalSavings += toApp(saved, sub.currency);
      }
    }

    if (sub.isTrial && !sub.isPaused) {
      try {
        const trialEnd = sub.trialEndDate ? parseISO(sub.trialEndDate) : null;
        if (trialEnd && trialEnd >= startOfDay(today)) {
          trialWarnings.push({
            subscriptionId: sub.id,
            name: sub.name,
            trialEndDate: sub.trialEndDate!,
            price: sub.price,
            currency: sub.currency,
            billingCycle: sub.billingCycle,
            rawBillingCycle: sub.rawBillingCycle,
            logoUrl: sub.logoUrl,
            serviceId: sub.serviceId,
            brandVariant: sub.brandVariant,
            logoIcon: sub.logoIcon,
            logoImageUri: sub.logoImageUri,
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
      const monthlySaving = splitMonthlySaving(sub);

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
          serviceId: sub.serviceId,
          brandVariant: sub.brandVariant,
          logoIcon: sub.logoIcon,
          logoImageUri: sub.logoImageUri,
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
    const earliestTime = earliestEnd.getTime();
    const totalTrialCost = trialWarnings.reduce((sum, t) => {
      const end = parseISO(t.trialEndDate);
      if (end.getTime() !== earliestTime) return sum;
      const sub = subscriptions.find((s) => s.id === t.subscriptionId);
      return sum + (sub ? toApp(sub.price, sub.currency) : 0);
    }, 0);
    const symbol = getCurrencySymbol(appCurrency);
    advisorMessage = `Cancel before ${formattedEnd} to avoid paying ${symbol}${totalTrialCost.toFixed(0)}.`;
  } else if (splitSavings.length > 0) {
    vaultMode = "advisor";
    advisorType = "splits";
    const totalSplitSaving = splitSavings.reduce((s, sp) => s + toApp(sp.monthlySaving, subscriptions.find((x) => x.id === sp.subscriptionId)?.currency), 0);
    const roundSplit = Math.round(totalSplitSaving * 100) / 100;
    const symbol = getCurrencySymbol(appCurrency);
    advisorMessage = `Your shared subscriptions save you ${symbol}${roundSplit.toFixed(0)} every month.`;
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
