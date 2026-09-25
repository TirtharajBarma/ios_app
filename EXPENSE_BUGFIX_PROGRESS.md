# Expense Tracker — Bugfix Progress Tracker

Review report date: 2026-09-25 (see conversation). All fixes below are expense-tracker-scoped. No changes were made during review; changes start here.

Legend: done = fixed & committed to this list; n/a = deliberate decision (documented).

> Status: every `[x]` line below is applied to the codebase and statically verified with `npx tsc --noEmit` (clean). `expo lint` reports only pre-existing `react-hooks/*` Animated-value warnings (245 errors/199 warnings from the existing code, none introduced by these fixes).

## CRITICAL

- [x] **CRIT-1** Missing `logAction` import → ReferenceError on 16+ store actions. (fix: import in `useExpenseStore.ts`)
- [x] **CRIT-2** Import screen fabricates fake transactions (0-parse fallback, PDF/XLSX simulated fallback, receipt photo fake, date-digits-as-amount).
- [x] **CRIT-3** Vault deposit/withdraw revert inflates/deflates balances; `txnCountThisMonth` mismatch.
- [x] **CRIT-4** Hard-coded dates removed: AddTransactionModal defaults, onDeviceAi reference dates, Visualizer year regex.
- [x] **CRIT-5** Store getters scoped to `selectedMonth` (spent/income/breakdown/remaining/overspent/net/safe) so the dashboard is truly monthly.
- [x] **CRIT-6** `partialize` persists `selectedMonth` + previously-dropped keys.

## HIGH

- [x] **HIGH-7** Transfer `toAccountId` (and `nextBillDate`/`billingCycle`) reset when modal opens.
- [x] **HIGH-8** `deleteCategory` reassigns orphan transactions + cleans `categoryBudgets`.
- [x] **HIGH-9** Deleting a settlement income tx unsets `isSettled` on the linked debt tx.
- [x] **HIGH-10** `getOverspentPercentage` div-by-zero guard (no more `Infinity%`).
- [x] **HIGH-11** DatePickerModal syncs `viewYear/viewMonth` to `selectedDate`/`visible`.
- [x] **HIGH-12** `app/settings/data.tsx`: CSV escaping, PDF uses selected currency, row-count/header consistency, real cache clear.
- [x] **HIGH-13** Budget screen save — resolved by CRIT-1 (logAction import).

## MEDIUM

- [x] **MED-14** Settings icon grid shows all `AVAILABLE_ICONS` (no `slice(0,12)`).
- [x] **MED-15** Sign-out / delete-account placeholder rows removed (no auth system exists in expense app).
- [x] **MED-16** Currency switch wrapped with try/catch so a conversion failure can't break the flow.
- [x] **MED-17** Compact currency formatting unified to Indian lakh/crore convention (`1.2L`, `45k`).
- [x] **MED-18** Visualizer: ALL horizon spans real history, sankey % uses horizon total, weekend/day averages use actual day counts, year regex accepts any 4-digit year.
- [x] **MED-19** `executeSmartQuery` memoized per query so it isn't computed twice per render.
- [x] **MED-20** "On-device AI" label made honest (rules engine, not Neural Engine).
- [x] **MED-21** Unique id generation (Date.now + nonce) in store/import paths.

## MINOR

- [x] **MINOR-1** Initial seed transactions/folders use dates relative to today (stay in the current month).
- [x] **MINOR-2** `ExpenseHeader` neutral fallback name instead of hard-coded `'TIRTHARAJ BARMA'`.
- [x] **MINOR-3** `addTransaction` handles `vault_deposit`/`vault_withdraw` (no silent account no-op).
- [x] **MINOR-4** Budget preset chip formatting aligned with lakh/k convention.
- [n/a] **MINOR-5** Full theming for `themeMode` editorial/cream/midnight — expense UI is a single dark palette by design; left as-is (would require a palette system across 18 components). Documented, not changed.
- [n/a] **MINOR-6** Cross-app coupling (AddTransactionModal/Visualizer import `useSubscriptionStore`) — subscription feature out of expense scope; left as-is.

---

## Round 2 — Money-Flow Accounting Audit (debit/credit, lend/borrow, vault, adjustments)

Follow-up audit of `addTransaction` / `removeTransactions` / `settleTransaction` symmetry. Three real bugs found and fixed in `store/useExpenseStore.ts`, all re-verified with `npx tsc --noEmit` (clean):

- [x] **FLOW-1** Deleting an `expense` on a credit/due account left `monthlyChange` permanently low (create did `-amount`, revert omitted `+amount`). Revert now restores `monthlyChange` in the credit branch.
- [x] **FLOW-2** Deleting a `vault_deposit`/`vault_withdraw` on a credit card wrote to `balance` instead of `dueAmount` (create moved `dueAmount`, revert didn't) → identical class to CRIT-3. Revert now mirrors the create side (credit → `dueAmount` ∓, cash → `balance` ±).
- [x] **FLOW-3** `debt_lend` was not credit-aware and never touched `monthlyChange`, so lend ₹1000 → +0 net-flow, friend repays ₹1000 → +1000 net-flow (false gain). Now treated like an `expense` outflow on both create and revert (credit → `dueAmount`+, cash → `balance`−, `monthlyChange`− both ways).

Intentionally unchanged (design-consistent): same-account transfer already blocked in UI (`AddTransactionModal.tsx:478`); `income`/split-settlement on a credit card credits `balance` (matches the general income convention); split expenses debit the full amount and use `split.yourShare` only for statistics/budgets.