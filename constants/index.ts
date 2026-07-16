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
  INR: "₹",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "$",
  AUD: "$",
};

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] || "$";
}
