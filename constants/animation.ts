/**
 * Animation tokens
 *
 * Reusable timing, spring configs and pre-built `withTiming` /
 * `withSpring` values. Components should reference these instead of
 * hardcoding duration / spring constants so the app feels consistent.
 *
 * All values are designed for Reanimated 3+ (`withTiming`, `withSpring`,
 * `withSequence`, `Easing`).
 */

// ─── Durations (ms) ────────────────────────────────────────────────

export const duration = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

export type Duration = typeof duration;

// ─── Spring configs ────────────────────────────────────────────────

export const springConfig = {
  /** Snappy, button-like response. */
  button: {
    damping: 15,
    stiffness: 300,
    mass: 0.5,
  } as const,

  /** Gentle, card-like entry. */
  card: {
    damping: 20,
    stiffness: 180,
    mass: 0.8,
  } as const,

  /** Default — good for most UI transitions. */
  default: {
    damping: 18,
    stiffness: 200,
    mass: 0.7,
  } as const,

  /** Bouncy — playful overshoot for success states. */
  bouncy: {
    damping: 9,
    stiffness: 150,
    mass: 0.6,
  } as const,
} as const;

export type SpringConfig = typeof springConfig;

// ─── Button press ───────────────────────────────────────────────────

/** Scale-down for interactive press feedback. */
export const buttonPressScale = 0.97;

/** Scale-up on release (slight overshoot for "snap" feel). */
export const buttonReleaseScale = 1.02;

// ─── Card enter ─────────────────────────────────────────────────────

/** Starting opacity for a card that fades + slides in. */
export const cardEnterInitialOpacity = 0;

/** Starting Y-offset (translated downward before sliding up). */
export const cardEnterInitialTranslateY = 16;

// ─── Reusable keyframe presets ─────────────────────────────────────
// These are raw values — components construct `withTiming` / `withSpring`
// calls around them. Keeping them as plain objects avoids importing
// Reanimated in the constants module.

/** Fade: from transparent to opaque (or vice-versa when inverted). */
export const fade = {
  from: 0,
  to: 1,
} as const;

/** Slide up: from below the resting position. */
export const slideUp = {
  fromY: 20,
  toY: 0,
} as const;

/** Slide down: from above the resting position. */
export const slideDown = {
  fromY: -20,
  toY: 0,
} as const;

/** Slide from right. */
export const slideFromRight = {
  fromX: 20,
  toX: 0,
} as const;

/** Scale in from slightly smaller. */
export const scaleIn = {
  fromScale: 0.92,
  toScale: 1,
} as const;

export type AnimationTokens = {
  duration: Duration;
  springConfig: SpringConfig;
  buttonPressScale: number;
  buttonReleaseScale: number;
  cardEnterInitialOpacity: number;
  cardEnterInitialTranslateY: number;
  fade: typeof fade;
  slideUp: typeof slideUp;
  slideDown: typeof slideDown;
  slideFromRight: typeof slideFromRight;
  scaleIn: typeof scaleIn;
};

export default {
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
} satisfies AnimationTokens;
