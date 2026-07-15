/**
 * LogoCircle
 *
 * Circular container purpose-built for subscription brand logos.
 * Supports an image (expo-image), a gradient fallback, an optional
 * border, and an optional shadow. When no image is provided, renders
 * the brand initial.
 *
 * Usage:
 *   <LogoCircle source={{ uri: logoUrl }} size={48} color="#E50914" />
 *   <LogoCircle name="Netflix" size={48} color="#E50914" />
 */
import React, { memo, useState, useCallback, forwardRef } from "react";
import { View, type ViewStyle } from "react-native";
import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppText from "./AppText";
import { colors, shadows, hexToRGBA, typography } from "@/constants";
import type { GradientStops } from "@/constants/gradients";

type LogoSize = "sm" | "md" | "lg" | "xl";

type FontVariant = keyof typeof typography;

const sizeMap: Record<LogoSize, { size: number; fontSize: FontVariant }> = {
  sm: { size: 32, fontSize: "caption1" },
  md: { size: 44, fontSize: "subheadline" },
  lg: { size: 56, fontSize: "headline" },
  xl: { size: 72, fontSize: "title3" },
};

export interface LogoCircleProps {
  /** Remote or local image source for the logo. */
  source?: ImageSource | string;
  /** Brand name — used for the initial fallback. */
  name?: string;
  /** Brand color — drives the gradient fallback + border tint. */
  color?: string;
  /** Size preset or explicit px. */
  size?: LogoSize | number;
  /** Show a ring around the circle. */
  bordered?: boolean;
  /** Show a drop shadow. */
  shadowed?: boolean;
  /** Custom gradient stops (overrides the color-derived gradient). */
  gradient?: GradientStops;
  /** Style override. */
  style?: ViewStyle;
}

const LogoCircle = forwardRef<View, LogoCircleProps>(function LogoCircle(
  {
    source,
    name,
    color = colors.accent,
    size = "md",
    bordered = false,
    shadowed = false,
    gradient,
    style,
  },
  ref
) {
  const [errored, setErrored] = useState(false);

  const numericSize =
    typeof size === "number" ? size : sizeMap[size].size;
  const fontKey =
    typeof size === "string" ? sizeMap[size].fontSize : "subheadline";

  const handleError = useCallback(() => setErrored(true), []);

  const showImage = source && !errored;
  const fallbackGradient = gradient ?? [
    color,
    hexToRGBA(color, 0.6),
  ] as GradientStops;

  const wrapperStyle: ViewStyle = {
    width: numericSize,
    height: numericSize,
    borderRadius: numericSize / 2,
    borderWidth: bordered ? 1.5 : 0,
    borderColor: hexToRGBA(color, 0.4),
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    ...(shadowed ? shadows.card.native : {}),
  };

  if (showImage) {
    return (
      <View ref={ref} style={[wrapperStyle, style]}>
        <Image
          source={typeof source === "string" ? { uri: source } : source}
          style={{ width: numericSize, height: numericSize }}
          onError={handleError}
          contentFit="cover"
        />
      </View>
    );
  }

  return (
    <View ref={ref} style={[wrapperStyle, style]}>
      <LinearGradient
        colors={fallbackGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: numericSize,
          height: numericSize,
          borderRadius: numericSize / 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AppText variant={fontKey} weight="700" color={colors.white}>
          {name ? name.charAt(0).toUpperCase() : "?"}
        </AppText>
      </LinearGradient>
    </View>
  );
});

export default memo(LogoCircle);
