import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import AsyncStorage from "@/utils/storage";
import { getDatabase } from "@/database/database";
import {
  useExpenseStore,
  recomputeAllAccountsHelper,
  INITIAL_CATEGORIES,
  isSystemCategory,
  monthKeyOf,
} from "@/store/useExpenseStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import type {
  ExpenseAccount,
  ExpenseTransaction,
  ExpenseCategory,
  SavingsVault,
  EventFolder,
  QuickExpensePreset,
} from "@/types/expense";

/**
 * Portable backup that survives a reinstall.
 *
 * Captures 100% of app data:
 * - Bank accounts with opening balances, due amounts, billing days
 * - Transactions (expenses, incomes, transfers, debts lend/borrow, vault deposits/withdrawals)
 * - Event and trip folders
 * - Debt tracking & split bill breakdowns with friend shares and settlement states
 * - Savings vaults and goals
 * - Categories and budgets
 * - Subscriptions & recurring commitments
 * - User personalization & settings
 */

const BACKUP_VERSION = 3;

/** Tables in SQLite subscriptions.db */
const TABLES = ["subscriptions", "transactions"] as const;
type Table = (typeof TABLES)[number];

/**
 * Every AsyncStorage key this app owns.
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
] as const;

/** Device-local sync bookkeeping: never backed up, cleared on restore so the next sync rebuilds it. */
const SYNC_LOCAL_KEYS = ["@expense_shared_remote_ids_v2", "@expense_shared_pending_deletes_v1"] as const;

export interface BackupSummary {
  subscriptions: number;
  transactions: number;
  accounts: number;
  folders: number;
  vaults: number;
  settings: number;
}

export interface BackupPayload {
  version: number;
  createdAt: string;
  app: string;
  subscriptions: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  expenseData?: {
    accounts: ExpenseAccount[];
    transactions: ExpenseTransaction[];
    categories: ExpenseCategory[];
    savingsVaults: SavingsVault[];
    eventFolders: EventFolder[];
    quickPresets: QuickExpensePreset[];
    categoryBudgets: Record<string, number>;
    monthlyBudget: number;
    currencyCode: string;
    currencySymbol: string;
    learnedMerchantRules?: Record<string, string>;
    hasSeenWalkthrough?: boolean;
    statementSetup?: Record<string, unknown>;
    selectedMonth?: string;
    themeMode?: string;
    ruleCount?: number;
  };
  settings?: Record<string, unknown>;
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

  // Capture current live in-memory expense state directly
  const expenseState = useExpenseStore.getState();
  const expenseData = {
    accounts: expenseState.accounts || [],
    transactions: expenseState.transactions || [],
    categories: expenseState.categories || [],
    savingsVaults: expenseState.savingsVaults || [],
    eventFolders: expenseState.eventFolders || [],
    quickPresets: expenseState.quickPresets || [],
    categoryBudgets: expenseState.categoryBudgets || {},
    monthlyBudget: expenseState.monthlyBudget || 0,
    currencyCode: expenseState.currencyCode || "INR",
    currencySymbol: expenseState.currencySymbol || "₹",
    learnedMerchantRules: expenseState.learnedMerchantRules || {},
    hasSeenWalkthrough: expenseState.hasSeenWalkthrough ?? true,
    statementSetup: (expenseState.statementSetup as unknown as Record<string, unknown>) || {},
    selectedMonth: expenseState.selectedMonth,
    themeMode: expenseState.themeMode,
    ruleCount: expenseState.ruleCount,
  };

  // Capture current settings state directly
  const settingsState = useSettingsStore.getState();
  const settings = {
    userName: settingsState.userName,
    userEmail: settingsState.userEmail,
    userTagline: settingsState.userTagline,
    userAvatarId: settingsState.userAvatarId,
    currencyCode: settingsState.currencyCode,
    appearance: settingsState.appearance,
    notificationsEnabled: settingsState.notificationsEnabled,
    notificationTiming: settingsState.notificationTiming,
    dailyExpenseReminderEnabled: settingsState.dailyExpenseReminderEnabled,
    afternoonReminderEnabled: settingsState.afternoonReminderEnabled,
    afternoonReminderTime: settingsState.afternoonReminderTime,
    nightReminderEnabled: settingsState.nightReminderEnabled,
    nightReminderTime: settingsState.nightReminderTime,
    billDueReminderEnabled: settingsState.billDueReminderEnabled,
    subscriptionReminderEnabled: settingsState.subscriptionReminderEnabled,
    faceIdEnabled: settingsState.faceIdEnabled,
    analyticsEnabled: settingsState.analyticsEnabled,
    crashReportsEnabled: settingsState.crashReportsEnabled,
    shortcutSaved: settingsState.shortcutSaved,
    customCategories: settingsState.customCategories,
  };

