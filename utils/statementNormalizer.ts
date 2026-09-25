import { ExpenseAccount, ExpenseCategory, ExpenseTransaction, TransactionType } from '@/types/expense';
import { ParsedPdfRow } from './pdfParser';

export interface StagedStatementTxn {
  id: string;
  selected: boolean;
  date: string; // ISO format (YYYY-MM-DD)
  rawDate: string;
  narration: string; // ALL-CAPS
  amount: number;
  type: TransactionType;
  categoryId: string;
  categoryConfidence: 'high' | 'medium' | 'low';
  accountName: string;
  accountId?: string;
  toAccountId?: string;
  toAccountName?: string;
  refNo?: string;
  balance?: number;
  isDuplicate: boolean;
  compositeHash: string;
  rawLine?: string;
}

export interface StatementReconciliation {
  openingBalance?: number;
  closingBalance?: number;
  totalDebits: number;
  totalCredits: number;
  netFlow: number;
  isReconciled: boolean;
  reconciledDiff: number;
}

export interface NormalizedStatementResult {
  bankName: string;
  accountNumberMasked?: string;
  statementPeriod?: string;
  reconciliation: StatementReconciliation;
  accountBalances?: Record<string, number>;
  accountDueAmounts?: Record<string, number>;
  accountsDetected: string[];
  transactions: StagedStatementTxn[];
  duplicateCount: number;
  newCount: number;
  totalAmount: number;
}

