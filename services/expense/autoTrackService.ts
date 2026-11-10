import { Platform, NativeModules, Linking } from 'react-native';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useExpenseStore } from '@/store/useExpenseStore';
import { createPendingTransactionFromText, parseFinancialText } from '@/utils/financialParser';
import { PendingTransaction, ExpenseTransaction, ExpenseAccount, ExpenseCategory } from '@/types/expense';
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
      // Use the time the bank message arrived, not the time we got around to draining it
      const receivedAt = Number.isFinite(item.timestamp) && item.timestamp > 0 && item.timestamp <= Date.now() ? item.timestamp : Date.now();
      const pendingTx = createPendingTransactionFromText(fullText, item.title || 'Bank Notification', 'notification', receivedAt);

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

/** Known bank/wallet brand keywords */
const BANK_BRAND_KEYWORDS: Record<string, string[]> = {
  slice: ['slice', 'slicebank', 'sliceit', 'slice.bank.in'],
  hdfc: ['hdfc', 'hdfcbank', 'hdfcbank.net'],
  icici: ['icici', 'icicibank', 'icicibank.com', 'imobile'],
  sbi: ['sbi', 'state bank', 'onlinesbi', 'sbi.co.in', 'sbicard'],
  axis: ['axis', 'axisbank', 'axisbank.com', 'neo axis', 'myzone axis', 'myzone'],
  kotak: ['kotak', 'kotakbank', '811'],
  onecard: ['onecard', 'one card', 'fpl', 'onecard.co'],
  jupiter: ['jupiter', 'jupiter.money'],
  fi: ['fi money', 'epifi', 'fi.money'],
  uni: ['uni card', 'uni.club'],
  cred: ['cred', 'cred.club'],
  scapia: ['scapia', 'scapia.cards'],
  amazon: ['amazon pay', 'amazon', 'amzn'],
  paytm: ['paytm'],
  phonepe: ['phonepe'],
  gpay: ['gpay', 'google pay'],
  indusind: ['indusind'],
  pnb: ['pnb', 'punjab national'],
  canara: ['canara'],
  bob: ['bank of baroda', 'baroda', 'bob'],
  idfc: ['idfc', 'idfc first'],
  rbl: ['rbl'],
  yesbank: ['yes bank', 'yesbank'],
  citi: ['citi', 'citibank'],
  amex: ['amex', 'american express'],
  federal: ['federal bank'],
  au: ['au small', 'aubank'],
  bandhan: ['bandhan'],
  ubii: ['union bank'],
  boi: ['bank of india'],
  central: ['central bank'],
  hsbc: ['hsbc'],
  scb: ['standard chartered', 'stanbic', 'scb'],
  chase: ['chase'],
  bofa: ['bank of america', 'bofa'],
  wells: ['wells fargo'],
  revolut: ['revolut'],
  monzo: ['monzo'],
};

/**
 * Detects if an incoming pending transaction matches an existing transaction
 * already recorded in the ledger (including manual expenses, splits, debts/lent).
 */
export function findMatchingExistingTransaction(
  pending: PendingTransaction,
  transactions: ExpenseTransaction[]
): ExpenseTransaction | undefined {
  if (!pending.amount || !pending.date) return undefined;

  const pendingDateObj = new Date(pending.date);

  return transactions.find((t) => {
    // 1. Amount must match
    const amountMatches = Math.abs(t.amount - pending.amount) < 0.01;
    if (!amountMatches) return false;

    // 2. Date proximity check (within ±2 days to account for delayed bank alerts)
    const txDateObj = new Date(t.date);
    const dayDiff = Math.abs((pendingDateObj.getTime() - txDateObj.getTime()) / (1000 * 60 * 60 * 24));
    if (dayDiff > 2.5) return false;

    // 3. Merchant / Payee / Note matching
    const tMerchant = (t.merchant || '').toLowerCase().trim();
    const pMerchant = (pending.merchant || '').toLowerCase().trim();
    const tNote = (t.note || '').toLowerCase().trim();

    // If both have merchant names:
    if (tMerchant && pMerchant) {
      const tm = tMerchant.replace(/[^a-z0-9]/g, '');
      const pm = pMerchant.replace(/[^a-z0-9]/g, '');
      if (tm.length >= 3 && pm.length >= 3) {
        if (tm.includes(pm) || pm.includes(tm)) {
          return true; // Real merchant match
        }
        // Both have distinct non-matching merchants (e.g. 'cigarettes' vs 'akhilmallik')
        // So this is a different expense, not a duplicate!
        return false;
      }
    }

    // If pending merchant appears in user's notes or vice versa
    if (pMerchant && pMerchant.length >= 3 && tNote.includes(pMerchant)) {
      return true;
    }
    if (tMerchant && tMerchant.length >= 3 && (pending.rawText || '').toLowerCase().includes(tMerchant)) {
      return true;
    }

    // Only if pending merchant is unknown or missing, and exact same date + same amount
    if (!pMerchant || pMerchant === 'unknown merchant') {
      if (t.date === pending.date) {
        return true;
      }
    }

    return false;
  });
}

