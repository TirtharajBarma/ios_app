/**
 * Typography tokens
 *
 * Mirrors Apple's SF Pro type scale from the HIG.
 * Each style bundles fontSize, lineHeight, fontWeight, and letterSpacing
 * so call-sites never need to compose them.
 *
 * Weights follow SF Pro conventions:
 *  - Regular  (400)
 *  - Medium   (500)
 *  - Semibold (600)
 *  - Bold     (700)
 */
import type { TextStyle } from "react-native";

type TypographyToken = TextStyle & {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle["fontWeight"];
  letterSpacing: number;
};

export const typography = {
  /** Large Title — 34pt Bold, the biggest headline in iOS. */
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700" as const,
    letterSpacing: 0.37,
    fontFamily: "System",
  },

  /** Title 1 — 28pt Bold, section headers. */
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
    letterSpacing: 0.36,
    fontFamily: "System",
  },

  /** Title 2 — 22pt Bold, navigation bars. */
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700" as const,
    letterSpacing: 0.35,
    fontFamily: "System",
  },

  /** Title 3 — 20pt Semibold, smaller section titles. */
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "600" as const,
    letterSpacing: 0.38,
    fontFamily: "System",
  },

  /** Headline — 17pt Semibold, emphasized body text. */
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600" as const,
    letterSpacing: -0.41,
    fontFamily: "System",
  },

  /** Body — 17pt Regular, standard paragraph text. */
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400" as const,
    letterSpacing: -0.41,
    fontFamily: "System",
  },

  /** Callout — 16pt Regular, supplementary text. */
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "400" as const,
    letterSpacing: -0.32,
    fontFamily: "System",
  },

  /** Subheadline — 15pt Regular, secondary labels. */
  subheadline: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400" as const,
    letterSpacing: -0.24,
    fontFamily: "System",
  },

  /** Footnote — 13pt Regular, tertiary labels / metadata. */
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
    letterSpacing: -0.08,
    fontFamily: "System",
  },

  /** Caption 1 — 12pt Medium, small annotations. */
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 0,
    fontFamily: "System",
  },

  /** Caption 2 — 11pt Medium, smallest readable text. */
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "500" as const,
    letterSpacing: 0.07,
    fontFamily: "System",
  },
} as const;

export type Typography = typeof typography;

/** Extract the style object for a given key, safe to spread in `<Text>`. */
export function textStyleFor(
  key: keyof typeof typography
): TypographyToken {
  return typography[key];
}

export default typography;