// Fast string hash for composite duplicate signatures
export function generateCompositeHash(
  date: string,
  amount: number,
  type: string,
  narration: string,
  refNo?: string
): string {
  const normNarration = narration.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
  const normRef = (refNo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = `${date}|${Math.round(amount * 100)}|${type}|${normNarration}|${normRef}`;
  
  // Simple fast string hash
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash_${Math.abs(hash).toString(36)}_${Math.round(amount)}`;
}

// Convert various date formats into standardized ISO "YYYY-MM-DD"
export function normalizeDateToISO(dateStr: string): string {
  const clean = dateStr.trim();
  const todayISO = new Date().toISOString().split('T')[0];

  // 1. "DD MMM YYYY" e.g. "13 Sep 2026", "21-Sep-2026", "21/Sep/26"
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const dmyWord = clean.match(/(\d{1,2})[\s\-/]+([A-Za-z]{3})[\s\-/]+(\d{2,4})/);
  if (dmyWord) {
    const day = dmyWord[1].padStart(2, '0');
    const mIdx = months.indexOf(dmyWord[2].toLowerCase());
    const month = (mIdx >= 0 ? mIdx + 1 : 1).toString().padStart(2, '0');
    let year = dmyWord[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // 2. "DD/MM/YYYY" or "DD-MM-YYYY" or "YYYY-MM-DD"
  const parts = clean.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    // DD/MM/YYYY or DD/MM/YY
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  return todayISO;
}

/**
 * Multi-Tier Smart Categorizer:
 * 1. Historical learned merchant rules from user's past actions
 * 2. Exact category name match in user categories
 * 3. Semantic keyword & merchant pattern heuristics
 * 4. Fallback to default category
 */
export function classifyNarration(
  narration: string,
  categories: ExpenseCategory[],
  learnedRules: Record<string, string> = {}
): { categoryId: string; confidence: 'high' | 'medium' | 'low' } {
  const text = narration.toLowerCase();

  // Tier 1: Check learned merchant memory
  const normalizedKey = text.replace(/[^a-z0-9]/g, '').slice(0, 30);
  for (const [merchantKey, catId] of Object.entries(learnedRules)) {
    if (normalizedKey.includes(merchantKey) || merchantKey.includes(normalizedKey)) {
      const match = categories.find((c) => c.id === catId);
      if (match) {
        return { categoryId: match.id, confidence: 'high' };
      }
    }
  }

  // Tier 2: Check exact category name match in narration
  for (const cat of categories) {
    const catNameLower = cat.name.toLowerCase();
    if (text === catNameLower || text.startsWith(catNameLower + ' ') || text.endsWith(' ' + catNameLower)) {
      return { categoryId: cat.id, confidence: 'high' };
    }
  }

  // Tier 3: Keyword heuristics for Indian & Global merchants

  // Cigarettes / Tobacco
  if (/cig|cigarette|smoke|tobacco|paan|lighter|vape/.test(text)) {
    const cigCat = categories.find((c) => c.id === 'cat_cig' || c.name.toLowerCase().includes('cig'));
    if (cigCat) return { categoryId: cigCat.id, confidence: 'high' };
  }

  // Food & Dining & Quick Commerce Groceries
  if (/swiggy|zomato|mcdonald|kfc|starbucks|burger|pizza|cafe|restaurant|hotel|bhojanalay|blinkit|zepto|instamart|bakery|diner|food|chai|tea|coffee|lunch|dinner|breakfast|snack|biryani|domino/.test(text)) {
    const foodCat = categories.find((c) => c.id === 'cat_food' || c.name.toLowerCase().includes('food'));
    if (foodCat) return { categoryId: foodCat.id, confidence: 'high' };
  }

  // Transport & Travel
  if (/uber|ola|rapido|metro|fuel|petrol|diesel|shell|hpcl|bpcl|irctc|flight|indigo|airindia|toll|fastag|parking|auto|cab|bus|railway|transport|rickshaw/.test(text)) {
    const transCat = categories.find((c) => c.id === 'cat_trans' || c.name.toLowerCase().includes('trans'));
    if (transCat) return { categoryId: transCat.id, confidence: 'high' };
  }

  // Shopping & Ecommerce & Retail
  if (/amazon|flipkart|myntra|zara|h&m|nykaa|meesho|ajio|croma|reliance|retail|apple|decathlon|store|mart|mall|cloth|apparel|vishal|holder|purchase|pos\s*\d/.test(text)) {
    const shopCat = categories.find((c) => c.id === 'cat_shop' || c.name.toLowerCase().includes('shop'));
    if (shopCat) return { categoryId: shopCat.id, confidence: 'medium' };
  }

  // Entertainment & Subscriptions
  if (/netflix|spotify|prime|hotstar|youtube|bookmyshow|pvr|inox|steam|playstation|movie|cinema|game|disney|theatre/.test(text)) {
    const entCat = categories.find((c) => c.id === 'cat_ent' || c.name.toLowerCase().includes('ent'));
    if (entCat) return { categoryId: entCat.id, confidence: 'high' };
  }

  // Utilities & Bills & Recharges
  if (/electricity|bescom|tata power|airtel|jio|vi\b|vodafone|broadband|wifi|water|gas|cylinder|bill|recharge|dth|postpaid|prepaid/.test(text)) {
    const utilCat = categories.find((c) => c.id === 'cat_util' || c.name.toLowerCase().includes('util'));
    if (utilCat) return { categoryId: utilCat.id, confidence: 'high' };
  }

  // Health & Pharmacy
  if (/apollo|pharmeasy|netmeds|medplus|hospital|clinic|doctor|pharmacy|medicine|dental|pathology|lab|1mg/.test(text)) {
    const healthCat = categories.find((c) => c.id === 'cat_health' || c.name.toLowerCase().includes('health'));
    if (healthCat) return { categoryId: healthCat.id, confidence: 'high' };
  }

  // Finance & Banking Fees & Taxes
  if (/interest|charges|fee|tax|gst|emi|loan|insurance|lic|hdfc bank|sbi bank|penalty|stamp/.test(text)) {
    const finCat = categories.find((c) => c.id === 'cat_fin' || c.name.toLowerCase().includes('fin'));
    if (finCat) return { categoryId: finCat.id, confidence: 'medium' };
  }

  // Income / Salary / Refund / Cashback
  if (/salary|payroll|dividend|refund|cashback|bonus|stipend|interest credit/.test(text)) {
    const incCat = categories.find((c) => c.id === 'cat_income' || c.name.toLowerCase().includes('income'));
    if (incCat) return { categoryId: incCat.id, confidence: 'high' };
  }

  // Tier 4: Fallback
  const miscCat = categories.find((c) => c.id === 'cat_misc' || c.name.toLowerCase().includes('misc'));
  return {
    categoryId: miscCat?.id || categories[0]?.id || 'cat_shop',
    confidence: 'low',
  };
}

/**
 * Universal Statement Normalizer Engine
 * Supports both parsed PDF spatial rows and raw CSV/Text files.
 */
export function normalizeStatementData(
  input: { pdfRows?: ParsedPdfRow[]; csvContent?: string; fileName?: string },
  existingAccounts: ExpenseAccount[],
  existingCategories: ExpenseCategory[],
  existingTransactions: ExpenseTransaction[],
  learnedRules: Record<string, string> = {}
): NormalizedStatementResult {
  let bankName = 'Bank Statement';
  let accountNumberMasked: string | undefined;
  let statementPeriod: string | undefined;
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;

  const accountsDetectedSet = new Set<string>();
  const accountBalances: Record<string, number> = {};
  const accountDueAmounts: Record<string, number> = {};
  const stagedTxs: StagedStatementTxn[] = [];
  let currentAccountName = existingAccounts[0]?.name || 'Primary Account';

  // Helper to match account name against existing accounts
  function resolveAccountId(accName: string): string | undefined {
    if (!accName) return undefined;
    const directMatch = existingAccounts.find(
      (a) => a.name.toLowerCase() === accName.toLowerCase()
    );
    if (directMatch) return directMatch.id;

    // Partial substring match (e.g. "Slice Card" matches "Slice")
    const partialMatch = existingAccounts.find(
      (a) =>
        accName.toLowerCase().includes(a.name.toLowerCase()) ||
        a.name.toLowerCase().includes(accName.toLowerCase())
    );
    if (partialMatch) return partialMatch.id;

    return undefined;
  }

  // ══════════════════════════════════════════════════════════
  // BRANCH A: PDF SPATIAL ROWS PARSING
  // ══════════════════════════════════════════════════════════
  if (input.pdfRows && input.pdfRows.length > 0) {
    const rows = input.pdfRows;

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const lineStr = row.items.map((x) => x.text).join(' ');

      // 1. Bank Name detection
      if (/klarr/i.test(lineStr)) bankName = 'Klarr Statement';
      else if (/hdfc/i.test(lineStr)) bankName = 'HDFC Bank';
      else if (/state bank|sbi\b/i.test(lineStr)) bankName = 'State Bank of India';
      else if (/icici/i.test(lineStr)) bankName = 'ICICI Bank';
      else if (/axis/i.test(lineStr)) bankName = 'Axis Bank';
      else if (/kotak/i.test(lineStr)) bankName = 'Kotak Mahindra Bank';
      else if (/slice/i.test(lineStr)) bankName = 'Slice';
      else if (/chase/i.test(lineStr)) bankName = 'Chase Bank';

      // 2. Account Number Masking detection (e.g. "A/c: XX1234", "Account Number: *******1234")
      const accNumMatch = lineStr.match(/(?:a\/c|account|acct|card)(?:\s+no\.?)?[:\s]+([xX*0-9\s-]{4,20})/i);
      if (accNumMatch && !accountNumberMasked) {
        accountNumberMasked = accNumMatch[1].trim();
      }

      // 3. Statement Period detection (e.g. "01 Sep 2026 to 25 Sep 2026")
      const periodMatch = lineStr.match(
        /(\d{1,2}[\s\-/]+[A-Za-z]{3}[\s\-/]+\d{2,4}|\d{1,2}[\s\-/]+\d{1,2}[\s\-/]+\d{2,4})\s*(?:Ñ|to|-|–|—|through)\s*(\d{1,2}[\s\-/]+[A-Za-z]{3}[\s\-/]+\d{2,4}|\d{1,2}[\s\-/]+\d{1,2}[\s\-/]+\d{2,4})/i
      );
      if (periodMatch && !statementPeriod) {
        statementPeriod = `${periodMatch[1]} to ${periodMatch[2]}`;
      }

      // 4. Multi-Account Section header detection (e.g. "Amazon Pay wallet 1 transactions", "Slice 13 transactions")
      const accHeaderMatch = lineStr.match(/^([A-Za-z0-9\s/]+?)\s+(\d+)\s+transactions/i);
      if (accHeaderMatch) {
        currentAccountName = accHeaderMatch[1].trim();
        accountsDetectedSet.add(currentAccountName);
        continue;
      }

      // 5. Opening / Closing Balance detection per account
      if (/closing\s+balance/i.test(lineStr)) {
        let amtStr = '';
        const isNegative = lineStr.includes('-') || lineStr.toLowerCase().includes('dr');
        for (const it of row.items) {
          if (it.text.includes('₹') || it.text.includes('$') || /^[0-9,.]+$/.test(it.text)) {
            amtStr += it.text.replace(/[₹$,\s]/g, '');
          }
        }
        const val = parseFloat(amtStr);
        if (!isNaN(val)) {
          closingBalance = val;
          const isCreditCard = /axis|credit|card|zone/i.test(currentAccountName);
          if (isCreditCard) {
            accountDueAmounts[currentAccountName] = val;
          } else if (!isNegative) {
            accountBalances[currentAccountName] = val;
          }
        }
        continue;
      }

      if (/opening\s+balance/i.test(lineStr)) {
        let amtStr = '';
        for (const it of row.items) {
          if (it.text.includes('₹') || it.text.includes('$') || /^[0-9,.]+$/.test(it.text)) {
            amtStr += it.text.replace(/[₹$,\s]/g, '');
          }
        }
        const val = parseFloat(amtStr);
        if (!isNaN(val)) {
          openingBalance = val;
        }
        continue;
      }

      // 6. Transaction Row Detection
      // Check if row begins with a valid date token
      const firstTwo = row.items.slice(0, 2).map((x) => x.text).join(' ');
      const dateMatch = firstTwo.match(
        /(\d{1,2}[\s\-/]+[A-Za-z]{3}[\s\-/]+\d{2,4}|\d{1,2}[\s\-/]+\d{1,2}[\s\-/]+\d{2,4}|\d{4}[\s\-/]+\d{2}[\s\-/]+\d{2})/
      );

      if (dateMatch) {
        const rawDate = dateMatch[1];
        const isoDate = normalizeDateToISO(rawDate);

        // Collect all currency/amount values in this row
        const amountValues: number[] = [];
        for (let i = 0; i < row.items.length; i++) {
          const it = row.items[i];
          if (it.text.includes('₹') || it.text.includes('$')) {
            let numStr = it.text.replace(/[₹$,\s]/g, '').trim();
            // Handle split tokens e.g. "₹1", ",", "016"
            let nextIdx = i + 1;
            while (
              nextIdx < row.items.length &&
              (row.items[nextIdx].text === ',' || /^[0-9]+$/.test(row.items[nextIdx].text))
            ) {
              numStr += row.items[nextIdx].text;
              nextIdx++;
            }
            const val = parseFloat(numStr.replace(/,/g, ''));
            if (!isNaN(val) && val > 0) amountValues.push(val);
          } else if (/^[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?$|^[0-9]+\.[0-9]{2}$/.test(it.text)) {
            const val = parseFloat(it.text.replace(/,/g, ''));
            if (!isNaN(val) && val > 0 && val < 100000000) amountValues.push(val);
          }
        }

        let parsedAmount = amountValues[0] || 0;
        let parsedBalance = amountValues.length > 1 ? amountValues[amountValues.length - 1] : undefined;

        // Skip rows where amount is 0 (header/footer timestamps)
        if (parsedAmount <= 0) continue;

        // Check if Credit (Income) or Debit (Expense)
        let isIncome =
          lineStr.toLowerCase().includes('credit') ||
          lineStr.toLowerCase().includes('cr.') ||
          lineStr.toLowerCase().includes('refund') ||
          lineStr.toLowerCase().includes('deposit');

        // Check for Internal Self-Transfer / Card Payment / ATM
        let txnType: TransactionType = isIncome ? 'income' : 'expense';
        let toAccName: string | undefined;

        if (
          /atm\s+wdl|atm\s+cash|self\s*transfer|transfer\s+to\s+self|fund\s*transfer|card\s*bill\s*payment|credit\s*card\s*payment|payment\s+to\s+card|neft\s+to\s+self|imps\s+to\s+self|\btransfer\b|\btrf\b/i.test(lineStr) ||
          row.items.some((it) => /^transfer$/i.test(it.text.trim()) || /^self\s*transfer$/i.test(it.text.trim()))
        ) {
          txnType = 'transfer';

          // Detect target account if mentioned
          const allKnownNames = [...existingAccounts.map((a) => a.name), ...Array.from(accountsDetectedSet)];
          for (const known of allKnownNames) {
            if (
              known.toLowerCase() !== currentAccountName.toLowerCase() &&
              new RegExp(`\\b${known}\\b`, 'i').test(lineStr)
            ) {
              toAccName = known;
              break;
            }
          }
        }

        // Extract narration tokens (exclude dates, amounts, "Debit", "Credit", dashes)
        const cleanTokens = row.items
          .filter(
            (x) =>
              !x.text.match(/(\d{1,2}[\s\-/]+[A-Za-z]{3}[\s\-/]+\d{2,4}|\d{1,2}[\s\-/]+\d{1,2}[\s\-/]+\d{2,4})/) &&
              !x.text.includes('₹') &&
              !x.text.includes('$') &&
              !/^[0-9,.\s-]+$/.test(x.text) &&
              !['DEBIT', 'CREDIT', 'DR', 'CR', 'EXPENSES', 'INCOME', '--', '-', ','].includes(x.text.toUpperCase())
          )
          .map((x) => x.text);

        let narration = cleanTokens[0] || 'Transaction';
        let categorySuggestion = cleanTokens.length > 1 ? cleanTokens[1] : undefined;

        if (narration.toLowerCase() === 'cigarettes' && !categorySuggestion) {
          categorySuggestion = 'Cigarettes';
        }

        // Categorize
        let matchedCatId = existingCategories[0]?.id || 'cat_shop';
        let confidence: 'high' | 'medium' | 'low' = 'low';

        if (categorySuggestion) {
          const directCat = existingCategories.find(
            (c) => c.name.toLowerCase() === categorySuggestion?.toLowerCase()
          );
          if (directCat) {
            matchedCatId = directCat.id;
            confidence = 'high';
          } else {
            const res = classifyNarration(narration + ' ' + categorySuggestion, existingCategories, learnedRules);
            matchedCatId = res.categoryId;
            confidence = res.confidence;
          }
        } else {
          const res = classifyNarration(narration, existingCategories, learnedRules);
          matchedCatId = res.categoryId;
          confidence = res.confidence;
        }

        // Deduplication signature check
        const compositeHash = generateCompositeHash(isoDate, parsedAmount, txnType, narration);
        const isDuplicate = existingTransactions.some((tx) => {
          const txHash = generateCompositeHash(tx.date, tx.amount, tx.type, tx.note || '');
          return txHash === compositeHash;
        });

        const targetAccId = resolveAccountId(currentAccountName);

        stagedTxs.push({
          id: `staged_${Date.now()}_${stagedTxs.length}_${Math.random().toString(36).slice(2, 6)}`,
          selected: !isDuplicate, // Pre-select only new transactions!
          date: isoDate,
          rawDate,
          narration: narration.toUpperCase(),
          amount: parsedAmount,
          type: txnType,
          categoryId: matchedCatId,
          categoryConfidence: confidence,
          accountName: currentAccountName,
          accountId: targetAccId,
          toAccountId: toAccName ? resolveAccountId(toAccName) : undefined,
          toAccountName: toAccName,
          balance: parsedBalance,
          isDuplicate,
          compositeHash,
          rawLine: lineStr,
        });
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // BRANCH B: CSV / TEXT PARSING
  // ══════════════════════════════════════════════════════════
  else if (input.csvContent) {
    const lines = input.csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const isAppHeader = lines[0]?.toLowerCase().includes('id') && lines[0]?.toLowerCase().includes('category');
    const startIdx =
      isAppHeader || lines[0]?.toLowerCase().includes('amount') || lines[0]?.toLowerCase().includes('date')
        ? 1
        : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.length < 5) continue;

      const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      const cleanParts = parts.map((p) => p.replace(/^"|"$/g, '').trim());

      let amount = 0;
      let dateStr = new Date().toISOString().split('T')[0];
      let narration = `Imported: ${input.fileName || 'CSV'}`;
      let isIncome = false;
      let categoryId = existingCategories[0]?.id || 'cat_shop';
      let confidence: 'high' | 'medium' | 'low' = 'low';

      if (isAppHeader && cleanParts.length >= 5) {
        dateStr = cleanParts[1] || dateStr;
        amount = Math.abs(parseFloat(cleanParts[2])) || 0;
        isIncome = cleanParts[3]?.toLowerCase() === 'income';
        const catMatch = existingCategories.find(
          (c) => c.id === cleanParts[4] || c.name.toLowerCase() === cleanParts[4]?.toLowerCase()
        );
        if (catMatch) {
          categoryId = catMatch.id;
          confidence = 'high';
        }
        if (cleanParts[6]) narration = cleanParts[6];
      } else {
        // Multi-Bank Heuristics
        const dateMatch = line.match(
          /(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})/
        );
        if (dateMatch) {
          dateStr = normalizeDateToISO(dateMatch[1]);
        }

        const lineWithoutDate = line.replace(
          /(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})/g,
          ' '
        );
        const numbers =
          lineWithoutDate.match(
            /(?:₹|\$|INR)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/g
          ) || [];
        const cleanNums = numbers
          .map((n) => parseFloat(n.replace(/[₹$, INR\s]/g, '')))
          .filter((n) => !isNaN(n) && n > 0 && n < 10000000);

        if (cleanNums.length > 0) {
          amount = cleanNums[0];
          if (cleanNums.length >= 2 && line.toLowerCase().includes('cr') && !line.toLowerCase().includes('dr')) {
            isIncome = true;
          }
        }

        const cleanedText = line
          .replace(/(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g, '')
          .replace(/[0-9,.]+/g, '')
          .replace(/[|;,\t]/g, ' ')
          .trim();
        if (cleanedText.length > 2) {
          narration = cleanedText.slice(0, 50).trim();
        }

        const classRes = classifyNarration(narration || line, existingCategories, learnedRules);
        categoryId = classRes.categoryId;
        confidence = classRes.confidence;
      }

      if (amount > 0) {
        const txnType: TransactionType = isIncome ? 'income' : 'expense';
        const compositeHash = generateCompositeHash(dateStr, amount, txnType, narration);
        const isDuplicate = existingTransactions.some((tx) => {
          const txHash = generateCompositeHash(tx.date, tx.amount, tx.type, tx.note || '');
          return txHash === compositeHash;
        });

        stagedTxs.push({
          id: `staged_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          selected: !isDuplicate,
          date: dateStr,
          rawDate: dateStr,
          narration: narration.toUpperCase(),
          amount,
          type: txnType,
          categoryId,
          categoryConfidence: confidence,
          accountName: currentAccountName,
          accountId: existingAccounts[0]?.id || 'acc_default',
          isDuplicate,
          compositeHash,
          rawLine: line,
        });
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // RECONCILIATION CALCULATIONS
  // ══════════════════════════════════════════════════════════
  const totalDebits = stagedTxs
    .filter((t) => t.type === 'expense' || t.type === 'transfer' || t.type === 'debt_lend')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCredits = stagedTxs
    .filter((t) => t.type === 'income' || t.type === 'debt_borrow')
    .reduce((sum, t) => sum + t.amount, 0);

  const netFlow = totalCredits - totalDebits;

  let isReconciled = true;
  let reconciledDiff = 0;
  if (openingBalance !== undefined && closingBalance !== undefined) {
    const calculatedClosing = openingBalance + totalCredits - totalDebits;
    reconciledDiff = Math.abs(calculatedClosing - closingBalance);
    isReconciled = reconciledDiff < 1; // within 1 unit tolerance
  }

  const duplicateCount = stagedTxs.filter((t) => t.isDuplicate).length;
  const newCount = stagedTxs.length - duplicateCount;
  const totalAmount = stagedTxs.reduce((sum, t) => sum + t.amount, 0);

  if (accountsDetectedSet.size === 0) {
    accountsDetectedSet.add(currentAccountName);
  }

  return {
    bankName,
    accountNumberMasked,
    statementPeriod,
    reconciliation: {
      openingBalance,
      closingBalance,
      totalDebits,
      totalCredits,
      netFlow,
      isReconciled,
      reconciledDiff,
    },
    accountBalances,
    accountDueAmounts,
    accountsDetected: Array.from(accountsDetectedSet),
    transactions: stagedTxs,
    duplicateCount,
    newCount,
    totalAmount,
  };
}
