import { requireOptionalNativeModule } from 'expo';

/**
 * A quick-add expense that the iOS App Intent has already committed to disk.
 *
 * The App Intent writes the persisted state itself (so it works while the app
 * is terminated), then records the operation here as a durable outbox entry.
 * On the next foreground the app drains this log, so a stale in-memory
 * Zustand snapshot can never overwrite a quick add the user already saw
 * confirmed.
 */
export type PendingQuickAddOp = {
  opId: string;
  transactionId: string;
  amount: number;
  categoryId: string;
  accountId: string;
  date: string;
  note?: string;
};

export type ExpenseQuickAddSnapshot = {
  categories: { id: string; name: string }[];
  accounts: { id: string; name: string; type?: string }[];
};

type ExpenseQuickAddModule = {
  /** JSON string of `PendingQuickAddOp[]` that has not been acknowledged yet. */
  getPendingQuickAddsAsync(): Promise<string>;
  ackQuickAddAsync(opId: string): Promise<void>;
  /**
   * Point an outbox entry at a different transaction id. Used when a replay had
   * to create the transaction itself, so a later retry recognises it instead of
   * adding a duplicate.
   */
  setQuickAddTransactionIdAsync(opId: string, transactionId: string): Promise<void>;
  /** JSON string of `ExpenseQuickAddSnapshot`. */
  getExpenseSnapshotAsync(): Promise<string>;
  /** Refreshes iOS App Intents dynamic parameters & queries cache */
  syncShortcutsParametersAsync?(): Promise<void>;
};

let cached: ExpenseQuickAddModule | null | undefined;

function getModule(): ExpenseQuickAddModule | null {
  if (cached === undefined) {
    cached = requireOptionalNativeModule<ExpenseQuickAddModule>('ExpenseQuickAdd') ?? null;
  }
  return cached ?? null;
}

export function isQuickAddNativeAvailable(): boolean {
  return getModule() !== null;
}

export async function getPendingQuickAdds(): Promise<PendingQuickAddOp[]> {
  const mod = getModule();
  if (!mod) return [];
  try {
    const raw = await mod.getPendingQuickAddsAsync();
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingQuickAddOp[]) : [];
  } catch {
    return [];
  }
}

export async function ackQuickAdd(opId: string): Promise<void> {
  const mod = getModule();
  if (!mod) return;
  try {
    await mod.ackQuickAddAsync(opId);
  } catch {
    // A failed ack just means the operation is replayed again, which is safe
    // because replay is keyed on the transaction id.
  }
}

async function setQuickAddTransactionId(opId: string, transactionId: string): Promise<void> {
  const mod = getModule();
  if (!mod) return;
  try {
    await mod.setQuickAddTransactionIdAsync(opId, transactionId);
  } catch {
    // Best effort; see ackQuickAdd.
  }
}

export async function getExpenseQuickAddSnapshot(): Promise<ExpenseQuickAddSnapshot | null> {
  const mod = getModule();
  if (!mod) return null;
  try {
    const raw = await mod.getExpenseSnapshotAsync();
    return raw ? (JSON.parse(raw) as ExpenseQuickAddSnapshot) : null;
  } catch {
    return null;
  }
}

/**
 * Signals iOS App Intents to refresh its cached entities (categories, accounts)
 * across Siri, Spotlight, and Shortcuts.
 */
export async function syncShortcutsParameters(): Promise<void> {
  const mod = getModule();
  if (!mod || !mod.syncShortcutsParametersAsync) return;
  try {
    await mod.syncShortcutsParametersAsync();
  } catch {
    // Best effort on unsupported runtime or platforms
  }
}

/**
 * Drain native quick adds into the Zustand store.
 *
 * Order matters: rehydrate first so the store reflects whatever is on disk
 * (including writes the App Intent already made), then only replay operations
 * whose transaction is genuinely missing, then acknowledge.
 */
export async function drainPendingQuickAdds(): Promise<number> {
  const ops = await getPendingQuickAdds();
  if (ops.length === 0) return 0;

  // Imported lazily to keep this module free of store side effects at import time.
  const { useExpenseStore } = await import('@/store/useExpenseStore');
  const { createExpense } = await import('./createExpense');

  try {
    await useExpenseStore.persist.rehydrate();
  } catch {
    // Fall through: replay below still guarantees the transaction exists.
  }

  const known = new Set(useExpenseStore.getState().transactions.map((t) => t.id));
  let applied = 0;

  for (const op of ops) {
    if (!known.has(op.transactionId)) {
      const result = createExpense({
        amount: op.amount,
        categoryId: op.categoryId,
        accountId: op.accountId,
        date: op.date,
        note: op.note,
      });
      if (result.ok) {
        // The replay created its own id; record it before acking so a retry
        // recognises the transaction instead of adding a second one.
        await setQuickAddTransactionId(op.opId, result.transactionId);
        known.add(result.transactionId);
        applied += 1;
      }
    }
    await ackQuickAdd(op.opId);
  }

  return applied;
}
