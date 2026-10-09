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
  unbilledDue?: number; // Part of dueAmount spent after the last statement closing (credit cards with billingDay)
  monthlyChange: number; // positive for credit/gain, negative for due/debit
  statusType: 'positive' | 'negative' | 'due' | 'no_change';
  iconType?: string;
  isArchived?: boolean;
  dueDay?: number; // Billing payment due day of month (1-31)
  billingDay?: number; // Statement generation day of month (1-31)
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
  accountName?: string; // Historical account name snapshot
  toAccountId?: string; // To Account (for transfers or vaults)
  toAccountName?: string; // Historical to-account name snapshot
  vaultId?: string; // Target savings vault if deposit/withdraw
  folderId?: string; // Linked Event Folder ID
  folderName?: string; // Linked Event Folder Name
  date: string; // ISO format (yyyy-MM-dd)
  merchant?: string; // Merchant / Payee name (e.g. Starbucks, Uber, Blinkit)
  note?: string; // Extra user memo / optional notes
  tag?: string; // Event/Trip folder tag e.g. "Goa Trip", "Night Out"
  split?: SplitDetails;
  borrowerOrLender?: string;
  isSettled?: boolean;
  settledTxId?: string; // ID of the auto-generated settlement transaction for this debt/split
  settlementTxId?: string; // ID of the debt/split transaction this settlement resolves
  subscriptionId?: string; // Linked subscription ID in useSubscriptionStore
  allocatedMonth?: string; // Optional budget month allocation override (e.g. "NOVEMBER 2026")
  createdAt?: number | string; // Creation timestamp for accurate time-wise reverse-chronological ordering
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

export interface PendingTransaction {
  id: string;
  source: 'sms' | 'notification' | 'manual_test';
  sender: string;
  rawText: string;
  amount: number;
  currency: string;
  type: TransactionType;
  merchant?: string;
  accountHint?: string;
  suggestedCategoryId?: string;
  suggestedAccountId?: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  status: 'pending' | 'approved' | 'dismissed';
}

