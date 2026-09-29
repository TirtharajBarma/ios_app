import { useExpenseStore } from '@/store/useExpenseStore';

/**
 * Single entry point for creating an expense transaction.
 *
 * Every write path goes through here so the persisted state stays identical:
 * the normal Add Expense modal, the Android Quick Add screen, and the
 * outbox-replay of writes that arrived from the iOS App Intent while the
 * app was terminated.
 *
 * Account balances are not computed here: `addTransaction` updates them
 * incrementally and `persist.merge` re-derives them from `transactions`, so
 * the canonical invariant
 *   accounts === recomputeAllAccounts(accounts, transactions)
 * holds after every write no matter which path created it.
 */
export type CreateExpenseInput = {
  amount: number;
  categoryId: string;
  accountId: string;
  /** `yyyy-MM-dd`. Defaults to today, local time. */
  date?: string;
  merchant?: string;
  note?: string;
  folderId?: string;
  folderName?: string;
  tag?: string;
  subscriptionId?: string;
};

export type CreateExpenseResult =
  | { ok: true; transactionId: string }
  | { ok: false; error: string };

/** Local-time `yyyy-MM-dd` (not UTC, so the day matches the user's calendar). */
export function localISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createExpense(input: CreateExpenseInput): CreateExpenseResult {
  const { getState } = useExpenseStore;
  const state = getState();

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' };
  }

  const accounts = state.accounts;
  if (!accounts || accounts.length === 0) {
    return { ok: false, error: 'Add an account in Settings before recording expenses.' };
  }

  const account = accounts.find((a) => a.id === input.accountId);
  if (!account) {
    return { ok: false, error: 'That account no longer exists. Pick another one.' };
  }

  const categories = state.categories || [];
  let categoryId = input.categoryId;
  if (!categories.some((c) => c.id === categoryId)) {
    // The category was deleted while a form was open — fall back rather than
    // writing a transaction that no category can explain.
    const fallback = categories.find((c) => c.id === 'cat_other') || categories[0];
    if (!fallback) return { ok: false, error: 'No expense categories are available yet.' };
    categoryId = fallback.id;
  }

  const known = new Set(state.transactions.map((t) => t.id));

  state.addTransaction({
    amount,
    type: 'expense',
    categoryId,
    accountId: account.id,
    accountName: account.name,
    folderId: input.folderId,
    folderName: input.folderName,
    date: input.date || localISODate(),
    merchant: input.merchant,
    note: input.note,
    tag: input.tag,
    subscriptionId: input.subscriptionId,
  });

  const created = getState().transactions.find((t) => !known.has(t.id));
  return created
    ? { ok: true, transactionId: created.id }
    : { ok: false, error: 'Could not save the expense. Please try again.' };
}
