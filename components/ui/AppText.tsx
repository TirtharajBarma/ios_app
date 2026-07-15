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
import { Text, type TextProps, type TextStyle } from "react-native";
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
  style?: TextStyle | TextStyle[];
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
    fontFamily: token.fontFamily,
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
    fontWeight: weight ?? token.fontWeight,
    letterSpacing: token.letterSpacing,
    color: textColor,
    textAlign: align,
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
