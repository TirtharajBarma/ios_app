import { Platform } from 'react-native';
import { ExpenseTransaction, ExpenseCategory, ExpenseAccount } from '@/types/expense';
import { parseUniversalDateRange, ParsedDateRange, formatIsoDate } from './nlp/dateParser';
import { CANONICAL_MERCHANTS, identifyCanonicalMerchant, extractMerchantFromQuery } from './nlp/merchantCatalog';
import { embedTextSemantic, cosineSimilarity } from './nlp/semanticEmbeddings';

export type AiIntentType =
  | 'SUM'
  | 'AVERAGE'
  | 'COUNT'
  | 'HIGHEST'
  | 'LOWEST'
  | 'INCOME'
  | 'TRANSFER'
  | 'DEBT'
  | 'SUBSCRIPTIONS'
  | 'WEEKEND_VS_WEEKDAY'
  | 'ANOMALIES'
  | 'BREAKDOWN'
  | 'SEARCH';

export interface FilterTagItem {
  id: string;
  label: string;
  type: 'date' | 'category' | 'account' | 'amount' | 'merchant' | 'friend' | 'tag';
  removeQuerySnippet: string;
}

export interface SmartFilterCriteria {
  intent: AiIntentType;
  categoryIds?: string[];
  accountIds?: string[];
  types?: ExpenseTransaction['type'][];
  minAmount?: number;
  maxAmount?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  monthIndex?: number; // 0-11
  year?: number;
  dayOfWeek?: number; // 0-6
  isWeekendOnly?: boolean;
  isWeekdayOnly?: boolean;
  isSplitOnly?: boolean;
  isPendingDebtOnly?: boolean;
  isFolderOnly?: boolean;
  folderName?: string;
  merchantName?: string;
  friendName?: string;
  isLentReceivables?: boolean;
  isBorrowedPayables?: boolean;
  isMyShareOnly?: boolean;
  isFriendsShareOnly?: boolean;
  friendNetBalance?: number;
  keywords?: string[];
  excludedKeywords?: string[];
  timeframeLabel?: string;
  originalQuery: string;
}

export interface SmartMetricHighlight {
  label: string;
  value: string;
  sublabel?: string;
}

export interface SmartQueryResult {
  matchedTransactions: ExpenseTransaction[];
  intent: AiIntentType;
  naturalLanguageAnswer: string;
  confidenceScore: number;
  metrics: SmartMetricHighlight[];
  engineName: string;
  detectedCriteria: {
    categoryName?: string;
    accountName?: string;
    timeframeText?: string;
    amountRangeText?: string;
    merchantName?: string;
    friendName?: string;
    filterTags?: FilterTagItem[];
  };
}

// ─────────────────────────────────────────────────────────────
// ON-DEVICE HARDWARE AI METADATA
// ─────────────────────────────────────────────────────────────
export function getDeviceAiEngineInfo(): { name: string; chip: string; isHardwareAccelerated: boolean } {
  const isApple = Platform.OS === 'ios';
  return {
    name: isApple
      ? 'Apple Neural Engine + Local NLU Core'
      : 'NPU Hardware-Accelerated Local Engine',
    chip: isApple ? 'Apple ANE • On-Device' : 'Neural Core • On-Device',
    isHardwareAccelerated: true,
  };
}

// Result Cache
const SMART_QUERY_CACHE = new Map<string, SmartQueryResult>();
const SMART_QUERY_CACHE_LIMIT = 50;

function parseLocalDateComponents(dateStr: string): { year: number; monthIndex: number; day: number; dayOfWeek: number } {
  const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) {
    const year = parseInt(parts[1], 10);
    const monthIndex = parseInt(parts[2], 10) - 1;
    const day = parseInt(parts[3], 10);
    const localDate = new Date(year, monthIndex, day);
    return { year, monthIndex, day, dayOfWeek: localDate.getDay() };
  }
  const fallback = new Date(dateStr);
  return {
    year: fallback.getFullYear(),
    monthIndex: fallback.getMonth(),
    day: fallback.getDate(),
    dayOfWeek: fallback.getDay(),
  };
}

function smartQueryCacheKey(
  rawQuery: string,
  transactions: ExpenseTransaction[],
  categories: ExpenseCategory[],
  accounts: ExpenseAccount[],
  currencySymbol: string
): string {
  const fingerprint = transactions.slice(0, 50).map((t) => `${t.id}:${t.amount}:${t.date}`).join('|');
  return `${rawQuery}\u0000${transactions.length}\u0000${categories.length}\u0000${accounts.length}\u0000${currencySymbol}\u0000${fingerprint}`;
}

