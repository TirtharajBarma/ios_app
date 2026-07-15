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
  source?: ImageSource | string;
  name?: string;
  color?: string;
  size?: LogoSize | number;
  bordered?: boolean;
  shadowed?: boolean;
  gradient?: GradientStops;
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
  const [errorCount, setErrorCount] = useState(0);

  const numericSize =
    typeof size === "number" ? size : sizeMap[size].size;
  const fontKey =
    typeof size === "string" ? sizeMap[size].fontSize : "subheadline";

  const handleError = useCallback(() => {
    setErrorCount((prev) => prev + 1);
  }, []);

  // Determine current image source based on load error count
  let currentSource: any = null;
  
  if (source && errorCount === 0) {
    currentSource = typeof source === "string" ? { uri: source } : source;
  } else if (name && errorCount === 1) {
    // Stage 2 Fallback: Google Favicon API
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    currentSource = {
      uri: `https://www.google.com/s2/favicons?sz=128&domain=${cleanName}.com`,
    };
  }

  const showImage = currentSource !== null;
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
    backgroundColor: color,
    ...(shadowed ? shadows.card.native : {}),
  };

  if (showImage) {
    return (
      <View ref={ref} style={[wrapperStyle, style]}>
        <Image
          source={currentSource}
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
