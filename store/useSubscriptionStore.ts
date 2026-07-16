import { create } from "zustand";
import { startOfYear, endOfYear, startOfDay, parseISO } from "date-fns";
import type {
  NewSubscriptionInput,
  Subscription,
  SubscriptionStats,
} from "@/types/subscription";
import * as db from "@/database/database";
import { toMonthly, toYearly, daysUntil, advanceCycle, advanceCycleDate, getSubscriptionActivePrice } from "@/utils/date";
import { scheduleReminder, cancelReminder } from "@/utils/notifications";
import AsyncStorage from "@/utils/storage";
import { getExchangeRates } from "@/utils/currency";

interface SubscriptionState {
  /** In-memory list, sorted by next billing date (ascending). */
  subscriptions: Subscription[];
  /** Derived monthly / yearly totals, count, and trials. */
  stats: SubscriptionStats;
  /** Whether the initial load from SQLite has completed. */
  isLoaded: boolean;

  // ─── async actions ───────────────────────────────────────────────
  loadSubscriptions: () => Promise<void>;
  addSubscription: (input: NewSubscriptionInput) => Promise<Subscription>;
  updateSubscription: (id: string, input: Partial<NewSubscriptionInput>) => Promise<void>;
  removeSubscription: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  convertAllCurrencies: (oldCurrency: string, newCurrency: string) => Promise<void>;

