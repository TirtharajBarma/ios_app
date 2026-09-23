import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@/utils/storage';
import { ExpenseAccount, ExpenseCategory, ExpenseTransaction } from '@/types/expense';
import { expenseColors } from '@/constants/expenseColors';

export type AppThemeMode = 'editorial' | 'cream' | 'midnight' | 'system';

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
  selectedTransactionIds: string[];
  activeAccountFilter: string; // 'All' or account id/name
  smartSearchQuery: string;

  // Actions
  setSelectedMonth: (month: string) => void;
  setMonthlyBudget: (budget: number) => void;
  setThemeMode: (theme: AppThemeMode) => void;
  setCurrency: (code: string, symbol: string) => void;
  setActiveAccountFilter: (filter: string) => void;
  setSmartSearchQuery: (query: string) => void;

  addTransaction: (tx: Omit<ExpenseTransaction, 'id'>) => void;
  removeTransactions: (ids: string[]) => void;
  toggleSelectTransaction: (id: string) => void;
  clearSelectedTransactions: () => void;
  selectAllTransactions: () => void;

  categoryBudgets: Record<string, number>; // categoryId -> custom budget limit

  addAccount: (acc: Omit<ExpenseAccount, 'id' | 'txnCountThisMonth' | 'monthlyChange'>) => void;
  updateAccount: (id: string, updates: Partial<ExpenseAccount>) => void;
  deleteAccount: (id: string) => void;
  archiveAccount: (id: string) => void;

  addCategory: (cat: Omit<ExpenseCategory, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<ExpenseCategory>) => void;
  deleteCategory: (id: string) => void;
  setCategories: (categories: ExpenseCategory[]) => void;
  reorderCategories: (fromIndex: number, toIndex: number) => void;
  setCategoryBudget: (catId: string, amount: number) => void;
  setAllCategoryBudgets: (budgets: Record<string, number>) => void;

  // Derived Calculations
  getTotalBalance: () => number;
  getTotalIncome: () => number;
  getTotalSpent: () => number;
  getNetBalance: () => number;
  getRemainingBudget: () => number;
  getOverspentPercentage: () => number;
  getCategoryBreakdown: () => Array<{
    category: ExpenseCategory;
    amount: number;
    percentage: number;
  }>;
  getTopCategory: () => {
    category: ExpenseCategory;
    amount: number;
    percentage: number;
  } | null;

  getFilteredTransactions: () => ExpenseTransaction[];
  getCategoryById: (catId: string) => ExpenseCategory;
}

const INITIAL_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat_cig', name: 'Cigarettes', emoji: '🚬', color: expenseColors.categories.cig, iconName: 'Star' },
  { id: 'cat_shop', name: 'Shopping', color: expenseColors.categories.shop, iconName: 'ShoppingBag' },
  { id: 'cat_ent', name: 'Entertainment', color: expenseColors.categories.ent, iconName: 'Tv' },
  { id: 'cat_health', name: 'Health', color: expenseColors.categories.health, iconName: 'Heart' },
  { id: 'cat_fin', name: 'Finance', color: expenseColors.categories.fin, iconName: 'Banknote' },
  { id: 'cat_trans', name: 'Transport', color: expenseColors.categories.trans, iconName: 'Car' },
  { id: 'cat_util', name: 'Utilities', color: expenseColors.categories.util, iconName: 'Zap' },
  { id: 'cat_misc', name: 'Misc', color: expenseColors.categories.misc, iconName: 'MoreHorizontal' },
  { id: 'cat_food', name: 'Food', color: expenseColors.categories.food, iconName: 'UtensilsCrossed' },
  { id: 'cat_income', name: 'Income', color: expenseColors.accentGreen, iconName: 'Coins' },
];

const INITIAL_ACCOUNTS: ExpenseAccount[] = [
  {
    id: 'acc_slice',
    name: 'Slice',
    txnCountThisMonth: 9,
    balance: 8967,
    monthlyChange: 8967,
    statusType: 'positive',
  },
  {
    id: 'acc_hdfc',
    name: 'HDFC',
    txnCountThisMonth: 1,
    balance: 2771,
    monthlyChange: 2771,
    statusType: 'positive',
  },
  {
    id: 'acc_amazon',
    name: 'Amazon Pay Wallet',
    txnCountThisMonth: 2,
    balance: 1385,
    monthlyChange: 1385,
    statusType: 'positive',
  },
  {
    id: 'acc_neo',
    name: 'Neo Axis',
    txnCountThisMonth: 5,
    balance: 0,
    dueAmount: 677,
    monthlyChange: -677,
    statusType: 'due',
  },
  {
    id: 'acc_myzone',
    name: 'Myzone Axis',
    txnCountThisMonth: 1,
    balance: 0,
    dueAmount: 119,
    monthlyChange: -119,
    statusType: 'due',
  },
  {
    id: 'acc_sbi',
    name: 'SBI',
    txnCountThisMonth: 3,
    balance: 0,
    monthlyChange: 0,
    statusType: 'no_change',
  },
];

