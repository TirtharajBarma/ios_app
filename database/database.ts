import * as SQLite from "expo-sqlite";
import { runMigrations } from "./migrations";
import { setDatabaseInstance, getDatabase as getConnectionDb } from "./connection";
import {
  createSubscription as dbCreateSubscription,
  getAllSubscriptions as dbGetAllSubscriptions,
  getSubscriptionById as dbGetSubscriptionById,
  updateSubscription as dbUpdateSubscription,
  deleteSubscription as dbDeleteSubscription,
  deleteAllSubscriptions as dbDeleteAllSubscriptions,
} from "./queries";
import type { DbSubscription } from "./schema";
import type { Subscription, NewSubscriptionInput } from "@/types/subscription";

let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens the SQLite database connection, runs migrations, and prepares it for queries.
 */
export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  // If already initialized, getConnectionDb will return without throwing
  try {
    const db = getConnectionDb();
    if (db) return db;
  } catch (e) {
    // Expected if not initialized yet
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log("Database: Opening connection to 'subscriptions.db'...");
      const db = await SQLite.openDatabaseAsync("subscriptions.db");
      
      // Run schema migrations first (may need the db handle internally)
      await runMigrations(db);
      
      // Only now expose the db to the rest of the app
      setDatabaseInstance(db);

      // Enable foreign keys
      await db.execAsync("PRAGMA foreign_keys = ON;");
      
      console.log("Database: Successfully initialized.");
      return db;
    } catch (error) {
      console.error("Database initialization error:", error);
      throw new Error(`Failed to initialize database: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Gets the current active database connection.
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  return getConnectionDb();
}

// ─── Zustand Compatibility Layer ─────────────────────────────────────

/**
 * Compatibility alias for app startup.
 */
export async function initDatabase(): Promise<void> {
  await initializeDatabase();
}

/**
 * Mapper: Database Row -> Domain Subscription model (Zustand store format)
 */
function mapDbToSubscription(dbSub: DbSubscription): Subscription {
  const rawCycle = dbSub.billingCycle?.toLowerCase() || "monthly";
  let parsedCycle: any = rawCycle;
  let customMonths: number | undefined = undefined;

  if (rawCycle.startsWith("custom:")) {
    parsedCycle = "custom";
    const parts = rawCycle.split(":");
    const val = Number(parts[1]) || 1;
    const unit = parts[2] || "months";
    if (unit === "days") {
      customMonths = val / 30;
    } else if (unit === "weeks") {
      customMonths = (val * 7) / 30;
    } else if (unit === "months") {
      customMonths = val;
    } else if (unit === "years") {
      customMonths = val * 12;
    }
  } else if (rawCycle === "custom") {
    customMonths = 1;
  }

  return {
    id: dbSub.id,
    name: dbSub.name,
    color: dbSub.brandColor || "#007AFF",
    logoUrl: dbSub.logo || undefined,
    price: dbSub.price || 0,
    currency: dbSub.currency || "USD",
    billingCycle: parsedCycle,
    customIntervalMonths: customMonths,
    rawBillingCycle: dbSub.billingCycle || undefined,
    nextBillingDate: dbSub.isTrial === 1 ? (dbSub.trialEndDate || "") : (dbSub.renewDate || dbSub.trialEndDate || ""),
    category: (dbSub.category?.toLowerCase() || "other") as any,
    reminderEnabled: dbSub.reminderEnabled === 1,
    reminderDays: dbSub.reminderDays,
    note: dbSub.notes || undefined,
    
    // Extensions
    isTrial: dbSub.isTrial === 1,
    trialStartDate: dbSub.trialStartDate || undefined,
    trialEndDate: dbSub.trialEndDate || undefined,
    startDate: dbSub.startDate || undefined,
    paymentMethod: dbSub.paymentMethod || undefined,
    website: dbSub.website || undefined,

    // Splitting
    splitEnabled: dbSub.splitEnabled === 1,
    splitType: dbSub.splitType as any || undefined,
    splitValue: dbSub.splitValue || undefined,

    // Promo
    promoEnabled: dbSub.promoEnabled === 1,
    promoPrice: dbSub.promoPrice || undefined,
    promoDurationValue: dbSub.promoDurationValue || undefined,
    promoDurationUnit: dbSub.promoDurationUnit as any || undefined,
    promoStartDate: dbSub.promoStartDate || undefined,
    promoEndDate: dbSub.promoEndDate || undefined,

    createdAt: dbSub.createdAt,
    updatedAt: dbSub.updatedAt,
  };
}

/**
 * Mapper: Domain Input model -> Database Row inputs
 */
function mapDomainToDb(id: string, input: NewSubscriptionInput): Omit<DbSubscription, "createdAt" | "updatedAt"> {
  // Store the full raw billing cycle string so custom/bi-weekly/semi-yearly survive round-trips
  const rawBillingCycle = input.rawBillingCycle || input.billingCycle;
  
  return {
    id,
    name: input.name,
    logo: input.logoUrl || null,
    website: input.website || null,
    category: input.category,
    price: input.price,
    currency: input.currency,
    billingCycle: rawBillingCycle,
    isTrial: input.isTrial ? 1 : 0,
    trialStartDate: input.trialStartDate || null,
    trialEndDate: input.trialEndDate || null,
    renewDate: input.isTrial ? null : input.nextBillingDate,
    startDate: input.startDate || null,
    paymentMethod: input.paymentMethod || null,
    brandColor: input.color,
    notes: input.note || null,
    reminderEnabled: input.reminderEnabled ? 1 : 0,
    reminderDays: input.reminderDays,
    splitEnabled: input.splitEnabled ? 1 : 0,
    splitType: input.splitType || null,
    splitValue: input.splitValue || null,
    promoEnabled: input.promoEnabled ? 1 : 0,
    promoPrice: input.promoPrice || null,
    promoDurationValue: input.promoDurationValue || null,
    promoDurationUnit: input.promoDurationUnit || null,
    promoStartDate: input.promoStartDate || null,
    promoEndDate: input.promoEndDate || null,
  };
}

/**
 * Fetches all subscriptions in the store's domain format.
 */
export async function getAllSubscriptions(): Promise<Subscription[]> {
  const dbSubs = await dbGetAllSubscriptions();
  return dbSubs.map(mapDbToSubscription);
}

/**
 * Inserts a new subscription in the store's domain format.
 */
export async function insertSubscription(
  id: string,
  input: NewSubscriptionInput
): Promise<Subscription> {
  const dbInput = mapDomainToDb(id, input);
  const createdDb = await dbCreateSubscription(dbInput);
  return mapDbToSubscription(createdDb);
}

/**
 * Updates an existing subscription in the store's domain format.
 */
export async function updateSubscription(
  id: string,
  input: Partial<NewSubscriptionInput>
): Promise<void> {
  const dbUpdates: Partial<Omit<DbSubscription, "id" | "createdAt" | "updatedAt">> = {};
  
  if (input.name !== undefined) dbUpdates.name = input.name;
  if (input.logoUrl !== undefined) dbUpdates.logo = input.logoUrl;
  if (input.price !== undefined) dbUpdates.price = input.price;
  if (input.currency !== undefined) dbUpdates.currency = input.currency;
  if (input.billingCycle !== undefined) dbUpdates.billingCycle = input.rawBillingCycle || input.billingCycle;
  if (input.isTrial !== undefined) dbUpdates.isTrial = input.isTrial ? 1 : 0;
  
  if (input.nextBillingDate !== undefined) {
    if (input.isTrial === true) {
      dbUpdates.trialEndDate = input.nextBillingDate;
    } else if (input.isTrial === false) {
      dbUpdates.renewDate = input.nextBillingDate;
    } else {
      // isTrial not in update payload — check what we already have
      if (dbUpdates.isTrial === 1) {
        dbUpdates.trialEndDate = input.nextBillingDate;
      } else {
        dbUpdates.renewDate = input.nextBillingDate;
      }
    }
  }
  
  if (input.color !== undefined) dbUpdates.brandColor = input.color;
  if (input.category !== undefined) dbUpdates.category = input.category;
  if (input.note !== undefined) dbUpdates.notes = input.note;
  if (input.reminderEnabled !== undefined) dbUpdates.reminderEnabled = input.reminderEnabled ? 1 : 0;
  if (input.reminderDays !== undefined) dbUpdates.reminderDays = input.reminderDays;
  if (input.trialStartDate !== undefined) dbUpdates.trialStartDate = input.trialStartDate;
  if (input.trialEndDate !== undefined) dbUpdates.trialEndDate = input.trialEndDate;
  if (input.startDate !== undefined) dbUpdates.startDate = input.startDate;
  if (input.paymentMethod !== undefined) dbUpdates.paymentMethod = input.paymentMethod;
  if (input.website !== undefined) dbUpdates.website = input.website;
  
  if (input.splitEnabled !== undefined) dbUpdates.splitEnabled = input.splitEnabled ? 1 : 0;
  if (input.splitType !== undefined) dbUpdates.splitType = input.splitType;
  if (input.splitValue !== undefined) dbUpdates.splitValue = input.splitValue;
  if (input.promoEnabled !== undefined) dbUpdates.promoEnabled = input.promoEnabled ? 1 : 0;
  if (input.promoPrice !== undefined) dbUpdates.promoPrice = input.promoPrice;
  if (input.promoDurationValue !== undefined) dbUpdates.promoDurationValue = input.promoDurationValue;
  if (input.promoDurationUnit !== undefined) dbUpdates.promoDurationUnit = input.promoDurationUnit;
  if (input.promoStartDate !== undefined) dbUpdates.promoStartDate = input.promoStartDate;
  if (input.promoEndDate !== undefined) dbUpdates.promoEndDate = input.promoEndDate;

  await dbUpdateSubscription(id, dbUpdates);
}

/**
 * Deletes a subscription by ID.
 */
export async function deleteSubscription(id: string): Promise<void> {
  await dbDeleteSubscription(id);
}

/**
 * Wipes the entire subscriptions table.
 */
export async function deleteAllSubscriptions(): Promise<void> {
  await dbDeleteAllSubscriptions();
}