  const async: Record<string, string | null> = {};
  for (const key of ASYNC_KEYS) {
    async[key] = await AsyncStorage.getItem(key);
  }

  // Ensure @expense_data_v1 and @expense_settings_v3 contain the freshest state
  async["@expense_data_v1"] = JSON.stringify({ state: expenseData, version: 0 });
  // Merge over the stored blob so keys not listed above (shareGroups, autoTrack*, pendingTransactions) survive.
  let storedSettings: Record<string, unknown> = {};
  try {
    storedSettings = JSON.parse(async["@expense_settings_v3"] || "{}") || {};
  } catch {}
  async["@expense_settings_v3"] = JSON.stringify({ ...storedSettings, ...settings });

  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    app: "cashveil",
    subscriptions,
    transactions,
    expenseData,
    settings,
    async,
  };
}

function summarise(payload: BackupPayload): BackupSummary {
  let txCount = 0;
  let accCount = 0;
  let folderCount = 0;
  let vaultCount = 0;

  if (payload.expenseData) {
    txCount = payload.expenseData.transactions?.length || 0;
    accCount = payload.expenseData.accounts?.length || 0;
    folderCount = payload.expenseData.eventFolders?.length || 0;
    vaultCount = payload.expenseData.savingsVaults?.length || 0;
  } else if (payload.async?.["@expense_data_v1"]) {
    try {
      const parsed = JSON.parse(payload.async["@expense_data_v1"]);
      const s = parsed.state || parsed;
      txCount = s.transactions?.length || 0;
      accCount = s.accounts?.length || 0;
      folderCount = s.eventFolders?.length || 0;
      vaultCount = s.savingsVaults?.length || 0;
    } catch {}
  } else if (Array.isArray(payload.transactions)) {
    txCount = payload.transactions.length;
  }

  return {
    subscriptions: payload.subscriptions?.length || 0,
    transactions: txCount,
    accounts: accCount,
    folders: folderCount,
    vaults: vaultCount,
    settings: Object.values(payload.async || {}).filter((v) => v !== null).length,
  };
}

/**
 * Writes the backup to a temp file and opens the share sheet so the user can put
 * it somewhere that outlives the app (Drive, iCloud, WhatsApp, email, Files).
 */
export async function exportBackup(): Promise<BackupSummary> {
  const payload = await buildBackupPayload();
  const summary = summarise(payload);

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `cashveil-full-backup-${stamp}.json`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Sharing is not available on this device.");
    }

    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      dialogTitle: "Save your Cashveil complete backup",
      UTI: "public.json",
    });

    return summary;
  } finally {
    // Delayed so a share target still reading the file doesn't race the delete; the OS also purges cache.
    setTimeout(() => {
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }, 60_000);
  }
}

/** Values SQLite will accept as bound parameters. */
type BindValue = string | number | null | boolean | Uint8Array;

const ALLOWED_COLUMNS: Record<Table, string[]> = {
  subscriptions: [
    "id", "name", "logo", "website", "category", "price", "currency", 
    "billingCycle", "isTrial", "trialStartDate", "trialEndDate", 
    "renewDate", "startDate", "paymentMethod", "brandColor", "notes", 
    "reminderEnabled", "reminderDays", "splitEnabled", "splitType", 
    "splitValue", "promoEnabled", "promoPrice", "promoDurationValue", 
    "promoDurationUnit", "promoStartDate", "promoEndDate", "isPaused", 
    "logoStyle", "originalLogo", "logoIcon", "logoImage", "serviceId", 
    "brandVariant", "isShared", "sharedGroupId", "createdAt", "updatedAt"
  ],
  transactions: [
    "id", "subscriptionId", "amount", "currency", "date", "createdAt"
  ]
};

