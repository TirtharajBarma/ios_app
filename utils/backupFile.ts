import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import AsyncStorage from "@/utils/storage";
import { getDatabase } from "@/database/database";

/**
 * Portable backup that survives a reinstall.
 *
 * `utils/backup.ts` writes rolling snapshots into the app sandbox, which Android
 * deletes the moment the app is uninstalled. These helpers are the opposite: the
 * exported file is handed to the user through the share sheet so it lands outside
 * the sandbox, and can be restored into a freshly installed app.
 */

const BACKUP_VERSION = 2;

/** Tables we're allowed to touch. Never build SQL from unvalidated input. */
const TABLES = ["subscriptions", "transactions"] as const;
type Table = (typeof TABLES)[number];

/**
 * Every AsyncStorage key this app owns. Keys are enumerated here rather than
 * dumped via getAllKeys() so we never copy another library's internals.
 */
const ASYNC_KEYS = [
  "@expense_data_v1",
  "@legacy_expense_v1",
  "@expense_settings_v3",
  "@legacy_settings_v3",
  "@legacy_settings_v2",
  "@expense_exchange_rates_v2",
  "@legacy_exchange_rates_v2",
  "@onboarding_complete",
  "@db_cleanup_done_v4",
  "@expense_shared_remote_ids_v2",
  "@expense_shared_pending_deletes_v1",
] as const;

export interface BackupSummary {
  subscriptions: number;
  transactions: number;
  settings: number;
}

export interface BackupPayload {
  version: number;
  createdAt: string;
  app: string;
  subscriptions: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  async: Record<string, string | null>;
}

export async function buildBackupPayload(): Promise<BackupPayload> {
  const db = getDatabase();

  const subscriptions = (await db.getAllAsync(
    "SELECT * FROM subscriptions"
  )) as Record<string, unknown>[];
  const transactions = (await db.getAllAsync(
    "SELECT * FROM transactions"
  )) as Record<string, unknown>[];

  const async: Record<string, string | null> = {};
  for (const key of ASYNC_KEYS) {
    async[key] = await AsyncStorage.getItem(key);
  }

  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    app: "subscription",
    subscriptions,
    transactions,
    async,
  };
}

function summarise(payload: BackupPayload): BackupSummary {
  return {
    subscriptions: payload.subscriptions.length,
    transactions: payload.transactions.length,
    settings: Object.values(payload.async).filter((v) => v !== null).length,
  };
}

/**
 * Writes the backup to a temp file and opens the share sheet so the user can put
 * it somewhere that outlives the app (Drive, WhatsApp, email, Files).
 */
export async function exportBackup(): Promise<BackupSummary> {
  const payload = await buildBackupPayload();
  const summary = summarise(payload);

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `subscription-backup-${stamp}.json`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    dialogTitle: "Save your backup",
    UTI: "public.json",
  });

  return summary;
}

/** Values SQLite will accept as bound parameters. */
type BindValue = string | number | null | boolean | Uint8Array;

function buildInsert(table: Table, row: Record<string, unknown>): {
  sql: string;
  params: BindValue[];
} {
  const columns = Object.keys(row);
  const placeholders = columns.map(() => "?").join(", ");
  return {
    sql: `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
    // Rows come straight out of SQLite, so every value is already bind-safe.
    params: columns.map((c) => row[c] as BindValue),
  };
}

function assertValid(input: unknown): asserts input is BackupPayload {
  if (typeof input !== "object" || input === null) {
    throw new Error("That file isn't a valid backup.");
  }
  const p = input as Partial<BackupPayload>;
  if (typeof p.version !== "number") {
    throw new Error("That file isn't a valid backup.");
  }
  if (p.version > BACKUP_VERSION) {
    throw new Error(
      `That backup was made by a newer version of the app (v${p.version}). Update the app first.`
    );
  }
  if (!Array.isArray(p.subscriptions) || !Array.isArray(p.transactions)) {
    throw new Error("That backup is missing its data tables.");
  }
}

async function readPickedFile(): Promise<BackupPayload> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "public.json", "*/*"],
    copyToCacheDirectory: true,
  });

  if (picked.canceled) {
    throw new Error("cancelled");
  }

  const asset = picked.assets?.[0];
  if (!asset) {
    throw new Error("No file was selected.");
  }

  const raw = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That file couldn't be read as JSON.");
  }

  assertValid(parsed);
  return parsed;
}

/**
 * Replaces current data with the contents of a backup. Subscriptions go in before
 * transactions because of the foreign key with ON DELETE CASCADE.
 */
export async function importBackup(): Promise<BackupSummary> {
  const payload = await readPickedFile();
  const db = getDatabase();

  await db.withExclusiveTransactionAsync(async () => {
    for (const table of TABLES) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    for (const row of payload.subscriptions) {
      const { sql, params } = buildInsert("subscriptions", row);
      await db.runAsync(sql, params);
    }
    for (const row of payload.transactions) {
      const { sql, params } = buildInsert("transactions", row);
      await db.runAsync(sql, params);
    }
  });

  for (const [key, value] of Object.entries(payload.async ?? {})) {
    if (value === null || value === undefined) continue;
    if (!(ASYNC_KEYS as readonly string[]).includes(key)) continue;
    await AsyncStorage.setItem(key, value);
  }

  return summarise(payload);
}