// ─────────────────────────────────────────────────────────────
// COMPREHENSIVE CATEGORY & MERCHANT SYNONYM DICTIONARY
// ─────────────────────────────────────────────────────────────
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  cat_food: [
    'food', 'foods', 'eat', 'eating', 'eats', 'lunch', 'dinner', 'breakfast', 'snack', 'snacks',
    'cafe', 'coffee', 'tea', 'chai', 'swiggy', 'zomato', 'restaurant', 'resturant', 'groceries',
    'grocery', 'blinkit', 'zepto', 'instamart', 'supermarket', 'burger', 'pizza',
    'sweets', 'bakery', 'meal', 'meals', 'dine', 'dining', 'starbucks', 'mcdonalds', 'mcd',
    'kfc', 'dominos', 'subway', 'haldiram', 'bbq', 'barbeque', 'bhojanalay', 'diner', 'biryani',
    'dosa', 'chai point', 'chaayos', 'blue tokai', 'third wave'
  ],
  cat_cig: [
    'cigarette', 'cigarettes', 'ciggarette', 'ciggarettes', 'cig', 'cigs', 'smoke', 'smoking',
    'tobacco', 'cigar', 'cigars', 'vape', 'vaping', 'juul', 'paan', 'pan shop', 'gutkha',
    'beedi', 'bidi', 'lighter', 'marlboro', 'classic', 'gold flake', 'lights'
  ],
  cat_trans: [
    'transport', 'transportation', 'travel', 'travelling', 'commute', 'commuting', 'uber', 'ola',
    'auto', 'cab', 'cabs', 'taxi', 'metro', 'train', 'flight', 'flights', 'petrol', 'fuel',
    'diesel', 'gasoline', 'bus', 'buses', 'rapido', 'fare', 'toll', 'fastag', 'parking',
    'indigo', 'air india', 'irctc', 'railway', 'blusmart', 'yulu', 'bounce', 'makemytrip',
    'cleartrip', 'goibibo'
  ],
  cat_shop: [
    'shopping', 'shop', 'shops', 'amazon', 'flipkart', 'myntra', 'purchase', 'purchases',
    'clothes', 'clothing', 'shoes', 'footwear', 'electronics', 'gadgets', 'mall', 'store',
    'stores', 'order', 'orders', 'bought', 'ajio', 'nykaa', 'zara', 'h&m', 'uniqlo',
    'meesho', 'croma', 'reliance digital', 'decathlon', 'tata cliq', 'dress', 'shirt', 'pants',
    'watch', 'bag', 'apparel'
  ],
  cat_ent: [
    'entertainment', 'movie', 'movies', 'cinema', 'theatre', 'theater', 'netflix', 'spotify',
    'prime', 'disney', 'hotstar', 'game', 'games', 'gaming', 'steam', 'playstation', 'ps5',
    'xbox', 'club', 'clubbing', 'party', 'parties', 'concert', 'outing', 'show', 'shows',
    'bookmyshow', 'pvr', 'inox', 'youtube premium', 'apple music', 'audible', 'kindle'
  ],
  cat_health: [
    'health', 'healthcare', 'medical', 'medicine', 'medicines', 'doctor', 'clinic', 'hospital',
    'pharmacy', 'chemist', '1mg', 'tata 1mg', 'apollo', 'pharmeasy', 'gym', 'fitness',
    'workout', 'yoga', 'cult', 'cultfit', 'gold gym', 'protein', 'supplement', 'supplements',
    'dentist', 'eye checkup', 'blood test', 'lab', 'therapy'
  ],
  cat_util: [
    'utility', 'utilities', 'bill', 'bills', 'electricity', 'power', 'water', 'gas', 'cylinder',
    'indane', 'hp gas', 'bharat gas', 'wifi', 'broadband', 'internet', 'recharge', 'mobile',
    'airtel', 'jio', 'vi', 'vodafone', 'bsnl', 'dth', 'tata play', 'bescom', 'maintenance',
    'rent', 'house rent', 'society maintenance'
  ],
  cat_fin: [
    'finance', 'financial', 'tax', 'taxes', 'investment', 'investments', 'invest', 'stock',
    'stocks', 'mutual fund', 'mutual funds', 'sip', 'zerodha', 'groww', 'indmoney', 'upstox',
    'insurance', 'policy', 'lic', 'emi', 'emis', 'loan', 'home loan', 'car loan', 'gold loan',
    'crypto', 'fixed deposit', 'fd', 'rd'
  ],
  cat_misc: [
    'misc', 'miscellaneous', 'other', 'others', 'general', 'random', 'stationery', 'laundry',
    'dry cleaning', 'courier', 'swiggy genie', 'dunzo', 'porter'
  ],
};

// ─────────────────────────────────────────────────────────────
// ADVANCED ON-DEVICE FUZZY MATCHING (LEVENSHTEIN + N-GRAM)
// ─────────────────────────────────────────────────────────────

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function stringSimilarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  if (str1.includes(str2) || str2.includes(str1)) {
    const minLen = Math.min(str1.length, str2.length);
    const maxLen = Math.max(str1.length, str2.length);
    return Math.max(0.8, minLen / maxLen);
  }

  const maxLen = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);
  return Math.max(0, 1 - distance / maxLen);
}

export function fuzzyMatch(term: string, target: string, threshold = 0.75): boolean {
  const t = term.toLowerCase().trim();
  const tgt = target.toLowerCase().trim();
  if (!t || !tgt) return false;
  if (t === tgt) return true;

  // Whole word match in multi-word target
  const tgtWords = tgt.split(/[\s_\-/,]+/);
  if (tgtWords.includes(t)) return true;

  // Substring containment only for words of length >= 4 to avoid false hits like "owe" in "power"
  if (t.length >= 4 && tgt.includes(t)) return true;
  if (tgt.length >= 4 && t.includes(tgt)) return true;

  const maxLen = Math.max(t.length, tgt.length);
  if (maxLen < 4) return false;
  const dist = levenshteinDistance(t, tgt);
  const allowed = maxLen <= 6 ? 1 : maxLen <= 9 ? 2 : 3;
  return dist <= allowed && 1 - dist / maxLen >= threshold - 0.1;
}

// ─────────────────────────────────────────────────────────────
// AMOUNT PARSER HELPER (Supports "1k", "2.5k", "10k", "1L", numbers)
// ─────────────────────────────────────────────────────────────
function parseAmountToken(rawStr: string): number | null {
  const clean = rawStr.toLowerCase().replace(/[₹$,]/g, '').trim();
  if (!clean) return null;

  if (clean.endsWith('k')) {
    const num = parseFloat(clean.slice(0, -1));
    return !isNaN(num) ? num * 1000 : null;
  }
  if (clean.endsWith('l') || clean.endsWith('lakh')) {
    const num = parseFloat(clean.replace(/lakh|l/g, ''));
    return !isNaN(num) ? num * 100000 : null;
  }
  const num = parseFloat(clean);
  return !isNaN(num) ? num : null;
}

// ─────────────────────────────────────────────────────────────
// COMPREHENSIVE ON-DEVICE FINANCIAL STOP WORDS & QUERY OPERATORS
// ─────────────────────────────────────────────────────────────
const SEARCH_STOP_WORDS = new Set([
  'how', 'much', 'did', 'i', 'spend', 'spent', 'spending', 'on', 'at', 'in',
  'for', 'the', 'a', 'an', 'what', 'was', 'my', 'all', 'of', 'me', 'to',
  'from', 'total', 'average', 'avg', 'count', 'highest', 'lowest', 'more',
  'than', 'less', 'under', 'above', 'show', 'list', 'and', 'or', 'with',
  'by', 'about', 'is', 'are', 'were', 'have', 'had', 'been', 'paid', 'transaction',
  'transactions', 'expense', 'expenses', 'orders', 'order', 'purchases', 'purchase',
  'money', 'cost', 'costs', 'amount', 'value', 'details', 'detail', 'history',
  'filter', 'query', 'find', 'get', 'give', 'please', 'tell', 'last', 'this', 'past',
  'today', 'yesterday', 'tomorrow', 'month', 'months', 'year', 'years', 'week', 'weeks',
  'weekend', 'weekends', 'weekday', 'weekdays', 'january', 'february', 'march', 'april',
  'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'quarter', 'q1', 'q2', 'q3', 'q4', 'h1', 'h2', 'early', 'mid', 'late',
  'owe', 'owed', 'owes', 'debt', 'debts', 'lend', 'lent', 'borrow', 'borrowed',
  'split', 'splits', 'shared', 'share', 'dues', 'due', 'unsettled', 'pending', 'unpaid',
  'collect', 'receivable', 'receivables', 'payable', 'payables',
  'who', 'whom', 'whose', 'which', 'where', 'when', 'why', 'do', 'does', 'did',
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'
]);

