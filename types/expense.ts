export type TransactionType = 'expense' | 'income' | 'transfer' | 'debt_lend' | 'debt_borrow';

export interface SplitDetails {
  totalPaid: number;
  yourShare: number;
  friendsShare: number;
  friendNames?: string;
  settled?: boolean;
}

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
  type?: 'savings' | 'credit' | 'wallet' | 'cash';
  openingBalance?: number;
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
  type: TransactionType;
  categoryId: string;
  accountId: string; // From Account
  toAccountId?: string; // To Account (for transfers)
  date: string; // ISO format (yyyy-MM-dd)
  note?: string;
  tag?: string; // Event/Trip folder tag e.g. "Goa Trip", "Night Out"
  split?: SplitDetails;
  borrowerOrLender?: string;
  isSettled?: boolean;
}

export interface ExpenseBudget {
  monthlyLimit: number;
  month: string; // e.g. "2026-09"
}
