import type { SQLiteDatabase } from "expo-sqlite";
import { CREATE_TABLES_SQL, CREATE_INDEXES_SQL } from "./schema";

const SCHEMA_VERSION = 2;

/** Columns that must exist for the current app version. */
const REQUIRED_COLUMNS = [
  "isTrial",
  "trialStartDate",
  "trialEndDate",
  "startDate",
  "paymentMethod",
  "brandColor",
  "notes",
  "reminderEnabled",
  "reminderDays",
  "website",
  "splitEnabled",
  "splitType",
  "splitValue",
  "promoEnabled",
  "promoPrice",
  "promoDurationValue",
  "promoDurationUnit",
  "promoStartDate",
  "promoEndDate",
  "isPaused",
];

/** SQLite ALTER TABLE column defaults by column name. */
const COLUMN_DEFAULTS: Record<string, string> = {
  isTrial: "0",
  trialStartDate: "NULL",
  trialEndDate: "NULL",
  startDate: "NULL",
  paymentMethod: "NULL",
  brandColor: "NULL",
  notes: "NULL",
  reminderEnabled: "0",
  reminderDays: "0",
  website: "NULL",
  splitEnabled: "0",
  splitType: "NULL",
  splitValue: "NULL",
  promoEnabled: "0",
  promoPrice: "NULL",
  promoDurationValue: "NULL",
  promoDurationUnit: "NULL",
  promoStartDate: "NULL",
  promoEndDate: "NULL",
  isPaused: "0",
};

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  try {
    const result = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
    const currentVersion = result?.user_version ?? 0;

    console.log(`Database: Current schema version is ${currentVersion}. Target version is ${SCHEMA_VERSION}.`);

    if (currentVersion >= SCHEMA_VERSION) {
      await db.execAsync("BEGIN TRANSACTION;");
      try {
        await ensureColumns(db);
        await db.execAsync("COMMIT;");
      } catch (err) {
        await db.execAsync("ROLLBACK;");
        throw err;
      }
      console.log("Database: Schema is up-to-date. No migrations needed.");
      return;
    }

    // Run migrations sequentially
    if (currentVersion < 1) {
      console.log("Database: Running migration to version 1...");

      await db.execAsync("BEGIN TRANSACTION;");
      try {
        // Check if table exists at all
        const tableExists = await db.getFirstAsync<{ cnt: number }>(
          "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='subscriptions';"
        );

        if (tableExists && tableExists.cnt > 0) {
          // Table exists — safely add missing columns instead of dropping
          await ensureColumns(db);
        } else {
          // No table at all — create it fresh
          await db.execAsync(CREATE_TABLES_SQL);
          await db.execAsync(CREATE_INDEXES_SQL);
        }
        await db.execAsync("COMMIT;");
      } catch (error) {
        await db.execAsync("ROLLBACK;");
        throw error;
      }

      await db.execAsync("PRAGMA user_version = 1;");
      console.log("Database: Successfully migrated to version 1.");
    }

    if (currentVersion < 2) {
      console.log("Database: Running migration to version 2 (creating transactions table)...");

      await db.execAsync("BEGIN TRANSACTION;");
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            subscriptionId TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            date TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY(subscriptionId) REFERENCES subscriptions(id) ON DELETE CASCADE
          );
        `);
        await db.execAsync("CREATE INDEX IF NOT EXISTS idx_transactions_sub_id ON transactions(subscriptionId);");
        await db.execAsync("COMMIT;");
      } catch (error) {
        await db.execAsync("ROLLBACK;");
        throw error;
      }

      await db.execAsync("PRAGMA user_version = 2;");
      console.log("Database: Successfully migrated to version 2.");
    }
  } catch (error) {
    console.error("Database migration error:", error);
    throw new Error(`Failed to migrate database: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

/**
 * Safely add any missing columns to the subscriptions table.
 * Uses ALTER TABLE ADD COLUMN which is non-destructive — existing data is preserved.
 */
async function ensureColumns(db: SQLiteDatabase): Promise<void> {
  const tableInfo = await db.getAllAsync<{ name: string }>("PRAGMA table_info(subscriptions);");
  const existingColumns = new Set(tableInfo.map((col) => col.name));

  for (const col of REQUIRED_COLUMNS) {
    if (!existingColumns.has(col)) {
      const defaultVal = COLUMN_DEFAULTS[col] ?? "NULL";
      console.log(`Database: Adding missing column '${col}' (default: ${defaultVal})`);
      if (defaultVal === "NULL") {
        await db.execAsync(`ALTER TABLE subscriptions ADD COLUMN ${col};`);
      } else {
        await db.execAsync(`ALTER TABLE subscriptions ADD COLUMN ${col} NOT NULL DEFAULT ${defaultVal};`);
      }
    }
  }
}
