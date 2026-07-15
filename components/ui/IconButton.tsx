/**
 * IconButton
 *
 * Circular (or rounded-square) icon button with optional blur background,
 * filled / outlined variants, and multiple size presets.
 *
 * Usage:
 *   <IconButton icon={<Plus />} variant="filled" size="large" onPress={add} />
 *   <IconButton icon={<Settings />} variant="blur" onPress={openSettings} />
 */
import React, { memo, useCallback, forwardRef } from "react";
import { Pressable, View, type ViewStyle, type PressableProps } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import {
  colors,
  shadows,
  springConfig,
  buttonPressScale,
} from "@/constants";
import type { ReactNode } from "react";

// ─── Variants ────────────────────────────────────────────────────────

type IconButtonVariant = "filled" | "outlined" | "blur";

interface VariantStyle {
  bg?: string;
  border?: string;
  borderWidth?: number;
}

const variantTokens: Record<IconButtonVariant, VariantStyle> = {
  filled: { bg: colors.surfaceSecondary },
  outlined: { border: colors.border, borderWidth: 1 },
  blur: { bg: "transparent" },
};

// ─── Sizes ──────────────────────────────────────────────────────────

type IconButtonSize = "small" | "medium" | "large";

const sizeTokens: Record<IconButtonSize, { size: number; hitSlop: number }> = {
  small: { size: 28, hitSlop: 4 },
  medium: { size: 36, hitSlop: 4 },
  large: { size: 44, hitSlop: 4 },
};

// ─── Props ─────────────────────────────────────────────────────────

export interface IconButtonProps extends Omit<PressableProps, "style"> {
  /** Icon node to render in the center. */
  icon: ReactNode;
  /** Visual variant. */
  variant?: IconButtonVariant;
  /** Size preset (determines the circle diameter). */
  size?: IconButtonSize;
  /** Optional tint for the icon (defaults to textPrimary). */
  iconColor?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Override style on the outer wrapper. */
  style?: ViewStyle;
}

// ─── Component ──────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const IconButton = forwardRef<View, IconButtonProps>(function IconButton(
  {
    icon,
    variant = "filled",
    size = "medium",
    iconColor,
    disabled = false,
    style,
    onPress,
    ...rest
  },
  ref
) {
  const scale = useSharedValue(1);
  const s = sizeTokens[size];
  const v = variantTokens[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    "worklet";
    scale.value = withSpring(buttonPressScale, springConfig.button);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    "worklet";
    scale.value = withSpring(1, springConfig.button);
  }, [scale]);

  const handlePress = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
      if (disabled) return;
      Haptics.selectionAsync();
      onPress?.(e);
    },
    [disabled, onPress],
  );

  const wrapperStyle: ViewStyle = {
    width: s.size,
    height: s.size,
    borderRadius: s.size / 2,
    overflow: "hidden",
    opacity: disabled ? 0.4 : 1,
    ...shadows.small.native,
  };

  const innerContent = (
    <View
      style={{
        width: s.size,
        height: s.size,
        borderRadius: s.size / 2,
        borderWidth: v.borderWidth ?? 0,
        borderColor: v.border,
        backgroundColor: variant !== "blur" ? (v.bg ?? "transparent") : undefined,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon}
    </View>
  );

  return (
    <AnimatedPressable
      ref={ref as any}
      style={[wrapperStyle, animatedStyle, style]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={s.hitSlop}
      accessibilityRole="button"
      {...rest}
    >
      {variant === "blur" ? (
        <BlurView
          intensity={60}
          tint="dark"
          style={{
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {innerContent}
        </BlurView>
      ) : (
        innerContent
      )}
    </AnimatedPressable>
  );
});

export default memo(IconButton);
