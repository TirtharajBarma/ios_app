export interface ExpenseCategory {
  id: string;
  name: string;
  emoji?: string;
  color: string;
  iconName?: string;
}

export interface ExpenseAccount {
  id: string;
  name: string;
  type?: 'savings' | 'credit' | 'wallet';
  txnCountThisMonth: number;
  balance: number;
  dueAmount?: number;
  monthlyChange: number; // positive for credit/gain, negative for due/debit
  statusType: 'positive' | 'due' | 'no_change';
  iconType?: string;
  isArchived?: boolean;
}

export interface ExpenseTransaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  accountId: string;
  date: string; // ISO format
  note?: string;
}

export interface ExpenseBudget {
  monthlyLimit: number;
  month: string; // e.g. "2026-09"
}