function buildInsert(table: Table, row: Record<string, unknown>): {
  sql: string;
  params: BindValue[];
} | null {
  const allowed = ALLOWED_COLUMNS[table];
  const columns = Object.keys(row).filter(c => allowed.includes(c));
  if (columns.length === 0) return null;
  const placeholders = columns.map(() => "?").join(", ");
  const quotedColumns = columns.map(c => `"${c}"`).join(", ");
  return {
    sql: `INSERT OR REPLACE INTO ${table} (${quotedColumns}) VALUES (${placeholders})`,
    params: columns.map((c) => (row[c] !== undefined ? (row[c] as BindValue) : null)),
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
  if (p.version > 10) {
    throw new Error(
      `That backup was made by a newer version of the app (v${p.version}). Update the app first.`
    );
  }
  if (!Array.isArray(p.subscriptions) && !p.expenseData && !p.async) {
    throw new Error("That backup is missing its data tables.");
  }
  // Shape checks run before anything is wiped, so a malformed file can't leave us half-restored.
  const isRows = (v: unknown) => v === undefined || (Array.isArray(v) && v.every((r) => typeof r === "object" && r !== null));
  const e = p.expenseData as Record<string, unknown> | undefined;
  if (
    !isRows(p.subscriptions) ||
    !isRows(p.transactions) ||
    (e !== undefined && (typeof e !== "object" || e === null || !isRows(e.accounts) || !isRows(e.transactions)))
  ) {
    throw new Error("That backup file is damaged, so nothing was restored.");
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
 * Replaces current data with the contents of a backup.
 * Restores SQLite subscriptions, restores all AsyncStorage keys,
 * and immediately rehydrates live in-memory Zustand stores!
 */
/** A file that holds no data at all must not wipe the current data. */
function assertHasUsableData(p: BackupPayload): void {
  const hasRows = (Array.isArray(p.subscriptions) && p.subscriptions.length > 0) || (Array.isArray(p.transactions) && p.transactions.length > 0);
  const hasExpense = !!p.expenseData && (((p.expenseData as any).transactions?.length ?? 0) > 0 || ((p.expenseData as any).accounts?.length ?? 0) > 0);
  const hasAsync = Object.values(p.async ?? {}).some((v) => v !== null && v !== undefined);
  if (!hasRows && !hasExpense && !hasAsync) {
    throw new Error("That backup is empty, so nothing was restored.");
  }
}

/**
 * Saves the current data to a file before a restore overwrites it, so a wrong restore can be undone.
 * Keeps the last 3. A failure here is logged but does not block the restore.
 */
async function snapshotBeforeRestore(): Promise<void> {
  try {
    const dir = `${FileSystem.documentDirectory}restore-snapshots/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const payload = await buildBackupPayload();
    await FileSystem.writeAsStringAsync(`${dir}before-restore-${stamp}.json`, JSON.stringify(payload), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const files = (await FileSystem.readDirectoryAsync(dir)).filter((f) => f.startsWith("before-restore-")).sort();
    for (const old of files.slice(0, Math.max(0, files.length - 3))) {
      await FileSystem.deleteAsync(`${dir}${old}`, { idempotent: true }).catch(() => {});
    }
  } catch (e) {
    console.warn("Could not save a pre-restore snapshot:", e);
  }
}

export async function importBackup(): Promise<BackupSummary> {
  const payload = await readPickedFile();
  assertHasUsableData(payload);
  await snapshotBeforeRestore();
  const db = getDatabase();

  // 1. Restore SQLite subscriptions & subscription logs safely
  await db.runAsync("PRAGMA foreign_keys = OFF;").catch(() => {});
  try {
    await db.withExclusiveTransactionAsync(async () => {
      // Only replace a table when the backup actually has rows for it; an empty or missing list leaves current data alone
      const hasSubs = Array.isArray(payload.subscriptions) && payload.subscriptions.length > 0;
      const hasTxs = Array.isArray(payload.transactions) && payload.transactions.length > 0;
      if (hasTxs || hasSubs) await db.runAsync("DELETE FROM transactions;");
      if (hasSubs) await db.runAsync("DELETE FROM subscriptions;");

      if (Array.isArray(payload.subscriptions)) {
        for (const row of payload.subscriptions) {
          const ins = buildInsert("subscriptions", row);
          if (ins) await db.runAsync(ins.sql, ins.params);
        }
      }
      if (Array.isArray(payload.transactions)) {
        for (const row of payload.transactions) {
          const ins = buildInsert("transactions", row);
          if (ins) await db.runAsync(ins.sql, ins.params);
        }
      }
    });
  } finally {
    await db.runAsync("PRAGMA foreign_keys = ON;").catch(() => {});
  }

  // 2. Extract and resolve expenseData (with legacy fallback)
  let expData = payload.expenseData;
  if (!expData && (payload.async?.["@expense_data_v1"] || payload.async?.["@legacy_expense_v1"])) {
    try {
      const raw = payload.async?.["@expense_data_v1"] || payload.async?.["@legacy_expense_v1"];
      if (raw) {
        const parsed = JSON.parse(raw);
        expData = parsed.state || parsed;
      }
    } catch {}
  }

  // 3. Restore all AsyncStorage keys (settings are merged in step 5, so keep the current blob for it)
  const existingSettingsRaw = await AsyncStorage.getItem("@expense_settings_v3");
  for (const [key, value] of Object.entries(payload.async ?? {})) {
    if (value === null || value === undefined) continue;
    if (!(ASYNC_KEYS as readonly string[]).includes(key)) continue;
    if (key === "@expense_settings_v3") continue;
    await AsyncStorage.setItem(key, value);
  }
  for (const key of SYNC_LOCAL_KEYS) {
    await AsyncStorage.removeItem(key).catch(() => {});
  }

  // If payload had expenseData directly, ensure @expense_data_v1 is populated
  if (expData) {
    // 4. Immediately hydrate useExpenseStore in-memory with category migration and balance reconciliation!
    const importedCats = expData.categories || [];
    let mergedCategories: ExpenseCategory[];
    if (importedCats.length > 0) {
      // Preserve the user's exact category order, custom categories, icons, and colors!
      mergedCategories = [...importedCats];
      // Only append missing system categories (like cat_subs, cat_goal, etc.)
      INITIAL_CATEGORIES.forEach((ic) => {
        if (isSystemCategory(ic.id) && !mergedCategories.some((c) => c.id === ic.id)) {
          mergedCategories.push(ic);
        }
      });
    } else {
      mergedCategories = [...INITIAL_CATEGORIES];
    }

    // Determine the target month for account activity calculation and initial dashboard view:
    // 1. If payload explicitly specified selectedMonth, use it
    // 2. Otherwise, check the most recent transaction date
    // 3. Fallback to current calendar month
    let targetMonth: string | undefined = expData.selectedMonth as string | undefined;
    if (!targetMonth && Array.isArray(expData.transactions) && expData.transactions.length > 0) {
      const sortedDates = (expData.transactions as ExpenseTransaction[])
        .map((t) => t.date)
        .filter(Boolean)
        .sort()
        .reverse();
      if (sortedDates[0]) {
        targetMonth = monthKeyOf(new Date(sortedDates[0]));
      }
    }
    if (!targetMonth) {
      targetMonth = monthKeyOf(new Date());
    }

    const recomputedAccounts = recomputeAllAccountsHelper(
      expData.accounts || [],
      expData.transactions || [],
      targetMonth
    );

    await AsyncStorage.setItem(
      "@expense_data_v1",
      JSON.stringify({
        state: {
          ...expData,
          categories: mergedCategories,
          selectedMonth: targetMonth,
        },
        version: 0,
      })
    );

    useExpenseStore.setState({
      accounts: recomputedAccounts,
      transactions: expData.transactions || [],
      categories: mergedCategories,
      savingsVaults: expData.savingsVaults || [],
      eventFolders: expData.eventFolders || [],
      quickPresets: expData.quickPresets || [],
      categoryBudgets: expData.categoryBudgets || {},
      monthlyBudget: expData.monthlyBudget || 0,
      currencyCode: expData.currencyCode || "INR",
      currencySymbol: expData.currencySymbol || "₹",
      learnedMerchantRules: expData.learnedMerchantRules || {},
      hasSeenWalkthrough: expData.hasSeenWalkthrough ?? true,
      statementSetup: (expData.statementSetup as any) || {
        hasImported: true,
        openingBalancesConfigured: true,
        budgetConfigured: true,
      },
      selectedMonth: targetMonth,
      themeMode: (expData.themeMode as any) || "dark",
      ruleCount: (expData.ruleCount as number) || 0,
      selectedTransactionIds: [],
      activeAccountFilter: "All",
      smartSearchQuery: "",
    });
  }

  // 5. Restore settings if present
  {
    let incoming: Record<string, unknown> | undefined = payload.settings;
    if (!incoming && payload.async?.["@expense_settings_v3"]) {
      try {
        incoming = JSON.parse(payload.async["@expense_settings_v3"]);
      } catch {}
    }
    if (incoming && typeof incoming === "object") {
      let existing: Record<string, unknown> = {};
      try {
        existing = JSON.parse(existingSettingsRaw || "{}") || {};
      } catch {}
      // Device-bound state (joined groups, queued auto-tracked items) stays as it is on this device.
      const { shareGroups: _g, shareGroup: _g1, pendingTransactions: _p, ...rest } = incoming as Record<string, unknown>;
      await AsyncStorage.setItem("@expense_settings_v3", JSON.stringify({ ...existing, ...rest }));
    }
  }

  // 6. Immediately rehydrate Zustand in-memory stores
  try {
    await useSubscriptionStore.getState().loadSubscriptions();
  } catch (e) {
    console.warn("Failed to reload subscriptions after backup import:", e);
  }

  try {
    await useSettingsStore.getState().loadSettings();
  } catch (e) {
    console.warn("Failed to reload settings after backup import:", e);
  }

  return summarise(payload);
}
