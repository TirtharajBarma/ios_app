import type { SQLiteDatabase } from "expo-sqlite";
import { CREATE_TABLES_SQL, CREATE_INDEXES_SQL } from "./schema";
import { services, type Service } from "@/assets/data/services";

const SCHEMA_VERSION = 6;

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
  "logoStyle",
  "originalLogo",
  "logoIcon",
  "logoImage",
  "serviceId",
  "brandVariant",
  "isShared",
  "sharedGroupId",
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
  logoStyle: "'badge'",
  originalLogo: "NULL",
  logoIcon: "NULL",
  logoImage: "NULL",
  serviceId: "NULL",
  brandVariant: "NULL",
  isShared: "0",
  sharedGroupId: "NULL",
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

    if (currentVersion < 3) {
      console.log("Database: Running migration to version 3 (logo source columns)...");

      await db.execAsync("BEGIN TRANSACTION;");
      try {
        await ensureColumns(db);

        // Preserve each row's original service logo so "Original" stays
        // available forever. Only real logo sources qualify — the icon:/
        // file:/ph:/content: prefixes denote user customizations, not originals.
        await db.execAsync(`
          UPDATE subscriptions
          SET originalLogo = logo
          WHERE logo IS NOT NULL
            AND logo != ''
            AND logo NOT LIKE 'icon:%'
            AND logo NOT LIKE 'file:%'
            AND logo NOT LIKE 'ph:%'
            AND logo NOT LIKE 'content:%';
        `);

        // Recover Lucide icons previously stored as "icon:<Name>" strings.
        await db.execAsync(`
          UPDATE subscriptions
          SET logoIcon = substr(logo, 6)
          WHERE logo LIKE 'icon:%';
        `);

        await db.execAsync("COMMIT;");
      } catch (error) {
        await db.execAsync("ROLLBACK;");
        throw error;
      }

      await db.execAsync("PRAGMA user_version = 3;");
      console.log("Database: Successfully migrated to version 3.");
    }

    if (currentVersion < 4) {
      console.log("Database: Running migration to version 4 (brand logo variants)...");

      await db.execAsync("BEGIN TRANSACTION;");
      try {
        await ensureColumns(db);

        // Backfill serviceId / brandVariant from the curated catalog.
        // Best-effort matching: first by the persisted favicon/logo domain,
        // then by the subscription's display name. Non-matching rows keep a
        // NULL serviceId (they render their favicon / custom logo as before).
        const rows = await db.getAllAsync<{
          id: string;
          name: string;
          logo: string | null;
          originalLogo: string | null;
          logoIcon: string | null;
          logoImage: string | null;
        }>(
          "SELECT id, name, logo, originalLogo, logoIcon, logoImage FROM subscriptions;"
        );

        const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
        const domainOfUrl = (url: string | null | undefined): string | null => {
          if (!url) return null;
          const m = url.match(/[?&]domain=([^&]+)/);
          if (m) return m[1].toLowerCase().replace(/^www\./, "");
          try {
            const host = new URL(url).hostname.replace(/^www\./, "");
            return host || null;
          } catch {
            return null;
          }
        };
        const findService = (row: {
          name: string;
          logo: string | null;
          originalLogo: string | null;
        }): Service | undefined => {
          const faviconDomain = domainOfUrl(row.originalLogo || row.logo);
          if (faviconDomain) {
            const found = services.find(
              (s) => s.website && normalize(s.website) === faviconDomain
            );
            if (found) return found;
          }
          const nameNorm = normalize(row.name || "");
          return services.find((s) => normalize(s.name) === nameNorm) ?? undefined;
        };

        let updated = 0;
        for (const row of rows) {
          // Rows carrying a custom override (icon or picked image) stay
          // unassociated — brand association must never change how a user's
          // custom logo renders. The `logo` column is left untouched.
          if (row.logoIcon || row.logoImage) continue;
          const matched = findService(row);
          if (!matched) continue;
          await db.runAsync(
            "UPDATE subscriptions SET serviceId = ?, brandVariant = ? WHERE id = ?;",
            matched.id,
            "primary",
            row.id
          );
          updated += 1;
        }

        console.log(`Database: v4 backfill associated ${updated} subscription(s) with catalog brands.`);
        await db.execAsync("COMMIT;");
      } catch (error) {
        await db.execAsync("ROLLBACK;");
        throw error;
      }

      await db.execAsync("PRAGMA user_version = 4;");
      console.log("Database: Successfully migrated to version 4.");
    }

    if (currentVersion < 5) {
      console.log("Database: Running migration to version 5 (shared subscriptions)...");

      await db.execAsync("BEGIN TRANSACTION;");
      try {
        await ensureColumns(db);
        await db.execAsync("COMMIT;");
      } catch (error) {
        await db.execAsync("ROLLBACK;");
        throw error;
      }

      await db.execAsync("PRAGMA user_version = 5;");
      console.log("Database: Successfully migrated to version 5.");
    }

    if (currentVersion < 6) {
      console.log("Database: Running migration to version 6 (multi-group sharing)...");

      await db.execAsync("BEGIN TRANSACTION;");
      try {
        await ensureColumns(db);
        await db.execAsync("COMMIT;");
      } catch (error) {
        await db.execAsync("ROLLBACK;");
        throw error;
      }

      await db.execAsync("PRAGMA user_version = 6;");
      console.log("Database: Successfully migrated to version 6.");
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
