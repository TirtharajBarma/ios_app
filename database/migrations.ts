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
      console.log("Database: Schema is up-to-date. No migrations needed.");
      return;
    }

    // Run migrations sequentially
    if (currentVersion < 1) {
      console.log("Database: Running migration to version 1...");
      
      // Execute schema creation scripts
      await db.execAsync(CREATE_TABLES_SQL);
      await db.execAsync(CREATE_INDEXES_SQL);
      
      // Update database version
      await db.execAsync("PRAGMA user_version = 1;");
      console.log("Database: Successfully migrated to version 1.");
    }

    // Future version migrations can be added here:
    // if (currentVersion < 2) { ... await db.execAsync("PRAGMA user_version = 2;"); }

  } catch (error) {
    console.error("Database migration error:", error);
    throw new Error(`Failed to migrate database: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}