const INITIAL_TRANSACTIONS: ExpenseTransaction[] = [
  { id: 'tx_1', amount: 14, type: 'expense', categoryId: 'cat_cig', accountId: 'acc_slice', date: '2026-09-22', note: 'CIGARETTES' },
  { id: 'tx_2', amount: 131, type: 'expense', categoryId: 'cat_trans', accountId: 'acc_hdfc', date: '2026-09-22', note: 'SUDHA OFFICE UBER' },
  { id: 'tx_3', amount: 119, type: 'expense', categoryId: 'cat_ent', accountId: 'acc_myzone', date: '2026-09-21', note: 'MOVIE' },
  { id: 'tx_4', amount: 27, type: 'expense', categoryId: 'cat_trans', accountId: 'acc_hdfc', date: '2026-09-21', note: 'AUTO' },
  { id: 'tx_5', amount: 86, type: 'expense', categoryId: 'cat_food', accountId: 'acc_neo', date: '2026-09-21', note: 'LUNCH' },
  { id: 'tx_6', amount: 202, type: 'expense', categoryId: 'cat_shop', accountId: 'acc_amazon', date: '2026-09-15', note: 'AMAZON PURCHASES' },
  { id: 'tx_7', amount: 1092, type: 'expense', categoryId: 'cat_cig', accountId: 'acc_slice', date: '2026-09-14', note: 'CIGARETTES PACK' },
  { id: 'tx_8', amount: 100, type: 'expense', categoryId: 'cat_trans', accountId: 'acc_slice', date: '2026-09-14', note: 'METRO PASS' },
  { id: 'tx_9', amount: 86, type: 'expense', categoryId: 'cat_food', accountId: 'acc_neo', date: '2026-09-12', note: 'GROCERIES' },
  { id: 'tx_10', amount: 25, type: 'expense', categoryId: 'cat_misc', accountId: 'acc_sbi', date: '2026-09-10', note: 'MISC CHAI' },
];

