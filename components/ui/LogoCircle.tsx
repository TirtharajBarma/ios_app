import React, { memo, useState, useCallback, useEffect, forwardRef, useRef } from "react";
import { Animated } from "react-native";
import { View, type ViewStyle } from "react-native";
import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import AppText from "./AppText";
import { colors, shadows, hexToRGBA, typography } from "@/constants";
import type { GradientStops } from "@/constants/gradients";
import { getLucideIcon, isLucideIconSource } from "./lucideIcons";
import { getFaviconUri } from "@/utils/faviconCache";

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
  /** White plate behind image sources. Used by dark/wordmark logos. */
  whiteBackground?: boolean;
  gradient?: GradientStops;
  style?: ViewStyle;
  website?: string;
}

function isEmojiString(str: string): boolean {
  if (str.length > 10) return false;
  if (str.includes("/") || str.includes(".") || str.includes("://") || str.startsWith("file:")) return false;
  for (const char of str) {
    if (char.charCodeAt(0) > 127) return true;
  }
  return false;
}

/** Bundled brand-logo variants (curated catalog assets). */
const LOCAL_LOGOS: Record<string, any> = {
  "local:jiohotstar": require("../../assets/images/logos/jiohotstar.jpg"),
  "local:jiocinema": require("../../assets/images/logos/jiocinema.jpg"),
  "local:hoichoi": require("../../assets/images/logos/hoichoi.jpg"),
  "local:lionsgateplay": require("../../assets/images/logos/lionsgateplay.jpg"),
  "local:aha": require("../../assets/images/logos/aha.jpg"),
  "local:healthifyme": require("../../assets/images/logos/healthifyme.jpg"),

  "local:brand:netflix-primary": require("../../assets/images/brand-logos/netflix-primary.png"),
  "local:brand:netflix-mark": require("../../assets/images/brand-logos/netflix-mark.png"),
  "local:brand:spotify-primary": require("../../assets/images/brand-logos/spotify-primary.png"),
  "local:brand:spotify-mark": require("../../assets/images/brand-logos/spotify-mark.png"),
  "local:brand:youtube-primary": require("../../assets/images/brand-logos/youtube-primary.png"),
  "local:brand:youtube-mark": require("../../assets/images/brand-logos/youtube-mark.png"),
  "local:brand:chatgpt-primary": require("../../assets/images/brand-logos/chatgpt-primary.png"),
  "local:brand:notion-primary": require("../../assets/images/brand-logos/notion-primary.png"),
  "local:brand:google-one-primary": require("../../assets/images/brand-logos/google-one-primary.png"),
  "local:brand:google-primary": require("../../assets/images/brand-logos/google-primary.png"),
  "local:brand:google-mark": require("../../assets/images/brand-logos/google-mark.png"),
  "local:brand:amazon-prime-primary": require("../../assets/images/brand-logos/amazon-prime-primary.png"),
  "local:brand:amazon-prime-mark": require("../../assets/images/brand-logos/amazon-prime-mark.png"),
  "local:brand:prime-video-primary": require("../../assets/images/brand-logos/prime-video-primary.png"),
  "local:brand:prime-video-alternate": require("../../assets/images/brand-logos/prime-video-alternate.png"),
  "local:brand:apple-music-primary": require("../../assets/images/brand-logos/apple-music-primary.png"),
  "local:brand:apple-music-mark": require("../../assets/images/brand-logos/apple-music-mark.png"),
  "local:brand:apple-tv-primary": require("../../assets/images/brand-logos/apple-tv-primary.png"),
  "local:brand:apple-tv-alternate": require("../../assets/images/brand-logos/apple-tv-alternate.png"),
  "local:brand:disney-plus-primary": require("../../assets/images/brand-logos/disney-plus-primary.png"),
  "local:brand:jio-primary": require("../../assets/images/brand-logos/jio-primary.png"),
  "local:brand:airtel-primary": require("../../assets/images/brand-logos/airtel-primary.png"),
  "local:brand:microsoft-primary": require("../../assets/images/brand-logos/microsoft-primary.png"),
  "local:brand:github-primary": require("../../assets/images/brand-logos/github-primary.png"),
  "local:brand:github-mark": require("../../assets/images/brand-logos/github-mark.png"),
};