  // Compatibility aliases
  load: () => Promise<void>;
  add: (input: NewSubscriptionInput) => Promise<Subscription>;
  update: (id: string, input: Partial<NewSubscriptionInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** Derive aggregated stats from the current list. */
function computeStats(subscriptions: Subscription[]): SubscriptionStats {
  let nextRenewalDate: string | null = null;
  let minDays = Infinity;

  for (const sub of subscriptions) {
    // Only count active (non-trial) subscriptions for renewal alerts
    if (sub.isTrial) continue;

    const d = daysUntil(sub.nextBillingDate);
    if (d >= 0 && d < minDays) {
      minDays = d;
      nextRenewalDate = sub.nextBillingDate;
    }
  }

  // Calculate monthly & yearly spends
  const monthlyTotal = subscriptions.reduce(
    (sum, s) => {
      // Do not include free trials in current monthly spending totals
      if (s.isTrial) return sum;
      const activePrice = getSubscriptionActivePrice(s);
      return sum + toMonthly(activePrice, s.billingCycle, s.customIntervalMonths);
    },
    0
  );
  
  const yearlyTotal = subscriptions.reduce(
    (sum, s) => {
      if (s.isTrial) return sum;
      const activePrice = getSubscriptionActivePrice(s);
      return sum + toYearly(activePrice, s.billingCycle, s.customIntervalMonths);
    },
    0
  );

  const activeCount = subscriptions.filter((s) => !s.isTrial).length;
  const trialCount = subscriptions.filter((s) => s.isTrial).length;

  return {
    count: subscriptions.length,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    yearlyTotal: Math.round(yearlyTotal * 100) / 100,
    nextRenewalDate,
    activeCount,
    trialCount,
  };
}

/** Helper: generate a UUID. Uses the Web Crypto API available in Expo 57. */
function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscriptions: [],
  stats: { count: 0, monthlyTotal: 0, yearlyTotal: 0, nextRenewalDate: null, activeCount: 0, trialCount: 0 },
  isLoaded: false,

  loadSubscriptions: async () => {
    await db.initializeDatabase();
    
    // Wipe database of old seed/mock data once on startup (D-03 guard: only if no real data)
    const CLEANUP_KEY = "@db_cleanup_done_v4";
    const isCleaned = await AsyncStorage.getItem(CLEANUP_KEY);
    if (!isCleaned) {
      const existing = await db.getAllSubscriptions();
      if (existing.length === 0) {
        await db.deleteAllSubscriptions();
      }
      await AsyncStorage.setItem(CLEANUP_KEY, "true");
    }

    let subscriptions = await db.getAllSubscriptions();

    // Auto-advance any paid subscriptions whose nextBillingDate has passed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let changed = false;

    for (const sub of subscriptions) {
      // Only auto-advance paid subscriptions; trials that have ended remain
      // at their trialEndDate — the UI layer shows them as "Expired"
      if (!sub.isTrial && sub.nextBillingDate) {
        const billDate = new Date(sub.nextBillingDate);
        if (billDate < today) {
          let nextDate = sub.nextBillingDate;
          let safety = 0;
          while (new Date(nextDate) < today && safety < 366) {
            nextDate = advanceCycle(nextDate, sub.billingCycle, sub.customIntervalMonths);
            safety++;
          }
          await db.updateSubscription(sub.id, { nextBillingDate: nextDate });
          sub.nextBillingDate = nextDate;
          changed = true;
        }
      }
    }

    if (changed) {
      subscriptions = await db.getAllSubscriptions();
      // Re-schedule reminders for all subs whose dates were auto-advanced
      for (const sub of subscriptions) {
        scheduleReminder(sub).catch(() => {});
      }
    }

    // Sort nearest renewal first
    subscriptions.sort((a, b) => {
      const timeA = a.nextBillingDate && !isNaN(new Date(a.nextBillingDate).getTime())
        ? new Date(a.nextBillingDate).getTime() : Infinity;
      const timeB = b.nextBillingDate && !isNaN(new Date(b.nextBillingDate).getTime())
        ? new Date(b.nextBillingDate).getTime() : Infinity;
      return timeA - timeB;
    });
    set({ subscriptions, stats: computeStats(subscriptions), isLoaded: true });
  },

  addSubscription: async (input) => {
    await db.initializeDatabase();
    const id = generateId();
    const sub = await db.insertSubscription(id, input);
    set((state) => {
      const subscriptions = [...state.subscriptions, sub].sort((a, b) => {
        const timeA = a.nextBillingDate && !isNaN(new Date(a.nextBillingDate).getTime())
          ? new Date(a.nextBillingDate).getTime() : Infinity;
        const timeB = b.nextBillingDate && !isNaN(new Date(b.nextBillingDate).getTime())
          ? new Date(b.nextBillingDate).getTime() : Infinity;
        return timeA - timeB;
      });
      return { subscriptions, stats: computeStats(subscriptions) };
    });
    scheduleReminder(sub).catch(() => {});
    return sub;
  },

  updateSubscription: async (id, input) => {
    await db.initializeDatabase();
    await db.updateSubscription(id, input);
    set((state) => {
      const idx = state.subscriptions.findIndex((s) => s.id === id);
      if (idx === -1) return state;
      const updated = [...state.subscriptions];
      updated[idx] = {
        ...updated[idx],
        ...input,
        updatedAt: new Date().toISOString(),
      };
      updated.sort((a, b) => {
        const timeA = a.nextBillingDate && !isNaN(new Date(a.nextBillingDate).getTime())
          ? new Date(a.nextBillingDate).getTime() : Infinity;
        const timeB = b.nextBillingDate && !isNaN(new Date(b.nextBillingDate).getTime())
          ? new Date(b.nextBillingDate).getTime() : Infinity;
        return timeA - timeB;
      });
      return { subscriptions: updated, stats: computeStats(updated) };
    });
  },

  removeSubscription: async (id) => {
    await db.initializeDatabase();
    await db.deleteSubscription(id);
    cancelReminder(id).catch(() => {});
    set((state) => {
      const subscriptions = state.subscriptions.filter((s) => s.id !== id);
      return { subscriptions, stats: computeStats(subscriptions) };
    });
  },

  convertAllCurrencies: async (oldCurrency, newCurrency) => {
    await db.initializeDatabase();
    const EXCHANGE_RATES = await getExchangeRates();
    
    const subs = get().subscriptions;
    // B-04: removed unused rateFrom. Each sub is converted from its own currency → USD → newCurrency
    const rateTo = EXCHANGE_RATES[newCurrency?.toUpperCase()] ?? 1.0;
    
    const updatedSubs: Subscription[] = [];
    
    for (const sub of subs) {
      const subCurrencyRate = EXCHANGE_RATES[sub.currency?.toUpperCase()];
      if (subCurrencyRate === undefined || subCurrencyRate === 0) {
        // Skip subscriptions with unknown currency — don't corrupt their price
        updatedSubs.push(sub);
        continue;
      }
      const priceInUSD = sub.price / subCurrencyRate;
      const newPrice = Math.round((priceInUSD * rateTo) * 100) / 100;
      
      // Also convert promoPrice if present
      let newPromoPrice = sub.promoPrice;
      if (sub.promoEnabled && sub.promoPrice != null) {
        const promoInUSD = sub.promoPrice / subCurrencyRate;
        newPromoPrice = Math.round((promoInUSD * rateTo) * 100) / 100;
      }
      
      // Also convert share-type splitValue (fixed amount split)
      let newSplitValue = sub.splitValue;
      if (sub.splitEnabled && sub.splitType === "share" && sub.splitValue != null) {
        const splitInUSD = sub.splitValue / subCurrencyRate;
        newSplitValue = Math.round((splitInUSD * rateTo) * 100) / 100;
      }
      
      const dbUpdates: any = {
        price: newPrice,
        currency: newCurrency,
      };
      if (newPromoPrice !== sub.promoPrice) dbUpdates.promoPrice = newPromoPrice;
      if (newSplitValue !== sub.splitValue) dbUpdates.splitValue = newSplitValue;
      
      await db.updateSubscription(sub.id, dbUpdates);
      
      updatedSubs.push({
        ...sub,
        price: newPrice,
        currency: newCurrency,
        promoPrice: newPromoPrice,
        splitValue: newSplitValue,
      });
    }
    
    set({ subscriptions: updatedSubs, stats: computeStats(updatedSubs) });
  },

  refresh: async () => {
    await get().loadSubscriptions();
  },

  // ─── Compatibility Aliases ─────────────────────────────────────────
  load: async () => {
    await get().loadSubscriptions();
  },
  add: async (input) => {
    return await get().addSubscription(input);
  },
  update: async (id, input) => {
    await get().updateSubscription(id, input);
  },
  remove: async (id) => {
    await get().removeSubscription(id);
  },
}));
