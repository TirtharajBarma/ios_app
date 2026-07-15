/**
 * Avatar
 *
 * Circular avatar with image support and initials fallback. Multiple
 * size presets. Uses expo-image for fast, cached rendering.
 *
 * Usage:
 *   <Avatar source={{ uri: user.photo }} size="medium" />
 *   <Avatar name="John Doe" size="small" />  // shows "JD" initials
 */
import React, { memo, useState, useCallback, forwardRef } from "react";
import { View } from "react-native";
import { Image, type ImageSource } from "expo-image";
import AppText from "./AppText";
import { colors, hexToRGBA } from "@/constants";

type AvatarSize = "small" | "medium" | "large" | "xlarge";

type FontVariant = keyof typeof import("@/constants").typography;

const sizeMap: Record<AvatarSize, { size: number; fontSize: FontVariant }> = {
  small: { size: 32, fontSize: "caption1" },
  medium: { size: 44, fontSize: "subheadline" },
  large: { size: 64, fontSize: "headline" },
  xlarge: { size: 96, fontSize: "title2" },
};

export interface AvatarProps {
  /** Remote or local image source. */
  source?: ImageSource | string;
  /** Name used to derive initials fallback. */
  name?: string;
  /** Size preset. */
  size?: AvatarSize;
  /** Custom background color for initials fallback. */
  bgColor?: string;
  /** Style override for the outer circle. */
  style?: import("react-native").ViewStyle;
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const Avatar = forwardRef<View, AvatarProps>(function Avatar(
  {
    source,
    name,
    size = "medium",
    bgColor,
    style,
  },
  ref
) {
  const [errored, setErrored] = useState(false);
  const s = sizeMap[size];

  const showImage = source && !errored;

  const handleError = useCallback(() => {
    setErrored(true);
  }, []);

  const fallbackBg = bgColor ?? hexToRGBA(colors.accent, 0.3);

  return (
    <View
      ref={ref}
      style={[
        {
          width: s.size,
          height: s.size,
          borderRadius: s.size / 2,
          backgroundColor: fallbackBg,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={typeof source === "string" ? { uri: source } : source}
          style={{ width: s.size, height: s.size }}
          onError={handleError}
          contentFit="cover"
        />
      ) : (
        <AppText
          variant={s.fontSize}
          weight="600"
          color={colors.textPrimary}
        >
          {getInitials(name)}
        </AppText>
      )}
    </View>
  );
});

export default memo(Avatar);
