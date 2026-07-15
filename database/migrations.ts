import type { SQLiteDatabase } from "expo-sqlite";
import { CREATE_TABLES_SQL, CREATE_INDEXES_SQL } from "./schema";

const SCHEMA_VERSION = 1;

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  try {
    // Get the current database schema version
    const result = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
    const currentVersion = result?.user_version ?? 0;

    console.log(`Database: Current schema version is ${currentVersion}. Target version is ${SCHEMA_VERSION}.`);

    if (currentVersion >= SCHEMA_VERSION) {
      // Even if schema version matches, double check columns in case database existed pre-migrations
      try {
        const tableInfo = await db.getAllAsync<{ name: string }>("PRAGMA table_info(subscriptions);");
        if (tableInfo.length > 0) {
          const hasIsTrial = tableInfo.some((col) => col.name === "isTrial");
          if (!hasIsTrial) {
            console.log("Database: Found old schema version on current version. Recreating table...");
            await db.execAsync("DROP TABLE IF EXISTS subscriptions;");
            await db.execAsync(CREATE_TABLES_SQL);
            await db.execAsync(CREATE_INDEXES_SQL);
          }
        }
      } catch (err) {
        console.warn("Database: Schema validation check failed", err);
      }
      
      console.log("Database: Schema is up-to-date. No migrations needed.");
      return;
    }

    // Run migrations sequentially
    if (currentVersion < 1) {
      console.log("Database: Running migration to version 1...");

      // Safety check: if old subscriptions table exists but lacks new 'isTrial' column, recreate it.
      try {
        const tableInfo = await db.getAllAsync<{ name: string }>("PRAGMA table_info(subscriptions);");
        if (tableInfo.length > 0) {
          const hasIsTrial = tableInfo.some((col) => col.name === "isTrial");
          if (!hasIsTrial) {
            console.log("Database: Detected old table schema (missing isTrial column). Recreating table...");
            await db.execAsync("DROP TABLE IF EXISTS subscriptions;");
          }
        }
      } catch (e) {
        console.warn("Database: Failed to check table schema status, proceeding...", e);
      }
      
      // Execute schema creation scripts
      await db.execAsync(CREATE_TABLES_SQL);
      await db.execAsync(CREATE_INDEXES_SQL);
      
      // Update database version
      await db.execAsync("PRAGMA user_version = 1;");
      console.log("Database: Successfully migrated to version 1.");
    }

  } catch (error) {
    console.error("Database migration error:", error);
    throw new Error(`Failed to migrate database: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}
