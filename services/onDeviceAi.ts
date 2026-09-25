import { Platform } from 'react-native';
import { ExpenseTransaction, ExpenseCategory, ExpenseAccount } from '@/types/expense';

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
  keywords?: string[];
  friendName?: string;
  isWeekendOnly?: boolean;
  isWeekdayOnly?: boolean;
  isSplitOnly?: boolean;
  isPendingDebtOnly?: boolean;
  isFolderOnly?: boolean;
  folderName?: string;
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
  };
}

// ─────────────────────────────────────────────────────────────
// ON-DEVICE HARDWARE AI METADATA
// ─────────────────────────────────────────────────────────────
export function getDeviceAiEngineInfo(): { name: string; chip: string; isHardwareAccelerated: boolean } {
  return {
    name: 'Local Rules & NLP Engine (On-Device)',
    chip: `${Platform.OS === 'ios' ? 'iOS' : 'Android'} • Local NLU`,
    isHardwareAccelerated: false,
  };
}

// Memoized result cache so the same query over the same dataset isn't re-parsed
// and re-scanned on every render (getFilteredTransactions + getSmartSearchResult
// both evaluate executeSmartQuery during a single Ledger render).
const SMART_QUERY_CACHE = new Map<string, SmartQueryResult>();
const SMART_QUERY_CACHE_LIMIT = 30;

function smartQueryCacheKey(
  rawQuery: string,
  transactions: ExpenseTransaction[],
  categories: ExpenseCategory[],
  accounts: ExpenseAccount[],
  currencySymbol: string
): string {
  const fingerprint = transactions.map((t) => t.id).join('|');
  return `${rawQuery}\u0000${categories.length}\u0000${accounts.length}\u0000${currencySymbol}\u0000${fingerprint}`;
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

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

const MONTH_SHORTS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
];

// ─────────────────────────────────────────────────────────────
// ADVANCED ON-DEVICE FUZZY MATCHING (LEVENSHTEIN + N-GRAM)
// ─────────────────────────────────────────────────────────────

/**
 * Computes exact Levenshtein Edit Distance between two strings.
 */
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
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Computes a normalized similarity score between 0.0 and 1.0.
 */
export function stringSimilarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  // Direct substring bonus
  if (str1.includes(str2) || str2.includes(str1)) {
    const minLen = Math.min(str1.length, str2.length);
    const maxLen = Math.max(str1.length, str2.length);
    return Math.max(0.8, minLen / maxLen);
  }

  const maxLen = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Fuzzy token matcher with tolerance scaled to word length.
 */