/** Which account a pending transaction will be booked to (shared by the review UI and approval). */
export function resolvePendingAccount(
  pending: PendingTransaction,
  overrideAccountId: string | null | undefined,
  accounts: ExpenseAccount[]
): ExpenseAccount | undefined {
  if (!accounts || accounts.length === 0) return undefined;

  // 1. If user explicitly picked an override account in the review UI, respect it
  if (overrideAccountId) {
    const forced = accounts.find((a) => a.id === overrideAccountId);
    if (forced) return forced;
  }

  const rawCorpus = `${pending.sender || ''} ${pending.accountHint || ''} ${pending.rawText || ''}`.toLowerCase();
  const rawDigits = (pending.accountHint || rawCorpus).replace(/\D/g, '');

  // 2. Exact 4-digit or 3-digit card/account match in account name
  if (rawDigits.length >= 3) {
    const last3or4 = rawDigits.slice(-4);
    const digitMatch = accounts.find((a) => {
      const aDigits = a.name.replace(/\D/g, '');
      return aDigits.length >= 3 && (aDigits.includes(last3or4) || last3or4.includes(aDigits));
    });
    if (digitMatch) return digitMatch;
  }

  const isCreditCardContext = /\b(credit\s*card|card\s*ending|card\s*no|card\s*\*\*|card\s*xx|spent\s+on\s+card|swiped)\b/i.test(rawCorpus);
  const isSavingsContext = /\b(a\/c|savings|salary|current\s*a\/c|debited\s*from\s*a\/c|account\s*ending)\b/i.test(rawCorpus);

  // 3. Dynamic Name & Domain Matching:
  // Check if any user account name or keywords match the sender or email body
  let bestAccount: ExpenseAccount | null = null;
  let highestScore = 0;

  for (const acc of accounts) {
    let score = 0;
    const aNameLower = acc.name.toLowerCase().trim();

    // Exact name in corpus (e.g. "slice" in "slice <noreply@slice.bank.in>")
    if (aNameLower.length >= 3 && rawCorpus.includes(aNameLower)) {
      score += 50;
    }

    // Individual words in account name (e.g. "Slice", "Axis", "SBI", "ICICI", "Amazon", "Paytm")
    const words = aNameLower.split(/[\s_-]+/).filter((w) => w.length >= 3);
    for (const word of words) {
      if (['bank', 'card', 'account', 'pay', 'wallet'].includes(word)) continue;
      if (rawCorpus.includes(word)) {
        score += 30;
      }
    }

    // Check sender email specifically (e.g. noreply@slice.bank.in -> contains "slice")
    const senderClean = (pending.sender || '').toLowerCase();
    for (const word of words) {
      if (['bank', 'card', 'account', 'pay', 'wallet'].includes(word)) continue;
      if (senderClean.includes(word)) {
        score += 40;
      }
    }

    // Context bonus
    if (isCreditCardContext && (acc.type === 'credit' || /credit|card/i.test(acc.name))) {
      score += 10;
    }
    if (isSavingsContext && (acc.type === 'savings' || /savings|salary|current/i.test(acc.name))) {
      score += 10;
    }

    if (score > highestScore) {
      highestScore = score;
      bestAccount = acc;
    }
  }

  if (bestAccount && highestScore >= 30) {
    return bestAccount;
  }

  // 4. Known Bank Brands Dictionary matching
  let candidateBankKey: string | null = null;
  for (const [brandKey, keywords] of Object.entries(BANK_BRAND_KEYWORDS)) {
    if (keywords.some((kw) => rawCorpus.includes(kw))) {
      candidateBankKey = brandKey;
      break;
    }
  }

  if (candidateBankKey) {
    const bankKeywords = BANK_BRAND_KEYWORDS[candidateBankKey];
    const brandMatchingAccounts = accounts.filter((a) => {
      const aName = a.name.toLowerCase();
      return bankKeywords.some((kw) => aName.includes(kw));
    });

    if (brandMatchingAccounts.length === 1) {
      return brandMatchingAccounts[0];
    }

    if (brandMatchingAccounts.length > 1) {
      if (isCreditCardContext) {
        const cardAcc = brandMatchingAccounts.find(
          (a) => a.type === 'credit' || /credit|card/i.test(a.name)
        );
        if (cardAcc) return cardAcc;
      }
      if (isSavingsContext) {
        const savingsAcc = brandMatchingAccounts.find(
          (a) => a.type === 'savings' || /savings|salary|current/i.test(a.name)
        );
        if (savingsAcc) return savingsAcc;
      }
      return brandMatchingAccounts[0];
    }
  }

  // 5. Fallback to user's configured default account or primary account
  const defaultAccId = useSettingsStore.getState().autoTrackDefaultAccountId;
  if (defaultAccId) {
    const def = accounts.find((a) => a.id === defaultAccId);
    if (def) return def;
  }

  return accounts[0];
}

