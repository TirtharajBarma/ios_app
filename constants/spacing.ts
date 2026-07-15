/**
 * Spacing scale
 *
 * Consistent spacing tokens for margin, padding, gap, and sizing.
 * No component should ever use a magic number.
 */
export const spacing = {
  2: 2,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
} as const;

export type Spacing = typeof spacing;

/** Default horizontal padding for full-bleed screens. */
export const screenPadding = spacing[20];

export default spacing;
