import { Platform, NativeModules, Linking } from 'react-native';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useExpenseStore } from '@/store/useExpenseStore';
import { createPendingTransactionFromText, parseFinancialText } from '@/utils/financialParser';
import { PendingTransaction, ExpenseTransaction } from '@/types/expense';
import { logAction, logException } from '@/utils/auditLog';

// Access optional Android Native Module
const { TransactionTracker } = NativeModules;

export interface AutoTrackPermissionStatus {
  isSupported: boolean;
  isGranted: boolean;
  platform: 'android' | 'ios' | 'web';
  reason?: string;
}

/**
 * Checks whether the current device supports and has granted
 * background transaction notification tracking.
 */
export async function checkAutoTrackPermissions(): Promise<AutoTrackPermissionStatus> {
  if (Platform.OS !== 'android') {
    return {
      isSupported: false,
      isGranted: false,
      platform: Platform.OS as 'ios' | 'web',
      reason: 'Background SMS and notification interception is an Android-exclusive capability. Apple iOS sandboxes notifications from other apps.',
    };
  }

  if (!TransactionTracker) {
    return {
      isSupported: true,
      isGranted: false,
      platform: 'android',
      reason: 'Native module not detected in this environment. Rebuild the Android app with prebuild.',
    };
  }

  try {
    const isGranted: boolean = await TransactionTracker.isNotificationListenerEnabled();
    return {
      isSupported: true,
      isGranted: !!isGranted,
      platform: 'android',
    };
  } catch (error) {
    console.warn('[AutoTrack] Failed to query native listener permission:', error);
    return {
      isSupported: true,
      isGranted: false,
      platform: 'android',
      reason: 'Could not read permission status',
    };
  }
}

/**
 * Opens Android system settings for granting Notification Listener access.
 */
export async function openAutoTrackPermissionSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    if (TransactionTracker?.openNotificationListenerSettings) {
      try {
        await TransactionTracker.openNotificationListenerSettings();
        return;
      } catch (e) {
        console.warn('[AutoTrack] Failed to open direct notification listener settings:', e);
      }
    }
    // Fallback to app details settings
    Linking.openSettings().catch(() => {});
  }
}

/**
 * Syncs any unhandled notifications captured by the background service.
 */
export async function drainPendingNativeTransactions(): Promise<number> {
  if (Platform.OS !== 'android' || !TransactionTracker) {
    return 0;
  }

  const { autoTrackSmsEnabled, autoTrackAutoApprove, autoTrackDefaultAccountId } = useSettingsStore.getState();
  if (!autoTrackSmsEnabled) {
    return 0;
  }

  try {
    const rawJson = await TransactionTracker.getPendingNotifications();
    if (!rawJson) return 0;

    const items: Array<{
      id: string;
      packageName: string;
      title: string;
      text: string;
      timestamp: number;
    }> = JSON.parse(rawJson);

    if (!Array.isArray(items) || items.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const item of items) {
      const fullText = `${item.title ? item.title + '. ' : ''}${item.text || ''}`;
      const pendingTx = createPendingTransactionFromText(fullText, item.title || 'Bank Notification', 'notification');

      if (pendingTx) {
        if (autoTrackAutoApprove) {
          // Commit directly to ledger
          await autoApproveTransaction(pendingTx, autoTrackDefaultAccountId);
        } else {
          // Push to pending queue for user review
          await useSettingsStore.getState().addPendingTransaction(pendingTx);
        }
        processedCount++;
      }

      // Acknowledge native item
      await TransactionTracker.ackNotification(item.id);
    }

    return processedCount;
  } catch (error) {
    console.warn('[AutoTrack] Error draining native notifications:', error);
    return 0;
  }
}

/**
 * Automatically converts a pending transaction into an official ExpenseTransaction.
 */
