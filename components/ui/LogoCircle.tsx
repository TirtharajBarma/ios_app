import React, { memo, useState, useCallback, useEffect, forwardRef } from "react";
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
  whiteBackground?: boolean;
  gradient?: GradientStops;
  style?: ViewStyle;
  website?: string;
}

const LOCAL_LOGOS: Record<string, any> = {
  "local:jiohotstar": require("../../assets/images/logos/jiohotstar.jpg"),
  "local:jiocinema": require("../../assets/images/logos/jiocinema.jpg"),
  "local:hoichoi": require("../../assets/images/logos/hoichoi.jpg"),
  "local:lionsgateplay": require("../../assets/images/logos/lionsgateplay.jpg"),
  "local:aha": require("../../assets/images/logos/aha.jpg"),
  "local:healthifyme": require("../../assets/images/logos/healthifyme.jpg"),
};

const LogoCircle = forwardRef<View, LogoCircleProps>(function LogoCircle(
  {
    source,
    name,
    color = colors.accent,
    size = "md",
    bordered = false,
    shadowed = false,
    whiteBackground = false,
    gradient,
    style,
    website,
  },
  ref
) {
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    setErrorCount(0);
  }, [source]);

  const numericSize =
    typeof size === "number" ? size : sizeMap[size].size;
  const fontKey =
    typeof size === "string" ? sizeMap[size].fontSize : "subheadline";

  const handleError = useCallback(() => {
    setErrorCount((prev) => prev + 1);
  }, []);

  const resolvedSource = typeof source === "string" && LOCAL_LOGOS[source] ? LOCAL_LOGOS[source] : source;
  let currentSource: any = null;

  // Helper to extract clean domain
  const getDomain = () => {
    if (website) {
      const clean = website.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].split("?")[0];
      if (clean) return clean;
    }
    if (typeof source === "string" && source.trim()) {
      if (source.startsWith("local:")) return null;
      if (source.includes("logo.clearbit.com/")) {
        return source.split("logo.clearbit.com/")[1].split("/")[0];
      }
      if (source.includes("icon.horse/icon/")) {
        return source.split("icon.horse/icon/")[1].split("/")[0];
      }
      if (source.includes("domain=")) {
        return source.split("domain=")[1].split("&")[0];
      }
      const clean = source.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].split("?")[0];
      if (clean) return clean;
    }
    if (name) {
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return `${cleanName}.com`;
    }
    return null;
  };

  const domain = getDomain();

  if (resolvedSource && errorCount === 0) {
    currentSource = typeof resolvedSource === "string" ? { uri: resolvedSource } : resolvedSource;
  } else if (!resolvedSource && domain && errorCount === 0) {
    currentSource = {
      uri: `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
    };
  } else if (domain && errorCount === 1) {
    // Only try Google Favicon as fallback if the failed source was NOT already a google favicon
    const isGoogleFavicon = typeof resolvedSource === "string" && resolvedSource.includes("google.com/s2/favicons");
    if (!isGoogleFavicon) {
      currentSource = {
        uri: `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
      };
    }
  }

  const showImage = currentSource !== null;
  const fallbackGradient = gradient ?? [
    color,
    hexToRGBA(color, 0.6),
  ] as GradientStops;

  const bgColor = showImage ? "#FFFFFF" : (whiteBackground ? "#FFFFFF" : color);

  const wrapperStyle: ViewStyle = {
    width: numericSize,
    height: numericSize,
    borderRadius: numericSize / 2,
    borderWidth: bordered ? 1.5 : 0,
    borderColor: showImage
      ? "rgba(255, 255, 255, 0.12)"
      : (whiteBackground ? "rgba(0, 0, 0, 0.08)" : hexToRGBA(color, 0.4)),
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: bgColor,
    ...(shadowed ? shadows.card.native : {}),
  };

  if (showImage) {
    return (
      <View ref={ref} style={[wrapperStyle, style]}>
        <Image
          source={currentSource}
          style={{
            width: numericSize * 0.68,
            height: numericSize * 0.68,
          }}
          onError={handleError}
          contentFit="contain"
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
