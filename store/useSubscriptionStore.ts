import { create } from "zustand";
import { startOfYear, endOfYear, startOfDay, parseISO, addDays, addWeeks, addMonths, addYears } from "date-fns";
import type {
  NewSubscriptionInput,
  Subscription,
  SubscriptionStats,
} from "@/types/subscription";
import * as db from "@/database/database";
import { toMonthly, toYearly, daysUntil, advanceCycle, advanceCycleDate, getSubscriptionActivePrice, getNextRenewalDate } from "@/utils/date";
import { scheduleReminder, cancelReminder, cancelAllReminders, scheduleAllReminders } from "@/utils/notifications";
import AsyncStorage from "@/utils/storage";
import { getExchangeRates } from "@/utils/currency";
import { triggerAutoBackup } from "@/utils/backup";

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
  updateReminderDaysForDefaultTiming: (prevDays: number, newDays: number) => Promise<void>;
  importSubscriptions: (importedSubs: NewSubscriptionInput[]) => Promise<void>;

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
    if (sub.isPaused) continue;
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
      if (s.isPaused) return sum;
      // Do not include free trials in current monthly spending totals
      if (s.isTrial) return sum;
      const activePrice = getSubscriptionActivePrice(s);
      return sum + toMonthly(activePrice, s.rawBillingCycle || s.billingCycle, s.customIntervalMonths);
    },
    0
  );
  
  const yearlyTotal = subscriptions.reduce(
    (sum, s) => {
      if (s.isPaused) return sum;
      if (s.isTrial) return sum;
      const activePrice = getSubscriptionActivePrice(s);
      return sum + toYearly(activePrice, s.rawBillingCycle || s.billingCycle, s.customIntervalMonths);
    },
    0
  );

  const activeCount = subscriptions.filter((s) => !s.isTrial && !s.isPaused).length;
  const trialCount = subscriptions.filter((s) => s.isTrial && !s.isPaused).length;

  return {
    count: subscriptions.length,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    yearlyTotal: Math.round(yearlyTotal * 100) / 100,
    nextRenewalDate,
    activeCount,
    trialCount,
  };
}

async function populateHistoricalTransactions(sub: Subscription): Promise<void> {
  if (sub.isTrial) return;
  const existing = await db.getTransactionsBySubscriptionId(sub.id);
  if (existing.length > 0) return;

  const start = startOfDay(sub.startDate ? new Date(sub.startDate) : new Date(sub.createdAt));
  const today = startOfDay(new Date());
  
  if (start > today) return;
  
  let current = start;
  let periods = 0;
  const maxCycles = 100;
  const activePrice = getSubscriptionActivePrice(sub);
  
  while (current <= today && periods < maxCycles) {
    const cycleLower = (sub.rawBillingCycle || sub.billingCycle || "monthly").toLowerCase();
    
    await db.createTransaction({
      id: sub.id + "-tx-" + periods,
      subscriptionId: sub.id,
      amount: activePrice,
      currency: sub.currency,
      date: current.toISOString(),
    }).catch(() => {});
    
    periods++;
    if (cycleLower === "weekly") {
      current = addWeeks(start, periods);
    } else if (cycleLower === "bi-weekly") {
      current = addWeeks(start, periods * 2);
    } else if (cycleLower === "monthly") {
      current = addMonths(start, periods);
    } else if (cycleLower === "quarterly") {
      current = addMonths(start, periods * 3);
    } else if (cycleLower === "semi-yearly") {
      current = addMonths(start, periods * 6);
    } else if (cycleLower === "yearly") {
      current = addYears(start, periods);
    } else if (cycleLower.startsWith("custom:")) {
      const parts = cycleLower.split(":");
      const val = Number(parts[1]) || 1;
      const unit = parts[2] || "months";
      if (unit === "days") {
        current = addDays(start, val * periods);
      } else if (unit === "weeks") {
        current = addWeeks(start, val * periods);
      } else if (unit === "years") {
        current = addYears(start, val * periods);
      } else {
        current = addMonths(start, val * periods);
      }
    } else {
      const customVal = sub.customIntervalMonths || 1;
      current = addMonths(start, customVal * periods);
    }
  }
}

/** Helper: generate a UUID. Uses the Web Crypto API available in Expo 57. */
function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