export async function autoApproveTransaction(
  pending: PendingTransaction,
  overrideAccountId?: string | null
): Promise<void> {
  const expenseStore = useExpenseStore.getState();
  const accounts = expenseStore.accounts;
  const categories = expenseStore.categories;

  // 1. Resolve Account
  let targetAccount = accounts.find((a) => a.id === overrideAccountId);
  if (!targetAccount && pending.accountHint) {
    // Try matching last 4 digits
    targetAccount = accounts.find((a) => a.name.includes(pending.accountHint!.replace(/\D/g, '')));
  }
  if (!targetAccount) {
    targetAccount = accounts[0]; // Fallback to primary account
  }

  // 2. Automatically Resolve Category
  let targetCategory: (typeof categories)[0] | undefined;

  if (pending.type === 'income') {
    targetCategory = categories.find((c) => c.id === 'cat_income' || c.name.toLowerCase() === 'income');
  }

  const catHint = (pending.suggestedCategoryId || '').toLowerCase();
  const merchantHint = (pending.merchant || '').toLowerCase();
  const rawTextHint = (pending.rawText || '').toLowerCase();

  const categoryAliasMap: Record<string, string[]> = {
    cat_food: ['food', 'groceries', 'dining', 'restaurant', 'cafe', 'coffee', 'swiggy', 'zomato', 'blinkit', 'zepto', 'instamart', 'starbucks', 'supermarket', 'bakery', 'pizza', 'burger'],
    cat_trans: ['transport', 'commute', 'travel', 'uber', 'ola', 'rapido', 'metro', 'petrol', 'fuel', 'flight', 'railway', 'irctc', 'fastag', 'parking'],
    cat_shop: ['shopping', 'shop', 'amazon', 'flipkart', 'myntra', 'zara', 'h&m', 'clothing', 'retail', 'croma', 'uniqlo', 'ikea'],
    cat_util: ['utilities', 'utility', 'bills', 'electricity', 'water', 'gas', 'broadband', 'wifi', 'recharge', 'airtel', 'jio', 'vi', 'bescom'],
    cat_ent: ['entertainment', 'movies', 'cinema', 'netflix', 'spotify', 'hotstar', 'pvr', 'theatre', 'gaming', 'steam', 'playstation', 'bookmyshow'],
    cat_health: ['health', 'medical', 'pharmacy', 'hospital', 'doctor', 'medicine', 'apollo', 'pharmeasy', '1mg'],
    cat_subs: ['subscription', 'renewal', 'membership'],
    cat_fin: ['finance', 'bank', 'atm', 'loan', 'interest', 'investment', 'mutual fund'],
  };

  if (!targetCategory && catHint) {
    targetCategory = categories.find((c) => c.id.toLowerCase() === catHint);
  }

  if (!targetCategory) {
    for (const [targetCatId, aliases] of Object.entries(categoryAliasMap)) {
      if (aliases.some((a) => a === catHint || merchantHint.includes(a) || rawTextHint.includes(a))) {
        targetCategory = categories.find((c) => c.id === targetCatId);
        if (targetCategory) break;
      }
    }
  }

  if (!targetCategory && catHint) {
    targetCategory = categories.find((c) => c.name.toLowerCase().includes(catHint) || catHint.includes(c.name.toLowerCase()));
  }

  if (!targetCategory) {
    targetCategory = categories.find((c) => c.id === 'cat_food') || categories[0];
  }

  // 3. Deduplication check: verify if an identical transaction was recorded in the last 5 minutes
  const existingRecent = expenseStore.transactions.some(
    (t) =>
      t.amount === pending.amount &&
      t.type === pending.type &&
      t.date === pending.date &&
      Math.abs(Date.now() - (typeof t.createdAt === 'number' ? t.createdAt : new Date(t.createdAt || 0).getTime())) < 300000
  );
  if (existingRecent) {
    return;
  }

  // 4. Add to ledger
  const newTx: Omit<ExpenseTransaction, 'id'> = {
    amount: pending.amount,
    type: pending.type,
    categoryId: targetCategory?.id || 'other',
    accountId: targetAccount?.id || 'default_acc',
    accountName: targetAccount?.name,
    date: pending.date,
    merchant: pending.merchant,
    note: `Auto-tracked from ${pending.sender}`,
    createdAt: pending.timestamp || Date.now(),
  };

  await expenseStore.addTransaction(newTx);
  logAction('transaction', `Auto-tracked transaction approved: ${pending.amount}`, { merchant: pending.merchant });
}

/**
 * Test / Simulation helper for verification & simulator playground.
 */
export async function simulateIncomingFinancialMessage(
  rawText: string,
  sender: string = 'Test Bank'
): Promise<PendingTransaction | null> {
  const pendingTx = createPendingTransactionFromText(rawText, sender, 'manual_test');
  if (!pendingTx) return null;

  const { autoTrackAutoApprove, autoTrackDefaultAccountId } = useSettingsStore.getState();
  if (autoTrackAutoApprove) {
    await autoApproveTransaction(pendingTx, autoTrackDefaultAccountId);
  } else {
    await useSettingsStore.getState().addPendingTransaction(pendingTx);
  }

  return pendingTx;
}