/** Which category a pending transaction will be booked under (shared by the review UI and approval). */
export function resolvePendingCategory(
  pending: PendingTransaction,
  categories: ExpenseCategory[],
  overrideCategoryId?: string | null
): ExpenseCategory | undefined {
  if (overrideCategoryId) {
    const forced = categories.find((c) => c.id === overrideCategoryId);
    if (forced) return forced;
  }

  let targetCategory: ExpenseCategory | undefined;

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
    // Short aliases ("vi", "ola", "gas") must be whole words, or "via UPI" would match "vi" and "cola" would match "ola"
    const hasAlias = (hay: string, a: string) =>
      a.length <= 4 ? new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(hay) : hay.includes(a);
    for (const [targetCatId, aliases] of Object.entries(categoryAliasMap)) {
      if (aliases.some((a) => a === catHint || hasAlias(merchantHint, a) || hasAlias(rawTextHint, a))) {
        targetCategory = categories.find((c) => c.id === targetCatId);
        if (targetCategory) break;
      }
    }
  }

  if (!targetCategory && catHint) {
    targetCategory = categories.find((c) => c.name.toLowerCase().includes(catHint) || catHint.includes(c.name.toLowerCase()));
  }

  if (!targetCategory) {
    // Unknown spend is Misc, not Food: guessing Food silently skews the Food budget
    targetCategory = categories.find((c) => c.id === 'cat_misc') || categories.find((c) => c.id === 'cat_food') || categories[0];
  }
  return targetCategory;
}

/**
 * Converts a pending transaction into an official ExpenseTransaction.
 * Returns false when it was skipped as a duplicate, true when it was added to the ledger.
 * `manual` = the user explicitly approved it in the review screen, so it is never skipped as a duplicate.
 */
export async function autoApproveTransaction(
  pending: PendingTransaction,
  overrideAccountId?: string | null,
  opts?: { manual?: boolean; overrideCategoryId?: string | null }
): Promise<boolean> {
  const expenseStore = useExpenseStore.getState();

  // Deduplication for automatic capture (checks existing ledger for manual entries, debts, splits)
  if (!opts?.manual) {
    const existingMatch = findMatchingExistingTransaction(pending, expenseStore.transactions);
    if (existingMatch) {
      logAction('transaction', `Auto-approve skipped: already exists in ledger (ID ${existingMatch.id})`);
      return false;
    }
  }

  const targetAccount = resolvePendingAccount(pending, overrideAccountId, expenseStore.accounts);
  const targetCategory = resolvePendingCategory(pending, expenseStore.categories, opts?.overrideCategoryId);

  // Add to ledger
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
  return true;
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
