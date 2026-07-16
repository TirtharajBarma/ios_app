import AsyncStorage from "@/utils/storage";

const STORAGE_KEY = "@subo_exchange_rates";
const API_URL = "https://open.er-api.com/v6/latest/USD";

// Fallback rates (as of latest static sync)
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
};

export interface ExchangeRatesData {
  rates: Record<string, number>;
  lastUpdated: number;
}

/**
 * Fetches the latest exchange rates from the API.
 * Falls back to locally stored rates, and then to static fallback rates.
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    // Try to fetch latest online rates
    const response = await fetch(API_URL);
    if (response.ok) {
      const data = await response.json();
      if (data && data.rates) {
        const ratesData: ExchangeRatesData = {
          rates: data.rates,
          lastUpdated: Date.now(),
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ratesData));
        return data.rates;
      }
    }
  } catch (error) {
    console.warn("Failed to fetch live exchange rates, using offline storage:", error);
  }

  // Fallback to offline stored rates
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: ExchangeRatesData = JSON.parse(stored);
      // Only use if not older than 7 days
      if (Date.now() - data.lastUpdated < 7 * 24 * 60 * 60 * 1000) {
        return data.rates;
      }
    }
  } catch (e) {
    console.warn("Failed to load stored exchange rates:", e);
  }

  return FALLBACK_EXCHANGE_RATES;
}
