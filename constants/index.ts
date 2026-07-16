/**
 * Constants — barrel export
 *
 * Import everything from `@/constants`:
 *
 *   import { Colors, Spacing, Radius } from "@/constants"
 *   import { Gradients, Duration, SpringConfig } from "@/constants"
 *   import { hexToRGBA, opacity } from "@/constants"
 */

// ─── Tokens (values) ───────────────────────────────────────────────

export { colors } from "./colors";
export { transparentWhite } from "./colors";
export { spacing } from "./spacing";
export { screenPadding } from "./spacing";
export { radius } from "./radius";
export { cardRadius, sheetRadius, radiusFull } from "./radius";
export { typography } from "./typography";
export { textStyleFor } from "./typography";
export { shadows } from "./shadows";
export { shadowStyle } from "./shadows";
export { gradients } from "./gradients";
export {
  duration,
  springConfig,
  buttonPressScale,
  buttonReleaseScale,
  cardEnterInitialOpacity,
  cardEnterInitialTranslateY,
  fade,
  slideUp,
  slideDown,
  slideFromRight,
  scaleIn,
} from "./animation";

// ─── Helper functions ──────────────────────────────────────────────

export { hexToRGBA, opacity, dynamicColor } from "./theme";

// ─── Shared data ──────────────────────────────────────────────────

export const CATEGORIES = [
  "Entertainment",
  "Music",
  "Productivity",
  "Health",
  "Education",
  "Gaming",
  "AI",
  "News",
  "Cloud",
  "Shopping",
  "Finance",
  "Other",
] as const;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
  CAD: "CA$",
  AUD: "A$",
  CHF: "₣",
  CNY: "¥",
  SGD: "S$",
  HKD: "HK$",
  NOK: "kr",
  SEK: "kr",
  DKK: "kr",
  NZD: "NZ$",
  BRL: "R$",
  MXN: "MX$",
  KRW: "₩",
  TRY: "₺",
  AED: "د.إ",
  SAR: "﷼",
  ZAR: "R",
  THB: "฿",
  MYR: "RM",
  IDR: "Rp",
  PHP: "₱",
  PLN: "zł",
  CZK: "Kč",
  HUF: "Ft",
  RUB: "₽",
  UAH: "₴",
  RON: "lei",
};

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", flag: "🇨🇦" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺" },
  { code: "CHF", symbol: "₣", name: "Swiss Franc", flag: "🇨🇭" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", flag: "🇨🇳" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", flag: "🇸🇬" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", flag: "🇭🇰" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", flag: "🇳🇴" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", flag: "🇸🇪" },
  { code: "DKK", symbol: "kr", name: "Danish Krone", flag: "🇩🇰" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", flag: "🇳🇿" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", flag: "🇧🇷" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", flag: "🇲🇽" },
  { code: "KRW", symbol: "₩", name: "South Korean Won", flag: "🇰🇷" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", flag: "🇹🇷" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", flag: "🇦🇪" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", flag: "🇸🇦" },
  { code: "ZAR", symbol: "R", name: "South African Rand", flag: "🇿🇦" },
  { code: "THB", symbol: "฿", name: "Thai Baht", flag: "🇹🇭" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", flag: "🇲🇾" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", flag: "🇮🇩" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", flag: "🇵🇭" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty", flag: "🇵🇱" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna", flag: "🇨🇿" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint", flag: "🇭🇺" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble", flag: "🇷🇺" },
  { code: "UAH", symbol: "₴", name: "Ukrainian Hryvnia", flag: "🇺🇦" },
];

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] || "$";
}
