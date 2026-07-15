/**
 * AppButton
 *
 * Versatile button with 5 variants, 3 sizes, loading state, icon slots,
 * press animation (Reanimated), and haptic feedback.
 *
 * Usage:
 *   <AppButton variant="primary" size="large" onPress={handleSave}>
 *     Save
 *   </AppButton>
 *   <AppButton variant="outline" leftIcon={<Plus />} rightIcon={<ChevronRight />}>
 *     Add Subscription
 *   </AppButton>
 */
import React, { memo, useCallback, forwardRef } from "react";
import {
  Pressable,
  View,
  ActivityIndicator,
  type ViewStyle,
  type PressableProps,
  type StyleProp,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AppText from "./AppText";
import {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  springConfig,
  buttonPressScale,
} from "@/constants";
import type { ReactNode } from "react";

// ─── Variant styles ────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

interface VariantTokens {
  bg: string;
  text: string;
  border?: string;
}

const variantStyles: Record<ButtonVariant, VariantTokens> = {
  primary: { bg: colors.accent, text: colors.white },
  secondary: { bg: colors.surfaceSecondary, text: colors.textPrimary },
  outline: { bg: "transparent", text: colors.accent, border: colors.accent },
  ghost: { bg: "transparent", text: colors.textSecondary },
  danger: { bg: colors.danger, text: colors.white },
};

// ─── Size tokens ────────────────────────────────────────────────────

type ButtonSize = "small" | "medium" | "large";

interface SizeTokens {
  paddingV: number;
  paddingH: number;
  fontSize: keyof typeof typography;
  radius: number;
  iconGap: number;
}

const sizeTokens: Record<ButtonSize, SizeTokens> = {
  small: {
    paddingV: 6,
    paddingH: spacing[12],
    fontSize: "subheadline",
    radius: radius[8],
    iconGap: spacing[4],
  },
  medium: {
    paddingV: 10,
    paddingH: spacing[16],
    fontSize: "body",
    radius: radius[12],
    iconGap: spacing[8],
  },
  large: {
    paddingV: 14,
    paddingH: spacing[24],
    fontSize: "headline",
    radius: radius[16],
    iconGap: spacing[8],
  },
};

// ─── Props ─────────────────────────────────────────────────────────

export interface AppButtonProps extends Omit<PressableProps, "style"> {
  /** Visual style variant. */
  variant?: ButtonVariant;
  /** Size preset. */
  size?: ButtonSize;
  /** Show a spinner and disable interaction. */
  loading?: boolean;
  /** Disabled state. */
  disabled?: boolean;
  /** Icon rendered before the label. */
  leftIcon?: ReactNode;
  /** Icon rendered after the label. */
  rightIcon?: ReactNode;
  /** Children override (if you need custom content instead of a text label). */
  children?: ReactNode;
  /** Additional styles merged on the outer wrapper. */
  style?: StyleProp<ViewStyle>;
}

// ─── Component ──────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const AppButton = forwardRef<View, AppButtonProps>(function AppButton(
  {
    variant = "primary",
    size = "medium",
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    children,
    style,
    onPress,
    ...rest
  },
  ref
) {
  const scale = useSharedValue(1);
  const isDisabled = disabled || loading;

  const v = variantStyles[variant];
  const s = sizeTokens[size];

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
      if (isDisabled) return;
      Haptics.selectionAsync();
      onPress?.(e);
    },
    [isDisabled, onPress],
  );

  const wrapperStyle: ViewStyle = {
    backgroundColor: isDisabled ? colors.surfaceSecondary : v.bg,
    borderRadius: s.radius,
    borderWidth: v.border ? 1 : 0,
    borderColor: v.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: s.paddingV,
    paddingHorizontal: s.paddingH,
    opacity: isDisabled ? 0.5 : 1,
    ...shadows.small.native,
  };

  return (
    <AnimatedPressable
      ref={ref as any}
      style={[wrapperStyle, animatedStyle, style]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      accessibilityRole="button"
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {leftIcon && (
            <View style={{ marginRight: s.iconGap }}>{leftIcon}</View>
          )}
          {typeof children === "string" ? (
            <AppText
              variant={s.fontSize}
              weight="600"
              color={v.text}
            >
              {children}
            </AppText>
          ) : (
            children
          )}
          {rightIcon && (
            <View style={{ marginLeft: s.iconGap }}>{rightIcon}</View>
          )}
        </>
      )}
    </AnimatedPressable>
  );
});

export default memo(AppButton);
