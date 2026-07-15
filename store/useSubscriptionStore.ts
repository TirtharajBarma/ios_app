import { create } from "zustand";
import type {
  NewSubscriptionInput,
  Subscription,
  SubscriptionStats,
} from "@/types/subscription";
import * as db from "@/database/database";
import { toMonthly, toYearly, daysUntil } from "@/utils/date";
import { scheduleReminder, cancelReminder } from "@/utils/notifications";

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
      return sum + toMonthly(s.price, s.billingCycle, s.customIntervalMonths);
    },
    0
  );
  
  const yearlyTotal = subscriptions.reduce(
    (sum, s) => {
      if (s.isTrial) return sum;
      return sum + toYearly(s.price, s.billingCycle, s.customIntervalMonths);
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
    const subscriptions = await db.getAllSubscriptions();
    // Sort nearest renewal first
    subscriptions.sort(
      (a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime()
    );
    set({ subscriptions, stats: computeStats(subscriptions), isLoaded: true });
  },

  addSubscription: async (input) => {
    await db.initializeDatabase();
    const id = generateId();
    const sub = await db.insertSubscription(id, input);
    set((state) => {
      const subscriptions = [...state.subscriptions, sub].sort(
        (a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime()
      );
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
      updated.sort(
        (a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime()
      );
      return { subscriptions: updated, stats: computeStats(updated) };
    });
    const updatedSub = get().subscriptions.find((s) => s.id === id);
    if (updatedSub) scheduleReminder(updatedSub).catch(() => {});
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
