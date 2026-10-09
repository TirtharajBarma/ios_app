import { create } from 'zustand';
import { AppState } from 'react-native';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@/utils/storage';
import { logAction, logException } from '@/utils/auditLog';
import { ExpenseAccount, ExpenseCategory, ExpenseTransaction, QuickExpensePreset, SavingsVault, EventFolder } from '@/types/expense';
import { expenseColors } from '@/constants/expenseColors';
import { executeSmartQuery, SmartQueryResult } from '@/services/onDeviceAi';
import { syncShortcutsParameters } from '@/services/expense/quickAddNative';

import {
  convertCurrency,
  formatConvertedCurrency,
  formatMoney,
  roundMoney,
  getExchangeRates,
  ZERO_DECIMAL_CURRENCIES,
  FALLBACK_EXCHANGE_RATES,
} from '@/utils/currency';
import { getCurrencySymbol } from '@/constants';
import { getLastClosingDateStr } from '@/utils/creditCard';

export type AppThemeMode = 'editorial' | 'cream' | 'midnight' | 'system';

export interface StatementSetupState {
  hasImported: boolean;
  openingBalancesConfigured: boolean;
  budgetConfigured: boolean;
  lastImportTimestamp?: number;
}

const MONTHS_FULL = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localISODate(d);
}

