import type { SQLiteDatabase } from "expo-sqlite";

let dbInstance: SQLiteDatabase | null = null;

/**
 * Caches the active SQLite database instance.
 */
export function setDatabaseInstance(db: SQLiteDatabase): void {
  dbInstance = db;
}

/**
 * Gets the current active database connection.
 * Throws an error if the database has not been initialized yet.
 */
export function getDatabase(): SQLiteDatabase {
  if (!dbInstance) {
    throw new Error("Database has not been initialized. Call initializeDatabase() first.");
  }
  return dbInstance;
}

/**
 * Checks if the database connection has been established.
 */
export function isDatabaseReady(): boolean {
  return dbInstance !== null;
}
