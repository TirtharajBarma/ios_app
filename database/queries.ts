import { getDatabase } from "./connection";
import type { DbSubscription } from "./schema";

/**
 * Creates a new subscription in the database.
 */
export async function createSubscription(
  sub: Omit<DbSubscription, "createdAt" | "updatedAt">
): Promise<DbSubscription> {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    const sql = `
      INSERT INTO subscriptions (
        id, name, logo, website, category, price, currency, billingCycle,
        isTrial, trialStartDate, trialEndDate, renewDate, startDate,
        paymentMethod, brandColor, notes, reminderEnabled, reminderDays,
        splitEnabled, splitType, splitValue,
        promoEnabled, promoPrice, promoDurationValue, promoDurationUnit, promoStartDate, promoEndDate,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await db.runAsync(
      sql,
      sub.id,
      sub.name,
      sub.logo,
      sub.website,
      sub.category,
      sub.price,
      sub.currency,
      sub.billingCycle,
      sub.isTrial,
      sub.trialStartDate,
      sub.trialEndDate,
      sub.renewDate,
      sub.startDate,
      sub.paymentMethod,
      sub.brandColor,
      sub.notes,
      sub.reminderEnabled,
      sub.reminderDays,
      sub.splitEnabled ?? 0,
      sub.splitType ?? null,
      sub.splitValue ?? null,
      sub.promoEnabled ?? 0,
      sub.promoPrice ?? null,
      sub.promoDurationValue ?? null,
      sub.promoDurationUnit ?? null,
      sub.promoStartDate ?? null,
      sub.promoEndDate ?? null,
      now,
      now
    );

    return {
      ...sub,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    console.error("Database: Failed to create subscription", error);
    throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * Fetches all subscriptions from the database.
 */
export async function getAllSubscriptions(): Promise<DbSubscription[]> {
  try {
    const db = getDatabase();
    const sql = "SELECT * FROM subscriptions ORDER BY name ASC;";
    const rows = await db.getAllAsync<DbSubscription>(sql);
    return rows;
  } catch (error) {
    console.error("Database: Failed to fetch subscriptions", error);
    throw new Error(`Failed to fetch subscriptions: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * Fetches a single subscription by ID. Returns null if not found.
 */
export async function getSubscriptionById(id: string): Promise<DbSubscription | null> {
  try {
    const db = getDatabase();
    const sql = "SELECT * FROM subscriptions WHERE id = ?;";
    const row = await db.getFirstAsync<DbSubscription>(sql, id);
    return row;
  } catch (error) {
    console.error(`Database: Failed to fetch subscription by ID ${id}`, error);
    throw new Error(`Failed to fetch subscription: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * Updates an existing subscription dynamically.
 */
export async function updateSubscription(
  id: string,
  sub: Partial<Omit<DbSubscription, "id" | "createdAt" | "updatedAt">>
): Promise<DbSubscription> {
  try {
    const db = getDatabase();
    const keys = Object.keys(sub);
    
    if (keys.length === 0) {
      const existing = await getSubscriptionById(id);
      if (!existing) throw new Error(`Subscription with ID ${id} not found`);
      return existing;
    }

    const now = new Date().toISOString();
    const setClause = [...keys.map((k) => `${k} = ?`), "updatedAt = ?"].join(", ");
    const values = [...keys.map((k) => (sub as any)[k]), now, id];

    const sql = `UPDATE subscriptions SET ${setClause} WHERE id = ?;`;
    await db.runAsync(sql, ...values);

    const updated = await getSubscriptionById(id);
    if (!updated) {
      throw new Error(`Subscription with ID ${id} not found after update`);
    }
    return updated;
  } catch (error) {
    console.error(`Database: Failed to update subscription ${id}`, error);
    throw new Error(`Failed to update subscription: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * Deletes a subscription by ID. Returns true if successful.
 */
export async function deleteSubscription(id: string): Promise<boolean> {
  try {
    const db = getDatabase();
    const sql = "DELETE FROM subscriptions WHERE id = ?;";
    const result = await db.runAsync(sql, id);
    return result.changes > 0;
  } catch (error) {
    console.error(`Database: Failed to delete subscription ${id}`, error);
    throw new Error(`Failed to delete subscription: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * Wipes the entire subscriptions table. Returns true if successful.
 */
export async function deleteAllSubscriptions(): Promise<boolean> {
  try {
    const db = getDatabase();
    const sql = "DELETE FROM subscriptions;";
    const result = await db.runAsync(sql);
    return result.changes > 0;
  } catch (error) {
    console.error("Database: Failed to delete all subscriptions", error);
    throw new Error(`Failed to clear database: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * Searches subscriptions by name or category.
 */
export async function searchSubscriptions(query: string): Promise<DbSubscription[]> {
  try {
    const db = getDatabase();
    const searchWildcard = `%${query}%`;
    const sql = `
      SELECT * FROM subscriptions 
      WHERE name LIKE ? OR category LIKE ? 
      ORDER BY name ASC;
    `;
    const rows = await db.getAllAsync<DbSubscription>(sql, searchWildcard, searchWildcard);
    return rows;
  } catch (error) {
    console.error(`Database: Failed to search subscriptions with query "${query}"`, error);
    throw new Error(`Failed to search subscriptions: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * Fetches upcoming renewals, sorting trials by trialEndDate and paid plans by renewDate.
 */
export async function getUpcomingRenewals(limit: number = 10): Promise<DbSubscription[]> {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    const sql = `
      SELECT * FROM subscriptions 
      WHERE 
        (isTrial = 1 AND trialEndDate IS NOT NULL AND trialEndDate >= ?)
        OR (isTrial = 0 AND renewDate IS NOT NULL AND renewDate >= ?)
      ORDER BY 
        CASE 
          WHEN isTrial = 1 THEN trialEndDate 
          ELSE renewDate 
        END ASC
      LIMIT ?;
    `;
    const rows = await db.getAllAsync<DbSubscription>(sql, now, now, limit);
    return rows;
  } catch (error) {
    console.error("Database: Failed to fetch upcoming renewals", error);
    throw new Error(`Failed to get upcoming renewals: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}
