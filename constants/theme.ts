/**
 * Theme — master export & helper functions
 *
 * Import from here for anything that combines or derives values from
 * multiple constant modules (e.g. opacity helper, hex → rgba converter,
 * dynamic color selector).
 */

// ─── Re-exports for convenience ────────────────────────────────────

export { colors, transparentWhite } from "./colors";
export type { Colors } from "./colors";

export { spacing, screenPadding } from "./spacing";
export type { Spacing } from "./spacing";

export { radius, cardRadius, sheetRadius, radiusFull } from "./radius";
export type { Radius } from "./radius";

export { typography, textStyleFor } from "./typography";
export type { Typography } from "./typography";

export { shadows, shadowStyle } from "./shadows";
export type { Shadows, ShadowLevel } from "./shadows";

export { gradients } from "./gradients";
export type { Gradients, GradientStops } from "./gradients";

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
export type { Duration, SpringConfig, AnimationTokens } from "./animation";

// ─── Helper functions ───────────────────────────────────────────────

/**
 * Create an rgba string from a hex color and opacity value.
 *
 * @example
 *   hexToRGBA("#FFFFFF", 0.1)  // → "rgba(255, 255, 255, 0.1)"
 *   hexToRGBA("#0A84FF", 0.5)  // → "rgba(10, 132, 255, 0.5)"
 */
export function hexToRGBA(hex: string, opacity: number): string {
  // Strip leading # if present
  const clean = hex.replace("#", "");

  // Handle shorthand hex (e.g., "FFF" -> "FFFFFF")
  let fullHex = clean;
  if (clean.length === 3) {
    fullHex = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }

  // Handle 8-character hex with alpha (ignore the alpha portion)
  const hex6 = fullHex.substring(0, 6);

  const r = parseInt(hex6.substring(0, 2), 16) || 0;
  const g = parseInt(hex6.substring(2, 4), 16) || 0;
  const b = parseInt(hex6.substring(4, 6), 16) || 0;

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Generate a transparent-white rgba string at a given opacity.
 *
 * @example
 *   opacity(0.08)   // → "rgba(255, 255, 255, 0.08)"
 *   opacity(0.2)    // → "rgba(255, 255, 255, 0.2)"
 */
export function opacity(value: number): string {
  return `rgba(255, 255, 255, ${value})`;
}

/**
 * Pick a color dynamically based on a condition.
 *
 * A thin wrapper that's handy for inline `style` objects and NativeWind
 * `className` conditionals.
 *
 * @example
 *   dynamicColor(isActive, colors.accent, colors.textMuted)
 */
export function dynamicColor<T>(condition: boolean, ifTrue: T, ifFalse: T): T {
  return condition ? ifTrue : ifFalse;
}
