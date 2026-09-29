/**
 * AppText
 *
 * Typed, themed text component that maps directly to the typography
 * design tokens. Supports variant selection, weight override, color,
 * alignment, and numberOfLines.
 *
 * Usage:
 *   <AppText variant="largeTitle">Dashboard</AppText>
 *   <AppText variant="body" color="textSecondary">Subtitle here</AppText>
 */
import React, { memo, forwardRef } from "react";
import { Text, Platform, type TextProps, type TextStyle } from "react-native";
import { typography, colors } from "@/constants";

export type AppTextVariant =
  | keyof typeof typography
  | "caption";

export interface AppTextProps extends Omit<TextProps, "style"> {
  /** Typography variant — maps to the design-system token. */
  variant?: AppTextVariant;
  /** Override the default weight for this variant. */
  weight?: TextStyle["fontWeight"];
  /** Override the default color (any valid RN color string or design token). */
  color?: string;
  /** Override text alignment. */
  align?: TextStyle["textAlign"];
  /** Truncate after N lines. */
  numberOfLines?: number;
  /** Additional styles merged after the variant defaults. */
  style?: TextStyle | (TextStyle | false | null | undefined)[];
}

const AppText = forwardRef<Text, AppTextProps>(function AppText(
  {
    variant = "body",
    weight,
    color: colorOverride,
    align,
    numberOfLines: lines,
    style,
    children,
    ...rest
  },
  ref
) {
  const variantKey = variant === "caption" ? "caption1" : variant;
  const token = typography[variantKey];

  const textColor = colorOverride ?? colors.textPrimary;

  const resolvedStyle: TextStyle = {
    // No fontFamily override: the tokens used to hardcode "System", which is not
    // a real family on either platform. Letting React Native pick its default
    // gives San Francisco on iOS and Roboto on Android, so the two builds match.
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
    fontWeight: weight ?? token.fontWeight,
    letterSpacing: token.letterSpacing,
    color: textColor,
    textAlign: align,
    // Fix Android text vertical centering: includeFontPadding adds extra space
    // above/below glyphs on Android, making text appear off-center in native builds
    ...(Platform.OS === 'android' && { includeFontPadding: false }),
  };

  return (
    <Text
      ref={ref}
      style={[resolvedStyle, style]}
      numberOfLines={lines}
      {...rest}
    >
      {children}
    </Text>
  );
});

export default memo(AppText);

