import { TransactionType, PendingTransaction } from '@/types/expense';

export interface ParsedFinancialMessage {
  isFinancial: boolean;
  type?: TransactionType;
  amount?: number;
  currency?: string;
  merchant?: string;
  accountHint?: string;
  referenceId?: string;
  date?: string;
  categorySuggestion?: string;
  confidence: number; // 0 to 1
  reason?: string;
}

// Anti-patterns that disqualify an SMS from being a real monetary transaction
const OTP_OR_AUTH_PATTERNS = [
  /\b(otp|one[- ]time[- ]password|verification[- ]code|secret[- ]code|auth[- ]code|security[- ]code)\b/i,
  /\bdo not share\b/i,
  /\bvalid for \d+\s*(mins?|minutes?|secs?|seconds?)\b/i,
  /\blogin code\b/i,
];

const PROMOTIONAL_OR_SPAM_PATTERNS = [
  /\b(pre[- ]approved|apply now|congratulations|claim your|win up to|special offer|personal loan)\b/i,
  /\b(zero interest|flat \d+% off|limited time offer|discount code)\b/i,
  /\bcredit limit (increased|enhanced|upgraded)\b/i,
  /\b(bill generated|payment is due on|minimum amount due|total amount due)\b/i,
  // "payment of Rs X due on 15th": a reminder, not a transaction
  /\bpayment\b[^.]*\bdue\b/i,
  /\bdue (?:on|by) \d/i,
  // The card issuer acknowledging a bill payment; the bank-side debit is the real transaction
  /\b(?:credit\s*card|card)\b[^.]*\bpayment\b[^.]*\b(?:received|successful|posted)\b/i,
];

// Currency regex symbols & codes
const CURRENCY_REGEX_PART = '(?:INR|Rs\\.?|₹|USD|\\$|EUR|€|GBP|£|AED|CAD|AUD|SGD)';

// Known merchant to category mappings
const MERCHANT_CATEGORY_KEYWORDS: Record<string, string[]> = {
  'food': [
    'swiggy', 'zomato', 'starbucks', 'mcdonald', 'kfc', 'burger king', 'domino', 'pizza',
    'cafe', 'coffee', 'restaurant', 'bakery', 'eats', 'diner', 'subway', 'barbeque'
  ],
  'groceries': [
    'blinkit', 'zepto', 'instamart', 'bigbasket', 'dmart', 'spencer', 'grocery', 'supermarket',
    'nature basket', 'reliance retail', 'fresh'
  ],
  'commute': [
    'uber', 'ola', 'rapido', 'metro', 'irctc', 'fastag', 'petrol', 'fuel', 'shell', 'hpcl',
    'bpcl', 'iocl', 'flight', 'indigo', 'air india', 'makemytrip', 'parking'
  ],
  'shopping': [
    'amazon', 'flipkart', 'myntra', 'zara', 'h&m', 'ajio', 'meesho', 'nykaa', 'apple', 'croma',
    'uniqlo', 'ikea', 'tata cliq'
  ],
  'entertainment': [
    'netflix', 'spotify', 'hotstar', 'prime video', 'youtube', 'bookmyshow', 'cinema', 'pvr',
    'inox', 'playstation', 'steam'
  ],
  'bills': [
    'electricity', 'bescom', 'water bill', 'gas bill', 'airtel', 'jio', 'vi prepaid', 'vi postpaid',
    'broadband', 'recharge', 'wifi'
  ],
};

function formatTodayDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Same regex, but the leading optional currency group becomes mandatory. */
function withRequiredCurrency(re: RegExp): RegExp {
  return new RegExp(re.source.replace(`(${CURRENCY_REGEX_PART})?`, `(${CURRENCY_REGEX_PART})`), re.flags);
}

/**
 * Parses raw SMS or notification body to identify financial transactions.
 */