let loadPromise: Promise<void> | null = null;

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscriptions: [],
  stats: { count: 0, monthlyTotal: 0, yearlyTotal: 0, nextRenewalDate: null, activeCount: 0, trialCount: 0 },
  isLoaded: false,

  loadSubscriptions: async () => {
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
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

      // Populate history logic on load
      for (const sub of subscriptions) {
        await populateHistoricalTransactions(sub).catch(() => {});
      }

      const SQLiteDb = db.getDatabase();
      await SQLiteDb.execAsync("BEGIN TRANSACTION;");
      try {
        for (const sub of subscriptions) {
          // Only auto-advance paid subscriptions; trials that have ended remain
          // at their trialEndDate — the UI layer shows them as "Expired"
          if (!sub.isTrial && sub.nextBillingDate && !sub.isPaused) {
            const billDate = new Date(sub.nextBillingDate);
            if (billDate < today) {
              const activePrice = getSubscriptionActivePrice(sub);
              await db.createTransaction({
                id: generateId(),
                subscriptionId: sub.id,
                amount: activePrice,
                currency: sub.currency,
                date: sub.nextBillingDate,
              }).catch(() => {});

              const anchorDate = sub.startDate ? new Date(sub.startDate) : new Date(sub.nextBillingDate);
              const nextDate = getNextRenewalDate(
                anchorDate,
                sub.rawBillingCycle || sub.billingCycle,
                sub.customIntervalMonths,
                today
              ).toISOString();
              
              await db.updateSubscription(sub.id, { nextBillingDate: nextDate });
              sub.nextBillingDate = nextDate;
              changed = true;
            }
          }
        }
        await SQLiteDb.execAsync("COMMIT;");
      } catch (err) {
        await SQLiteDb.execAsync("ROLLBACK;");
        console.error("Failed to auto-advance subscriptions:", err);
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
    })();

    try {
      await loadPromise;
    } finally {
      loadPromise = null;
    }
  },

  addSubscription: async (input) => {
    await db.initializeDatabase();
    const id = generateId();
    const sub = await db.insertSubscription(id, input);
    await populateHistoricalTransactions(sub).catch(() => {});
    let currentSubscriptions: Subscription[] = [];
    set((state) => {
      const subscriptions = [...state.subscriptions, sub].sort((a, b) => {
        const timeA = a.nextBillingDate && !isNaN(new Date(a.nextBillingDate).getTime())
          ? new Date(a.nextBillingDate).getTime() : Infinity;
        const timeB = b.nextBillingDate && !isNaN(new Date(b.nextBillingDate).getTime())
          ? new Date(b.nextBillingDate).getTime() : Infinity;
        return timeA - timeB;
      });
      currentSubscriptions = subscriptions;
      return { subscriptions, stats: computeStats(subscriptions) };
    });
    scheduleReminder(sub).catch(() => {});
    triggerAutoBackup(currentSubscriptions).catch(() => {});
    return sub;
  },

  updateSubscription: async (id, input) => {
    await db.initializeDatabase();
    await db.updateSubscription(id, input);
    let updatedSub: Subscription | undefined;
    let currentSubscriptions: Subscription[] = [];
    set((state) => {
      const idx = state.subscriptions.findIndex((s) => s.id === id);
      if (idx === -1) return state;
      const updated = [...state.subscriptions];
      updated[idx] = {
        ...updated[idx],
        ...input,
        updatedAt: new Date().toISOString(),
      };
      updatedSub = updated[idx];
      updated.sort((a, b) => {
        const timeA = a.nextBillingDate && !isNaN(new Date(a.nextBillingDate).getTime())
          ? new Date(a.nextBillingDate).getTime() : Infinity;
        const timeB = b.nextBillingDate && !isNaN(new Date(b.nextBillingDate).getTime())
          ? new Date(b.nextBillingDate).getTime() : Infinity;
        return timeA - timeB;
      });
      currentSubscriptions = updated;
      return { subscriptions: updated, stats: computeStats(updated) };
    });

    if (updatedSub) {
      if (updatedSub.reminderEnabled && updatedSub.nextBillingDate && !updatedSub.isPaused) {
        await scheduleReminder(updatedSub).catch(() => {});
      } else {
        await cancelReminder(id).catch(() => {});
      }
      
      // Log transaction and reset next billing date if resuming
      if (input.isPaused === false) {
        const activePrice = getSubscriptionActivePrice(updatedSub);
        const today = new Date();
        
        // Log resumption transaction today
        await db.createTransaction({
          id: generateId(),
          subscriptionId: id,
          amount: activePrice,
          currency: updatedSub.currency,
          date: today.toISOString(),
        }).catch(() => {});

        // Reset next renewal date to one cycle from today
        const cycle = updatedSub.rawBillingCycle || updatedSub.billingCycle || "monthly";
        const customMonths = updatedSub.customIntervalMonths || 1;
        const nextDate = getNextRenewalDate(today, cycle, customMonths).toISOString();
        
        await db.updateSubscription(id, { nextBillingDate: nextDate }).catch(() => {});
        
        // Update in-memory state
        set((state) => {
          const idx = state.subscriptions.findIndex((s) => s.id === id);
          if (idx !== -1) {
            const updated = [...state.subscriptions];
            updated[idx] = {
              ...updated[idx],
              nextBillingDate: nextDate,
            };
            updated.sort((a, b) => {
              const timeA = a.nextBillingDate && !isNaN(new Date(a.nextBillingDate).getTime())
                ? new Date(a.nextBillingDate).getTime() : Infinity;
              const timeB = b.nextBillingDate && !isNaN(new Date(b.nextBillingDate).getTime())
                ? new Date(b.nextBillingDate).getTime() : Infinity;
              return timeA - timeB;
            });
            return { subscriptions: updated, stats: computeStats(updated) };
          }
          return state;
        });

        // Reschedule reminders for the new renewal date
        const subForReminder = { ...updatedSub, nextBillingDate: nextDate };
        if (subForReminder.reminderEnabled) {
          await scheduleReminder(subForReminder).catch(() => {});
        }
      }
    }
    triggerAutoBackup(currentSubscriptions).catch(() => {});
  },

  removeSubscription: async (id) => {
    await db.initializeDatabase();
    await db.deleteSubscription(id);
    cancelReminder(id).catch(() => {});
    let currentSubscriptions: Subscription[] = [];
    set((state) => {
      const subscriptions = state.subscriptions.filter((s) => s.id !== id);
      currentSubscriptions = subscriptions;
      return { subscriptions, stats: computeStats(subscriptions) };
    });
    triggerAutoBackup(currentSubscriptions).catch(() => {});
  },

  convertAllCurrencies: async (oldCurrency, newCurrency) => {
    if (oldCurrency?.toUpperCase() === newCurrency?.toUpperCase()) return;

    await db.initializeDatabase();
    const EXCHANGE_RATES = await getExchangeRates();
    
    const subs = get().subscriptions;
    const rateTo = EXCHANGE_RATES[newCurrency?.toUpperCase()] ?? 1.0;
    
    const updatedSubs: Subscription[] = [];
    const SQLiteDb = db.getDatabase();

    await SQLiteDb.execAsync("BEGIN TRANSACTION;");
    try {
      for (const sub of subs) {
        if (sub.currency?.toUpperCase() === newCurrency?.toUpperCase()) {
          updatedSubs.push(sub);
          continue;
        }

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
      await SQLiteDb.execAsync("COMMIT;");
    } catch (e) {
      await SQLiteDb.execAsync("ROLLBACK;");
      console.error("Batch currency conversion failed:", e);
      throw e;
    }
    
    set({ subscriptions: updatedSubs, stats: computeStats(updatedSubs) });
    triggerAutoBackup(updatedSubs).catch(() => {});
  },

  updateReminderDaysForDefaultTiming: async (prevDays: number, newDays: number) => {
    await db.initializeDatabase();
    const subs = get().subscriptions;
    const SQLiteDb = db.getDatabase();
    
    await SQLiteDb.execAsync("BEGIN TRANSACTION;");
    try {
      for (const s of subs) {
        if (s.reminderDays === prevDays) {
          await db.updateSubscription(s.id, { reminderDays: newDays });
        }
      }
      await SQLiteDb.execAsync("COMMIT;");
    } catch (e) {
      await SQLiteDb.execAsync("ROLLBACK;");
      console.error("Batch update of reminder timing failed:", e);
      throw e;
    }

    set((state) => {
      const updated = state.subscriptions.map((s) => 
        s.reminderDays === prevDays ? { ...s, reminderDays: newDays } : s
      );
      return { subscriptions: updated, stats: computeStats(updated) };
    });
  },

  importSubscriptions: async (importedSubs) => {
    await db.initializeDatabase();
    
    // Wipe existing database in one step
    await db.deleteAllSubscriptions();
    await cancelAllReminders().catch(() => {});
    
    const SQLiteDb = db.getDatabase();
    const createdSubs: Subscription[] = [];
    
    await SQLiteDb.execAsync("BEGIN TRANSACTION;");
    try {
      for (const input of importedSubs) {
        const id = generateId();
        const sub = await db.insertSubscription(id, input);
        createdSubs.push(sub);
      }
      await SQLiteDb.execAsync("COMMIT;");
      for (const sub of createdSubs) {
        await populateHistoricalTransactions(sub).catch(() => {});
      }
    } catch (e) {
      await SQLiteDb.execAsync("ROLLBACK;");
      console.error("Batch import failed:", e);
      throw e;
    }
    
    createdSubs.sort((a, b) => {
      const timeA = a.nextBillingDate && !isNaN(new Date(a.nextBillingDate).getTime())
        ? new Date(a.nextBillingDate).getTime() : Infinity;
      const timeB = b.nextBillingDate && !isNaN(new Date(b.nextBillingDate).getTime())
        ? new Date(b.nextBillingDate).getTime() : Infinity;
      return timeA - timeB;
    });
    
    set({
      subscriptions: createdSubs,
      stats: computeStats(createdSubs),
    });
    
    await scheduleAllReminders(createdSubs).catch(() => {});
    triggerAutoBackup(createdSubs).catch(() => {});
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