export const useExpenseStore = create<ExpenseState>()(
  persist(
    (set, get) => ({
  selectedMonth: 'SEPTEMBER 2026',
  monthlyBudget: 18400,
  currencyCode: 'INR',
  currencySymbol: '₹',
  themeMode: 'midnight',
  ruleCount: 12,

  categoryBudgets: {
    cat_cig: 3000,
    cat_trans: 1500,
    cat_shop: 2000,
    cat_food: 2500,
    cat_ent: 1500,
    cat_misc: 500,
    cat_health: 2000,
    cat_util: 1500,
    cat_fin: 2000,
  },

  categories: INITIAL_CATEGORIES,
  accounts: INITIAL_ACCOUNTS,
  transactions: INITIAL_TRANSACTIONS,
  selectedTransactionIds: [],
  activeAccountFilter: 'All',
  smartSearchQuery: '',

  setSelectedMonth: (month) => set({ selectedMonth: month }),
  setMonthlyBudget: (budget) => set({ monthlyBudget: budget }),
  setThemeMode: (mode) => set({ themeMode: mode }),
  setCurrency: (code, symbol) => set({ currencyCode: code, currencySymbol: symbol }),
  setActiveAccountFilter: (filter) => set({ activeAccountFilter: filter }),
  setSmartSearchQuery: (query) => set({ smartSearchQuery: query }),

  addTransaction: (txData) => {
    const newTx: ExpenseTransaction = {
      ...txData,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    set((state) => ({
      transactions: [newTx, ...state.transactions],
    }));
  },

  removeTransactions: (ids) => {
    set((state) => ({
      transactions: state.transactions.filter((t) => !ids.includes(t.id)),
      selectedTransactionIds: state.selectedTransactionIds.filter((id) => !ids.includes(id)),
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

  addAccount: (accData) => {
    const newAcc: ExpenseAccount = {
      ...accData,
      id: `acc_${Date.now()}`,
      txnCountThisMonth: 0,
      monthlyChange: accData.balance || 0,
      statusType: (accData.dueAmount && accData.dueAmount > 0) ? 'due' : 'positive',
    };
    set((state) => ({
      accounts: [...state.accounts, newAcc],
    }));
  },

  updateAccount: (id, updates) => {
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  },

  deleteAccount: (id) => {
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
    }));
  },

  archiveAccount: (id) => {
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? { ...a, isArchived: true } : a)),
    }));
  },

  addCategory: (catData) => {
    const newCat: ExpenseCategory = {
      ...catData,
      id: `cat_${Date.now()}`,
    };
    set((state) => ({
      categories: [...state.categories, newCat],
    }));
  },

  updateCategory: (id, updates) => {
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  },

  deleteCategory: (id) => {
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }));
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
  },

  setCategoryBudget: (catId, amount) => {
    set((state) => ({
      categoryBudgets: {
        ...state.categoryBudgets,
        [catId]: amount,
      },
    }));
  },

  setAllCategoryBudgets: (budgets) => {
    set({ categoryBudgets: budgets });
  },

  getTotalBalance: () => {
    const { accounts } = get();
    return accounts.reduce((sum, acc) => {
      if (acc.statusType === 'due' && acc.dueAmount) {
        return sum - acc.dueAmount;
      }
      return sum + acc.balance;
    }, 0);
  },

  getTotalIncome: () => {
    const { transactions } = get();
    return transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  },

  getTotalSpent: () => {
    const { transactions } = get();
    return transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  },

  getNetBalance: () => {
    return get().getTotalIncome() - get().getTotalSpent();
  },

  getRemainingBudget: () => {
    return get().monthlyBudget - get().getTotalSpent();
  },

  getOverspentPercentage: () => {
    const totalSpent = get().getTotalSpent();
    const budget = get().monthlyBudget;
    if (totalSpent <= budget) return 0;
    return Number((((totalSpent - budget) / budget) * 100).toFixed(1));
  },

  getCategoryBreakdown: () => {
    const { categories, transactions } = get();
    const totalSpent = get().getTotalSpent();

    return categories
      .filter((c) => c.id !== 'cat_income')
      .map((cat) => {
        const catSpent = transactions
          .filter((t) => t.type === 'expense' && t.categoryId === cat.id)
          .reduce((sum, t) => sum + t.amount, 0);

        const percentage = totalSpent > 0 ? Number(((catSpent / totalSpent) * 100).toFixed(1)) : 0;
        return {
          category: cat,
          amount: catSpent,
          percentage,
        };
      });
  },

  getTopCategory: () => {
    const breakdown = get().getCategoryBreakdown();
    if (breakdown.length === 0) return null;
    const sorted = [...breakdown].sort((a, b) => b.amount - a.amount);
    return sorted[0].amount > 0 ? sorted[0] : null;
  },

  getFilteredTransactions: () => {
    const { transactions, activeAccountFilter, smartSearchQuery, accounts, categories } = get();
    let result = [...transactions];

    // Filter by Account
    if (activeAccountFilter && activeAccountFilter !== 'All') {
      const matchedAcc = accounts.find(
        (a) => a.id === activeAccountFilter || a.name.toLowerCase() === activeAccountFilter.toLowerCase()
      );
      if (matchedAcc) {
        result = result.filter((t) => t.accountId === matchedAcc.id);
      }
    }

    // Filter by Smart Search Query
    if (smartSearchQuery.trim().length > 0) {
      const q = smartSearchQuery.toLowerCase();
      result = result.filter((t) => {
        const cat = categories.find((c) => c.id === t.categoryId);
        const acc = accounts.find((a) => a.id === t.accountId);
        const matchNote = t.note ? t.note.toLowerCase().includes(q) : false;
        const matchCat = cat ? cat.name.toLowerCase().includes(q) : false;
        const matchAcc = acc ? acc.name.toLowerCase().includes(q) : false;
        const matchAmount = t.amount.toString().includes(q);
        return matchNote || matchCat || matchAcc || matchAmount;
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
}),
{
  name: '@subo_expense_v1',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state) => ({
    categories: state.categories,
    categoryBudgets: state.categoryBudgets,
    monthlyBudget: state.monthlyBudget,
    currencyCode: state.currencyCode,
    currencySymbol: state.currencySymbol,
    themeMode: state.themeMode,
    transactions: state.transactions,
    accounts: state.accounts,
  }),
}
)
);