export function parseFinancialText(
  text: string,
  sender: string = '',
  receivedTimestamp: number = Date.now()
): ParsedFinancialMessage {
  if (!text || typeof text !== 'string') {
    return { isFinancial: false, confidence: 0, reason: 'Empty text' };
  }

  const cleanText = text.replace(/\s+/g, ' ').trim();

  // 1. Filter out OTP / 2FA / Authentication messages
  for (const pattern of OTP_OR_AUTH_PATTERNS) {
    if (pattern.test(cleanText)) {
      return { isFinancial: false, confidence: 0, reason: 'OTP or security code detected' };
    }
  }

  // 2. Filter out Spam / Promotional messages
  for (const pattern of PROMOTIONAL_OR_SPAM_PATTERNS) {
    if (pattern.test(cleanText)) {
      return { isFinancial: false, confidence: 0, reason: 'Promotional or marketing text detected' };
    }
  }

  // 3. Determine Transaction Type (Expense vs Income)
  let type: TransactionType | undefined;
  const isDebit = /\b(debited|spent|paid|withdrawn|purchase|deducted|charged|sent|transfer(?:red)?|txn|tranx|transaction|swiped|used|payment)\b/i.test(cleanText);
  const isCredit = /\b(credited|received|deposited|refund(?:ed)?|cashback|salary|added to account|reversal|reversed)\b/i.test(cleanText);

  if (isDebit && !isCredit) {
    type = 'expense';
  } else if (isCredit && !isDebit) {
    type = 'income';
  } else if (isDebit && isCredit) {
    // Both appear: check if it's a refund/reversal or an actual spend debited from account
    if (/\b(refund|cashback|reversal|reversed|salary)\b/i.test(cleanText)) {
      type = 'income';
    } else if (/\b(?:debited\s+from|spent\s+on|paid\s+to|charged\s+to)\b/i.test(cleanText)) {
      type = 'expense';
    } else {
      const debitIdx = cleanText.search(/\b(debited|spent|paid|withdrawn|transferred|txn|tranx|swiped)\b/i);
      const creditIdx = cleanText.search(/\b(credited|received|deposited)\b/i);
      type = debitIdx < creditIdx ? 'expense' : 'income';
    }
  } else {
    // Neither debit nor credit found
    return { isFinancial: false, confidence: 0, reason: 'No debit/credit transaction verb found' };
  }

  // 4. Extract Amount and Currency
  // Match patterns like: "INR 450.00", "Rs. 1,200", "Rs 500", "₹350", "$24.99", "Rs 450/-"
  let extractedAmount: number | undefined;
  let extractedCurrency = 'INR';

  // Specific regex looking for amount near action verbs
  const contextualAmountRegex = new RegExp(
    `(?:(?:debited|spent|paid|credited|received|refund(?:ed)?|withdrawn|purchase(?: of)?|transferred|transfer of|txn of|tranx of|transaction of|payment of|swiped for|sent)\\s*(?:by|with|for|of|to)?\\s*)` +
    `(${CURRENCY_REGEX_PART})?\\s*([0-9]+(?:,[0-9]+)*(?:\\.[0-9]{1,2})?)`,
    'i'
  );

  const reverseContextRegex = new RegExp(
    `(${CURRENCY_REGEX_PART})?\\s*([0-9]+(?:,[0-9]+)*(?:\\.[0-9]{1,2})?)\\s*` +
    `(?:(?:is|has been|was|done)?\\s*(?:debited|spent|paid|credited|received|withdrawn|transferred|deducted|charged|sent))`,
    'i'
  );

  const fallbackAmountRegex = new RegExp(
    `(${CURRENCY_REGEX_PART})\\s*([0-9]+(?:,[0-9]+)*(?:\\.[0-9]{1,2})?)`,
    'i'
  );

  // Balances and limits are never the transaction amount ("Avl Bal INR 5,000.00", "balance is Rs 5,000").
  const textForAmount = cleanText.replace(
    new RegExp(
      `\\b(?:(?:avl|avail(?:able)?|total|closing|current|ledger)\\s+)?(?:bal(?:ance)?|limit)\\b\\s*(?:is|of|:|-)?\\s*(?:${CURRENCY_REGEX_PART})?\\s*[0-9][0-9,]*(?:\\.[0-9]+)?(?:\\s*(?:cr|dr)\\b)?`,
      'gi'
    ),
    ' '
  );

  // Prefer amounts that carry a currency marker, so a stray number (an a/c or loan number) is never taken.
  let match =
    textForAmount.match(withRequiredCurrency(contextualAmountRegex)) ||
    textForAmount.match(withRequiredCurrency(reverseContextRegex)) ||
    textForAmount.match(fallbackAmountRegex) ||
    textForAmount.match(contextualAmountRegex) ||
    textForAmount.match(reverseContextRegex);

  if (match) {
    const rawCurr = match[1];
    const rawVal = match[2];

    if (rawVal) {
      const parsedVal = parseFloat(rawVal.replace(/,/g, ''));
      if (!isNaN(parsedVal) && parsedVal > 0) {
        extractedAmount = parsedVal;
      }
    }

    if (rawCurr) {
      const c = rawCurr.toUpperCase().replace(/\./g, '').trim();
      if (c === '$' || c === 'USD') extractedCurrency = 'USD';
      else if (c === '€' || c === 'EUR') extractedCurrency = 'EUR';
      else if (c === '£' || c === 'GBP') extractedCurrency = 'GBP';
      else if (c === 'AED') extractedCurrency = 'AED';
      else if (c === '₹' || c === 'RS' || c === 'INR') extractedCurrency = 'INR';
      else extractedCurrency = c;
    }
  }

  if (!extractedAmount) {
    return { isFinancial: false, confidence: 0, reason: 'Could not extract valid transaction amount' };
  }

  // 5. Extract Account / Card identifier (e.g. "a/c ending 1234", "card **5678", "A/c *4321")
  let accountHint: string | undefined;
  const accountMatch = cleanText.match(/(?:a\/c|acct|account|card)\s*(?:no\.?)?\s*(?:ending\s+with\s+|ending\s+|xx+|\*+)?([0-9]{3,4})/i);
  if (accountMatch && accountMatch[1]) {
    accountHint = `ending ${accountMatch[1]}`;
  }

  // 6. Extract Merchant / Payee
  let merchant: string | undefined;

  if (/\b(?:atm|cash\s+withdrawal)\b/i.test(cleanText)) {
    merchant = 'ATM Cash Withdrawal';
  } else {
    const merchantRegexes = [
      // "to VPA swiggy@icici", "to user@upi"
      /(?:vpa|upi\s+id)\s+([A-Za-z0-9._-]+@[A-Za-z0-9]+)/i,
      // "by UPI/Swiggy" or "towards UPI/swiggy@icici" or "UPI/P2M/123/Swiggy"
      /(?:towards|by|via)\s+upi\/(?:[A-Za-z0-9_]+\/)?([A-Za-z0-9\s&'.-]{2,25})/i,
      // "at STARBUCKS", "for AMAZON", "merchant ZOMATO"
      /(?:at|for|merchant)\s+([A-Za-z0-9\s&'.-]{2,30}?)(?:\s+(?:on|via|ref|upi|bal|available|\.|\band\b|$))/i,
      // "paid to STARBUCKS", "transferred to JOHN", "sent to RAMESH"
      /(?:paid\s+to|transfer(?:red)?\s+to|sent\s+to)\s+([A-Za-z0-9\s&'.-]{2,30}?)(?:\s+(?:on|via|ref|upi|bal|available|at|\.|\band\b|$))/i,
      // "to STARBUCKS"
      /\bto\s+([A-Za-z0-9\s&'.-]{2,30}?)(?:\s+(?:on|via|ref|upi|bal|available|at|\.|\band\b|$))/i,
      // "info: POS 1234 STARBUCKS"
      /(?:info[:\s]+)([A-Za-z0-9\s&'.-]{2,30})/i,
    ];

    for (const regex of merchantRegexes) {
      const mMatch = cleanText.match(regex);
      if (mMatch && mMatch[1]) {
        let candidate = mMatch[1].trim();
        // Stop at the end of the sentence or where a balance statement starts
        candidate = candidate.split(/\.\s|\s(?:avl|avail(?:able)?|bal(?:ance)?)\b/i)[0].trim().replace(/[.,;:]+$/, '');
        // "UPI-ZOMATO-123" -> "ZOMATO"
        const upiWrapped = candidate.match(/^UPI[-/]([A-Za-z][A-Za-z &]*?)(?:[-/]\d+)?$/i);
        if (upiWrapped) candidate = upiWrapped[1].trim();
        // Disqualify if candidate looks like a currency amount (e.g. "Rs 250.00", "INR 500")
        if (new RegExp(`^${CURRENCY_REGEX_PART}\\s*[0-9]+`, 'i').test(candidate) || /^[0-9,.]+$/.test(candidate)) {
          continue;
        }
        // Disqualify generic bank/system words
        if (/^(your|account|bank|branch|a\/c|card|the|my|upi|ref|ref no|vpa|avail|bal|balance|limit|pos|txn|tranx)$/i.test(candidate)) {
          continue;
        }
        if (candidate.length >= 2) {
          merchant = candidate;
          break;
        }
      }
    }
  }

  // 7. Auto-suggest Category
  let categorySuggestion: string | undefined;
  const searchCorpus = `${merchant || ''} ${cleanText}`.toLowerCase();
  for (const [catKey, keywords] of Object.entries(MERCHANT_CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => searchCorpus.includes(kw))) {
      categorySuggestion = catKey;
      break;
    }
  }

  // 8. Date the message was received (a delayed notification must not be booked on a later day)
  const date = formatTodayDate(new Date(receivedTimestamp));

  return {
    isFinancial: true,
    type,
    amount: extractedAmount,
    currency: extractedCurrency,
    merchant,
    accountHint,
    date,
    categorySuggestion,
    confidence: merchant ? 0.95 : 0.85,
  };
}

/**
 * Creates a unique deterministic hash ID to prevent duplicate transactions.
 */
export function generateTransactionHash(
  amount: number,
  type: string,
  date: string,
  accountHint?: string,
  merchant?: string
): string {
  const parts = [
    Math.round(amount * 100),
    type.toLowerCase(),
    date,
    (accountHint || '').toLowerCase().replace(/\s+/g, ''),
    (merchant || '').toLowerCase().replace(/\s+/g, '').slice(0, 10),
  ];
  return `tx_${parts.join('_')}`;
}

/**
 * Transforms parsed result into a full PendingTransaction entity.
 */
export function createPendingTransactionFromText(
  rawText: string,
  sender: string = 'SMS',
  source: 'sms' | 'notification' | 'manual_test' = 'notification',
  receivedAt: number = Date.now()
): PendingTransaction | null {
  const parsed = parseFinancialText(rawText, sender, receivedAt);
  if (!parsed.isFinancial || !parsed.amount || !parsed.type) {
    return null;
  }

  const id = generateTransactionHash(
    parsed.amount,
    parsed.type,
    parsed.date || formatTodayDate(),
    parsed.accountHint,
    parsed.merchant
  );

  return {
    id,
    source,
    sender: sender || 'Bank',
    rawText,
    amount: parsed.amount,
    currency: parsed.currency || 'INR',
    type: parsed.type,
    merchant: parsed.merchant,
    accountHint: parsed.accountHint,
    suggestedCategoryId: parsed.categorySuggestion,
    date: parsed.date || formatTodayDate(),
    timestamp: receivedAt,
    status: 'pending',
  };
}
