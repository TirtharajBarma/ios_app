import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@/utils/storage';
import { logAction, logException } from '@/utils/auditLog';
import { ExpenseAccount, ExpenseCategory, ExpenseTransaction, QuickExpensePreset, SavingsVault, EventFolder } from '@/types/expense';
import { expenseColors } from '@/constants/expenseColors';
import { executeSmartQuery, SmartQueryResult } from '@/services/onDeviceAi';

import { convertCurrency, formatConvertedCurrency, getExchangeRates, ZERO_DECIMAL_CURRENCIES, FALLBACK_EXCHANGE_RATES } from '@/utils/currency';
import { getCurrencySymbol } from '@/constants';

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

function monthKeyOf(d: Date): string {
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

function isInMonth(dateStr: string, year: number, month: number): boolean {
  const d = parseISODate(dateStr);
  return d.year === year && d.month === month;
}

function monthKeyToYearMonth(monthKey?: string): { year: number; month: number } {
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
  hasInitialAppLoaded: boolean;
  hasSeenWalkthrough: boolean;

  // Actions
  setHasInitialAppLoaded: (loaded: boolean) => void;
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
  deleteSavingsVault: (id: string) => void;
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
  getTotalBalance: () => number;
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

const INITIAL_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat_cig', name: 'Cigarettes', color: expenseColors.categories.cig, iconName: 'Cigarette' },
  { id: 'cat_shop', name: 'Shopping', color: expenseColors.categories.shop, iconName: 'ShoppingBag' },
  { id: 'cat_ent', name: 'Entertainment', color: expenseColors.categories.ent, iconName: 'Tv' },
  { id: 'cat_subs', name: 'Subscription', color: '#FF9D66', iconName: 'Repeat' },
  { id: 'cat_health', name: 'Health', color: expenseColors.categories.health, iconName: 'Heart' },
  { id: 'cat_fin', name: 'Finance', color: expenseColors.categories.fin, iconName: 'Banknote' },
  { id: 'cat_trans', name: 'Transport', color: expenseColors.categories.trans, iconName: 'Car' },
  { id: 'cat_util', name: 'Utilities', color: expenseColors.categories.util, iconName: 'Zap' },
  { id: 'cat_food', name: 'Food', color: expenseColors.categories.food, iconName: 'UtensilsCrossed' },
  { id: 'cat_misc', name: 'Misc', color: expenseColors.categories.misc, iconName: 'MoreHorizontal' },
  { id: 'cat_income', name: 'Income', color: expenseColors.accentGreen, iconName: 'Coins' },
];

const INITIAL_ACCOUNTS: ExpenseAccount[] = [
  {
    id: 'acc_primary',
    name: 'Cash / Primary',
    type: 'cash',
    txnCountThisMonth: 0,
    balance: 0,
    monthlyChange: 0,
    statusType: 'positive',
  },
];

const INITIAL_TRANSACTIONS: ExpenseTransaction[] = [];

const INITIAL_QUICK_PRESETS: QuickExpensePreset[] = [];

const INITIAL_SAVINGS_VAULTS: SavingsVault[] = [];

export const recomputeAllAccountsHelper = (
  accounts: ExpenseAccount[],
  transactions: ExpenseTransaction[]
): ExpenseAccount[] => {
  if (!accounts || accounts.length === 0) return accounts || [];
  const txs = transactions || [];

  return accounts.map((acc) => {
    const isCredit = acc.type === 'credit';
    const accNameLower = (acc.name || '').trim().toLowerCase();

    const linkedTxs = txs.filter(
      (t) =>
        t.accountId === acc.id ||
        t.toAccountId === acc.id ||
        (t.accountName && accNameLower && t.accountName.trim().toLowerCase() === accNameLower) ||
        (t.toAccountName && accNameLower && t.toAccountName.trim().toLowerCase() === accNameLower)
    );

    let txnCountThisMonth = 0;
    let monthlyChange = 0;
    let expenseSum = 0;
    let incomeSum = 0;

    for (const t of linkedTxs) {
      txnCountThisMonth += 1;
      const isFrom =
        t.accountId === acc.id ||
        (t.accountName && accNameLower && t.accountName.trim().toLowerCase() === accNameLower);
      const isTo =
        t.toAccountId === acc.id ||
        (t.toAccountName && accNameLower && t.toAccountName.trim().toLowerCase() === accNameLower);

      if (t.type === 'expense' && isFrom) {
        expenseSum += t.amount;
        monthlyChange -= t.amount;
      } else if (t.type === 'income' && isFrom) {
        incomeSum += t.amount;
        monthlyChange += t.amount;
      } else if (t.type === 'transfer') {
        if (isFrom) {
          expenseSum += t.amount;
          monthlyChange -= t.amount;
        }
        if (isTo) {
          incomeSum += t.amount;
          monthlyChange += t.amount;
        }
      } else if (t.type === 'debt_lend' && isFrom) {
        expenseSum += t.amount;
        monthlyChange -= t.amount;
      } else if (t.type === 'debt_borrow' && isFrom) {
        incomeSum += t.amount;
        monthlyChange += t.amount;
      } else if (t.type === 'vault_deposit' && isFrom) {
        expenseSum += t.amount;
        monthlyChange -= t.amount;
      } else if (t.type === 'vault_withdraw' && isFrom) {
        incomeSum += t.amount;
        monthlyChange += t.amount;
      }
    }

    const startingOpening = acc.openingBalance || 0;

    if (isCredit) {
      const finalDue = Math.max(0, startingOpening + expenseSum - incomeSum);
      return {
        ...acc,
        balance: 0,
        dueAmount: finalDue,
        monthlyChange,
        txnCountThisMonth,
        statusType: finalDue > 0 ? ('due' as const) : ('no_change' as const),
      };
    } else {
      const finalBalance = Math.max(0, startingOpening + incomeSum - expenseSum);
      return {
        ...acc,
        balance: finalBalance,
        dueAmount: undefined,
        monthlyChange,
        txnCountThisMonth,
        statusType: 'positive' as const,
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
  hasInitialAppLoaded: false,
  hasSeenWalkthrough: false,

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

  setHasInitialAppLoaded: (hasInitialAppLoaded) => set({ hasInitialAppLoaded }),
  setHasSeenWalkthrough: (hasSeenWalkthrough) => set({ hasSeenWalkthrough }),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
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

      return {
        accounts: updatedAccounts,
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
      accountName: fromAcc?.name || txData.accountName,
      toAccountName: toAcc?.name || txData.toAccountName,
    };

    set((state) => {
      const updatedAccounts = state.accounts.map((acc) => {
        let balance = acc.balance;
        let dueAmount = acc.dueAmount || 0;
        let monthlyChange = acc.monthlyChange;
        let txnCountThisMonth = acc.txnCountThisMonth;
        const isDue = acc.statusType === 'due' || acc.type === 'credit';

        // 1. Expense
        if (newTx.type === 'expense' && acc.id === newTx.accountId) {
          txnCountThisMonth += 1;
          if (isDue) {
            dueAmount += newTx.amount;
            monthlyChange -= newTx.amount;
          } else {
            balance = Math.max(0, balance - newTx.amount);
            monthlyChange -= newTx.amount;
          }
        }

        // 2. Income
        if (newTx.type === 'income' && acc.id === newTx.accountId) {
          txnCountThisMonth += 1;
          balance += newTx.amount;
          monthlyChange += newTx.amount;
        }

        // 3. Transfer Out (From Account)
        if (newTx.type === 'transfer' && acc.id === newTx.accountId) {
          txnCountThisMonth += 1;
          if (isDue) {
            dueAmount += newTx.amount;
          } else {
            balance = Math.max(0, balance - newTx.amount);
          }
        }

        // 4. Transfer In / Bill Payment (To Account)
        if (newTx.type === 'transfer' && acc.id === newTx.toAccountId) {
          txnCountThisMonth += 1;
          if (isDue) {
            dueAmount = Math.max(0, dueAmount - newTx.amount);
          } else {
            balance += newTx.amount;
          }
        }

        // 5. Debt Lent
        if (newTx.type === 'debt_lend' && acc.id === newTx.accountId) {
          txnCountThisMonth += 1;
          if (isDue) {
            dueAmount += newTx.amount;
            monthlyChange -= newTx.amount;
          } else {
            balance = Math.max(0, balance - newTx.amount);
            monthlyChange -= newTx.amount;
          }
        }

        // 6. Debt Borrowed
        if (newTx.type === 'debt_borrow' && acc.id === newTx.accountId) {
          txnCountThisMonth += 1;
          balance += newTx.amount;
        }

        // 7. Vault Deposit / Withdraw
        if ((newTx.type === 'vault_deposit' || newTx.type === 'vault_withdraw') && acc.id === newTx.accountId) {
          txnCountThisMonth += 1;
          if (newTx.type === 'vault_deposit') {
            if (isDue) {
              dueAmount += newTx.amount;
            } else {
              balance = Math.max(0, balance - newTx.amount);
            }
            monthlyChange -= newTx.amount;
          } else {
            if (isDue) {
              dueAmount = Math.max(0, dueAmount - newTx.amount);
            } else {
              balance += newTx.amount;
            }
            monthlyChange += newTx.amount;
          }
        }

        return {
          ...acc,
          balance,
          dueAmount: isDue ? dueAmount : undefined,
          monthlyChange,
          txnCountThisMonth,
          statusType: isDue ? ('due' as const) : ('positive' as const),
        };
      });

      const sortedTransactions = [newTx, ...state.transactions].sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });

      return {
        transactions: sortedTransactions,
        accounts: updatedAccounts,
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
          accountId: fromAcc?.id || txData.accountId || currentAccounts[0]?.id || 'acc_default',
          accountName: fromAcc?.name || txData.accountName,
          toAccountName: toAcc?.name || txData.toAccountName,
        };
        createdTxs.push(newTx);
      }

      // Recalculate account balances and txn counts in a single batch
      const updatedAccounts = currentAccounts.map((acc) => {
        let balance = acc.balance;
        let dueAmount = acc.dueAmount || 0;
        let monthlyChange = acc.monthlyChange;
        let txnCountThisMonth = acc.txnCountThisMonth;
        const isDue = acc.statusType === 'due' || acc.type === 'credit';

        // Check if there is an explicit reconciled balance for this account
        const explicitReconciledBalance =
          reconciledAccountBalances?.[acc.id] ??
          reconciledAccountBalances?.[acc.name];

        if (explicitReconciledBalance !== undefined && !isNaN(explicitReconciledBalance)) {
          balance = explicitReconciledBalance;
          for (const newTx of createdTxs) {
            if (newTx.accountId === acc.id || newTx.toAccountId === acc.id) {
              txnCountThisMonth += 1;
            }
          }
        } else {
          for (const newTx of createdTxs) {
            if (newTx.type === 'expense' && acc.id === newTx.accountId) {
              txnCountThisMonth += 1;
              if (isDue) {
                dueAmount += newTx.amount;
                monthlyChange -= newTx.amount;
              } else {
                balance = Math.max(0, balance - newTx.amount);
                monthlyChange -= newTx.amount;
              }
            } else if (newTx.type === 'income' && acc.id === newTx.accountId) {
              txnCountThisMonth += 1;
              balance += newTx.amount;
              monthlyChange += newTx.amount;
            } else if (newTx.type === 'transfer') {
              if (acc.id === newTx.accountId) {
                txnCountThisMonth += 1;
                if (isDue) dueAmount += newTx.amount;
                else balance = Math.max(0, balance - newTx.amount);
              }
              if (acc.id === newTx.toAccountId) {
                txnCountThisMonth += 1;
                if (isDue) dueAmount = Math.max(0, dueAmount - newTx.amount);
                else balance += newTx.amount;
              }
            } else if (newTx.type === 'debt_lend' && acc.id === newTx.accountId) {
              txnCountThisMonth += 1;
              if (isDue) {
                dueAmount += newTx.amount;
                monthlyChange -= newTx.amount;
              } else {
                balance = Math.max(0, balance - newTx.amount);
                monthlyChange -= newTx.amount;
              }
            } else if (newTx.type === 'debt_borrow' && acc.id === newTx.accountId) {
              txnCountThisMonth += 1;
              balance += newTx.amount;
            } else if ((newTx.type === 'vault_deposit' || newTx.type === 'vault_withdraw') && acc.id === newTx.accountId) {
              txnCountThisMonth += 1;
              if (newTx.type === 'vault_deposit') {
                if (isDue) dueAmount += newTx.amount;
                else balance = Math.max(0, balance - newTx.amount);
                monthlyChange -= newTx.amount;
              } else {
                if (isDue) dueAmount = Math.max(0, dueAmount - newTx.amount);
                else balance += newTx.amount;
                monthlyChange += newTx.amount;
              }
            }
          }
        }

        return {
          ...acc,
          balance,
          dueAmount: isDue ? dueAmount : undefined,
          monthlyChange,
          txnCountThisMonth,
          statusType: isDue ? ('due' as const) : ('positive' as const),
        };
      });

      const allTxs = [...createdTxs, ...state.transactions].sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeB !== timeA) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });

      return {
        transactions: allTxs,
        accounts: updatedAccounts,
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

      // 1. Revert old transaction on accounts
      let updatedAccounts = state.accounts.map((acc) => {
        let balance = acc.balance;
        let dueAmount = acc.dueAmount || 0;
        let monthlyChange = acc.monthlyChange;
        let txnCountThisMonth = acc.txnCountThisMonth;
        const isDue = acc.statusType === 'due' || acc.type === 'credit';

        if (oldTx.type === 'expense' && acc.id === oldTx.accountId) {
          txnCountThisMonth = Math.max(0, txnCountThisMonth - 1);
          if (isDue) {
            dueAmount = Math.max(0, dueAmount - oldTx.amount);
            monthlyChange += oldTx.amount;
          } else {
            balance += oldTx.amount;
            monthlyChange += oldTx.amount;
          }
        } else if (oldTx.type === 'income' && acc.id === oldTx.accountId) {
          txnCountThisMonth = Math.max(0, txnCountThisMonth - 1);
          balance = Math.max(0, balance - oldTx.amount);
          monthlyChange -= oldTx.amount;
        } else if (oldTx.type === 'transfer') {
          if (acc.id === oldTx.accountId) {
            txnCountThisMonth = Math.max(0, txnCountThisMonth - 1);
            if (isDue) {
              dueAmount = Math.max(0, dueAmount - oldTx.amount);
            } else {
              balance += oldTx.amount;
            }
          }
          if (acc.id === oldTx.toAccountId) {
            txnCountThisMonth = Math.max(0, txnCountThisMonth - 1);
            if (isDue) {
              dueAmount += oldTx.amount;
            } else {
              balance = Math.max(0, balance - oldTx.amount);
            }
          }
        } else if (oldTx.type === 'debt_lend' && acc.id === oldTx.accountId) {
          txnCountThisMonth = Math.max(0, txnCountThisMonth - 1);
          if (isDue) {
            dueAmount = Math.max(0, dueAmount - oldTx.amount);
            monthlyChange += oldTx.amount;
          } else {
            balance += oldTx.amount;
            monthlyChange += oldTx.amount;
          }
        } else if (oldTx.type === 'debt_borrow' && acc.id === oldTx.accountId) {
          txnCountThisMonth = Math.max(0, txnCountThisMonth - 1);
          balance = Math.max(0, balance - oldTx.amount);
        }

        return {
          ...acc,
          balance,
          dueAmount: isDue ? dueAmount : undefined,
          monthlyChange,
          txnCountThisMonth,
          statusType: isDue ? ('due' as const) : ('positive' as const),
        };
      });

      // 2. Apply updated transaction to accounts
      updatedAccounts = updatedAccounts.map((acc) => {
        let balance = acc.balance;
        let dueAmount = acc.dueAmount || 0;
        let monthlyChange = acc.monthlyChange;
        let txnCountThisMonth = acc.txnCountThisMonth;
        const isDue = acc.statusType === 'due' || acc.type === 'credit';

        if (updatedTx.type === 'expense' && acc.id === updatedTx.accountId) {
          txnCountThisMonth += 1;
          if (isDue) {
            dueAmount += updatedTx.amount;
            monthlyChange -= updatedTx.amount;
          } else {
            balance = Math.max(0, balance - updatedTx.amount);
            monthlyChange -= updatedTx.amount;
          }
        } else if (updatedTx.type === 'income' && acc.id === updatedTx.accountId) {
          txnCountThisMonth += 1;
          balance += updatedTx.amount;
          monthlyChange += updatedTx.amount;
        } else if (updatedTx.type === 'transfer') {
          if (acc.id === updatedTx.accountId) {
            txnCountThisMonth += 1;
            if (isDue) {
              dueAmount += updatedTx.amount;
            } else {
              balance = Math.max(0, balance - updatedTx.amount);
            }
          }
          if (acc.id === updatedTx.toAccountId) {
            txnCountThisMonth += 1;
            if (isDue) {
              dueAmount = Math.max(0, dueAmount - updatedTx.amount);
            } else {
              balance += updatedTx.amount;
            }
          }
        } else if (updatedTx.type === 'debt_lend' && acc.id === updatedTx.accountId) {
          txnCountThisMonth += 1;
          if (isDue) {
            dueAmount += updatedTx.amount;
            monthlyChange -= updatedTx.amount;
          } else {
            balance = Math.max(0, balance - updatedTx.amount);
            monthlyChange -= updatedTx.amount;
          }
        } else if (updatedTx.type === 'debt_borrow' && acc.id === updatedTx.accountId) {
          txnCountThisMonth += 1;
          balance += updatedTx.amount;
        }

        return {
          ...acc,
          balance,
          dueAmount: isDue ? dueAmount : undefined,
          monthlyChange,
          txnCountThisMonth,
          statusType: isDue ? ('due' as const) : ('positive' as const),
        };
      });

      return {
        transactions: state.transactions.map((t) => (t.id === id ? updatedTx : t)),
        accounts: updatedAccounts,
      };
    });
    logAction('transaction', 'Updated transaction', { id, updates: Object.keys(updates) });
  },

  removeTransactions: (ids) => {
    set((state) => {
      const removeSet = new Set<string>(ids);
      const sourcesToUnsettle = new Set<string>();

      // Expand removals: deleting a settled debt/split also removes its settlement
      // transaction, and deleting a settlement transaction un-settles its source.
      for (const t of state.transactions) {
        if (removeSet.has(t.id)) {
          if (t.settlementTxId) removeSet.add(t.settlementTxId);
          if (t.isSettled) sourcesToUnsettle.add(t.id);
          if (t.split?.settled) sourcesToUnsettle.add(t.id);
        } else if (t.settledTxId && removeSet.has(t.settledTxId)) {
          sourcesToUnsettle.add(t.id);
        }
      }

      const txsToRemove = state.transactions.filter((t) => removeSet.has(t.id));
      if (txsToRemove.length === 0) return state;

      let updatedAccounts = [...state.accounts];
      let updatedVaults = [...state.savingsVaults];

      for (const tx of txsToRemove) {
        // 1. Revert Expense / Outflow
        if (tx.type === 'expense') {
          updatedAccounts = updatedAccounts.map((acc) => {
            if (acc.id === tx.accountId) {
              if (acc.statusType === 'due' || acc.type === 'credit') {
                return {
                  ...acc,
                  dueAmount: Math.max(0, (acc.dueAmount || 0) - tx.amount),
                  monthlyChange: acc.monthlyChange + tx.amount,
                  txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1),
                };
              } else {
                return {
                  ...acc,
                  balance: acc.balance + tx.amount,
                  monthlyChange: acc.monthlyChange + tx.amount,
                  txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1),
                };
              }
            }
            return acc;
          });
        }

        // 2. Revert Income / Inflow
        else if (tx.type === 'income') {
          updatedAccounts = updatedAccounts.map((acc) => {
            if (acc.id === tx.accountId) {
              return {
                ...acc,
                balance: Math.max(0, acc.balance - tx.amount),
                monthlyChange: acc.monthlyChange - tx.amount,
                txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1),
              };
            }
            return acc;
          });
        }

        // 3. Revert Transfer
        else if (tx.type === 'transfer') {
          updatedAccounts = updatedAccounts.map((acc) => {
            if (acc.id === tx.accountId) {
              if (acc.statusType === 'due' || acc.type === 'credit') {
                return { ...acc, dueAmount: Math.max(0, (acc.dueAmount || 0) - tx.amount), txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1) };
              } else {
                return { ...acc, balance: acc.balance + tx.amount, txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1) };
              }
            }
            if (acc.id === tx.toAccountId) {
              if (acc.statusType === 'due' || acc.type === 'credit') {
                return { ...acc, dueAmount: (acc.dueAmount || 0) + tx.amount, txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1) };
              } else {
                return { ...acc, balance: Math.max(0, acc.balance - tx.amount), txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1) };
              }
            }
            return acc;
          });
        }

        // 4. Revert Debt Lent (Restores the balance that left on create; credit-aware + monthlyChange)
        else if (tx.type === 'debt_lend') {
          updatedAccounts = updatedAccounts.map((acc) => {
            if (acc.id === tx.accountId) {
              if (acc.statusType === 'due' || acc.type === 'credit') {
                return {
                  ...acc,
                  dueAmount: Math.max(0, (acc.dueAmount || 0) - tx.amount),
                  monthlyChange: acc.monthlyChange + tx.amount,
                  txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1),
                };
              }
              return {
                ...acc,
                balance: acc.balance + tx.amount,
                monthlyChange: acc.monthlyChange + tx.amount,
                txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1),
              };
            }
            return acc;
          });
        }

        // 5. Revert Debt Borrowed (Removes the balance that entered on create)
        else if (tx.type === 'debt_borrow') {
          updatedAccounts = updatedAccounts.map((acc) => {
            if (acc.id === tx.accountId) {
              return {
                ...acc,
                balance: Math.max(0, acc.balance - tx.amount),
                txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1),
              };
            }
            return acc;
          });
        }

        // 6. Revert Vault Deposit
        else if (tx.type === 'vault_deposit') {
          if (tx.vaultId) {
            updatedVaults = updatedVaults.map((v) =>
              v.id === tx.vaultId ? { ...v, currentAmount: Math.max(0, v.currentAmount - tx.amount), isCompleted: false } : v
            );
          }
          updatedAccounts = updatedAccounts.map((acc) => {
            if (acc.id === tx.accountId) {
              // Create added to dueAmount for credit cards; mirror that on revert
              if (acc.statusType === 'due' || acc.type === 'credit') {
                return {
                  ...acc,
                  dueAmount: Math.max(0, (acc.dueAmount || 0) - tx.amount),
                  monthlyChange: acc.monthlyChange + tx.amount,
                  txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1),
                };
              }
              return {
                ...acc,
                balance: acc.balance + tx.amount,
                monthlyChange: acc.monthlyChange + tx.amount,
                txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1),
              };
            }
            return acc;
          });
        }

        // 7. Revert Vault Withdraw
        else if (tx.type === 'vault_withdraw') {
          if (tx.vaultId) {
            updatedVaults = updatedVaults.map((v) =>
              v.id === tx.vaultId ? { ...v, currentAmount: v.currentAmount + tx.amount } : v
            );
          }
          updatedAccounts = updatedAccounts.map((acc) => {
            if (acc.id === tx.accountId) {
              // Create reduced dueAmount for credit cards; mirror that on revert
              if (acc.statusType === 'due' || acc.type === 'credit') {
                return {
                  ...acc,
                  dueAmount: (acc.dueAmount || 0) + tx.amount,
                  monthlyChange: acc.monthlyChange - tx.amount,
                  txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1),
                };
              }
              return {
                ...acc,
                balance: Math.max(0, acc.balance - tx.amount),
                monthlyChange: acc.monthlyChange - tx.amount,
                txnCountThisMonth: Math.max(0, acc.txnCountThisMonth - 1),
              };
            }
            return acc;
          });
        }
      }

      return {
        transactions: state.transactions
          .filter((t) => !removeSet.has(t.id))
          .map((t) => {
            if (!sourcesToUnsettle.has(t.id)) return t;
            if (t.split) return { ...t, split: { ...t.split, settled: false }, settlementTxId: undefined };
            return { ...t, isSettled: false, settlementTxId: undefined };
          }),
        selectedTransactionIds: state.selectedTransactionIds.filter((id) => !removeSet.has(id)),
        accounts: updatedAccounts,
        savingsVaults: updatedVaults,
      };
    });
  },

  updateTransactionsCategory: (ids, categoryId) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        ids.includes(t.id) ? { ...t, categoryId } : t
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
    set((state) => ({
      eventFolders: (state.eventFolders || []).filter((f) => f.id !== id),
    }));
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

      const todayISO = new Date().toISOString().split('T')[0];

      // 1. Debt Lent Settlement: friend pays me back -> account balance increases + record new settlement income transaction
      if (tx.type === 'debt_lend' && !tx.isSettled) {
        const amount = tx.amount;
        const targetAccId = targetOrSourceAccountId || tx.accountId || state.accounts[0]?.id;
        const updatedAccounts = state.accounts.map((acc) => {
          if (acc.id === targetAccId) {
            return {
              ...acc,
              balance: acc.balance + amount,
              monthlyChange: acc.monthlyChange + amount,
              txnCountThisMonth: acc.txnCountThisMonth + 1,
            };
          }
          return acc;
        });

        const settlementTx: ExpenseTransaction = {
          id: genId('tx'),
          amount,
          type: 'income',
          categoryId: 'cat_income',
          accountId: targetAccId,
          date: todayISO,
          note: `Received from ${tx.borrowerOrLender || 'Friend'} (Settled)`,
          isSettled: true,
          settledTxId: txId,
        };

        return {
          ...state,
          accounts: updatedAccounts,
          transactions: [
            settlementTx,
            ...state.transactions.map((t) => (t.id === txId ? { ...t, isSettled: true, settlementTxId: settlementTx.id } : t)),
          ],
        };
      }

      // 2. Split Bill Settlement: friend pays their share -> account balance increases + record new settlement income transaction
      if (tx.split && !tx.split.settled) {
        const remainingUnsettledAmount = tx.split.friends && tx.split.friends.length > 0
          ? tx.split.friends.filter((f) => !f.settled).reduce((sum, f) => sum + f.amount, 0)
          : tx.split.friendsShare;
        const amount = remainingUnsettledAmount > 0 ? remainingUnsettledAmount : tx.split.friendsShare;
        const targetAccId = targetOrSourceAccountId || tx.accountId || state.accounts[0]?.id;
        const updatedAccounts = state.accounts.map((acc) => {
          if (acc.id === targetAccId) {
            return {
              ...acc,
              balance: acc.balance + amount,
              monthlyChange: acc.monthlyChange + amount,
              txnCountThisMonth: acc.txnCountThisMonth + 1,
            };
          }
          return acc;
        });

        const settlementTx: ExpenseTransaction = {
          id: genId('tx'),
          amount,
          type: 'income',
          categoryId: 'cat_income',
          accountId: targetAccId,
          date: todayISO,
          note: `Received from ${tx.split.friendNames || 'Friends'} (Split Share)`,
          isSettled: true,
          settledTxId: txId,
        };

        const updatedFriends = tx.split.friends ? tx.split.friends.map((f) => ({ ...f, settled: true })) : undefined;

        return {
          ...state,
          accounts: updatedAccounts,
          transactions: [
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
          ],
        };
      }

      // 3. Debt Borrowed Settlement: I pay back the friend -> account balance decreases + record new settlement expense transaction
      if (tx.type === 'debt_borrow' && !tx.isSettled) {
        const amount = tx.amount;
        const sourceAccId = targetOrSourceAccountId || tx.accountId || state.accounts[0]?.id;
        const updatedAccounts = state.accounts.map((acc) => {
          if (acc.id === sourceAccId) {
            return {
              ...acc,
              balance: Math.max(0, acc.balance - amount),
              monthlyChange: acc.monthlyChange - amount,
              txnCountThisMonth: acc.txnCountThisMonth + 1,
            };
          }
          return acc;
        });

        const settlementTx: ExpenseTransaction = {
          id: genId('tx'),
          amount,
          type: 'expense',
          categoryId: tx.categoryId || 'cat_other',
          accountId: sourceAccId,
          date: todayISO,
          note: `Repaid to ${tx.borrowerOrLender || 'Friend'} (Debt Cleared)`,
          isSettled: true,
          settledTxId: txId,
        };

        return {
          ...state,
          accounts: updatedAccounts,
          transactions: [
            settlementTx,
            ...state.transactions.map((t) => (t.id === txId ? { ...t, isSettled: true, settlementTxId: settlementTx.id } : t)),
          ],
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
        const perAmt = Math.round((tx.split.friendsShare || 0) / Math.max(names.length, 1));
        friends = names.map((n, i) => ({ id: `f_${i}`, name: n, amount: perAmt, settled: false }));
      }

      const friend = friends.find((f) => f.id === friendId) || (friends.length === 1 ? friends[0] : null);
      if (!friend || friend.settled) return state;

      const amount = friend.amount;
      const targetAccId = receivingAccountId || tx.accountId || state.accounts[0]?.id;
      const todayISO = new Date().toISOString().split('T')[0];

      const updatedFriends = friends.map((f) =>
        f.id === friend.id ? { ...f, settled: true } : f
      );
      const allFriendsSettled = updatedFriends.every((f) => f.settled);

      const updatedAccounts = state.accounts.map((acc) => {
        if (acc.id === targetAccId) {
          return {
            ...acc,
            balance: acc.balance + amount,
            monthlyChange: acc.monthlyChange + amount,
            txnCountThisMonth: acc.txnCountThisMonth + 1,
          };
        }
        return acc;
      });

      const settlementTx: ExpenseTransaction = {
        id: genId('tx'),
        amount,
        type: 'income',
        categoryId: 'cat_income',
        accountId: targetAccId,
        date: todayISO,
        note: `Received from ${friend.name || 'Friend'} (Split Share - ${tx.note || 'Expense'})`,
        isSettled: true,
        settledTxId: `${txId}_${friend.id}`,
      };

      return {
        ...state,
        accounts: updatedAccounts,
        transactions: [
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
        ],
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

  deleteSavingsVault: (id) => {
    set((state) => ({
      savingsVaults: state.savingsVaults.filter((v) => v.id !== id),
    }));
  },

  depositToVault: (vaultId, amount, sourceAccountId) => {
    if (amount <= 0) return;
    const targetVault = get().savingsVaults.find((v) => v.id === vaultId);
    if (!targetVault) return;

    set((state) => {
      // The vault always draws from a concrete physical account; default to the
      // first account so the recorded ledger entry and the revert stay balanced.
      const effectiveSource = sourceAccountId || state.accounts[0]?.id || 'acc_primary';

      // 1. Update Vault Balance
      const updatedVaults = state.savingsVaults.map((v) =>
        v.id === vaultId
          ? {
              ...v,
              currentAmount: v.currentAmount + amount,
              isCompleted: v.currentAmount + amount >= v.targetAmount,
            }
          : v
      );

      // 2. Deduct from the physical account
      const updatedAccounts = state.accounts.map((acc) => {
        if (acc.id === effectiveSource) {
          return {
            ...acc,
            balance: Math.max(0, acc.balance - amount),
            monthlyChange: acc.monthlyChange - amount,
            txnCountThisMonth: acc.txnCountThisMonth + 1,
          };
        }
        return acc;
      });

      // 3. Record transaction for ledger clarity
      const depositTx: ExpenseTransaction = {
        id: genId('tx'),
        amount,
        type: 'vault_deposit',
        categoryId: 'cat_fin',
        accountId: effectiveSource,
        vaultId,
        date: localISODate(new Date()),
        note: `Saved to ${targetVault.emoji} ${targetVault.name}`,
      };

      return {
        savingsVaults: updatedVaults,
        accounts: updatedAccounts,
        transactions: [depositTx, ...state.transactions],
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
              currentAmount: Math.max(0, v.currentAmount - actualWithdraw),
              isCompleted: false,
            }
          : v
      );

      // The vault always releases back to a concrete physical account so the
      // recorded ledger entry and the revert stay balanced.
      const effectiveTarget = targetAccountId || state.accounts[0]?.id || 'acc_primary';
      const updatedAccounts = state.accounts.map((acc) => {
        if (acc.id === effectiveTarget) {
          return {
            ...acc,
            balance: acc.balance + actualWithdraw,
            monthlyChange: acc.monthlyChange + actualWithdraw,
            txnCountThisMonth: acc.txnCountThisMonth + 1,
          };
        }
        return acc;
      });

      const withdrawTx: ExpenseTransaction = {
        id: genId('tx'),
        amount: actualWithdraw,
        type: 'vault_withdraw',
        categoryId: 'cat_fin',
        accountId: effectiveTarget,
        vaultId,
        date: localISODate(new Date()),
        note: `Withdrawn from ${targetVault.emoji} ${targetVault.name}`,
      };

      return {
        savingsVaults: updatedVaults,
        accounts: updatedAccounts,
        transactions: [withdrawTx, ...state.transactions],
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

      return {
        accounts: updatedAccounts,
        transactions: updatedTransactions,
      };
    });
    logAction('account', 'Updated account', { id, updates: Object.keys(updates) });
  },

  deleteAccount: (id) => {
    set((state) => {
      const targetAccount = state.accounts.find((a) => a.id === id);
      const accName = targetAccount?.name || 'Deleted Account';
      return {
        accounts: state.accounts.filter((a) => a.id !== id),
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
  },

  updateCategory: (id, updates) => {
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    logAction('category', 'Updated category', { id, updates: Object.keys(updates) });
  },

  deleteCategory: (id) => {
    const { categories, transactions, categoryBudgets } = get();
    const remaining = categories.filter((c) => c.id !== id);
    const fallback = remaining.find((c) => c.id !== 'cat_income')?.id || 'cat_income';
    const reassignedCount = transactions.filter((t) => t.categoryId === id).length;
    set({
      categories: remaining,
      categoryBudgets: Object.fromEntries(
        Object.entries(categoryBudgets || {}).filter(([key]) => key !== id)
      ),
      transactions: transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: fallback } : t)),
    });
    logAction('category', `Deleted category, reassigned ${reassignedCount} transaction(s)`, { id, fallback });
  },

  setCategories: (categories) => {
    set({ categories });
  },

  reorderCategories: (fromIndex, toIndex) => {
    set((state) => {
      const updated = [...state.categories];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return { categories: updated };
    });
    logAction('category', 'Reordered categories', { fromIndex, toIndex });
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

  getTotalBalance: () => {
    const { accounts } = get();
    return accounts.reduce((sum, acc) => {
      if (acc.type === 'credit') {
        return sum - (acc.dueAmount || 0);
      }
      return sum + Math.max(0, acc.balance);
    }, 0);
  },

  getTotalSavedInVaults: () => {
    const { savingsVaults } = get();
    return (savingsVaults || []).reduce((sum, v) => sum + (v.currentAmount || 0), 0);
  },

  getFreeLiquidBalance: () => {
    return Math.max(0, get().getTotalBalance() - get().getTotalSavedInVaults());
  },

  getTotalIncome: (monthKey) => {
    const { transactions, selectedMonth } = get();
    const { year, month } = monthKeyToYearMonth(monthKey || selectedMonth);
    return transactions
      .filter((t) => t.type === 'income' && isInMonth(t.date, year, month))
      .reduce((sum, t) => sum + t.amount, 0);
  },

  getTotalSpent: (monthKey) => {
    const { transactions, selectedMonth } = get();
    const { year, month } = monthKeyToYearMonth(monthKey || selectedMonth);
    return transactions
      .filter((t) => t.type === 'expense' && isInMonth(t.date, year, month))
      .reduce((sum, t) => {
        const personalShare = t.split ? t.split.yourShare : t.amount;
        return sum + personalShare;
      }, 0);
  },

  getNetBalance: (monthKey) => {
    return get().getTotalIncome(monthKey) - get().getTotalSpent(monthKey);
  },

  getRemainingBudget: (monthKey) => {
    return get().monthlyBudget - get().getTotalSpent(monthKey);
  },

  getSafeToSpend: (monthKey) => {
    const { monthlyBudget, transactions, selectedMonth } = get();
    const totalSpent = get().getTotalSpent(monthKey);
    const { year, month } = monthKeyToYearMonth(monthKey || selectedMonth);

    // Vault deposits in the month reduce spendable cash flow
    const vaultDepositsThisMonth = transactions
      .filter((t) => t.type === 'vault_deposit' && isInMonth(t.date, year, month))
      .reduce((sum, t) => sum + t.amount, 0);

    if (monthlyBudget > 0) {
      return Math.max(0, monthlyBudget - totalSpent - vaultDepositsThisMonth);
    }

    const income = get().getTotalIncome(monthKey);
    return Math.max(0, income - totalSpent - vaultDepositsThisMonth);
  },

  getOverspentPercentage: (monthKey) => {
    const totalSpent = get().getTotalSpent(monthKey);
    const budget = get().monthlyBudget;
    if (budget <= 0 || totalSpent <= budget) return 0;
    return Number((((totalSpent - budget) / budget) * 100).toFixed(1));
  },

  getCategoryBreakdown: (monthKey) => {
    const { categories, transactions, selectedMonth } = get();
    const totalSpent = get().getTotalSpent(monthKey);
    const { year, month } = monthKeyToYearMonth(monthKey || selectedMonth);

    return categories
      .filter((c) => c.id !== 'cat_income')
      .map((cat) => {
        const catSpent = transactions
          .filter((t) => t.type === 'expense' && t.categoryId === cat.id && isInMonth(t.date, year, month))
          .reduce((sum, t) => {
            const personalShare = t.split ? t.split.yourShare : t.amount;
            return sum + personalShare;
          }, 0);

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
      if (matchedAcc) {
        candidateTxs = candidateTxs.filter((t) => t.accountId === matchedAcc.id || t.toAccountId === matchedAcc.id);
      }
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
      if (matchedAcc) {
        result = result.filter((t) => t.accountId === matchedAcc.id || t.toAccountId === matchedAcc.id);
      }
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
    return (
      categories.find((c) => c.id === catId) || {
        id: catId,
        name: 'Expense',
        color: '#8E919D',
        iconName: 'MoreHorizontal',
      }
    );
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
  storage: createJSONStorage(() => ({
    getItem: async (key: string) => {
      let value = await AsyncStorage.getItem(key);
      if (!value && key === '@expense_data_v1') {
        value = await AsyncStorage.getItem('@subo_expense_v1');
      }
      return value;
    },
    setItem: async (key: string, value: string) => {
      await AsyncStorage.setItem(key, value);
    },
    removeItem: async (key: string) => {
      await AsyncStorage.removeItem(key);
      if (key === '@expense_data_v1') {
        await AsyncStorage.removeItem('@subo_expense_v1');
      }
    },
  })),
  merge: (persistedState: unknown, currentState: ExpenseState): ExpenseState => {
    const ps = (persistedState || {}) as Partial<ExpenseState>;
    const merged: ExpenseState = { ...currentState, ...ps };
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
    selectedMonth: state.selectedMonth,
    eventFolders: state.eventFolders,
    quickPresets: state.quickPresets,
    selectedTransactionIds: state.selectedTransactionIds,
    activeAccountFilter: state.activeAccountFilter,
    smartSearchQuery: state.smartSearchQuery,
    ruleCount: state.ruleCount,
    hasInitialAppLoaded: state.hasInitialAppLoaded,
    hasSeenWalkthrough: state.hasSeenWalkthrough,
    learnedMerchantRules: state.learnedMerchantRules,
    statementSetup: state.statementSetup,
  }),
}
)
);