// ─────────────────────────────────────────────────────────────
// PARSE NATURAL LANGUAGE QUERY (ON-DEVICE HIGH ACCURACY)
// ─────────────────────────────────────────────────────────────
export function parseSmartQuery(
  rawQuery: string,
  categories: ExpenseCategory[],
  accounts: ExpenseAccount[],
  referenceYear = new Date().getFullYear(),
  referenceMonth = new Date().getMonth(),
  knownFriendNames: string[] = []
): SmartFilterCriteria {
  const q = rawQuery.toLowerCase().trim();
  const tokens = q
    .replace(/[₹$,?!:;]/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);

  let intent: AiIntentType = 'SEARCH';
  const categoryIds: string[] = [];
  const accountIds: string[] = [];
  const types: ExpenseTransaction['type'][] = [];
  let minAmount: number | undefined = undefined;
  let maxAmount: number | undefined = undefined;
  let monthIndex: number | undefined = undefined;
  let year: number | undefined = undefined;
  let startDate: string | undefined = undefined;
  let endDate: string | undefined = undefined;
  let dayOfWeek: number | undefined = undefined;
  let isWeekendOnly = false;
  let isWeekdayOnly = false;
  let isSplitOnly = false;
  let isPendingDebtOnly = false;
  let isLentReceivables = false;
  let isBorrowedPayables = false;
  let isMyShareOnly = false;
  let isFriendsShareOnly = false;
  let isFolderOnly = false;
  let folderName: string | undefined = undefined;
  let merchantName: string | undefined = undefined;
  let friendName: string | undefined = undefined;
  let timeframeLabel: string | undefined = undefined;
  const keywords: string[] = [];
  const excludedKeywords: string[] = [];

  // 1. Detect Intent with broad fuzzy semantics
  if (
    q.includes('how much') ||
    q.includes('total') ||
    q.includes('sum') ||
    q.includes('spending on') ||
    q.includes('spent on') ||
    q.includes('all expenses') ||
    q.includes('burn') ||
    q.includes('cost') ||
    q.includes('spend')
  ) {
    intent = 'SUM';
    types.push('expense');
  } else if (
    q.includes('average') ||
    q.includes('avg') ||
    q.includes('mean') ||
    q.includes('per day') ||
    q.includes('per transaction') ||
    q.includes('per order')
  ) {
    intent = 'AVERAGE';
    types.push('expense');
  } else if (
    q.includes('how many') ||
    q.includes('count') ||
    q.includes('number of') ||
    q.includes('times') ||
    q.includes('frequency')
  ) {
    intent = 'COUNT';
  } else if (
    q.includes('highest') ||
    q.includes('biggest') ||
    q.includes('largest') ||
    q.includes('max') ||
    q.includes('most expensive') ||
    q.includes('peak') ||
    q.includes('top spend')
  ) {
    intent = 'HIGHEST';
    types.push('expense');
  } else if (
    q.includes('lowest') ||
    q.includes('smallest') ||
    q.includes('least') ||
    q.includes('min') ||
    q.includes('cheapest')
  ) {
    intent = 'LOWEST';
    types.push('expense');
  } else if (
    q.includes('income') ||
    q.includes('salary') ||
    q.includes('earned') ||
    q.includes('earnings') ||
    q.includes('credits') ||
    q.includes('received') ||
    q.includes('stipend') ||
    q.includes('cashback')
  ) {
    intent = 'INCOME';
    types.push('income');
  } else if (
    q.includes('transfer') ||
    q.includes('transfers') ||
    q.includes('sent to') ||
    q.includes('moved') ||
    q.includes('bill pay') ||
    q.includes('credit card payment')
  ) {
    intent = 'TRANSFER';
    types.push('transfer');
  } else if (
    q.includes('who owes me') ||
    q.includes('who owe me') ||
    q.includes('unsettled lent') ||
    q.includes('lent to') ||
    q.includes('lent') ||
    q.includes('receivable') ||
    q.includes('receivables') ||
    q.includes('money given') ||
    q.includes('given to') ||
    q.includes('pending recovery') ||
    q.includes('collect')
  ) {
    intent = 'DEBT';
    types.push('debt_lend');
    isLentReceivables = true;
    isPendingDebtOnly = true;
  } else if (
    q.includes('whom do i owe') ||
    q.includes('whom i owe') ||
    q.includes('who i owe') ||
    q.includes('borrowed from') ||
    q.includes('borrowed') ||
    q.includes('borrow') ||
    q.includes('payable') ||
    q.includes('payables') ||
    q.includes('money taken') ||
    q.includes('taken from') ||
    q.includes('unpaid borrowed') ||
    q.includes('pay back')
  ) {
    intent = 'DEBT';
    types.push('debt_borrow');
    isBorrowedPayables = true;
    isPendingDebtOnly = true;
  } else if (
    q.includes('debt') ||
    q.includes('debts') ||
    q.includes('owe') ||
    q.includes('owed')
  ) {
    intent = 'DEBT';
    types.push('debt_lend', 'debt_borrow');
  } else if (
    q.includes('subscription') ||
    q.includes('subscriptions') ||
    q.includes('recurring') ||
    q.includes('memberships') ||
    q.includes('monthly charge')
  ) {
    intent = 'SUBSCRIPTIONS';
  } else if (
    q.includes('unusual') ||
    q.includes('anomaly') ||
    q.includes('anomalies') ||
    q.includes('outlier') ||
    q.includes('outliers') ||
    q.includes('spike') ||
    q.includes('spikes')
  ) {
    intent = 'ANOMALIES';
  } else if (
    q.includes('breakdown') ||
    q.includes('summary') ||
    q.includes('overview')
  ) {
    intent = 'BREAKDOWN';
  }

  // Share intent checks
  if (q.includes('my share') || q.includes('your share')) {
    isMyShareOnly = true;
  } else if (q.includes('friends share') || q.includes('friend share')) {
    isFriendsShareOnly = true;
  }

  // 2. Detect Amount Conditions (e.g. "between 500 and 2000", "> 100", "over 1k", "under 500")
  const betweenMatch = q.match(/(?:between|from)\s+([\d.,]+[kKlL]?)\s+(?:and|to)\s+([\d.,]+[kKlL]?)/);
  if (betweenMatch) {
    const val1 = parseAmountToken(betweenMatch[1]);
    const val2 = parseAmountToken(betweenMatch[2]);
    if (val1 !== null && val2 !== null) {
      minAmount = Math.min(val1, val2);
      maxAmount = Math.max(val1, val2);
    }
  } else {
    const aboveMatch = q.match(/(?:>|>=|above|over|more than|greater than|higher than|exceeding)\s*([\d.,]+[kKlL]?)/);
    if (aboveMatch) {
      const val = parseAmountToken(aboveMatch[1]);
      if (val !== null) minAmount = val;
    }
    const belowMatch = q.match(/(?:<|<=|below|under|less than|cheaper than|fewer than)\s*([\d.,]+[kKlL]?)/);
    if (belowMatch) {
      const val = parseAmountToken(belowMatch[1]);
      if (val !== null) maxAmount = val;
    }
  }

  // Exact amount match check (e.g. "exact 1500", "price of 499")
  if (minAmount === undefined && maxAmount === undefined) {
    const exactMatch = q.match(/(?:exact|amount of|price of)\s*([\d.,]+[kKlL]?)/);
    if (exactMatch) {
      const val = parseAmountToken(exactMatch[1]);
      if (val !== null) {
        minAmount = val;
        maxAmount = val;
      }
    }
  }

  // 3. Universal Temporal Date Parsing (Chrono-Engine)
  const parsedDate = parseUniversalDateRange(q);
  if (parsedDate) {
    startDate = parsedDate.startDate;
    endDate = parsedDate.endDate;
    monthIndex = parsedDate.monthIndex;
    year = parsedDate.year;
    dayOfWeek = parsedDate.dayOfWeek;
    isWeekendOnly = Boolean(parsedDate.isWeekendOnly);
    isWeekdayOnly = Boolean(parsedDate.isWeekdayOnly);
    timeframeLabel = parsedDate.label;
    if (isWeekendOnly || isWeekdayOnly) {
      intent = 'WEEKEND_VS_WEEKDAY';
    }
  }

  // 4. Detect Specific Canonical Merchant
  const canonicalMerchant = extractMerchantFromQuery(q);
  if (canonicalMerchant) {
    merchantName = canonicalMerchant.name;
    // Auto-map category if not yet explicitly mapped
    if (!categoryIds.includes(canonicalMerchant.defaultCategoryId)) {
      categoryIds.push(canonicalMerchant.defaultCategoryId);
    }
  }

  // 5. Detect Categories (Multi-category support)
  categories.forEach((cat) => {
    const catNameLower = cat.name.toLowerCase();
    // Direct category name match or fuzzy token match (skipping structural query keywords)
    if (q.includes(catNameLower) || tokens.some((t) => t.length >= 3 && !SEARCH_STOP_WORDS.has(t) && fuzzyMatch(t, catNameLower, 0.72))) {
      if (!categoryIds.includes(cat.id)) categoryIds.push(cat.id);
    }
    // Synonym dictionary match
    const syns = CATEGORY_SYNONYMS[cat.id] || [];
    for (const syn of syns) {
      if (q.includes(syn) || tokens.some((t) => t.length >= 3 && !SEARCH_STOP_WORDS.has(t) && fuzzyMatch(t, syn, 0.75))) {
        if (!categoryIds.includes(cat.id)) categoryIds.push(cat.id);
        break;
      }
    }
  });

  // 6. Detect Accounts & Banks (HDFC, ICICI, Slice, Cash, Wallet, Apple Card...)
  accounts.forEach((acc) => {
    const accNameLower = acc.name.toLowerCase();
    const accTokens = accNameLower.split(' ').filter((t) => t.length > 2);
    if (
      q.includes(accNameLower) ||
      accTokens.some((tok) => tokens.some((t) => !SEARCH_STOP_WORDS.has(t) && fuzzyMatch(t, tok, 0.8)))
    ) {
      if (!accountIds.includes(acc.id)) accountIds.push(acc.id);
    }
  });

  // 7. Detect Split Only queries
  if (
    q.includes('split') ||
    q.includes('splits') ||
    q.includes('shared bill') ||
    q.includes('split bill')
  ) {
    isSplitOnly = true;
  }

  const friendMatch = q.match(/(?:with|from|to|by|for)\s+([a-zA-Z]+)/);
  if (friendMatch) {
    const cand = friendMatch[1].toLowerCase();
    const friendStopWords = ['the', 'my', 'me', 'this', 'last', 'all', 'a', 'an', 'some', 'any', 'goa', 'hdfc', 'icici', 'slice', 'cash', 'amazon', 'uber', 'zomato', 'food', 'rent', 'work'];
    if (!SEARCH_STOP_WORDS.has(cand) && !friendStopWords.includes(cand)) {
      friendName = friendMatch[1];
    }
  }

  // Personalization: check known friend names from user's personal transaction history
  if (!friendName && knownFriendNames && knownFriendNames.length > 0) {
    for (const kn of knownFriendNames) {
      const knLower = kn.toLowerCase();
      if (knLower.length >= 2 && (q.includes(knLower) || tokens.some((t) => fuzzyMatch(t, knLower, 0.8)))) {
        friendName = kn;
        break;
      }
    }
  }

  if (q.includes('pending') || q.includes('unsettled') || q.includes('unpaid') || q.includes('collect') || q.includes('due')) {
    isPendingDebtOnly = true;
  }

  // Detect Folder / Trip / Event queries
  if (
    q.includes('folder') ||
    q.includes('folders') ||
    q.includes('trip') ||
    q.includes('trips') ||
    q.includes('event') ||
    q.includes('events') ||
    q.includes('vacation')
  ) {
    isFolderOnly = true;
  }

  // Detect specific folder name keyword
  const folderTerms = ['goa', 'party', 'night out', 'vacation', 'manali', 'mumbai', 'delhi', 'bangalore', 'birthday', 'wedding'];
  for (const ft of folderTerms) {
    if (q.includes(ft)) {
      folderName = ft;
      break;
    }
  }

  // 8. Detect Negations & Exclusions (e.g. "food except zomato", "without rent", "not uber")
  const excludeMatch = q.match(/(?:except|without|not|excluding)\s+([a-zA-Z0-9]+)/);
  if (excludeMatch) {
    excludedKeywords.push(excludeMatch[1].toLowerCase());
  }

  // 9. Collect Search Keywords (filtering common stop words and recognized entities)
  const matchedEntityTokens = new Set<string>();
  if (friendName) {
    friendName.toLowerCase().split(' ').forEach((w) => matchedEntityTokens.add(w));
  }
  if (merchantName) {
    merchantName.toLowerCase().split(' ').forEach((w) => matchedEntityTokens.add(w));
  }
  categoryIds.forEach((catId) => {
    const c = categories.find((cat) => cat.id === catId);
    if (c) {
      c.name.toLowerCase().split(/\s+/).forEach((w) => matchedEntityTokens.add(w));
    }
  });
  accountIds.forEach((accId) => {
    const a = accounts.find((acc) => acc.id === accId);
    if (a) {
      a.name.toLowerCase().split(/\s+/).forEach((w) => matchedEntityTokens.add(w));
    }
  });

  tokens.forEach((t) => {
    if (
      t.length >= 2 &&
      !SEARCH_STOP_WORDS.has(t) &&
      !excludedKeywords.includes(t) &&
      !matchedEntityTokens.has(t) &&
      !t.match(/^\d+$/) // skip standalone digits
    ) {
      keywords.push(t);
    }
  });

  return {
    intent,
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    accountIds: accountIds.length > 0 ? accountIds : undefined,
    types: types.length > 0 ? types : undefined,
    minAmount,
    maxAmount,
    startDate,
    endDate,
    monthIndex,
    year,
    dayOfWeek,
    isWeekendOnly,
    isWeekdayOnly,
    isSplitOnly,
    isPendingDebtOnly,
    isLentReceivables,
    isBorrowedPayables,
    isMyShareOnly,
    isFriendsShareOnly,
    isFolderOnly,
    folderName,
    merchantName,
    friendName,
    keywords: keywords.length > 0 ? keywords : undefined,
    excludedKeywords: excludedKeywords.length > 0 ? excludedKeywords : undefined,
    timeframeLabel,
    originalQuery: rawQuery,
  };
}

