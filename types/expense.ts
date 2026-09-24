export type TransactionType = 'expense' | 'income' | 'transfer' | 'debt_lend' | 'debt_borrow' | 'vault_deposit' | 'vault_withdraw';

export interface SplitFriend {
  id: string;
  name: string;
  amount: number;
  settled?: boolean;
}

export interface SplitDetails {
  totalPaid: number;
  yourShare: number;
  friendsShare: number;
  friendNames?: string;
  friends?: SplitFriend[];
  settled?: boolean;
}

export interface EventFolder {
  id: string;
  name: string;
  emoji?: string;
  createdAt: string;
  totalSpent?: number;
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

export interface SavingsVault {
  id: string;
  name: string;
  emoji: string;
  targetAmount: number;
  currentAmount: number;
  color: string;
  category?: string;
  isCompleted?: boolean;
  createdAt?: string;
}

export interface ExpenseTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string; // From Account
  toAccountId?: string; // To Account (for transfers or vaults)
  vaultId?: string; // Target savings vault if deposit/withdraw
  folderId?: string; // Linked Event Folder ID
  folderName?: string; // Linked Event Folder Name
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

export interface QuickExpensePreset {
  id: string;
  label: string;
  emoji?: string;
  amount: number;
  categoryId: string;
  accountId?: string;
  note?: string;
}

