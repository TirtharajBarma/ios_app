/**
 * Corner radius tokens
 *
 * Covers the full range from subtle rounding to fully-pill shapes.
 */
export const radius = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
} as const;

/** Convenience alias for a perfect circle / pill. */
export const radiusFull = 9999;

export type Radius = typeof radius;

/** Default radius for card surfaces. */
export const cardRadius = radius[24];

/** Default radius for modal / bottom sheet corners. */
export const sheetRadius = radius[32];

export default radius;
