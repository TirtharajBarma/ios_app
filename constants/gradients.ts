/**
 * Gradient tokens
 *
 * Pre-defined color-stop arrays for `expo-linear-gradient`.
 * Every gradient is a tuple of hex strings so they type-check cleanly.
 *
 * Usage with LinearGradient:
 *   <LinearGradient
 *     colors={Gradients.hero}
 *     start={{ x: 0, y: 0 }}
 *     end={{ x: 1, y: 1 }}
 *   />
 */

export type GradientStops = [string, string, ...string[]];

export const gradients = {
  /** Dark card — subtle surface depth. */
  darkCard: ["#232325", "#1C1C1E"] as const,

  /** Hero — large feature area accent gradient. */
  hero: ["#0A84FF", "#5E5CE6"] as const,

  /** Glass — translucent glassmorphism tint (use with BlurView underneath). */
  glass: ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.02)"] as const,

  /** Red — danger / delete / active state. */
  red: ["#FF453A", "#FF6961"] as const,

  /** Green — success / active / money. */
  green: ["#30D158", "#63E68D"] as const,

  /** Blue — info / primary accent. */
  blue: ["#0A84FF", "#64D2FF"] as const,

  /** Brown — warm neutral / sepia category. */
  brown: ["#AC8E68", "#C4A882"] as const,

  /** Black — pure dark gradient for overlays. */
  black: ["#000000", "#1C1C1E"] as const,
} as const;

export type Gradients = typeof gradients;

export default gradients;
