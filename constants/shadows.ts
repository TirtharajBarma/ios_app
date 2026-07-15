/**
 * Shadow tokens
 *
 * Each level provides:
 *  - `native`:  iOS `shadow*` props (high-quality, multi-layer).
 *  - `android`: Android `elevation` fallback.
 *
 * Usage:
 *   <View style={[shadows.card.native, Platform.OS === 'android' && shadows.card.android]} />
 *
 * Or use the `shadowStyle()` helper below for a Platform-agnostic spread.
 */
import type { ViewStyle } from "react-native";

export type ShadowLevel = {
  native: Pick<
    ViewStyle,
    "shadowColor" | "shadowOffset" | "shadowOpacity" | "shadowRadius"
  >;
  android: Pick<ViewStyle, "elevation">;
};

export const shadows = {
  /** Barely-there lift — used for subtle separators. */
  small: {
    native: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
  },

  /** Medium elevation — used for interactive elements. */
  medium: {
    native: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
    },
    android: { elevation: 3 },
  },

  /** Large elevation — used for floating action elements. */
  large: {
    native: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
    },
    android: { elevation: 6 },
  },

  /** Floating — highest shadow, used for modals / alerts. */
  floating: {
    native: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 24,
    },
    android: { elevation: 10 },
  },

  /** Card — the default shadow for subscription cards. */
  card: {
    native: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
  },
} as const;

export type Shadows = typeof shadows;

/** Platform-aware shadow helper — returns the correct props for the running OS. */
export function shadowStyle(level: keyof typeof shadows): ViewStyle {
  // On iOS the native props are enough; Android only understands elevation.
  if (typeof globalThis !== "undefined" && "OS" in (globalThis as Record<string, unknown>)) {
    const os = (globalThis as Record<string, unknown>).OS as string;
    if (os === "android") {
      return { ...shadows[level].android };
    }
  }
  return { ...shadows[level].native };
}

export default shadows;