export function monthKeyOf(d: Date = new Date()): string {
  return `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

function parseISODate(dateStr: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) {
    const d = new Date(dateStr);
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

function parseTxDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  return new Date(dateStr);
}

export function isInMonth(dateStr: string, year: number, month: number): boolean {
  const d = parseISODate(dateStr);
  return d.year === year && d.month === month;
}

export function monthKeyToYearMonth(monthKey?: string): { year: number; month: number } {
  const now = new Date();
  const str = (monthKey || '').toLowerCase();
  let year = now.getFullYear();
  let month = now.getMonth();
  const yr = /\b(\d{4})\b/.exec(str);
  if (yr) year = parseInt(yr[1], 10);
  const idx = MONTHS_FULL.findIndex((m) => str.includes(m.toLowerCase()));
  if (idx >= 0) month = idx;
  return { year, month };
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getTxTimestamp(tx: ExpenseTransaction): number {
  if (tx.createdAt) {
    if (typeof tx.createdAt === 'number') return tx.createdAt;
    const t = new Date(tx.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  const match = tx.id.match(/\b(?:tx|txn|stmt)?[_ -]?(\d{10,13})\b/);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 1000000000) {
      return num < 10000000000 ? num * 1000 : num;
    }
  }
  return 0;
}

export function compareTransactions(a: ExpenseTransaction, b: ExpenseTransaction): number {
  const timeA = new Date(a.date).getTime();
  const timeB = new Date(b.date).getTime();
  if (timeB !== timeA) return timeB - timeA;
  const createdA = getTxTimestamp(a);
  const createdB = getTxTimestamp(b);
  if (createdB !== createdA) return createdB - createdA;
  return b.id.localeCompare(a.id);
}

interface ExpenseState {
  // Primary State
  selectedMonth: string; // e.g. "SEPTEMBER 2026"
  monthlyBudget: number; // 18400
  currencyCode: string; // 'INR'
  currencySymbol: string; // '₹'
  themeMode: AppThemeMode;
  ruleCount: number;

  categories: ExpenseCategory[];
  accounts: ExpenseAccount[];
  transactions: ExpenseTransaction[];
  quickPresets: QuickExpensePreset[];
  savingsVaults: SavingsVault[];
  eventFolders: EventFolder[];
  selectedTransactionIds: string[];
  activeAccountFilter: string; // 'All' or account id/name
  smartSearchQuery: string;
  hasSeenWalkthrough: boolean;
  _hasHydrated: boolean;

  // Actions
  setHasHydrated: (val: boolean) => void;
  setHasSeenWalkthrough: (seen: boolean) => void;
  setSelectedMonth: (month: string) => void;
  setMonthlyBudget: (budget: number) => void;
  setThemeMode: (theme: AppThemeMode) => void;
  setCurrency: (code: string, symbol: string) => void;
  convertAllCurrencies: (oldCurrency: string, newCurrency: string, newSymbol?: string) => Promise<void>;
  setActiveAccountFilter: (filter: string) => void;
  setSmartSearchQuery: (query: string) => void;
  learnedMerchantRules: Record<string, string>; // normalized merchant -> categoryId
  saveLearnedMerchantRule: (merchant: string, categoryId: string) => void;

  addTransaction: (tx: Omit<ExpenseTransaction, 'id'>) => void;
  addBatchTransactions: (
    txs: Omit<ExpenseTransaction, 'id'>[],
    newAccounts?: ExpenseAccount[],
    reconciledAccountBalances?: Record<string, number>
  ) => void;
  updateTransaction: (id: string, updates: Partial<ExpenseTransaction>) => void;
  removeTransactions: (ids: string[]) => void;
  updateTransactionsCategory: (ids: string[], categoryId: string) => void;
  toggleSelectTransaction: (id: string) => void;
  clearSelectedTransactions: () => void;
  selectAllTransactions: () => void;
  settleTransaction: (txId: string, receivingAccountId?: string) => void;
  settleFriendShare: (txId: string, friendId: string, receivingAccountId?: string) => void;

  addQuickPreset: (preset: Omit<QuickExpensePreset, 'id'>) => void;
  deleteQuickPreset: (id: string) => void;

  // Event Folders Actions
  addEventFolder: (folder: { name: string; emoji?: string }) => EventFolder;
  deleteEventFolder: (id: string) => void;

  // Savings Vaults Actions
  addSavingsVault: (vault: Omit<SavingsVault, 'id' | 'currentAmount'>) => void;
  updateSavingsVault: (id: string, updates: Partial<SavingsVault>) => void;
  deleteSavingsVault: (id: string, refundAccountId?: string) => void;
  depositToVault: (vaultId: string, amount: number, sourceAccountId?: string) => void;
  withdrawFromVault: (vaultId: string, amount: number, targetAccountId?: string) => void;

  categoryBudgets: Record<string, number>; // categoryId -> custom budget limit

  addAccount: (acc: Omit<ExpenseAccount, 'id' | 'txnCountThisMonth' | 'monthlyChange'>) => void;
  updateAccount: (id: string, updates: Partial<ExpenseAccount>) => void;
  deleteAccount: (id: string) => void;
  archiveAccount: (id: string) => void;
  unarchiveAccount: (id: string) => void;

  addCategory: (cat: Omit<ExpenseCategory, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<ExpenseCategory>) => void;
  deleteCategory: (id: string) => void;
  setCategories: (categories: ExpenseCategory[]) => void;
  reorderCategories: (fromIndex: number, toIndex: number) => void;
  setCategoryBudget: (catId: string, amount: number) => void;
  setAllCategoryBudgets: (budgets: Record<string, number>) => void;
  resetAllData: () => void;

  // Derived Calculations
  refreshCardCycles: () => void;
  getTotalBalance: (monthKey?: string) => number;
  getTotalIncome: (monthKey?: string) => number;
  getTotalSpent: (monthKey?: string) => number;
  getNetBalance: (monthKey?: string) => number;
  getRemainingBudget: (monthKey?: string) => number;
  getOverspentPercentage: (monthKey?: string) => number;
  getTotalSavedInVaults: () => number;
  getFreeLiquidBalance: () => number;
  getSafeToSpend: (monthKey?: string) => number;
  getCategoryBreakdown: (monthKey?: string) => Array<{
    category: ExpenseCategory;
    amount: number;
    percentage: number;
  }>;
  getTopCategory: (monthKey?: string) => {
    category: ExpenseCategory;
    amount: number;
    percentage: number;
  } | null;

  // PDF Setup Progress State
  statementSetup: StatementSetupState;
  setStatementSetup: (setup: Partial<StatementSetupState>) => void;

  // Currency Display Helpers
  convertAmount: (amount: number, fromCurrency?: string) => number;
  formatAmount: (amount: number, fromCurrency?: string) => string;

  getFilteredTransactions: () => ExpenseTransaction[];
  getSmartSearchResult: () => SmartQueryResult | null;
  getCategoryById: (catId: string) => ExpenseCategory;
}

export const SYSTEM_CATEGORY_IDS = new Set<string>([
  'cat_split_return',
  'cat_debt_repayment',
  'cat_income',
  'cat_goal',
]);

export function isSystemCategory(catId: string): boolean {
  return SYSTEM_CATEGORY_IDS.has(catId);
}

export function getUserCategories(categories?: ExpenseCategory[]): ExpenseCategory[] {
  return (categories || []).filter((c) => !isSystemCategory(c.id) && c.id !== 'cat_cig');
}

export const INITIAL_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat_food', name: 'Food', color: expenseColors.categories.food, iconName: 'UtensilsCrossed' },
  { id: 'cat_shop', name: 'Shopping', color: expenseColors.categories.shop, iconName: 'ShoppingBag' },
  { id: 'cat_trans', name: 'Transport', color: expenseColors.categories.trans, iconName: 'Car' },
  { id: 'cat_subs', name: 'Subscription', color: '#FF9D66', iconName: 'Repeat' },
  { id: 'cat_ent', name: 'Entertainment', color: expenseColors.categories.ent, iconName: 'Tv' },
  { id: 'cat_health', name: 'Health', color: expenseColors.categories.health, iconName: 'Heart' },
  { id: 'cat_fin', name: 'Finance', color: expenseColors.categories.fin, iconName: 'Banknote' },
  { id: 'cat_util', name: 'Utilities', color: expenseColors.categories.util, iconName: 'Zap' },
  { id: 'cat_misc', name: 'Misc', color: expenseColors.categories.misc, iconName: 'MoreHorizontal' },
  { id: 'cat_other', name: 'Other', color: '#8E95A5', iconName: 'MoreHorizontal' },
  { id: 'cat_split_return', name: 'Split Received', color: expenseColors.accentGreen, iconName: 'Users' },
  { id: 'cat_debt_repayment', name: 'Debt Repayment', color: '#88C0D0', iconName: 'Coins' },
  { id: 'cat_income', name: 'Income', color: expenseColors.accentGreen, iconName: 'Coins' },
  { id: 'cat_goal', name: 'Goals', color: expenseColors.accentGreen, iconName: 'Target' },
];

const INITIAL_ACCOUNTS: ExpenseAccount[] = [
  {
    id: 'acc_primary',
    name: 'Cash / Primary',
    type: 'cash',
    txnCountThisMonth: 0,
    balance: 0,
    openingBalance: 0,
    monthlyChange: 0,
    statusType: 'positive',
  },
];

const INITIAL_TRANSACTIONS: ExpenseTransaction[] = [];

const INITIAL_QUICK_PRESETS: QuickExpensePreset[] = [];

const INITIAL_SAVINGS_VAULTS: SavingsVault[] = [];

export const recomputeAllAccountsHelper = (
  accounts: ExpenseAccount[],
  transactions: ExpenseTransaction[],
  targetMonthKey?: string
): ExpenseAccount[] => {
  if (!accounts || accounts.length === 0) return accounts || [];
  const txs = transactions || [];
  const { year: currentYear, month: currentMonth } = monthKeyToYearMonth(targetMonthKey || monthKeyOf(new Date()));

  return accounts.map((acc) => {
    const isCredit = acc.type === 'credit';
    const accNameLower = (acc.name || '').trim().toLowerCase();

    const isFrom = (t: ExpenseTransaction) =>
      t.accountId === acc.id ||
      (!t.accountId && t.accountName && accNameLower && t.accountName.trim().toLowerCase() === accNameLower);
    const isTo = (t: ExpenseTransaction) =>
      t.toAccountId === acc.id ||
      (!t.toAccountId && t.toAccountName && accNameLower && t.toAccountName.trim().toLowerCase() === accNameLower);

    const linkedTxs = txs.filter((t) => isFrom(t) || isTo(t));

    let txnCountThisMonth = 0;
    let monthlyChange = 0;
    let expenseSum = 0;
    let incomeSum = 0;
    let unbilledSum = 0;
    const closingStr = isCredit && acc.billingDay ? getLastClosingDateStr(acc.billingDay) : null;

    for (const t of linkedTxs) {
      const inCurrentMonth = isInMonth(t.date, currentYear, currentMonth);
      if (inCurrentMonth) {
        txnCountThisMonth += 1;
      }

      const fromThis = isFrom(t);
      const toThis = isTo(t);

      if (closingStr && fromThis && t.type !== 'income' && t.type !== 'debt_borrow' && t.type !== 'vault_withdraw' && t.date.slice(0, 10) > closingStr) {
        unbilledSum += t.amount;
      }

      if (t.type === 'expense' && fromThis) {
        expenseSum += t.amount;
        if (inCurrentMonth) monthlyChange -= t.amount;
      } else if (t.type === 'income' && fromThis) {
        incomeSum += t.amount;
        if (inCurrentMonth) monthlyChange += t.amount;
      } else if (t.type === 'transfer') {
        if (fromThis) {
          expenseSum += t.amount;
          if (inCurrentMonth) monthlyChange -= t.amount;
        }
        if (toThis) {
          incomeSum += t.amount;
          if (inCurrentMonth) monthlyChange += t.amount;
        }
      } else if (t.type === 'debt_lend' && fromThis) {
        expenseSum += t.amount;
        if (inCurrentMonth) monthlyChange -= t.amount;
      } else if (t.type === 'debt_borrow' && fromThis) {
        incomeSum += t.amount;
        if (inCurrentMonth) monthlyChange += t.amount;
      } else if (t.type === 'vault_deposit' && fromThis) {
        expenseSum += t.amount;
        if (inCurrentMonth) monthlyChange -= t.amount;
      } else if (t.type === 'vault_withdraw' && fromThis) {
        incomeSum += t.amount;
        if (inCurrentMonth) monthlyChange += t.amount;
      }
    }

    const startingOpening = acc.openingBalance !== undefined
      ? acc.openingBalance
      : isCredit
        ? (acc.dueAmount || 0)
        : (acc.balance ?? 0);

    if (isCredit) {
      const rawDue = roundMoney(startingOpening + expenseSum - incomeSum);
      const finalDue = rawDue > 0 ? rawDue : 0;
      const positiveBalance = rawDue < 0 ? roundMoney(Math.abs(rawDue)) : 0;
      return {
        ...acc,
        openingBalance: startingOpening,
        balance: positiveBalance,
        dueAmount: finalDue,
        // Payments settle the oldest (billed) amount first, so unbilled can never exceed total due.
        unbilledDue: closingStr ? roundMoney(Math.min(unbilledSum, finalDue)) : 0,
        monthlyChange: roundMoney(monthlyChange),
        txnCountThisMonth,
        statusType: finalDue > 0 ? ('due' as const) : positiveBalance > 0 ? ('positive' as const) : ('no_change' as const),
      };
    } else {
      const finalBalance = roundMoney(startingOpening + incomeSum - expenseSum);
      return {
        ...acc,
        openingBalance: startingOpening,
        balance: finalBalance,
        dueAmount: undefined,
        monthlyChange: roundMoney(monthlyChange),
        txnCountThisMonth,
        statusType: finalBalance >= 0 ? ('positive' as const) : ('negative' as const),
      };
    }
  });
};

export const useExpenseStore = create<ExpenseState>()(
  persist(
    (set, get) => ({
  selectedMonth: monthKeyOf(new Date()),
  monthlyBudget: 0,
  currencyCode: 'INR',
  currencySymbol: '₹',
  themeMode: 'midnight',
  ruleCount: 0,

  categoryBudgets: {},

  categories: INITIAL_CATEGORIES,
  accounts: INITIAL_ACCOUNTS,
  transactions: INITIAL_TRANSACTIONS,
  quickPresets: [],
  savingsVaults: INITIAL_SAVINGS_VAULTS,
  eventFolders: [],
  selectedTransactionIds: [],
  activeAccountFilter: 'All',
  smartSearchQuery: '',
  hasSeenWalkthrough: false,
  _hasHydrated: false,

  setHasHydrated: (_hasHydrated) => set({ _hasHydrated }),

  statementSetup: {
    hasImported: false,
    openingBalancesConfigured: false,
    budgetConfigured: false,
  },
  setStatementSetup: (updates) => {
    set((state) => ({
      statementSetup: {
        ...state.statementSetup,
        ...updates,
      },
    }));
  },

  convertAmount: (amount, fromCurrency = 'INR') => {
    const { currencyCode } = get();
    return convertCurrency(amount, fromCurrency, currencyCode);
  },

  formatAmount: (amount, fromCurrency = 'INR') => {
    const { currencyCode, currencySymbol } = get();
    return formatConvertedCurrency(amount, fromCurrency, currencyCode, currencySymbol);
  },

  setHasSeenWalkthrough: (hasSeenWalkthrough) => set({ hasSeenWalkthrough }),
  setSelectedMonth: (month) => {
    set((state) => {
      const updatedAccounts = recomputeAllAccountsHelper(state.accounts, state.transactions, month);
      return {
        selectedMonth: month,
        accounts: updatedAccounts,
      };
    });
  },
  setMonthlyBudget: (budget) => {
    set({ monthlyBudget: budget });
    logAction('budget', `Set monthly budget: ${budget}`, { budget });
  },
  setThemeMode: (mode) => {
    set({ themeMode: mode });
    logAction('settings', `Changed theme: ${mode}`, { mode });
  },
  setCurrency: (code, symbol) => {
    const oldCode = get().currencyCode || 'INR';
    if (oldCode.toUpperCase() !== code.toUpperCase()) {
      get().convertAllCurrencies(oldCode, code, symbol);
    } else {
      set({ currencyCode: code, currencySymbol: symbol });
      logAction('settings', `Changed currency to ${code}`, { code });
    }
  },

  convertAllCurrencies: async (oldCurrency, newCurrency, newSymbol) => {
    const oldCode = (oldCurrency || get().currencyCode || 'INR').trim().toUpperCase();
    const newCode = (newCurrency || 'INR').trim().toUpperCase();
    const symbolToSet = newSymbol || getCurrencySymbol(newCode) || get().currencySymbol;

    if (oldCode === newCode) {
      set({ currencyCode: newCode, currencySymbol: symbolToSet });
      return;
    }

    const rates = await getExchangeRates();
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(newCode);

    const convertVal = (amount: number): number => {
      if (!amount || isNaN(amount)) return 0;
      const converted = convertCurrency(amount, oldCode, newCode, rates);
      return isZeroDecimal ? Math.round(converted) : Math.round(converted * 100) / 100;
    };

    set((state) => {
      // 1. Convert Accounts
      const updatedAccounts = state.accounts.map((acc) => ({
        ...acc,
        balance: convertVal(acc.balance),
        dueAmount: acc.dueAmount !== undefined ? convertVal(acc.dueAmount) : undefined,
        monthlyChange: convertVal(acc.monthlyChange),
        openingBalance: acc.openingBalance !== undefined ? convertVal(acc.openingBalance) : undefined,
      }));

      // 2. Convert Monthly Budget & Category Budgets
      const updatedMonthlyBudget = convertVal(state.monthlyBudget);
      const updatedCategoryBudgets: Record<string, number> = {};
      if (state.categoryBudgets) {
        Object.entries(state.categoryBudgets).forEach(([catId, val]) => {
          updatedCategoryBudgets[catId] = convertVal(val);
        });
      }

      // 3. Convert Transactions
      const updatedTransactions = state.transactions.map((tx) => {
        const newAmount = convertVal(tx.amount);
        let newSplit = tx.split;
        if (tx.split) {
          newSplit = {
            ...tx.split,
            yourShare: convertVal(tx.split.yourShare),
            friendsShare: convertVal(tx.split.friendsShare),
            friends: tx.split.friends
              ? tx.split.friends.map((f) => ({ ...f, amount: convertVal(f.amount) }))
              : undefined,
          };
        }
        return {
          ...tx,
          amount: newAmount,
          split: newSplit,
        };
      });

      // 4. Convert Savings Vaults
      const updatedVaults = (state.savingsVaults || []).map((v) => ({
        ...v,
        targetAmount: convertVal(v.targetAmount),
        currentAmount: convertVal(v.currentAmount),
      }));

      // 5. Convert Quick Presets
      const updatedPresets = (state.quickPresets || []).map((p) => ({
        ...p,
        amount: convertVal(p.amount),
      }));

      const finalAccounts = recomputeAllAccountsHelper(updatedAccounts, updatedTransactions, state.selectedMonth);

      return {
        accounts: finalAccounts,
        monthlyBudget: updatedMonthlyBudget,
        categoryBudgets: updatedCategoryBudgets,
        transactions: updatedTransactions,
        savingsVaults: updatedVaults,
        quickPresets: updatedPresets,
        currencyCode: newCode,
        currencySymbol: symbolToSet,
      };
    });

    logAction('settings', `Converted all expense data from ${oldCode} to ${newCode}`, { oldCode, newCode });
  },
  setActiveAccountFilter: (filter: string) => set({ activeAccountFilter: filter }),
  setSmartSearchQuery: (query: string) => set({ smartSearchQuery: query }),
  learnedMerchantRules: {},
  saveLearnedMerchantRule: (merchant, categoryId) => {
    const norm = merchant.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
    if (!norm) return;
    set((state) => ({
      learnedMerchantRules: {
        ...state.learnedMerchantRules,
        [norm]: categoryId,
      },
    }));
  },

  addTransaction: (txData) => {
    const fromAcc = get().accounts.find((a) => a.id === txData.accountId);
    const toAcc = txData.toAccountId ? get().accounts.find((a) => a.id === txData.toAccountId) : undefined;
    const newTx: ExpenseTransaction = {
      ...txData,
      id: genId('tx'),
      createdAt: txData.createdAt || Date.now(),
      accountName: fromAcc?.name || txData.accountName,
      toAccountName: toAcc?.name || txData.toAccountName,
    };

    set((state) => {
      const sortedTransactions = [newTx, ...state.transactions].sort(compareTransactions);
      const updatedAccounts = recomputeAllAccountsHelper(state.accounts, sortedTransactions, state.selectedMonth);

      let updatedVaults = state.savingsVaults;
      if (newTx.type === 'vault_deposit' && newTx.vaultId) {
        updatedVaults = updatedVaults.map((v) =>
          v.id === newTx.vaultId
            ? { ...v, currentAmount: roundMoney((v.currentAmount || 0) + newTx.amount), isCompleted: roundMoney((v.currentAmount || 0) + newTx.amount) >= (v.targetAmount || 0) }
            : v
        );
      } else if (newTx.type === 'vault_withdraw' && newTx.vaultId) {
        updatedVaults = updatedVaults.map((v) =>
          v.id === newTx.vaultId
            ? { ...v, currentAmount: roundMoney(Math.max(0, (v.currentAmount || 0) - newTx.amount)), isCompleted: roundMoney(Math.max(0, (v.currentAmount || 0) - newTx.amount)) >= (v.targetAmount || 0) }
            : v
        );
      }

      return {
        transactions: sortedTransactions,
        accounts: updatedAccounts,
        savingsVaults: updatedVaults,
      };
    });
    logAction('transaction', 'Added transaction', { id: newTx.id, amount: newTx.amount, type: newTx.type });
  },

  addBatchTransactions: (txsData, newAccountsList, reconciledAccountBalances) => {
    set((state) => {
      let currentAccounts = [...state.accounts];

      // If existing accounts only contain the empty default 'acc_primary' and new statement accounts are being created,
      // drop the placeholder acc_primary so no ghost account remains.
      const hasOnlyEmptyDefault =
        currentAccounts.length === 1 &&
        (currentAccounts[0].id === 'acc_primary' || currentAccounts[0].name.toLowerCase().includes('cash')) &&
        currentAccounts[0].txnCountThisMonth === 0 &&
        state.transactions.length === 0;

      if (hasOnlyEmptyDefault && newAccountsList && newAccountsList.length > 0) {
        currentAccounts = [];
      }

      // Add any new accounts detected if not present
      if (newAccountsList && newAccountsList.length > 0) {
        newAccountsList.forEach((newAcc) => {
          if (!currentAccounts.some((a) => a.id === newAcc.id || a.name.toLowerCase() === newAcc.name.toLowerCase())) {
            currentAccounts.push(newAcc);
          }
        });
      }

      const createdTxs: ExpenseTransaction[] = [];

      for (const txData of txsData) {
        const fromAcc = currentAccounts.find(
          (a) => a.id === txData.accountId || a.name.toLowerCase() === txData.accountName?.toLowerCase()
        );
        const toAcc = txData.toAccountId ? currentAccounts.find((a) => a.id === txData.toAccountId) : undefined;

        const newTx: ExpenseTransaction = {
          ...txData,
          id: genId('tx'),
          createdAt: txData.createdAt || Date.now(),
          accountId: fromAcc?.id || txData.accountId || currentAccounts[0]?.id || 'acc_default',
          accountName: fromAcc?.name || txData.accountName,
          toAccountName: toAcc?.name || txData.toAccountName,
        };
        createdTxs.push(newTx);
      }

      // Recalculate account balances and txn counts in a single batch
      const allTxs = [...createdTxs, ...state.transactions].sort(compareTransactions);
      
      // Use recomputeAllAccountsHelper to do the heavy lifting of figuring out the net change
      let updatedAccounts = recomputeAllAccountsHelper(currentAccounts, allTxs, state.selectedMonth);

      updatedAccounts = updatedAccounts.map((acc) => {
        const explicitReconciledBalance =
          reconciledAccountBalances?.[acc.id] ??
          reconciledAccountBalances?.[acc.name];

        if (explicitReconciledBalance !== undefined && !isNaN(explicitReconciledBalance)) {
          const isDue = acc.statusType === 'due' || acc.type === 'credit';
          // recomputeAllAccountsHelper applied all transactions (old+new) to the OLD openingBalance.
          // So acc.balance / acc.dueAmount is EXACTLY old_openingBalance + net(ALL).
          // We want the final balance to be explicitReconciledBalance.
          // We adjust the openingBalance by the difference.
          const computed = isDue ? (acc.dueAmount || 0) : acc.balance;
          const diff = explicitReconciledBalance - computed;
          
          return {
            ...acc,
            openingBalance: (acc.openingBalance || 0) + diff,
            balance: isDue ? 0 : explicitReconciledBalance,
            dueAmount: isDue ? explicitReconciledBalance : undefined,
            // Unbilled can never exceed the reconciled due.
            unbilledDue: isDue ? Math.min(acc.unbilledDue || 0, Math.max(0, explicitReconciledBalance)) : acc.unbilledDue,
            statusType: isDue 
              ? (explicitReconciledBalance > 0 ? ('due' as const) : ('no_change' as const)) 
              : (explicitReconciledBalance >= 0 ? ('positive' as const) : ('due' as const)),
          };
        }
        return acc;
      });

      let updatedVaults = state.savingsVaults.map((v) => {
        let amt = v.currentAmount || 0;
        for (const tx of createdTxs) {
          if (tx.vaultId === v.id) {
            if (tx.type === 'vault_deposit') amt += tx.amount;
            else if (tx.type === 'vault_withdraw') amt = Math.max(0, amt - tx.amount);
          }
        }
        const finalAmt = roundMoney(amt);
        return {
          ...v,
          currentAmount: finalAmt,
          isCompleted: v.targetAmount ? finalAmt >= v.targetAmount : false,
        };
      });

      return {
        transactions: allTxs,
        accounts: updatedAccounts,
        savingsVaults: updatedVaults,
      };
    });
    logAction('transaction', 'Added batch transactions', { count: txsData.length });
  },

  updateTransaction: (id, updates) => {
    set((state) => {
      const oldTx = state.transactions.find((t) => t.id === id);
      if (!oldTx) return state;

      const fromAcc = updates.accountId
        ? state.accounts.find((a) => a.id === updates.accountId)
        : state.accounts.find((a) => a.id === oldTx.accountId);
      const toAccountId = updates.toAccountId !== undefined ? updates.toAccountId : oldTx.toAccountId;
      const toAcc = toAccountId ? state.accounts.find((a) => a.id === toAccountId) : undefined;

      const updatedTx: ExpenseTransaction = {
        ...oldTx,
        ...updates,
        accountName: fromAcc?.name || updates.accountName || oldTx.accountName,
        toAccountName: toAcc?.name || updates.toAccountName || oldTx.toAccountName,
      };

      const updatedTxs = state.transactions.map((t) => (t.id === id ? updatedTx : t)).sort(compareTransactions);
      const updatedAccounts = recomputeAllAccountsHelper(state.accounts, updatedTxs, state.selectedMonth);

      let updatedVaults = state.savingsVaults.map((v) => {
        let amt = v.currentAmount || 0;
        const matchesOld = oldTx.vaultId ? v.id === oldTx.vaultId : false;
        const matchesUpdated = updatedTx.vaultId ? v.id === updatedTx.vaultId : false;

        if (matchesOld) {
          if (oldTx.type === 'vault_deposit') amt = Math.max(0, amt - oldTx.amount);
          else if (oldTx.type === 'vault_withdraw') amt += oldTx.amount;
        }

        if (matchesUpdated) {
          if (updatedTx.type === 'vault_deposit') amt += updatedTx.amount;
          else if (updatedTx.type === 'vault_withdraw') amt = Math.max(0, amt - updatedTx.amount);
        }

        const finalAmt = roundMoney(amt);
        return {
          ...v,
          currentAmount: finalAmt,
          isCompleted: v.targetAmount ? finalAmt >= v.targetAmount : false,
        };
      });

      return {
        transactions: updatedTxs,
        accounts: updatedAccounts,
        savingsVaults: updatedVaults,
      };
    });
    logAction('transaction', 'Updated transaction', { id, updates: Object.keys(updates) });
  },

  removeTransactions: (ids) => {
    set((state) => {
      const removeSet = new Set<string>(ids);
      const friendsToUnsettle = new Map<string, Set<string>>(); // parentTxId -> Set of friendIds
      const sourcesToUnsettle = new Set<string>(); // parentTxIds for debts or whole splits

      const parseSettledLink = (settledTxId?: string) => {
        if (!settledTxId) return null;
        if (settledTxId.startsWith('split_settle:')) {
          const parts = settledTxId.split(':');
          return { parentId: parts[1], friendId: parts[2] };
        }
        const fIdx = settledTxId.indexOf('_f_');
        if (fIdx !== -1) {
          return { parentId: settledTxId.substring(0, fIdx), friendId: settledTxId.substring(fIdx + 1) };
        }
        return { parentId: settledTxId, friendId: undefined };
      };

      for (const t of state.transactions) {
        if (removeSet.has(t.id)) {
          if (t.settlementTxId) removeSet.add(t.settlementTxId);
          const link = parseSettledLink(t.settledTxId);
          if (link) {
            if (link.friendId) {
              if (!friendsToUnsettle.has(link.parentId)) friendsToUnsettle.set(link.parentId, new Set());
              friendsToUnsettle.get(link.parentId)!.add(link.friendId);
            } else {
              sourcesToUnsettle.add(link.parentId);
            }
          }
        }
      }

      // When removing parent transactions, DO NOT delete actual settlement income transactions.
      // Instead, detach them so real-money bank receipts are preserved in the ledger.
      const detachedTxs = state.transactions.map((t) => {
        const link = parseSettledLink(t.settledTxId);
        if (link && removeSet.has(link.parentId)) {
          return {
            ...t,
            settledTxId: undefined,
            note: t.note ? `${t.note} (Settlement from removed split)` : 'Settlement receipt',
          };
        }
        return t;
      });

      const txsToRemove = detachedTxs.filter((t) => removeSet.has(t.id));
      if (txsToRemove.length === 0) return state;

      let updatedVaults = state.savingsVaults.map((v) => {
        let amt = v.currentAmount || 0;
        for (const tx of txsToRemove) {
          if (tx.vaultId === v.id) {
            if (tx.type === 'vault_deposit') amt = Math.max(0, amt - tx.amount);
            else if (tx.type === 'vault_withdraw') amt += tx.amount;
          }
        }
        const finalAmt = roundMoney(amt);
        return {
          ...v,
          currentAmount: finalAmt,
          isCompleted: v.targetAmount ? finalAmt >= v.targetAmount : false,
        };
      });

      const remainingTransactions = detachedTxs
        .filter((t) => !removeSet.has(t.id))
        .map((t) => {
          let updated = t;
          if (sourcesToUnsettle.has(t.id)) {
            if (updated.split) {
              const resetFriends = updated.split.friends ? updated.split.friends.map((f) => ({ ...f, settled: false })) : undefined;
              updated = { ...updated, split: { ...updated.split, settled: false, friends: resetFriends }, settlementTxId: undefined, isSettled: false };
            } else {
              updated = { ...updated, isSettled: false, settlementTxId: undefined };
            }
          }

          if (friendsToUnsettle.has(t.id) && updated.split && updated.split.friends) {
            const friendIds = friendsToUnsettle.get(t.id)!;
            const updatedFriends = updated.split.friends.map((f) =>
              friendIds.has(f.id) ? { ...f, settled: false } : f
            );
            const allSettled = updatedFriends.every((f) => f.settled);
            updated = {
              ...updated,
              split: {
                ...updated.split,
                friends: updatedFriends,
                settled: allSettled,
              },
            };
          }

          return updated;
        });

      const updatedAccounts = recomputeAllAccountsHelper(state.accounts, remainingTransactions, state.selectedMonth);

      return {
        transactions: remainingTransactions,
        accounts: updatedAccounts,
        savingsVaults: updatedVaults,
        selectedTransactionIds: state.selectedTransactionIds.filter((id) => !removeSet.has(id)),
      };
    });
    logAction('transaction', 'Removed transactions', { count: ids.length });
  },

  updateTransactionsCategory: (ids, categoryId) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        ids.includes(t.id) && t.type === 'expense' ? { ...t, categoryId } : t
      ),
    }));
  },

  addEventFolder: (folderData) => {
    const newFolder: EventFolder = {
      ...folderData,
      id: genId('ef'),
      createdAt: new Date().toISOString().split('T')[0],
    };
    set((state) => ({
      eventFolders: [newFolder, ...(state.eventFolders || [])],
    }));
    return newFolder;
  },

  deleteEventFolder: (id) => {
    set((state) => {
      const cleanId = id.toLowerCase().replace(/^name_/, '');
      const targetFolder = (state.eventFolders || []).find(
        (f) => f.id === id || f.name.toLowerCase() === cleanId || f.name.toLowerCase() === id.toLowerCase()
      );
      const folderName = (targetFolder?.name || cleanId).toLowerCase();

      return {
        eventFolders: (state.eventFolders || []).filter(
          (f) => f.id !== id && f.name.toLowerCase() !== cleanId && f.name.toLowerCase() !== id.toLowerCase()
        ),
        transactions: state.transactions.map((t) => {
          const matches =
            t.folderId === id ||
            (t.folderId && t.folderId.toLowerCase() === cleanId) ||
            (t.folderName && t.folderName.toLowerCase() === folderName) ||
            (t.tag && t.tag.toLowerCase() === folderName);

          if (matches) {
            return {
              ...t,
              folderId: undefined,
              folderName: undefined,
              tag: (t.tag && t.tag.toLowerCase() === folderName) ? undefined : t.tag,
            };
          }
          return t;
        }),
      };
    });
  },

  toggleSelectTransaction: (id) => {
    set((state) => {
      const exists = state.selectedTransactionIds.includes(id);
      return {
        selectedTransactionIds: exists
          ? state.selectedTransactionIds.filter((item) => item !== id)
          : [...state.selectedTransactionIds, id],
      };
    });
  },

  clearSelectedTransactions: () => set({ selectedTransactionIds: [] }),
  selectAllTransactions: () => {
    const allIds = get().getFilteredTransactions().map((t) => t.id);
    set({ selectedTransactionIds: allIds });
  },

  settleTransaction: (txId, targetOrSourceAccountId) => {
    set((state) => {
      const tx = state.transactions.find((t) => t.id === txId);
      if (!tx) return state;

      const todayISO = localISODate(new Date());

      // 1. Debt Lent Settlement: friend pays me back -> account balance increases + record settlement income transaction
      if (tx.type === 'debt_lend' && !tx.isSettled) {
        const amount = tx.amount;
        const targetAccId = targetOrSourceAccountId || tx.accountId || state.accounts[0]?.id;

        const settlementTx: ExpenseTransaction = {
          id: genId('tx'),
          amount,
          type: 'income',
          categoryId: 'cat_debt_repayment',
          accountId: targetAccId,
          date: todayISO,
          createdAt: Date.now(),
          note: `From ${tx.borrowerOrLender || 'Friend'}`,
          isSettled: true,
          settledTxId: txId,
        };

        const updatedTxs = [
          settlementTx,
          ...state.transactions.map((t) => (t.id === txId ? { ...t, isSettled: true, settlementTxId: settlementTx.id } : t)),
        ].sort(compareTransactions);

        const updatedAccounts = recomputeAllAccountsHelper(state.accounts, updatedTxs, state.selectedMonth);

        return {
          ...state,
          accounts: updatedAccounts,
          transactions: updatedTxs,
        };
      }

      // 2. Split Bill Settlement: friend pays their share -> account balance increases + record settlement income transaction
      if (tx.split && !tx.split.settled) {
        const remainingUnsettledAmount = tx.split.friends && tx.split.friends.length > 0
          ? tx.split.friends.filter((f) => !f.settled).reduce((sum, f) => sum + f.amount, 0)
          : (tx.split.friendsShare || 0);

        const updatedFriends = tx.split.friends ? tx.split.friends.map((f) => ({ ...f, settled: true })) : undefined;

        if (remainingUnsettledAmount <= 0) {
          const updatedTxs = state.transactions.map((t) =>
            t.id === txId && t.split
              ? {
                  ...t,
                  split: {
                    ...t.split,
                    friends: updatedFriends,
                    settled: true,
                  },
                }
              : t
          );
          return {
            ...state,
            transactions: updatedTxs,
          };
        }

        const amount = remainingUnsettledAmount;
        const targetAccId = targetOrSourceAccountId || tx.accountId || state.accounts[0]?.id;

        const settlementTx: ExpenseTransaction = {
          id: genId('tx'),
          amount,
          type: 'income',
          categoryId: 'cat_split_return',
          accountId: targetAccId,
          date: todayISO,
          createdAt: Date.now(),
          note: tx.note ? `From ${tx.split.friendNames || 'Friends'} · ${tx.note}` : `From ${tx.split.friendNames || 'Friends'}`,
          isSettled: true,
          settledTxId: txId,
        };

        const updatedTxs = [
          settlementTx,
          ...state.transactions.map((t) =>
            t.id === txId && t.split
              ? {
                  ...t,
                  split: {
                    ...t.split,
                    friends: updatedFriends,
                    settled: true,
                  },
                  settlementTxId: settlementTx.id,
                }
              : t
          ),
        ].sort(compareTransactions);

        const updatedAccounts = recomputeAllAccountsHelper(state.accounts, updatedTxs, state.selectedMonth);

        return {
          ...state,
          accounts: updatedAccounts,
          transactions: updatedTxs,
        };
      }

      // 3. Debt Borrowed Settlement: I pay back the friend -> account balance decreases + record settlement expense transaction
      if (tx.type === 'debt_borrow' && !tx.isSettled) {
        const amount = tx.amount;
        const sourceAccId = targetOrSourceAccountId || tx.accountId || state.accounts[0]?.id;

        const settlementTx: ExpenseTransaction = {
          id: genId('tx'),
          amount,
          type: 'expense',
          categoryId: 'cat_debt_repayment',
          accountId: sourceAccId,
          date: todayISO,
          createdAt: Date.now(),
          note: `Repaid to ${tx.borrowerOrLender || 'Friend'}`,
          isSettled: true,
          settledTxId: txId,
        };

        const updatedTxs = [
          settlementTx,
          ...state.transactions.map((t) => (t.id === txId ? { ...t, isSettled: true, settlementTxId: settlementTx.id } : t)),
        ].sort(compareTransactions);

        const updatedAccounts = recomputeAllAccountsHelper(state.accounts, updatedTxs, state.selectedMonth);

        return {
          ...state,
          accounts: updatedAccounts,
          transactions: updatedTxs,
        };
      }

      return state;
    });
  },

  settleFriendShare: (txId, friendId, receivingAccountId) => {
    set((state) => {
      const tx = state.transactions.find((t) => t.id === txId);
      if (!tx || !tx.split) return state;

      let friends = tx.split.friends;
      if (!friends || friends.length === 0) {
        const names = (tx.split.friendNames || 'Friend').split(',').map((n) => n.trim()).filter(Boolean);
        const totalCents = Math.round((tx.split.friendsShare || 0) * 100);
        const count = Math.max(names.length, 1);
        const baseCents = Math.floor(totalCents / count);
        const remainder = totalCents % count;
        friends = names.map((n, i) => ({
          id: `f_${i}`,
          name: n,
          amount: (baseCents + (i === count - 1 ? remainder : 0)) / 100,
          settled: false,
        }));
      }

      const friend = friends.find((f) => f.id === friendId) || (friends.length === 1 ? friends[0] : null);
      if (!friend || friend.settled) return state;

      const amount = friend.amount;
      const targetAccId = receivingAccountId || tx.accountId || state.accounts[0]?.id;
      const todayISO = localISODate(new Date());

      const updatedFriends = friends.map((f) =>
        f.id === friend.id ? { ...f, settled: true } : f
      );
      const allFriendsSettled = updatedFriends.every((f) => f.settled);

      const settlementTx: ExpenseTransaction = {
        id: genId('tx'),
        amount,
        type: 'income',
        categoryId: 'cat_split_return',
        accountId: targetAccId,
        date: todayISO,
        createdAt: Date.now(),
        note: tx.note ? `From ${friend.name || 'Friend'} · ${tx.note}` : `From ${friend.name || 'Friend'}`,
        isSettled: true,
        settledTxId: `split_settle:${txId}:${friend.id}`,
      };

      const updatedTxs = [
        settlementTx,
        ...state.transactions.map((t) => {
          if (t.id !== txId || !t.split) return t;
          return {
            ...t,
            split: {
              ...t.split,
              friends: updatedFriends,
              settled: allFriendsSettled,
            },
          };
        }),
      ].sort(compareTransactions);

      const updatedAccounts = recomputeAllAccountsHelper(state.accounts, updatedTxs, state.selectedMonth);

      return {
        ...state,
        accounts: updatedAccounts,
        transactions: updatedTxs,
      };
    });
  },

  addQuickPreset: (preset) => {
    const newPreset: QuickExpensePreset = {
      ...preset,
      id: genId('qp'),
    };
    set((state) => ({
      quickPresets: [newPreset, ...(state.quickPresets || [])],
    }));
  },

  deleteQuickPreset: (id) => {
    set((state) => ({
      quickPresets: (state.quickPresets || []).filter((p) => p.id !== id),
    }));
  },

  addSavingsVault: (vaultData) => {
    const newVault: SavingsVault = {
      ...vaultData,
      id: genId('vault'),
      currentAmount: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    set((state) => ({
      savingsVaults: [...state.savingsVaults, newVault],
    }));
  },

  updateSavingsVault: (id, updates) => {
    set((state) => ({
      savingsVaults: state.savingsVaults.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    }));
  },

  deleteSavingsVault: (id, refundAccountId) => {
    const vault = get().savingsVaults.find((v) => v.id === id);
    if (!vault) return;

    set((state) => {
      let newTransactions = [...state.transactions];

      if (vault.currentAmount > 0) {
        const effectiveTarget = refundAccountId || state.accounts[0]?.id || 'acc_primary';
        const refundTx: ExpenseTransaction = {
          id: genId('tx'),
          amount: vault.currentAmount,
          type: 'vault_withdraw',
          categoryId: 'cat_goal',
          accountId: effectiveTarget,
          vaultId: id,
          date: localISODate(new Date()),
          createdAt: Date.now(),
          note: `Refund from deleted goal: ${vault.emoji || '🎯'} ${vault.name}`,
        };
        newTransactions = [refundTx, ...newTransactions].sort(compareTransactions);
      }

      const updatedAccounts = recomputeAllAccountsHelper(state.accounts, newTransactions, state.selectedMonth);

      return {
        savingsVaults: state.savingsVaults.filter((v) => v.id !== id),
        accounts: updatedAccounts,
        transactions: newTransactions,
      };
    });

    logAction('vault', `Deleted savings vault ${vault.name}, refunded ${vault.currentAmount}`, { id, refundedAmount: vault.currentAmount });
  },

  depositToVault: (vaultId, amount, sourceAccountId) => {
    if (amount <= 0) return;
    const targetVault = get().savingsVaults.find((v) => v.id === vaultId);
    if (!targetVault) return;

    set((state) => {
      const effectiveSource = sourceAccountId || state.accounts[0]?.id || 'acc_primary';

      const updatedVaults = state.savingsVaults.map((v) =>
        v.id === vaultId
          ? {
              ...v,
              currentAmount: roundMoney(v.currentAmount + amount),
              isCompleted: v.currentAmount + amount >= v.targetAmount,
            }
          : v
      );

      const depositTx: ExpenseTransaction = {
        id: genId('tx'),
        amount,
        type: 'vault_deposit',
        categoryId: 'cat_goal',
        accountId: effectiveSource,
        vaultId,
        date: localISODate(new Date()),
        createdAt: Date.now(),
        note: `Saved to ${targetVault.emoji} ${targetVault.name}`,
      };

      const updatedTxs = [depositTx, ...state.transactions].sort(compareTransactions);
      const updatedAccounts = recomputeAllAccountsHelper(state.accounts, updatedTxs, state.selectedMonth);

      return {
        savingsVaults: updatedVaults,
        accounts: updatedAccounts,
        transactions: updatedTxs,
      };
    });

    logAction('vault', `Deposited ${amount} into vault`, { vaultId, amount, sourceAccountId });
  },

  withdrawFromVault: (vaultId, amount, targetAccountId) => {
    if (amount <= 0) return;
    const targetVault = get().savingsVaults.find((v) => v.id === vaultId);
    if (!targetVault) return;

    const actualWithdraw = Math.min(amount, targetVault.currentAmount);
    set((state) => {
      const updatedVaults = state.savingsVaults.map((v) =>
        v.id === vaultId
          ? {
              ...v,
              currentAmount: roundMoney(Math.max(0, v.currentAmount - actualWithdraw)),
              isCompleted: false,
            }
          : v
      );

      const effectiveTarget = targetAccountId || state.accounts[0]?.id || 'acc_primary';

      const withdrawTx: ExpenseTransaction = {
        id: genId('tx'),
        amount: actualWithdraw,
        type: 'vault_withdraw',
        categoryId: 'cat_goal',
        accountId: effectiveTarget,
        vaultId,
        date: localISODate(new Date()),
        createdAt: Date.now(),
        note: `Withdrawn from ${targetVault.emoji} ${targetVault.name}`,
      };

      const updatedTxs = [withdrawTx, ...state.transactions].sort(compareTransactions);
      const updatedAccounts = recomputeAllAccountsHelper(state.accounts, updatedTxs, state.selectedMonth);

      return {
        savingsVaults: updatedVaults,
        accounts: updatedAccounts,
        transactions: updatedTxs,
      };
    });

    logAction('vault', `Withdrew ${amount} from vault`, { vaultId, amount: actualWithdraw, targetAccountId });
  },

  addAccount: (accData) => {
    const newAcc: ExpenseAccount = {
      ...accData,
      id: genId('acc'),
      txnCountThisMonth: 0,
      monthlyChange: 0,
      statusType: accData.type === 'credit' ? 'due' : 'positive',
    };
    set((state) => {
      const combined = [...state.accounts, newAcc];
      const recomputed = recomputeAllAccountsHelper(combined, state.transactions);
      return {
        accounts: recomputed,
      };
    });
    logAction('account', `Added account: ${newAcc.name}`, { id: newAcc.id, balance: newAcc.balance, type: newAcc.type });
    syncShortcutsParameters().catch(() => {});
  },

  updateAccount: (id, updates) => {
    set((state) => {
      const targetAccount = state.accounts.find((a) => a.id === id);
      const oldNameLower = (targetAccount?.name || '').trim().toLowerCase();
      const newName = updates.name ? updates.name.trim() : targetAccount?.name;
      const newNameLower = (newName || '').trim().toLowerCase();

      // If account name is updated, sync transaction accountName fields
      let updatedTransactions = state.transactions;
      if (updates.name && newName && oldNameLower && newNameLower !== oldNameLower) {
        updatedTransactions = state.transactions.map((t) => {
          let updated = { ...t };
          let modified = false;
          if (t.accountId === id || (t.accountName && t.accountName.trim().toLowerCase() === oldNameLower)) {
            updated.accountId = id;
            updated.accountName = newName;
            modified = true;
          }
          if (t.toAccountId === id || (t.toAccountName && t.toAccountName.trim().toLowerCase() === oldNameLower)) {
            updated.toAccountId = id;
            updated.toAccountName = newName;
            modified = true;
          }
          return modified ? updated : t;
        });
      }

      const interimAccounts = state.accounts.map((a) => {
        if (a.id !== id) return a;
        return { ...a, ...updates };
      });

      const updatedAccounts = recomputeAllAccountsHelper(interimAccounts, updatedTransactions);
      const targetAcc = state.accounts.find((a) => a.id === id);
      const newFilter = (updates.name && targetAcc && state.activeAccountFilter === targetAcc.name)
        ? updates.name
        : state.activeAccountFilter;

      return {
        accounts: updatedAccounts,
        transactions: updatedTransactions,
        activeAccountFilter: newFilter,
      };
    });
    logAction('account', 'Updated account', { id, updates: Object.keys(updates) });
    syncShortcutsParameters().catch(() => {});
  },

  deleteAccount: (id) => {
    set((state) => {
      const targetAccount = state.accounts.find((a) => a.id === id);
      const accName = targetAccount?.name || 'Deleted Account';
      const resetFilter = state.activeAccountFilter === id || state.activeAccountFilter === accName;
      return {
        accounts: state.accounts.filter((a) => a.id !== id),
        activeAccountFilter: resetFilter ? 'All' : state.activeAccountFilter,
        transactions: state.transactions.map((t) => {
          let updated = t;
          if (t.accountId === id && !t.accountName) {
            updated = { ...updated, accountName: accName };
          }
          if (t.toAccountId === id && !t.toAccountName) {
            updated = { ...updated, toAccountName: accName };
          }
          return updated;
        }),
      };
    });
    logAction('account', 'Deleted account', { id });
    syncShortcutsParameters().catch(() => {});
  },

  archiveAccount: (id) => {
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? { ...a, isArchived: true } : a)),
    }));
    logAction('account', 'Archived account', { id });
  },

  unarchiveAccount: (id) => {
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? { ...a, isArchived: false } : a)),
    }));
    logAction('account', 'Unarchived account', { id });
  },

  addCategory: (catData) => {
    const newCat: ExpenseCategory = {
      ...catData,
      id: genId('cat'),
    };
    set((state) => ({
      categories: [...state.categories, newCat],
    }));
    logAction('category', `Added category: ${newCat.name}`, { id: newCat.id, iconName: newCat.iconName });
    syncShortcutsParameters().catch(() => {});
  },

  updateCategory: (id, updates) => {
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    logAction('category', 'Updated category', { id, updates: Object.keys(updates) });
    syncShortcutsParameters().catch(() => {});
  },

  deleteCategory: (id) => {
    if (isSystemCategory(id)) {
      console.warn(`Cannot delete system category ${id}`);
      return;
    }
    const { categories, transactions, categoryBudgets, quickPresets, learnedMerchantRules } = get();
    const remaining = categories.filter((c) => c.id !== id);
    const fallbackExpense = remaining.find((c) => !isSystemCategory(c.id) && c.id !== 'cat_income')?.id || 'cat_other';
    const fallbackIncome = 'cat_income';
    const reassignedCount = transactions.filter((t) => t.categoryId === id).length;

    const updatedRules = { ...(learnedMerchantRules || {}) };
    for (const [merchant, catId] of Object.entries(updatedRules)) {
      if (catId === id) {
        updatedRules[merchant] = fallbackExpense;
      }
    }

    const updatedPresets = (quickPresets || []).map((p) =>
      p.categoryId === id ? { ...p, categoryId: fallbackExpense } : p
    );

    set({
      categories: remaining,
      categoryBudgets: Object.fromEntries(
        Object.entries(categoryBudgets || {}).filter(([key]) => key !== id)
      ),
      transactions: transactions.map((t) => {
        if (t.categoryId === id) {
          return {
            ...t,
            categoryId: t.type === 'income' ? fallbackIncome : fallbackExpense,
          };
        }
        return t;
      }),
      learnedMerchantRules: updatedRules,
      quickPresets: updatedPresets,
    });
    logAction('category', `Deleted category, reassigned ${reassignedCount} transaction(s)`, { id, fallbackExpense });
    syncShortcutsParameters().catch(() => {});
  },

  setCategories: (categories) => {
    set({ categories });
    syncShortcutsParameters().catch(() => {});
  },

  reorderCategories: (fromIndex, toIndex) => {
    set((state) => {
      const updated = [...state.categories];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return { categories: updated };
    });
    logAction('category', 'Reordered categories', { fromIndex, toIndex });
    syncShortcutsParameters().catch(() => {});
  },

  setCategoryBudget: (catId, amount) => {
    set((state) => ({
      categoryBudgets: {
        ...state.categoryBudgets,
        [catId]: amount,
      },
    }));
    logAction('budget', `Set category budget: ${amount}`, { catId, amount });
  },

  setAllCategoryBudgets: (budgets) => {
    set({ categoryBudgets: budgets });
    logAction('budget', `Set budgets for ${Object.keys(budgets).length} category(ies)`);
  },

  // Re-derives billed/unbilled split (depends on today's date) without touching any data.
  refreshCardCycles: () =>
    set((state) => {
      if (!state.accounts.some((a) => a.type === 'credit' && a.billingDay)) return state;
      const next = recomputeAllAccountsHelper(state.accounts, state.transactions, state.selectedMonth);
      const changed = next.some((a, i) => a.unbilledDue !== state.accounts[i]?.unbilledDue);
      return changed ? { accounts: next } : state;
    }),

  getTotalBalance: (monthKey) => {
    const { accounts, transactions, selectedMonth } = get();
    const targetKey = monthKey || selectedMonth;
    const now = new Date();

    // If current or future month, return real-time live total balance
    const target = targetKey ? monthKeyToYearMonth(targetKey) : null;
    // Compare as numbers: month-name strings sort alphabetically ("September" > "October").
    if (!target || target.year * 12 + target.month >= now.getFullYear() * 12 + now.getMonth()) {
      return roundMoney(
        accounts.reduce((sum, acc) => {
          if (acc.type === 'credit') {
            // Unbilled spend isn't payable yet, so it doesn't reduce today's balance.
            return sum + (acc.balance || 0) - ((acc.dueAmount || 0) - (acc.unbilledDue || 0));
          }
          return sum + (acc.balance || 0);
        }, 0)
      );
    }

    // For a past month, calculate historical balance as of the last day of targetKey
    const { year, month } = monthKeyToYearMonth(targetKey);
    const endOfTargetMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();

    return roundMoney(
      accounts.reduce((total, acc) => {
        const isCredit = acc.type === 'credit';
        const startingOpening =
          acc.openingBalance !== undefined
            ? acc.openingBalance
            : isCredit
            ? acc.dueAmount || 0
            : acc.balance ?? 0;

        const accNameLower = (acc.name || '').trim().toLowerCase();
        const isFrom = (t: ExpenseTransaction) =>
          t.accountId === acc.id ||
          (!t.accountId && t.accountName && accNameLower && t.accountName.trim().toLowerCase() === accNameLower);
        const isTo = (t: ExpenseTransaction) =>
          t.toAccountId === acc.id ||
          (!t.toAccountId && t.toAccountName && accNameLower && t.toAccountName.trim().toLowerCase() === accNameLower);

        const pastTxs = transactions.filter((t) => {
          const tTime = parseTxDate(t.date).getTime();
          return tTime <= endOfTargetMonth && (isFrom(t) || isTo(t));
        });

        let expSum = 0;
        let incSum = 0;
        let pastUnbilled = 0;
        const pastClosing = isCredit && acc.billingDay ? getLastClosingDateStr(acc.billingDay, new Date(endOfTargetMonth)) : null;
        for (const t of pastTxs) {
          const fromThis = isFrom(t);
          const toThis = isTo(t);
          if (pastClosing && fromThis && t.type !== 'income' && t.type !== 'debt_borrow' && t.type !== 'vault_withdraw' && t.date.slice(0, 10) > pastClosing) {
            pastUnbilled += t.amount;
          }
          if (t.type === 'expense' && fromThis) expSum += t.amount;
          else if (t.type === 'income' && fromThis) incSum += t.amount;
          else if (t.type === 'transfer') {
            if (fromThis) expSum += t.amount;
            if (toThis) incSum += t.amount;
          } else if (t.type === 'debt_lend' && fromThis) expSum += t.amount;
          else if (t.type === 'debt_borrow' && fromThis) incSum += t.amount;
          else if (t.type === 'vault_deposit' && fromThis) expSum += t.amount;
          else if (t.type === 'vault_withdraw' && fromThis) incSum += t.amount;
        }

        if (isCredit) {
          const rawDue = startingOpening + expSum - incSum;
          const posBal = rawDue < 0 ? Math.abs(rawDue) : 0;
          const dueAmt = rawDue > 0 ? rawDue : 0;
          // Same rule as the live balance: only the billed part reduces cash.
          return total + posBal - (dueAmt - Math.min(pastUnbilled, dueAmt));
        } else {
          return total + (startingOpening + incSum - expSum);
        }
      }, 0)
    );
  },

  getTotalSavedInVaults: () => {
    const { savingsVaults } = get();
    return roundMoney((savingsVaults || []).reduce((sum, v) => sum + (v.currentAmount || 0), 0));
  },

  getFreeLiquidBalance: () => {
    return roundMoney(Math.max(0, get().getTotalBalance()));
  },

  getTotalIncome: (monthKey) => {
    const { transactions, selectedMonth } = get();
    const targetMonthKey = monthKey || selectedMonth;
    const { year, month } = monthKeyToYearMonth(targetMonthKey);
    const targetMonthNormalized = targetMonthKey.trim().toLowerCase();
    return roundMoney(
      transactions
        .filter(
          (t) =>
            t.type === 'income' &&
            t.categoryId !== 'cat_split_return' &&
            t.categoryId !== 'cat_debt_repayment' &&
            (t.allocatedMonth
              ? t.allocatedMonth.trim().toLowerCase() === targetMonthNormalized
              : isInMonth(t.date, year, month))
        )
        .reduce((sum, t) => sum + t.amount, 0)
    );
  },

  getTotalSpent: (monthKey) => {
    const { transactions, selectedMonth } = get();
    const { year, month } = monthKeyToYearMonth(monthKey || selectedMonth);
    return roundMoney(
      transactions
        .filter(
          (t) =>
            t.type === 'expense' &&
            t.categoryId !== 'cat_debt_repayment' &&
            isInMonth(t.date, year, month)
        )
        .reduce((sum, t) => {
          const personalShare = t.split ? t.split.yourShare : t.amount;
          return sum + personalShare;
        }, 0)
    );
  },

  getNetBalance: (monthKey) => {
    return roundMoney(get().getTotalIncome(monthKey) - get().getTotalSpent(monthKey));
  },

  getRemainingBudget: (monthKey) => {
    const { monthlyBudget, categoryBudgets } = get();
    const totalAllocated = Object.values(categoryBudgets || {}).reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const budget = monthlyBudget > 0 ? monthlyBudget : totalAllocated;
    return roundMoney(budget - get().getTotalSpent(monthKey));
  },

  getSafeToSpend: (monthKey) => {
    const { monthlyBudget, categoryBudgets, transactions, selectedMonth } = get();
    const totalSpent = get().getTotalSpent(monthKey);
    const { year, month } = monthKeyToYearMonth(monthKey || selectedMonth);

    const vaultDepositsThisMonth = transactions
      .filter((t) => t.type === 'vault_deposit' && isInMonth(t.date, year, month))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalAllocated = Object.values(categoryBudgets || {}).reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const budget = monthlyBudget > 0 ? monthlyBudget : totalAllocated;

    if (budget > 0) {
      return roundMoney(Math.max(0, budget - totalSpent - vaultDepositsThisMonth));
    }

    const income = get().getTotalIncome(monthKey);
    return roundMoney(Math.max(0, income - totalSpent - vaultDepositsThisMonth));
  },

  getOverspentPercentage: (monthKey) => {
    const totalSpent = get().getTotalSpent(monthKey);
    const { monthlyBudget, categoryBudgets } = get();
    const totalAllocated = Object.values(categoryBudgets || {}).reduce((s, v) => s + (v > 0 ? v : 0), 0);
    const budget = monthlyBudget > 0 ? monthlyBudget : totalAllocated;
    if (budget <= 0 || totalSpent <= budget) return 0;
    return Number((((totalSpent - budget) / budget) * 100).toFixed(1));
  },

  getCategoryBreakdown: (monthKey) => {
    const { categories, transactions, selectedMonth } = get();
    const totalSpent = get().getTotalSpent(monthKey);
    const { year, month } = monthKeyToYearMonth(monthKey || selectedMonth);

    const userCats = getUserCategories(categories);
    const userCatIds = new Set(userCats.map((c) => c.id));

    // Capture any expenses with missing or non-user categories into cat_other
    const orphanSpent = transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.categoryId !== 'cat_debt_repayment' &&
          !userCatIds.has(t.categoryId) &&
          isInMonth(t.date, year, month)
      )
      .reduce((sum, t) => {
        const personalShare = t.split ? t.split.yourShare : t.amount;
        return sum + personalShare;
      }, 0);

    return userCats.map((cat) => {
      let catSpent = transactions
        .filter((t) => t.type === 'expense' && t.categoryId === cat.id && isInMonth(t.date, year, month))
        .reduce((sum, t) => {
          const personalShare = t.split ? t.split.yourShare : t.amount;
          return sum + personalShare;
        }, 0);

      if (cat.id === 'cat_other' && orphanSpent > 0) {
        catSpent += orphanSpent;
      }

      const percentage = totalSpent > 0 ? Number(((catSpent / totalSpent) * 100).toFixed(1)) : 0;
      return {
        category: cat,
        amount: catSpent,
        percentage,
      };
    });
  },

  getTopCategory: (monthKey) => {
    const breakdown = get().getCategoryBreakdown(monthKey);
    if (breakdown.length === 0) return null;
    const sorted = [...breakdown].sort((a, b) => b.amount - a.amount);
    return sorted[0].amount > 0 ? sorted[0] : null;
  },

  getSmartSearchResult: () => {
    const { transactions, activeAccountFilter, smartSearchQuery, accounts, categories, currencySymbol } = get();
    if (!smartSearchQuery.trim()) return null;

    let candidateTxs = transactions;
    if (activeAccountFilter && activeAccountFilter !== 'All') {
      const matchedAcc = accounts.find(
        (a) => a.id === activeAccountFilter || a.name.toLowerCase() === activeAccountFilter.toLowerCase()
      );
      const filterLower = activeAccountFilter.trim().toLowerCase();
      const matchedNameLower = matchedAcc?.name.trim().toLowerCase();
      candidateTxs = candidateTxs.filter((t) => {
        const txAccNameLower = (t.accountName || '').trim().toLowerCase();
        const txToAccNameLower = (t.toAccountName || '').trim().toLowerCase();
        return (
          (matchedAcc && (t.accountId === matchedAcc.id || t.toAccountId === matchedAcc.id)) ||
          (matchedNameLower && (txAccNameLower === matchedNameLower || txToAccNameLower === matchedNameLower)) ||
          txAccNameLower === filterLower ||
          txToAccNameLower === filterLower ||
          t.accountId === activeAccountFilter
        );
      });
    }

    return executeSmartQuery(smartSearchQuery, candidateTxs, categories, accounts, currencySymbol);
  },

  getFilteredTransactions: () => {
    const { transactions, activeAccountFilter, smartSearchQuery, accounts, categories, currencySymbol } = get();
    let result = [...transactions];

    // Filter by Account
    if (activeAccountFilter && activeAccountFilter !== 'All') {
      const matchedAcc = accounts.find(
        (a) => a.id === activeAccountFilter || a.name.toLowerCase() === activeAccountFilter.toLowerCase()
      );
      const filterLower = activeAccountFilter.trim().toLowerCase();
      const matchedNameLower = matchedAcc?.name.trim().toLowerCase();
      result = result.filter((t) => {
        const txAccNameLower = (t.accountName || '').trim().toLowerCase();
        const txToAccNameLower = (t.toAccountName || '').trim().toLowerCase();
        return (
          (matchedAcc && (t.accountId === matchedAcc.id || t.toAccountId === matchedAcc.id)) ||
          (matchedNameLower && (txAccNameLower === matchedNameLower || txToAccNameLower === matchedNameLower)) ||
          txAccNameLower === filterLower ||
          txToAccNameLower === filterLower ||
          t.accountId === activeAccountFilter
        );
      });
    }

    // Filter by Smart Search Query using On-Device AI
    if (smartSearchQuery.trim().length > 0) {
      const aiResult = executeSmartQuery(smartSearchQuery, result, categories, accounts, currencySymbol);
      if (aiResult.matchedTransactions.length > 0) {
        return aiResult.matchedTransactions;
      }

      // Keyword fallback
      const q = smartSearchQuery.toLowerCase();
      result = result.filter((t) => {
        const cat = categories.find((c) => c.id === t.categoryId);
        const fromAcc = accounts.find((a) => a.id === t.accountId);
        const toAcc = t.toAccountId ? accounts.find((a) => a.id === t.toAccountId) : null;
        const matchFolderName = t.folderName ? t.folderName.toLowerCase().includes(q) : false;
        const matchNote = t.note ? t.note.toLowerCase().includes(q) : false;
        const matchTag = t.tag ? t.tag.toLowerCase().includes(q) : false;
        const matchFriend = t.borrowerOrLender
          ? t.borrowerOrLender.toLowerCase().includes(q)
          : t.split?.friendNames
          ? t.split.friendNames.toLowerCase().includes(q)
          : false;
        const matchCat = cat ? cat.name.toLowerCase().includes(q) : false;
        const matchAcc = fromAcc ? fromAcc.name.toLowerCase().includes(q) : false;
        const matchToAcc = toAcc ? toAcc.name.toLowerCase().includes(q) : false;
        const matchAmount = t.amount.toString().includes(q);
        return matchFolderName || matchNote || matchTag || matchFriend || matchCat || matchAcc || matchToAcc || matchAmount;
      });
    }

    return result;
  },

  getCategoryById: (catId: string) => {
    const { categories } = get();
    const found = categories.find((c) => c.id === catId);
    if (found) return found;
    if (catId === 'cat_split_return') {
      return { id: 'cat_split_return', name: 'Split Received', color: expenseColors.accentGreen, iconName: 'Users' };
    }
    if (catId === 'cat_debt_repayment') {
      return { id: 'cat_debt_repayment', name: 'Debt Repayment', color: '#88C0D0', iconName: 'Coins' };
    }
    if (catId === 'cat_salary' || catId === 'cat_income') {
      return { id: 'cat_income', name: 'Income', color: expenseColors.accentGreen, iconName: 'Coins' };
    }
    if (catId === 'cat_goal' || catId === 'cat_vault') {
      return { id: 'cat_goal', name: 'Goals', color: expenseColors.accentGreen, iconName: 'Target' };
    }
    return {
      id: catId,
      name: 'Expense',
      color: '#8E919D',
      iconName: 'MoreHorizontal',
    };
  },

  resetAllData: () => {
    set({
      transactions: [],
      selectedTransactionIds: [],
      accounts: INITIAL_ACCOUNTS,
      categories: INITIAL_CATEGORIES,
      savingsVaults: [],
      eventFolders: [],
      quickPresets: [],
      categoryBudgets: {},
      monthlyBudget: 0,
      learnedMerchantRules: {},
      smartSearchQuery: '',
      activeAccountFilter: 'All',
      hasSeenWalkthrough: false,
      statementSetup: {
        hasImported: false,
        openingBalancesConfigured: false,
        budgetConfigured: false,
      },
    });

    logAction('security', 'All stored expense data was erased', { scope: 'resetAllData' });
  },
}),
{
  name: '@expense_data_v1',
  onRehydrateStorage: () => (state) => {
    state?.setHasHydrated(true);
    syncShortcutsParameters().catch(() => {});
  },
  storage: createJSONStorage(() => ({
    getItem: async (key: string) => {
      let value = await AsyncStorage.getItem(key);
      if (!value && key === '@expense_data_v1') {
        value = await AsyncStorage.getItem('@legacy_expense_v1');
      }
      return value;
    },
    setItem: async (key: string, value: string) => {
      await AsyncStorage.setItem(key, value);
    },
    removeItem: async (key: string) => {
      await AsyncStorage.removeItem(key);
      if (key === '@expense_data_v1') {
        await AsyncStorage.removeItem('@legacy_expense_v1');
      }
    },
  })),
  merge: (persistedState: unknown, currentState: ExpenseState): ExpenseState => {
    const ps = (persistedState || {}) as Partial<ExpenseState>;
    const currentCalendarMonth = monthKeyOf(new Date());
    const merged: ExpenseState = {
      ...currentState,
      ...ps,
      selectedMonth: currentCalendarMonth,
      activeAccountFilter: 'All',
      smartSearchQuery: '',
      selectedTransactionIds: [],
    };
    if (Array.isArray(merged.categories)) {
      merged.categories = merged.categories.map((c: ExpenseCategory) => {
        const init = INITIAL_CATEGORIES.find((ic) => ic.id === c.id);
        if (init) {
          return {
            ...init,
            ...c,
            iconName: (c.iconName === 'Star' && c.id === 'cat_cig') ? init.iconName : (c.iconName || init.iconName),
            emoji: undefined,
          };
        }
        return c;
      });
      INITIAL_CATEGORIES.forEach((ic) => {
        if (!merged.categories.some((c: ExpenseCategory) => c.id === ic.id)) {
          merged.categories.push(ic);
        }
      });
    }
    if (Array.isArray(merged.accounts) && Array.isArray(merged.transactions)) {
      merged.accounts = recomputeAllAccountsHelper(merged.accounts, merged.transactions);
    }
    return merged;
  },
  partialize: (state) => ({
    categories: state.categories,
    categoryBudgets: state.categoryBudgets,
    monthlyBudget: state.monthlyBudget,
    currencyCode: state.currencyCode,
    currencySymbol: state.currencySymbol,
    themeMode: state.themeMode,
    transactions: state.transactions,
    accounts: state.accounts,
    savingsVaults: state.savingsVaults,
    eventFolders: state.eventFolders,
    quickPresets: state.quickPresets,
    ruleCount: state.ruleCount,
    hasSeenWalkthrough: state.hasSeenWalkthrough,
    learnedMerchantRules: state.learnedMerchantRules,
    statementSetup: state.statementSetup,
  }),
}
)
);

// A statement can close while the app sits in the background; refresh the billed/unbilled split on resume.
AppState.addEventListener('change', (s) => {
  if (s === 'active') useExpenseStore.getState().refreshCardCycles();
});