const LogoCircle = forwardRef<View, LogoCircleProps>(function LogoCircle(
  {
    source,
    name,
    color = colors.accent,
    size = "md",
    shadowed = false,
    whiteBackground = false,
    bordered = false,
    gradient,
    style,
    website,
  },
  ref
) {
  const [errorCount, setErrorCount] = useState(0);
  const [cachedFavicon, setCachedFavicon] = useState<string | null>(null);
  const imageOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setErrorCount(0);
    imageOpacity.setValue(0);
  }, [source, imageOpacity]);

  const numericSize =
    typeof size === "number" ? size : sizeMap[size].size;
  const fontKey =
    typeof size === "string" ? sizeMap[size].fontSize : "subheadline";

  const handleError = useCallback(() => {
    setErrorCount((prev) => prev + 1);
  }, []);

  const handleLoad = useCallback(() => {
    Animated.spring(imageOpacity, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
    }).start();
  }, [imageOpacity]);

  const resolvedSource = typeof source === "string" && LOCAL_LOGOS[source] ? LOCAL_LOGOS[source] : source;
  const isEmoji = typeof source === "string" && isEmojiString(source);
  const iconName = typeof source === "string" && isLucideIconSource(source) ? source.slice(5) : null;
  const LucideIcon = iconName ? getLucideIcon(iconName) : null;
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

  useEffect(() => {
    if (!domain || source) return;
    let cancelled = false;
    getFaviconUri(domain).then((uri) => {
      if (!cancelled) setCachedFavicon(uri);
    });
    return () => { cancelled = true; };
  }, [domain, source]);

  if (resolvedSource && errorCount === 0) {
    currentSource = typeof resolvedSource === "string" ? { uri: resolvedSource } : resolvedSource;
  } else if (!resolvedSource && domain && errorCount === 0) {
    currentSource = {
      uri: cachedFavicon || `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
    };
  } else if (domain && errorCount === 1) {
    const isGoogleFavicon = typeof resolvedSource === "string" && resolvedSource.includes("google.com/s2/favicons");
    if (!isGoogleFavicon) {
      currentSource = {
        uri: cachedFavicon || `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
      };
    }
  }

  const showImage = currentSource !== null;
  const hasGlyph = LucideIcon !== null || isEmoji;
  const fallbackGradient = gradient ?? [
    color,
    hexToRGBA(color, 0.6),
  ] as GradientStops;

  // Monogram (initial letter) is the automatic fallback when no source
  // resolves at all.
  const renderLetter = !showImage && !hasGlyph;

  const wrapperStyle: ViewStyle = {
    width: numericSize,
    height: numericSize,
    borderRadius: numericSize / 2,
    borderWidth: bordered ? 1.5 : 0,
    borderColor: showImage
      ? "rgba(255, 255, 255, 0.12)"
      : whiteBackground
        ? "rgba(0, 0, 0, 0.08)"
        : hexToRGBA(color, 0.4),
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: showImage || whiteBackground ? "#FFFFFF" : color,
    ...(shadowed ? shadows.card.native : {}),
  };

  const gradientFill = (
    children: React.ReactNode
  ) => (
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
      {children}
    </LinearGradient>
  );

  // ── Letter (monogram fallback) ─────────────────────────────────────
  if (renderLetter) {
    return (
      <View ref={ref} style={[wrapperStyle, style]}>
        {gradientFill(
          <AppText variant={fontKey} weight="700" color={colors.white}>
            {name ? name.charAt(0).toUpperCase() : "?"}
          </AppText>
        )}
      </View>
    );
  }

  // ── Lucide icon ────────────────────────────────────────────────────
  if (LucideIcon) {
    return (
      <View ref={ref} style={[wrapperStyle, style]}>
        {gradientFill(<LucideIcon size={numericSize * 0.45} color={colors.white} />)}
      </View>
    );
  }

  // ── Emoji ────────────────────────────────────────────────────────────
  if (isEmoji) {
    return (
      <View ref={ref} style={[wrapperStyle, style]}>
        {gradientFill(
          <AppText style={{ fontSize: numericSize * 0.45, lineHeight: numericSize * 0.52 }}>
            {source as string}
          </AppText>
        )}
      </View>
    );
  }

  // ── Image (favicon / bundled asset / custom image) ─────────────────
  if (showImage) {
    return (
      <View ref={ref} style={[wrapperStyle, style]}>
        <Animated.View style={{ opacity: imageOpacity }}>
          <Image
            source={currentSource}
            style={{
              width: numericSize * 0.78,
              height: numericSize * 0.78,
            }}
            onError={handleError}
            onLoad={handleLoad}
            contentFit="contain"
          />
        </Animated.View>
      </View>
    );
  }

  return null;
});

export default memo(LogoCircle);