export function fuzzyMatch(term: string, target: string, threshold = 0.75): boolean {
  const t = term.toLowerCase().trim();
  const tgt = target.toLowerCase().trim();
  if (!t || !tgt) return false;
  if (t === tgt) return true;

  // Fast Substring check
  if (t.length >= 3 && tgt.includes(t)) return true;
  if (tgt.length >= 3 && t.includes(tgt)) return true;

  // Exact typo distance checks based on word length
  const maxLen = Math.max(t.length, tgt.length);
  const dist = levenshteinDistance(t, tgt);

  if (maxLen <= 4 && dist <= 1) return true;
  if (maxLen <= 7 && dist <= 2) return true;
  if (maxLen > 7 && dist <= 3) return true;

  return stringSimilarity(t, tgt) >= threshold;
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
// PARSE NATURAL LANGUAGE QUERY (ON-DEVICE HIGH ACCURACY)
// ─────────────────────────────────────────────────────────────
export function parseSmartQuery(
  rawQuery: string,
  categories: ExpenseCategory[],
  accounts: ExpenseAccount[],
  referenceYear = new Date().getFullYear(),
  referenceMonth = new Date().getMonth()
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
  let friendName: string | undefined = undefined;
  let isWeekendOnly = false;
  let isWeekdayOnly = false;
  let isSplitOnly = false;
  let isPendingDebtOnly = false;
  let isFolderOnly = false;
  let folderName: string | undefined = undefined;
  const keywords: string[] = [];

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
    q.includes('debt') ||
    q.includes('lent') ||
    q.includes('borrow') ||
    q.includes('borrowed') ||
    q.includes('owe') ||
    q.includes('owed') ||
    q.includes('recover') ||
    q.includes('receivable') ||
    q.includes('pay back')
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
    q.includes('weekend') ||
    q.includes('weekends') ||
    q.includes('saturday') ||
    q.includes('sunday')
  ) {
    intent = 'WEEKEND_VS_WEEKDAY';
    isWeekendOnly = true;
  } else if (
    q.includes('weekday') ||
    q.includes('weekdays') ||
    q.includes('monday to friday')
  ) {
    intent = 'WEEKEND_VS_WEEKDAY';
    isWeekdayOnly = true;
  } else if (
    q.includes('unusual') ||
    q.includes('anomaly') ||
    q.includes('anomalies') ||
    q.includes('outlier') ||
    q.includes('outliers') ||
    q.includes('spike') ||
    q.includes('spikes') ||
    q.includes('heavy')
  ) {
    intent = 'ANOMALIES';
  } else if (
    q.includes('breakdown') ||
    q.includes('summary') ||
    q.includes('overview')
  ) {
    intent = 'BREAKDOWN';
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

  // Exact amount match check (e.g. "480", "exact 1500")
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

  // 3. Detect Timeframe (anchored to the current date)
  const today = new Date();
  const isoDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const daysAgoDate = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return isoDate(d);
  };
  const refDateStr = isoDate(today);
  if (q.includes('today')) {
    startDate = refDateStr;
    endDate = refDateStr;
  } else if (q.includes('yesterday')) {
    startDate = daysAgoDate(1);
    endDate = daysAgoDate(1);
  } else if (q.includes('this week') || q.includes('past week') || q.includes('last 7 days') || q.includes('past 7 days')) {
    startDate = daysAgoDate(7);
    endDate = refDateStr;
  } else if (q.includes('this month')) {
    monthIndex = referenceMonth;
    year = referenceYear;
  } else if (q.includes('last month') || q.includes('previous month')) {
    monthIndex = referenceMonth === 0 ? 11 : referenceMonth - 1;
    year = referenceMonth === 0 ? referenceYear - 1 : referenceYear;
  } else if (q.includes('last year') || q.includes('previous year')) {
    year = referenceYear - 1;
  } else if (q.includes('this year')) {
    year = referenceYear;
  }

  // Detect Month Names
  MONTH_NAMES.forEach((mName, idx) => {
    if (q.includes(mName)) {
      monthIndex = idx;
    }
  });
  if (monthIndex === undefined) {
    MONTH_SHORTS.forEach((mShort, idx) => {
      if (tokens.includes(mShort)) {
        monthIndex = idx;
      }
    });
  }

  // Detect Year
  const yearMatch = q.match(/\b(202[0-9])\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  // 4. Detect Category via Fuzzy Matching and Synonyms
  categories.forEach((cat) => {
    const catNameLower = cat.name.toLowerCase();
    // Direct category name match or fuzzy token match
    if (q.includes(catNameLower) || tokens.some((t) => t.length >= 3 && fuzzyMatch(t, catNameLower, 0.72))) {
      if (!categoryIds.includes(cat.id)) categoryIds.push(cat.id);
    }
    // Synonym dictionary match
    const syns = CATEGORY_SYNONYMS[cat.id] || [];
    for (const syn of syns) {
      if (q.includes(syn) || tokens.some((t) => t.length >= 3 && fuzzyMatch(t, syn, 0.75))) {
        if (!categoryIds.includes(cat.id)) categoryIds.push(cat.id);
        break;
      }
    }
  });

  // 5. Detect Accounts & Banks (HDFC, ICICI, Slice, Cash, Wallet, Apple Card...)
  accounts.forEach((acc) => {
    const accNameLower = acc.name.toLowerCase();
    const accTokens = accNameLower.split(' ').filter((t) => t.length > 2);
    if (
      q.includes(accNameLower) ||
      accTokens.some((tok) => tokens.some((t) => fuzzyMatch(t, tok, 0.8)))
    ) {
      if (!accountIds.includes(acc.id)) accountIds.push(acc.id);
    }
  });

  // 6. Detect Split / Friend Names
  if (q.includes('split') || q.includes('shared') || q.includes('alex') || q.includes('rahul') || q.includes('sam')) {
    isSplitOnly = true;
    const friendMatch = q.match(/(?:with|from|to)\s+([a-zA-Z]+)/);
    if (friendMatch && !['the', 'my', 'me', 'this', 'last', 'goa'].includes(friendMatch[1].toLowerCase())) {
      friendName = friendMatch[1];
    }
  }

  if (q.includes('pending') || q.includes('unsettled') || q.includes('unpaid') || q.includes('collect')) {
    isPendingDebtOnly = true;
  }

  // Detect Folder / Trip / Event queries (e.g. "Goa trip", "Night out", "all folders", "trips")
  if (
    q.includes('folder') ||
    q.includes('folders') ||
    q.includes('trip') ||
    q.includes('trips') ||
    q.includes('event') ||
    q.includes('events') ||
    q.includes('vacation') ||
    q.includes('goa') ||
    q.includes('party') ||
    q.includes('night out')
  ) {
    if (q === 'folder' || q === 'folders' || q === 'all folders' || q === 'trip' || q === 'trips' || q === 'all trips' || q === 'events') {
      isFolderOnly = true;
    } else {
      // Extract possible folder name keyword (e.g. "goa", "party", "night out")
      const folderTerms = ['goa', 'party', 'night out', 'vacation', 'manali', 'mumbai', 'delhi', 'bangalore', 'birthday', 'wedding'];
      for (const ft of folderTerms) {
        if (q.includes(ft)) {
          folderName = ft;
          break;
        }
      }
    }
  }

  // 7. Collect Search Keywords (filtering common stop words)
  const stopWords = new Set([
    'how', 'much', 'did', 'i', 'spend', 'spent', 'spending', 'on', 'at', 'in',
    'for', 'the', 'a', 'an', 'what', 'was', 'my', 'all', 'of', 'me', 'to',
    'from', 'total', 'average', 'avg', 'count', 'highest', 'lowest', 'more',
    'than', 'less', 'under', 'above', 'show', 'list', 'and', 'or', 'with',
    'this', 'that', 'month', 'week', 'year', 'day', 'order', 'orders', 'txn', 'txns',
    'transactions', 'expense', 'expenses', 'where', 'is', 'there', 'any', 'get',
    'give', 'between', 'during', 'who', 'whom', 'money', 'paid', 'purchase', 'purchases'
  ]);

  tokens.forEach((t) => {
    if (
      !stopWords.has(t) &&
      !MONTH_NAMES.includes(t) &&
      !MONTH_SHORTS.includes(t) &&
      parseAmountToken(t) === null
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
    friendName,
    isWeekendOnly,
    isWeekdayOnly,
    isSplitOnly,
    isPendingDebtOnly,
    isFolderOnly,
    folderName,
    keywords: keywords.length > 0 ? keywords : undefined,
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
  const criteria = parseSmartQuery(rawQuery, categories, accounts);

  // 1. Filter transactions through intelligent multi-stage pipeline
  const matched = transactions.filter((t) => {
    const txDate = new Date(t.date);
    const dayOfWeek = txDate.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Weekend / Weekday filter
    if (criteria.isWeekendOnly && !isWeekend) return false;
    if (criteria.isWeekdayOnly && isWeekend) return false;

    // Type Match
    if (criteria.types && criteria.types.length > 0) {
      if (!criteria.types.includes(t.type)) return false;
    }

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

    // Amount Range Match
    const effectiveAmount = t.split ? t.split.yourShare : t.amount;
    if (criteria.minAmount !== undefined && effectiveAmount < criteria.minAmount) return false;
    if (criteria.maxAmount !== undefined && effectiveAmount > criteria.maxAmount) return false;

    // Date Window Match
    if (criteria.startDate && t.date < criteria.startDate) return false;
    if (criteria.endDate && t.date > criteria.endDate) return false;

    if (criteria.monthIndex !== undefined && txDate.getMonth() !== criteria.monthIndex) return false;
    if (criteria.year !== undefined && txDate.getFullYear() !== criteria.year) return false;

    // Split filter
    if (criteria.isSplitOnly && !t.split) return false;

    // Pending debt filter
    if (criteria.isPendingDebtOnly) {
      const isPendingLend = t.type === 'debt_lend' && !t.isSettled;
      const isPendingBorrow = t.type === 'debt_borrow' && !t.isSettled;
      const isPendingSplit = t.split && !t.split.settled;
      if (!isPendingLend && !isPendingBorrow && !isPendingSplit) return false;
    }

    // Friend Name filter
    if (criteria.friendName) {
      const fn = criteria.friendName.toLowerCase();
      const borrowerLender = (t.borrowerOrLender || '').toLowerCase();
      const splitFriends = (t.split?.friendNames || '').toLowerCase();
      const note = (t.note || '').toLowerCase();
      if (!fuzzyMatch(fn, borrowerLender) && !fuzzyMatch(fn, splitFriends) && !fuzzyMatch(fn, note)) {
        return false;
      }
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

    // Fuzzy Keyword Match against Note, Tag, Folder, Friend Names, Category, Account
    if (criteria.keywords && criteria.keywords.length > 0) {
      const noteLower = (t.note || '').toLowerCase();
      const tagLower = (t.tag || '').toLowerCase();
      const folderLower = (t.folderName || '').toLowerCase();
      const friendLower = (t.borrowerOrLender || t.split?.friendNames || '').toLowerCase();
      const catObj = categories.find((c) => c.id === t.categoryId);
      const catName = (catObj?.name || '').toLowerCase();
      const accObj = accounts.find((a) => a.id === t.accountId);
      const accName = (accObj?.name || '').toLowerCase();

      const matchesAnyKeyword = criteria.keywords.some((kw) => {
        return (
          fuzzyMatch(kw, noteLower, 0.7) ||
          fuzzyMatch(kw, tagLower, 0.7) ||
          fuzzyMatch(kw, folderLower, 0.7) ||
          fuzzyMatch(kw, friendLower, 0.7) ||
          fuzzyMatch(kw, catName, 0.75) ||
          fuzzyMatch(kw, accName, 0.75)
        );
      });

      // If category or account was already explicitly matched, keyword failure is tolerated if keyword matches note/tag/folder
      if (!matchesAnyKeyword && !criteria.categoryIds && !criteria.accountIds) {
        return false;
      }
    }

    return true;
  });

  // 2. Calculate Aggregations & Outliers
  const count = matched.length;
  const totalAmount = matched.reduce((sum, t) => sum + (t.split ? t.split.yourShare : t.amount), 0);
  const avgAmount = count > 0 ? Math.round(totalAmount / count) : 0;

  let highestTx: ExpenseTransaction | null = null;
  let lowestTx: ExpenseTransaction | null = null;
  if (count > 0) {
    highestTx = [...matched].sort((a, b) => (b.split ? b.split.yourShare : b.amount) - (a.split ? a.split.yourShare : a.amount))[0];
    lowestTx = [...matched].sort((a, b) => (a.split ? a.split.yourShare : a.amount) - (b.split ? b.split.yourShare : b.amount))[0];
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

  // 3. Format Contextual Criteria Strings
  let catNameDisplay: string | undefined = undefined;
  if (criteria.categoryIds && criteria.categoryIds.length > 0) {
    const cat = categories.find((c) => c.id === criteria.categoryIds![0]);
    if (cat) catNameDisplay = `${cat.name}${cat.emoji ? ` ${cat.emoji}` : ''}`;
  }

  let accNameDisplay: string | undefined = undefined;
  if (criteria.accountIds && criteria.accountIds.length > 0) {
    const acc = accounts.find((a) => a.id === criteria.accountIds![0]);
    if (acc) accNameDisplay = acc.name;
  }

  let timeframeDisplay: string | undefined = undefined;
  if (criteria.monthIndex !== undefined) {
    const mName = MONTH_NAMES[criteria.monthIndex].toUpperCase();
    timeframeDisplay = criteria.year ? `${mName} ${criteria.year}` : mName;
  } else if (criteria.startDate && criteria.endDate) {
    if (criteria.startDate === criteria.endDate) timeframeDisplay = criteria.startDate;
    else timeframeDisplay = 'past 7 days';
  } else if (criteria.isWeekendOnly) {
    timeframeDisplay = 'on Weekends';
  } else if (criteria.isWeekdayOnly) {
    timeframeDisplay = 'on Weekdays';
  }

  let amountRangeDisplay: string | undefined = undefined;
  if (criteria.minAmount !== undefined && criteria.maxAmount !== undefined) {
    if (criteria.minAmount === criteria.maxAmount) {
      amountRangeDisplay = `exact ${currencySymbol}${criteria.minAmount.toLocaleString('en-IN')}`;
    } else {
      amountRangeDisplay = `${currencySymbol}${criteria.minAmount.toLocaleString('en-IN')} – ${currencySymbol}${criteria.maxAmount.toLocaleString('en-IN')}`;
    }
  } else if (criteria.minAmount !== undefined) {
    amountRangeDisplay = `> ${currencySymbol}${criteria.minAmount.toLocaleString('en-IN')}`;
  } else if (criteria.maxAmount !== undefined) {
    amountRangeDisplay = `< ${currencySymbol}${criteria.maxAmount.toLocaleString('en-IN')}`;
  }

  // 4. Generate High-Quality Natural Language Answer
  let answer = '';
  if (count === 0) {
    const target = catNameDisplay || accNameDisplay || criteria.keywords?.join(', ') || criteria.originalQuery;
    answer = `No transactions found matching "${target}"${timeframeDisplay ? ` in ${timeframeDisplay}` : ''}${amountRangeDisplay ? ` (${amountRangeDisplay})` : ''}. Try adjusting your search query.`;
  } else if (criteria.intent === 'AVERAGE') {
    answer = `Your average expense${catNameDisplay ? ` on ${catNameDisplay}` : ''}${timeframeDisplay ? ` ${timeframeDisplay}` : ''} was ${currencySymbol}${avgAmount.toLocaleString('en-IN')} across ${count} transaction${count !== 1 ? 's' : ''}. Total spent: ${currencySymbol}${totalAmount.toLocaleString('en-IN')}.`;
  } else if (criteria.intent === 'HIGHEST' && highestTx) {
    const note = highestTx.note || 'Expense';
    const highestAmt = highestTx.split ? highestTx.split.yourShare : highestTx.amount;
    answer = `Your biggest expense was ${currencySymbol}${highestAmt.toLocaleString('en-IN')} for "${note}" on ${highestTx.date}${accNameDisplay ? ` via ${accNameDisplay}` : ''}.`;
  } else if (criteria.intent === 'LOWEST' && lowestTx) {
    const note = lowestTx.note || 'Expense';
    const lowestAmt = lowestTx.split ? lowestTx.split.yourShare : lowestTx.amount;
    answer = `Your smallest expense was ${currencySymbol}${lowestAmt.toLocaleString('en-IN')} for "${note}" on ${lowestTx.date}.`;
  } else if (criteria.intent === 'COUNT') {
    answer = `Found ${count} transaction${count !== 1 ? 's' : ''}${catNameDisplay ? ` in ${catNameDisplay}` : ''}${timeframeDisplay ? ` ${timeframeDisplay}` : ''} totaling ${currencySymbol}${totalAmount.toLocaleString('en-IN')}.`;
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
    answer = `Total spending across all categories is ${currencySymbol}${totalAmount.toLocaleString('en-IN')} (${count} transactions). Top categories: ${top3Cats || 'None'}.`;
  } else {
    // Default SUM or SEARCH response
    const entity = catNameDisplay && accNameDisplay
      ? `on ${catNameDisplay} via ${accNameDisplay}`
      : catNameDisplay
      ? `on ${catNameDisplay}`
      : accNameDisplay
      ? `via ${accNameDisplay}`
      : criteria.keywords?.[0]
      ? `for "${criteria.keywords[0]}"`
      : '';
    const time = timeframeDisplay ? (timeframeDisplay.startsWith('on') ? timeframeDisplay : `in ${timeframeDisplay}`) : '';
    const filter = amountRangeDisplay ? `(${amountRangeDisplay})` : '';
    const parts = [entity, time, filter].filter(Boolean).join(' ');

    answer = `You spent ${currencySymbol}${totalAmount.toLocaleString('en-IN')} ${parts ? `${parts} ` : ''}across ${count} transaction${count !== 1 ? 's' : ''}.`.replace(/\s+/g, ' ');
  }

  // 5. Construct Informative Metric Highlights
  const metrics: SmartMetricHighlight[] = [];
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
          sublabel: highestTx.note || undefined,
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
    confidenceScore: count > 0 ? 0.96 : 0.5,
    metrics,
    engineName: engineInfo.name,
    detectedCriteria: {
      categoryName: catNameDisplay,
      accountName: accNameDisplay,
      timeframeText: timeframeDisplay,
      amountRangeText: amountRangeDisplay,
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
// EXPANDED PRE-BUILT POPULAR SMART AI QUERY CHIPS
// ─────────────────────────────────────────────────────────────
export const SMART_QUERY_PRESETS = [
  { label: '🍔 Food this month', query: 'How much did I spend on Food this month?' },
  { label: '🛒 Amazon orders', query: 'Amazon purchases' },
  { label: '⚡ Spend > ₹100', query: 'Expenses above 100' },
  { label: '🏆 Highest expense', query: 'Highest expense in September' },
  { label: '🚬 Cigarettes total', query: 'Total spent on cigarettes' },
  { label: '💳 HDFC Bank', query: 'HDFC transactions' },
  { label: '📈 Past 7 days', query: 'Total spent this week' },
  { label: '🏖️ Goa trip tag', query: 'Goa trip' },
  { label: '👥 Split with friends', query: 'Split bills with friends' },
];
