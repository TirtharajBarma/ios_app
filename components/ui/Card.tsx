/**
 * Card
 *
 * Reusable rounded card surface. Supports padding variants, shadow
 * variants, optional gradient background, optional blur overlay, and
 * optional pressable interaction with Reanimated press feedback.
 *
 * Usage:
 *   <Card variant="medium" onPress={onPress}>
 *     <AppText variant="headline">Netflix</AppText>
 *   </Card>
 *   <Card gradient="darkCard" blur>
 *     <AppText>Glassmorphism card</AppText>
 *   </Card>
 */
import React, { memo, useCallback, forwardRef } from "react";
import {
  View,
  Pressable,
  type ViewStyle,
  type PressableProps,
  type StyleProp,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, radius, shadows, springConfig, gradients } from "@/constants";
import type { GradientStops } from "@/constants/gradients";

// ─── Padding presets ────────────────────────────────────────────────

type PaddingVariant = "none" | "compact" | "default" | "spacious";

const paddingMap: Record<PaddingVariant, number> = {
  none: 0,
  compact: spacing[12],
  default: spacing[16],
  spacious: spacing[24],
};

// ─── Shadow presets ─────────────────────────────────────────────────

type ShadowVariant = "none" | "small" | "medium" | "large" | "card" | "floating";

// ─── Props ─────────────────────────────────────────────────────────

export interface CardProps extends Omit<PressableProps, "style"> {
  /** Internal padding preset. */
  padding?: PaddingVariant;
  /** Shadow level. */
  shadow?: ShadowVariant;
  /** Optional gradient background (key from `gradients`). */
  gradient?: keyof typeof gradients;
  /** Blur overlay on top of content. */
  blur?: boolean;
  /** Corner radius override. */
  borderRadius?: number;
  /** Make the card pressable with animation. */
  pressable?: boolean;
  /** Custom background color (used only when no gradient). */
  bgColor?: string;
  /** Style overrides. */
  style?: StyleProp<ViewStyle>;
  /** Card content. */
  children: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const Card = forwardRef<View, CardProps>(function Card(
  {
    padding = "default",
    shadow = "card",
    gradient: gradientKey,
    blur = false,
    borderRadius,
    pressable = false,
    bgColor = colors.card,
    style,
    children,
    onPress,
    onLongPress,
    ...rest
  },
  ref
) {
  const scale = useSharedValue(1);
  const br = borderRadius ?? radius[24];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    "worklet";
    scale.value = withSpring(0.98, springConfig.card);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    "worklet";
    scale.value = withSpring(1, springConfig.card);
  }, [scale]);

  const baseStyle: ViewStyle = {
    borderRadius: br,
    backgroundColor: gradientKey ? undefined : bgColor,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: "hidden",
  };

  const shadowStyle =
    shadow === "none" ? {} : (shadows[shadow] as ViewStyle);

  const renderContent = () => {
    if (gradientKey) {
      return (
        <LinearGradient
          colors={gradients[gradientKey] as unknown as GradientStops}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: paddingMap[padding], flex: 1 }}
        >
          {children}
        </LinearGradient>
      );
    }
    return (
      <View style={{ padding: paddingMap[padding], flex: 1 }}>
        {children}
      </View>
    );
  };

  const renderBlurOrContent = () => {
    if (blur) {
      return (
        <BlurView intensity={40} tint="dark" style={{ flex: 1 }}>
          {renderContent()}
        </BlurView>
      );
    }
    return renderContent();
  };

  if (pressable) {
    return (
      <AnimatedPressable
        ref={ref as any}
        style={[baseStyle, shadowStyle, animatedStyle, style]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={onLongPress}
        accessibilityRole="button"
        {...rest}
      >
        {renderBlurOrContent()}
      </AnimatedPressable>
    );
  }

  return (
    <View
      ref={ref}
      style={[baseStyle, shadowStyle, style]}
      {...rest}
    >
      {renderBlurOrContent()}
    </View>
  );
});

export default memo(Card);
