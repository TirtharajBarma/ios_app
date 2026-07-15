/**
 * Subscription domain types
 *
 * Shared by the Zustand store, the SQLite persistence layer, the form (Zod)
 * schema and the UI. Keeping a single source of truth here avoids drift.
 */

/** How often a subscription is billed. */
export type BillingCycle =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

/** Free-form category tag used for grouping / icon/color selection. */
export type Category =
  | "entertainment"
  | "productivity"
  | "health"
  | "music"
  | "news"
  | "cloud"
  | "ai"
  | "education"
  | "gaming"
  | "other";

/** ISO-4217 currency code, e.g. "USD", "EUR", "INR". */
export type Currency = string;

/** Reminder lead time before the next billing date, in days. */
export type ReminderDays = number;

/**
 * The canonical subscription record as used throughout the app (UI + store).
 */
export interface Subscription {
  id: string;
  name: string;
  /** Brand color (hex) or gradient key used for the card. */
  color: string;
  /** Optional logo URL / Name. */
  logoUrl?: string;
  /** Cost for one billing cycle, in major units (e.g. 9.99). */
  price: number;
  currency: Currency;
  billingCycle: BillingCycle;
  /** Custom interval in months, only used when billingCycle === "custom". */
  customIntervalMonths?: number;
  /** ISO-8601 date string of the next charge. */
  nextBillingDate: string;
  category: Category;
  /** Whether the user has enabled a renewal reminder. */
  reminderEnabled: boolean;
  /** How many days before renewal to remind. */
  reminderDays: ReminderDays;
  /** Optional free-form note. */
  note?: string;
  
  // ─── Trial and payment extensions ────────────────────────────────
  isTrial: boolean;
  trialStartDate?: string; // ISO-8601 date string
  trialEndDate?: string;   // ISO-8601 date string
  startDate?: string;      // ISO-8601 date string
  paymentMethod?: string;
  website?: string;

  createdAt: string;
  updatedAt: string;
}

/** Input used when creating a new subscription (server-generated fields omitted). */
export type NewSubscriptionInput = Omit<
  Subscription,
  "id" | "createdAt" | "updatedAt"
>;

/** Row shape as stored in SQLite (dates are TEXT, price is REAL). */
export interface SubscriptionRow {
  id: string;
  name: string;
  color: string;
  logo_url: string | null;
  price: number;
  currency: string;
  billing_cycle: string;
  custom_interval_months: number | null;
  next_billing_date: string;
  category: string;
  reminder_enabled: number; // SQLite boolean 0/1
  reminder_days: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Aggregated stats derived from the list of subscriptions. */
export interface SubscriptionStats {
  /** Total count of active subscriptions. */
  count: number;
  /** Combined monthly cost (normalized). */
  monthlyTotal: number;
  /** Combined yearly cost (normalized). */
  yearlyTotal: number;
  /** Next upcoming renewal date (ISO string) across all subscriptions. */
  nextRenewalDate: string | null;
  activeCount: number;
  trialCount: number;
}
