import type { SQLiteDatabase } from "expo-sqlite";
import { CREATE_TABLES_SQL, CREATE_INDEXES_SQL } from "./schema";

const SCHEMA_VERSION = 1;

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
};

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  try {
    const result = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
    const currentVersion = result?.user_version ?? 0;

    console.log(`Database: Current schema version is ${currentVersion}. Target version is ${SCHEMA_VERSION}.`);

    if (currentVersion >= SCHEMA_VERSION) {
      // Schema version matches — still verify columns exist (handles pre-migration DBs)
      await ensureColumns(db);
      console.log("Database: Schema is up-to-date. No migrations needed.");
      return;
    }

    // Run migrations sequentially
    if (currentVersion < 1) {
      console.log("Database: Running migration to version 1...");

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

      await db.execAsync("PRAGMA user_version = 1;");
      console.log("Database: Successfully migrated to version 1.");
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
      await db.execAsync(`ALTER TABLE subscriptions ADD COLUMN ${col} ${defaultVal === "NULL" ? "" : `DEFAULT ${defaultVal}`} NOT NULL DEFAULT ${defaultVal};`);
    }
  }
}
