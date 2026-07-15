/**
 * Color tokens
 *
 * Single source of truth for every color in the app. No component should
 * ever reference a raw hex or rgba — always import from here (or from the
 * barrel `@/constants`).
 *
 * Palette follows Apple's HIG dark-mode defaults for iOS.
 */

// ─── Transparent White palette ──────────────────────────────────────

export const transparentWhite = {
  5: "rgba(255, 255, 255, 0.05)",
  8: "rgba(255, 255, 255, 0.08)",
  12: "rgba(255, 255, 255, 0.12)",
  20: "rgba(255, 255, 255, 0.20)",
} as const;

// ─── Semantic colors ───────────────────────────────────────────────

export const colors = {
  // Backgrounds
  background: "#000000",
  surface: "#1C1C1E",
  surfaceSecondary: "#2C2C2E",
  card: "#232325",

  // Text
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",

  // Borders & separators
  border: "rgba(255, 255, 255, 0.08)",

  // Status
  success: "#30D158",
  warning: "#FFD60A",
  danger: "#FF453A",

  // Brand / accent
  accent: "#0A84FF",

  // Transparent white (convenience alias)
  ...transparentWhite,

  transparent: "transparent",
  black: "#000000",
  white: "#FFFFFF",
} as const;

export type Colors = typeof colors;
export default colors;