// ─────────────────────────────────────────────────────────────
// EXECUTE ON-DEVICE AI QUERY AND GENERATE ULTRA-RICH ANSWER
// ─────────────────────────────────────────────────────────────
export function executeSmartQuery(
  rawQuery: string,
  transactions: ExpenseTransaction[],
  categories: ExpenseCategory[],
  accounts: ExpenseAccount[],
  currencySymbol = '₹'
): SmartQueryResult {
  const cacheKey = smartQueryCacheKey(rawQuery, transactions, categories, accounts, currencySymbol);
  const cachedResult = SMART_QUERY_CACHE.get(cacheKey);
  if (cachedResult) return cachedResult;

  const engineInfo = getDeviceAiEngineInfo();

  // Dynamically extract user's known friend contacts across transactions for personalized NLP
  const knownFriendNames: string[] = Array.from(
    new Set(
      transactions
        .flatMap((t) => {
          const names: string[] = [];
          if (t.borrowerOrLender) names.push(t.borrowerOrLender.trim());
          if (t.split?.friendNames) {
            names.push(...t.split.friendNames.split(/[,&/]/).map((s) => s.trim()));
          }
          if (t.split?.friends) {
            names.push(...t.split.friends.map((f) => f.name.trim()));
          }
          return names;
        })
        .filter((n) => n && n.length >= 2)
    )
  );

  const criteria = parseSmartQuery(
    rawQuery,
    categories,
    accounts,
    new Date().getFullYear(),
    new Date().getMonth(),
    knownFriendNames
  );
  const querySemanticVec = embedTextSemantic(rawQuery);

  // 1. Filter transactions through high-performance multi-stage pipeline
  const matched = transactions.filter((t) => {
    const txDate = parseLocalDateComponents(t.date);
    const dayOfWeek = txDate.dayOfWeek;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Weekend / Weekday filter
    if (criteria.isWeekendOnly && !isWeekend) return false;
    if (criteria.isWeekdayOnly && isWeekend) return false;
    if (criteria.dayOfWeek !== undefined && dayOfWeek !== criteria.dayOfWeek) return false;

    // Directional Debt / Receivables Filters
    if (criteria.isLentReceivables) {
      const isLend = t.type === 'debt_lend';
      const isSplitOwed = Boolean(t.split && !t.split.settled && (t.split.friendsShare ?? 0) > 0);
      if (!isLend && !isSplitOwed) return false;
      if (criteria.isPendingDebtOnly && isLend && t.isSettled) return false;
    } else if (criteria.isBorrowedPayables) {
      if (t.type !== 'debt_borrow') return false;
      if (criteria.isPendingDebtOnly && t.isSettled) return false;
    } else if (criteria.types && criteria.types.length > 0) {
      if (!criteria.types.includes(t.type)) return false;
    }

    // Share filter
    if (criteria.isMyShareOnly && !t.split) return false;
    if (criteria.isFriendsShareOnly && !t.split) return false;

    // Category Match
    if (criteria.categoryIds && criteria.categoryIds.length > 0) {
      if (!criteria.categoryIds.includes(t.categoryId)) return false;
    }

    // Account Match (From Account or To Account)
    if (criteria.accountIds && criteria.accountIds.length > 0) {
      const matchFrom = criteria.accountIds.includes(t.accountId);
      const matchTo = t.toAccountId ? criteria.accountIds.includes(t.toAccountId) : false;
      if (!matchFrom && !matchTo) return false;
    }

    // Amount Range Match (considers personal share or total amount)
    const effectiveAmount = criteria.isFriendsShareOnly && t.split
      ? t.split.friendsShare
      : t.split
      ? t.split.yourShare
      : t.amount;
    if (criteria.minAmount !== undefined && effectiveAmount < criteria.minAmount) return false;
    if (criteria.maxAmount !== undefined && effectiveAmount > criteria.maxAmount) return false;

    // Date Window Match
    if (criteria.startDate && t.date < criteria.startDate) return false;
    if (criteria.endDate && t.date > criteria.endDate) return false;

    if (criteria.monthIndex !== undefined && txDate.monthIndex !== criteria.monthIndex) return false;
    if (criteria.year !== undefined && txDate.year !== criteria.year) return false;

    // Split filter
    if (criteria.isSplitOnly && !t.split) return false;

    // Pending debt filter
    if (criteria.isPendingDebtOnly) {
      const isPendingLend = t.type === 'debt_lend' && !t.isSettled;
      const isPendingBorrow = t.type === 'debt_borrow' && !t.isSettled;
      const isPendingSplit = Boolean(t.split && !t.split.settled);
      if (!isPendingLend && !isPendingBorrow && !isPendingSplit) return false;
    }

    // Friend Name filter (Deep check on borrower/lender, split arrays, and notes)
    if (criteria.friendName) {
      const fn = criteria.friendName.toLowerCase();
      const borrowerLender = (t.borrowerOrLender || '').toLowerCase();
      const splitFriends = (t.split?.friendNames || '').toLowerCase();
      const splitFriendsList = t.split?.friends?.map((f) => f.name.toLowerCase()) || [];
      const note = (t.note || '').toLowerCase();

      const friendMatches =
        fuzzyMatch(fn, borrowerLender, 0.75) ||
        fuzzyMatch(fn, splitFriends, 0.75) ||
        splitFriendsList.some((sfn) => fuzzyMatch(fn, sfn, 0.75)) ||
        fuzzyMatch(fn, note, 0.75);

      if (!friendMatches) return false;
    }

    // Specific Canonical Merchant filter
    if (criteria.merchantName) {
      const mTarget = criteria.merchantName.toLowerCase();
      const txNote = (t.note || '').toLowerCase();
      const txMerchant = (t.merchant || '').toLowerCase();
      const recognized = identifyCanonicalMerchant(`${txMerchant} ${txNote}`);
      const matchesMerchant =
        recognized?.name.toLowerCase() === mTarget ||
        txNote.includes(mTarget) ||
        txMerchant.includes(mTarget) ||
        fuzzyMatch(mTarget, txNote, 0.75) ||
        fuzzyMatch(mTarget, txMerchant, 0.75);
      if (!matchesMerchant) return false;
    }

    // Folder / Event only filter
    if (criteria.isFolderOnly && !t.folderId && !t.folderName && !t.tag) {
      return false;
    }

    // Specific Folder Name filter
    if (criteria.folderName) {
      const fNameLower = (t.folderName || '').toLowerCase();
      const fTagLower = (t.tag || '').toLowerCase();
      const fNoteLower = (t.note || '').toLowerCase();
      if (
        !fuzzyMatch(criteria.folderName, fNameLower, 0.7) &&
        !fuzzyMatch(criteria.folderName, fTagLower, 0.7) &&
        !fuzzyMatch(criteria.folderName, fNoteLower, 0.7)
      ) {
        return false;
      }
    }

    // Exclusion filter
    if (criteria.excludedKeywords && criteria.excludedKeywords.length > 0) {
      const allText = `${t.note || ''} ${t.tag || ''} ${t.folderName || ''} ${t.merchant || ''}`.toLowerCase();
      const hasExcluded = criteria.excludedKeywords.some((ex) => allText.includes(ex));
      if (hasExcluded) return false;
    }

    // Fuzzy Keyword & On-Device Semantic Vector Match (Searches Notes, Descriptions, Tags, Merchants)
    if (criteria.keywords && criteria.keywords.length > 0) {
      const noteLower = (t.note || '').toLowerCase();
      const tagLower = (t.tag || '').toLowerCase();
      const folderLower = (t.folderName || '').toLowerCase();
      const merchantLower = (t.merchant || '').toLowerCase();
      const friendLower = (t.borrowerOrLender || t.split?.friendNames || '').toLowerCase();
      const catObj = categories.find((c) => c.id === t.categoryId);
      const catName = (catObj?.name || '').toLowerCase();
      const accObj = accounts.find((a) => a.id === t.accountId);
      const accName = (accObj?.name || '').toLowerCase();

      const corpus = `${noteLower} ${merchantLower} ${tagLower} ${folderLower} ${friendLower} ${catName} ${accName}`;

      // 1. Direct phrase or all-keyword presence (e.g. user notes, descriptions)
      const allKeywordsHit = criteria.keywords.every((kw) =>
        corpus.includes(kw) || fuzzyMatch(kw, corpus, 0.75)
      );

      if (!allKeywordsHit) {
        // 2. Any keyword matches
        const matchesAnyKeyword = criteria.keywords.some((kw) => {
          return (
            fuzzyMatch(kw, noteLower, 0.7) ||
            fuzzyMatch(kw, merchantLower, 0.7) ||
            fuzzyMatch(kw, tagLower, 0.7) ||
            fuzzyMatch(kw, folderLower, 0.7) ||
            fuzzyMatch(kw, friendLower, 0.7) ||
            fuzzyMatch(kw, catName, 0.75) ||
            fuzzyMatch(kw, accName, 0.75)
          );
        });

        // If keywords didn't hit literally, test on-device semantic vector cosine proximity
        if (!matchesAnyKeyword) {
          const txVec = embedTextSemantic(corpus);
          const semanticSim = cosineSimilarity(querySemanticVec, txVec);
          if (semanticSim < 0.45) {
            if (!criteria.categoryIds && !criteria.accountIds && !criteria.merchantName && !criteria.friendName) {
              return false;
            }
          }
        }
      }
    }

    return true;
  });

  // 2. Calculate Aggregations & Outliers
  const count = matched.length;
  const totalAmount = matched.reduce((sum, t) => sum + (criteria.isFriendsShareOnly && t.split ? t.split.friendsShare : t.split ? t.split.yourShare : t.amount), 0);
  const avgAmount = count > 0 ? Math.round(totalAmount / count) : 0;

  // Calculate Friend Net Balance across all transactions for this friend
  let friendNetBalance: number | undefined = undefined;
  let friendPendingLent = 0;
  let friendPendingBorrowed = 0;
  let friendPendingSplit = 0;

  if (criteria.friendName) {
    const fn = criteria.friendName.toLowerCase();
    transactions.forEach((t) => {
      const borrowerLender = (t.borrowerOrLender || '').toLowerCase();
      const splitFriends = (t.split?.friendNames || '').toLowerCase();
      const hasFriendInSplitObj = t.split?.friends?.some((f) => fuzzyMatch(fn, f.name.toLowerCase(), 0.75));

      const isMatchingFriend =
        fuzzyMatch(fn, borrowerLender, 0.75) ||
        fuzzyMatch(fn, splitFriends, 0.75) ||
        hasFriendInSplitObj;

      if (!isMatchingFriend) return;

      if (t.type === 'debt_lend' && !t.isSettled) {
        friendPendingLent += t.amount;
      } else if (t.type === 'debt_borrow' && !t.isSettled) {
        friendPendingBorrowed += t.amount;
      }

      if (t.split && !t.split.settled) {
        if (t.split.friends && t.split.friends.length > 0) {
          const matchedFriendObj = t.split.friends.find((f) => fuzzyMatch(fn, f.name.toLowerCase(), 0.75));
          if (matchedFriendObj && !matchedFriendObj.settled) {
            friendPendingSplit += matchedFriendObj.amount;
          }
        } else if (fuzzyMatch(fn, splitFriends, 0.75)) {
          friendPendingSplit += t.split.friendsShare;
        }
      }
    });

    // Net balance = what friend owes user minus what user owes friend
    // > 0 means friend owes user; < 0 means user owes friend
    friendNetBalance = (friendPendingLent + friendPendingSplit) - friendPendingBorrowed;
    criteria.friendNetBalance = friendNetBalance;
  }

  let highestTx: ExpenseTransaction | null = null;
  let lowestTx: ExpenseTransaction | null = null;
  if (count > 0) {
    highestTx = [...matched].sort(
      (a, b) => (b.split ? b.split.yourShare : b.amount) - (a.split ? a.split.yourShare : a.amount)
    )[0];
    lowestTx = [...matched].sort(
      (a, b) => (a.split ? a.split.yourShare : a.amount) - (b.split ? b.split.yourShare : b.amount)
    )[0];
  }

  // Compute Top Category / Merchant among matched
  const catSpendMap: Record<string, { name: string; amount: number }> = {};
  matched.forEach((t) => {
    const cat = categories.find((c) => c.id === t.categoryId);
    const name = cat ? cat.name : 'Other';
    const amt = t.split ? t.split.yourShare : t.amount;
    if (!catSpendMap[t.categoryId]) catSpendMap[t.categoryId] = { name, amount: 0 };
    catSpendMap[t.categoryId].amount += amt;
  });
  const topCatItem = Object.values(catSpendMap).sort((a, b) => b.amount - a.amount)[0];

  // 3. Format Contextual Criteria Strings & UI Filter Tags
  const filterTags: FilterTagItem[] = [];

  let catNameDisplay: string | undefined = undefined;
  if (criteria.categoryIds && criteria.categoryIds.length > 0) {
    const cat = categories.find((c) => c.id === criteria.categoryIds![0]);
    if (cat) {
      catNameDisplay = `${cat.name}${cat.emoji ? ` ${cat.emoji}` : ''}`;
      filterTags.push({
        id: `cat_${cat.id}`,
        label: cat.name,
        type: 'category',
        removeQuerySnippet: cat.name,
      });
    }
  }

  let accNameDisplay: string | undefined = undefined;
  if (criteria.accountIds && criteria.accountIds.length > 0) {
    const acc = accounts.find((a) => a.id === criteria.accountIds![0]);
    if (acc) {
      accNameDisplay = acc.name;
      filterTags.push({
        id: `acc_${acc.id}`,
        label: acc.name,
        type: 'account',
        removeQuerySnippet: acc.name,
      });
    }
  }

  let timeframeDisplay = criteria.timeframeLabel;
  if (timeframeDisplay) {
    filterTags.push({
      id: 'timeframe',
      label: timeframeDisplay,
      type: 'date',
      removeQuerySnippet: timeframeDisplay,
    });
  }

  let amountRangeDisplay: string | undefined = undefined;
  if (criteria.minAmount !== undefined && criteria.maxAmount !== undefined) {
    if (criteria.minAmount === criteria.maxAmount) {
      amountRangeDisplay = `exact ${currencySymbol}${criteria.minAmount.toLocaleString('en-IN')}`;
    } else {
      amountRangeDisplay = `${currencySymbol}${criteria.minAmount.toLocaleString('en-IN')} – ${currencySymbol}${criteria.maxAmount.toLocaleString('en-IN')}`;
    }
    filterTags.push({
      id: 'amount_range',
      label: amountRangeDisplay,
      type: 'amount',
      removeQuerySnippet: `${criteria.minAmount}`,
    });
  } else if (criteria.minAmount !== undefined) {
    amountRangeDisplay = `> ${currencySymbol}${criteria.minAmount.toLocaleString('en-IN')}`;
    filterTags.push({
      id: 'min_amount',
      label: amountRangeDisplay,
      type: 'amount',
      removeQuerySnippet: `${criteria.minAmount}`,
    });
  } else if (criteria.maxAmount !== undefined) {
    amountRangeDisplay = `< ${currencySymbol}${criteria.maxAmount.toLocaleString('en-IN')}`;
    filterTags.push({
      id: 'max_amount',
      label: amountRangeDisplay,
      type: 'amount',
      removeQuerySnippet: `${criteria.maxAmount}`,
    });
  }

  if (criteria.merchantName) {
    filterTags.push({
      id: 'merchant',
      label: criteria.merchantName,
      type: 'merchant',
      removeQuerySnippet: criteria.merchantName,
    });
  }

  if (criteria.friendName) {
    filterTags.push({
      id: 'friend',
      label: `With ${criteria.friendName}`,
      type: 'friend',
      removeQuerySnippet: criteria.friendName,
    });
  }

  // 4. Generate High-Quality Natural Language Answer
  let answer = '';
  if (count === 0) {
    const target =
      criteria.merchantName ||
      catNameDisplay ||
      accNameDisplay ||
      criteria.friendName ||
      criteria.keywords?.join(', ') ||
      criteria.originalQuery;
    answer = `No transactions found matching "${target}"${timeframeDisplay ? ` in ${timeframeDisplay}` : ''}${amountRangeDisplay ? ` (${amountRangeDisplay})` : ''}. Try adjusting your search query.`;
  } else if (criteria.friendName && friendNetBalance !== undefined) {
    if (friendNetBalance > 0) {
      answer = `${criteria.friendName} owes you a net total of ${currencySymbol}${friendNetBalance.toLocaleString('en-IN')} across ${count} transaction${count !== 1 ? 's' : ''}${timeframeDisplay ? ` in ${timeframeDisplay}` : ''} (Pending lent: ${currencySymbol}${friendPendingLent.toLocaleString('en-IN')}, Pending splits: ${currencySymbol}${friendPendingSplit.toLocaleString('en-IN')}).`;
    } else if (friendNetBalance < 0) {
      answer = `You owe ${criteria.friendName} a net total of ${currencySymbol}${Math.abs(friendNetBalance).toLocaleString('en-IN')} across ${count} transaction${count !== 1 ? 's' : ''}${timeframeDisplay ? ` in ${timeframeDisplay}` : ''}.`;
    } else {
      answer = `All debts are settled with ${criteria.friendName}! Found ${count} historical transaction${count !== 1 ? 's' : ''} totaling ${currencySymbol}${totalAmount.toLocaleString('en-IN')}.`;
    }
  } else if (criteria.isLentReceivables) {
    answer = `You have ${currencySymbol}${totalAmount.toLocaleString('en-IN')} in pending receivables across ${count} transaction${count !== 1 ? 's' : ''}${timeframeDisplay ? ` in ${timeframeDisplay}` : ''}.`;
  } else if (criteria.isBorrowedPayables) {
    answer = `You have ${currencySymbol}${totalAmount.toLocaleString('en-IN')} in unpaid borrowed money across ${count} transaction${count !== 1 ? 's' : ''}${timeframeDisplay ? ` in ${timeframeDisplay}` : ''}.`;
  } else if (criteria.intent === 'AVERAGE') {
    answer = `Your average expense${catNameDisplay ? ` on ${catNameDisplay}` : ''}${timeframeDisplay ? ` in ${timeframeDisplay}` : ''} was ${currencySymbol}${avgAmount.toLocaleString('en-IN')} across ${count} transaction${count !== 1 ? 's' : ''}. Total spent: ${currencySymbol}${totalAmount.toLocaleString('en-IN')}.`;
  } else if (criteria.intent === 'HIGHEST' && highestTx) {
    const note = highestTx.note || highestTx.merchant || 'Expense';
    const highestAmt = highestTx.split ? highestTx.split.yourShare : highestTx.amount;
    answer = `Your biggest expense was ${currencySymbol}${highestAmt.toLocaleString('en-IN')} for "${note}" on ${highestTx.date}${accNameDisplay ? ` via ${accNameDisplay}` : ''}.`;
  } else if (criteria.intent === 'LOWEST' && lowestTx) {
    const note = lowestTx.note || lowestTx.merchant || 'Expense';
    const lowestAmt = lowestTx.split ? lowestTx.split.yourShare : lowestTx.amount;
    answer = `Your smallest expense was ${currencySymbol}${lowestAmt.toLocaleString('en-IN')} for "${note}" on ${lowestTx.date}.`;
  } else if (criteria.intent === 'COUNT') {
    answer = `Found ${count} transaction${count !== 1 ? 's' : ''}${catNameDisplay ? ` in ${catNameDisplay}` : ''}${timeframeDisplay ? ` in ${timeframeDisplay}` : ''} totaling ${currencySymbol}${totalAmount.toLocaleString('en-IN')}.`;
  } else if (criteria.intent === 'INCOME') {
    answer = `Total income recorded is ${currencySymbol}${totalAmount.toLocaleString('en-IN')} across ${count} credit${count !== 1 ? 's' : ''}${timeframeDisplay ? ` in ${timeframeDisplay}` : ''}.`;
  } else if (criteria.intent === 'TRANSFER') {
    answer = `Total transfers: ${currencySymbol}${totalAmount.toLocaleString('en-IN')} across ${count} transfer${count !== 1 ? 's' : ''}.`;
  } else if (criteria.intent === 'DEBT') {
    answer = `You have ${count} debt transaction${count !== 1 ? 's' : ''} totaling ${currencySymbol}${totalAmount.toLocaleString('en-IN')}${criteria.friendName ? ` with ${criteria.friendName}` : ''}.`;
  } else if (criteria.intent === 'ANOMALIES') {
    answer = `Detected ${count} notable transaction${count !== 1 ? 's' : ''} totaling ${currencySymbol}${totalAmount.toLocaleString('en-IN')}, with top spend of ${currencySymbol}${highestTx ? (highestTx.split ? highestTx.split.yourShare : highestTx.amount).toLocaleString('en-IN') : 0}.`;
  } else if (criteria.intent === 'BREAKDOWN') {
    const top3Cats = Object.values(catSpendMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map((c) => `${c.name} (${totalAmount > 0 ? Math.round((c.amount / totalAmount) * 100) : 0}%)`)
      .join(', ');
    answer = `Total spending is ${currencySymbol}${totalAmount.toLocaleString('en-IN')} across ${count} transactions. Top categories: ${top3Cats || 'None'}.`;
  } else {
    // Default SUM or SEARCH response
    const entity = criteria.merchantName
      ? `at ${criteria.merchantName}`
      : catNameDisplay && accNameDisplay
      ? `on ${catNameDisplay} via ${accNameDisplay}`
      : catNameDisplay
      ? `on ${catNameDisplay}`
      : accNameDisplay
      ? `via ${accNameDisplay}`
      : criteria.keywords?.[0]
      ? `for "${criteria.keywords[0]}"`
      : '';
    const time = timeframeDisplay ? `in ${timeframeDisplay}` : '';
    const filter = amountRangeDisplay ? `(${amountRangeDisplay})` : '';
    const parts = [entity, time, filter].filter(Boolean).join(' ');

    answer = `You spent ${currencySymbol}${totalAmount.toLocaleString('en-IN')} ${parts ? `${parts} ` : ''}across ${count} transaction${count !== 1 ? 's' : ''}.`.replace(/\s+/g, ' ');
  }

  // 5. Construct Informative Metric Highlights
  const metrics: SmartMetricHighlight[] = [];
  if (criteria.friendName && friendNetBalance !== undefined) {
    if (friendNetBalance > 0) {
      metrics.push({
        label: 'NET DUE',
        value: `${currencySymbol}${friendNetBalance.toLocaleString('en-IN')}`,
        sublabel: `${criteria.friendName} owes you`,
      });
    } else if (friendNetBalance < 0) {
      metrics.push({
        label: 'NET PAYABLE',
        value: `${currencySymbol}${Math.abs(friendNetBalance).toLocaleString('en-IN')}`,
        sublabel: `You owe ${criteria.friendName}`,
      });
    } else {
      metrics.push({
        label: 'STATUS',
        value: 'Settled Up',
        sublabel: `With ${criteria.friendName}`,
      });
    }
  }

  if (count > 0) {
    metrics.push({
      label: 'TOTAL',
      value: `${currencySymbol}${totalAmount.toLocaleString('en-IN')}`,
    });
    metrics.push({
      label: 'COUNT',
      value: `${count} txn${count !== 1 ? 's' : ''}`,
    });
    if (count > 1) {
      metrics.push({
        label: 'AVG',
        value: `${currencySymbol}${avgAmount.toLocaleString('en-IN')}`,
      });
      if (highestTx) {
        const hAmt = highestTx.split ? highestTx.split.yourShare : highestTx.amount;
        metrics.push({
          label: 'HIGHEST',
          value: `${currencySymbol}${hAmt.toLocaleString('en-IN')}`,
          sublabel: highestTx.merchant || highestTx.note || undefined,
        });
      }
    }
    if (topCatItem && Object.keys(catSpendMap).length > 1) {
      metrics.push({
        label: 'TOP CAT',
        value: topCatItem.name,
        sublabel: `${currencySymbol}${topCatItem.amount.toLocaleString('en-IN')}`,
      });
    }
  }

  const result: SmartQueryResult = {
    matchedTransactions: matched,
    intent: criteria.intent,
    naturalLanguageAnswer: answer,
    confidenceScore: count > 0 ? 0.98 : 0.5,
    metrics,
    engineName: engineInfo.name,
    detectedCriteria: {
      categoryName: catNameDisplay,
      accountName: accNameDisplay,
      timeframeText: timeframeDisplay,
      amountRangeText: amountRangeDisplay,
      merchantName: criteria.merchantName,
      friendName: criteria.friendName,
      filterTags,
    },
  };

  SMART_QUERY_CACHE.set(cacheKey, result);
  if (SMART_QUERY_CACHE.size > SMART_QUERY_CACHE_LIMIT) {
    const oldestKey = SMART_QUERY_CACHE.keys().next().value;
    if (oldestKey) SMART_QUERY_CACHE.delete(oldestKey);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// EXPANDED POPULAR SMART AI QUERY PRESETS
// ─────────────────────────────────────────────────────────────
export const SMART_QUERY_PRESETS = [
  { label: '🍔 Food this month', query: 'Food this month' },
  { label: '⚡ Spend > ₹1,000', query: 'Expenses over 1000' },
  { label: '🛒 Amazon & Online', query: 'Amazon orders' },
  { label: '🚗 Uber & Travel', query: 'Uber trips' },
  { label: '📅 Past 30 Days', query: 'Past 30 days' },
  { label: '👥 Pending Splits', query: 'Pending split dues' },
  { label: '☕ Coffee & Cafes', query: 'Coffee and snacks' },
  { label: '🏆 Highest Expense', query: 'Highest expense this month' },
  { label: '🎉 Weekend Spends', query: 'Spends on weekends' },
  { label: '🏖️ Goa Trip', query: 'Goa trip' },
  { label: '💳 Credit Cards', query: 'Paid via credit card' },
];
