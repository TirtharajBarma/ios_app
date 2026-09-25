import AsyncStorage from "@/utils/storage";
import { CURRENCIES, getCurrencySymbol } from "@/constants";

const STORAGE_KEY = "@expense_exchange_rates_v2";
const LEGACY_STORAGE_KEY = "@subo_exchange_rates_v2";
const API_URL = "https://open.er-api.com/v6/latest/USD";

// Fallback rates pegged to USD (guaranteed offline accuracy)
export const FALLBACK_EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  INR: 83.3,
  JPY: 157.5,
  CAD: 1.37,
  AUD: 1.50,
  CHF: 0.89,
  CNY: 7.25,
  SGD: 1.35,
  HKD: 7.81,
  NOK: 10.6,
  SEK: 10.5,
  DKK: 6.9,
  NZD: 1.63,
  BRL: 5.35,
  MXN: 18.5,
  KRW: 1380.0,
  TRY: 32.5,
  AED: 3.67,
  SAR: 3.75,
  ZAR: 18.2,
  THB: 36.7,
  MYR: 4.71,
  IDR: 16400.0,
  PHP: 58.6,
  PLN: 4.05,
  CZK: 23.2,
  HUF: 368.0,
  RUB: 89.0,
  UAH: 40.5,
  RON: 4.58,
};

export interface ExchangeRatesData {
  rates: Record<string, number>;
  lastUpdated: number;
}

// In-memory cache for ultra-fast synchronous UI rendering
let cachedRatesData: ExchangeRatesData | null = null;

/**
 * Loads cached exchange rates synchronously or from memory/storage.
 */
export async function getCachedExchangeRatesData(): Promise<ExchangeRatesData> {
  if (cachedRatesData) {
    return cachedRatesData;
  }

  try {
    let stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) {
      stored = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    }
    if (stored) {
      const parsed: ExchangeRatesData = JSON.parse(stored);
      if (parsed && parsed.rates) {
        cachedRatesData = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to load cached exchange rates:", e);
  }

  cachedRatesData = {
    rates: FALLBACK_EXCHANGE_RATES,
    lastUpdated: 0,
  };
  return cachedRatesData;
}

/**
 * Fetches the latest exchange rates from the API.
 * Updates local cache and in-memory cache.
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.rates) {
        const ratesData: ExchangeRatesData = {
          rates: { ...FALLBACK_EXCHANGE_RATES, ...data.rates },
          lastUpdated: Date.now(),
        };
        cachedRatesData = ratesData;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ratesData));
        return ratesData.rates;
      }
    }
  } catch (error) {
    // Offline or network error - gracefully fall back
  }

  // Fallback to offline stored rates
  const cached = await getCachedExchangeRatesData();
  return cached.rates;
}

/**
 * Converts an amount from a source currency to a target currency using exchange rates.
 * If source === target, returns amount untouched.
 * Never silently defaults to 1:1 if source !== target.
 */
export function convertCurrency(
  amount: number,
  fromCode: string = "INR",
  toCode: string = "INR",
  rates: Record<string, number> = cachedRatesData?.rates || FALLBACK_EXCHANGE_RATES
): number {
  if (!amount || isNaN(amount)) return 0;

  const src = (fromCode || "INR").trim().toUpperCase();
  const dst = (toCode || "INR").trim().toUpperCase();

  if (src === dst) return amount;

  const rateTable = { ...FALLBACK_EXCHANGE_RATES, ...(rates || {}) };
  const fromRate = rateTable[src] ?? FALLBACK_EXCHANGE_RATES[src] ?? 1.0;
  const toRate = rateTable[dst] ?? FALLBACK_EXCHANGE_RATES[dst] ?? 1.0;

  if (fromRate <= 0) return amount;

  // Convert source -> USD -> destination
  const amountInUSD = amount / fromRate;
  const converted = amountInUSD * toRate;

  return converted;
}

/**
 * Zero-decimal currencies that should not show fractional cents
 */
export const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "HUF", "IDR", "CLP", "PYG", "VND"]);

/**
 * Formats a numeric amount converted from `fromCode` to `toCode` with symbol and proper formatting.
 */
export function formatConvertedCurrency(
  amount: number,
  fromCode: string = "INR",
  toCode: string = "INR",
  symbol?: string,
  rates?: Record<string, number>
): string {
  const converted = convertCurrency(amount, fromCode, toCode, rates);
  const targetCode = (toCode || "INR").trim().toUpperCase();
  const sym = symbol || getCurrencySymbol(targetCode);

  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(targetCode);
  const isINR = targetCode === "INR";

  let formattedNumber: string;

  if (isINR) {
    // Indian Rupee formatting (e.g. 1,00,000)
    formattedNumber = Math.round(converted).toLocaleString("en-IN");
  } else if (isZeroDecimal) {
    formattedNumber = Math.round(converted).toLocaleString("en-US");
  } else {
    // Standard currency formatting (2 decimals if has fraction, or standard)
    const rounded = Number(converted.toFixed(2));
    formattedNumber = rounded.toLocaleString("en-US", {
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }

  return `${sym}${formattedNumber}`;
}

/**
 * Formats last updated time into human-friendly string.
 */
export function getRatesLastUpdatedFormatted(timestamp: number): string {
  if (!timestamp || timestamp === 0) {
    return "Using offline cached exchange rates";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Updated just now";
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  if (diffDays === 1) return "Updated yesterday";
  return `Updated ${new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
