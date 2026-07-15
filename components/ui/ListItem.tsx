/**
 * ListItem
 *
 * iOS-style list row: leading icon, title, subtitle, trailing element,
 * optional chevron, optional divider. Pressable with haptic feedback.
 *
 * Usage:
 *   <ListItem
 *     leading={<LogoCircle size="sm" name="Netflix" color="#E50914" />}
 *     title="Netflix"
 *     subtitle="$15.99/mo"
 *     trailing={<AppText variant="caption1" color={colors.textMuted}>Tomorrow</AppText>}
 *     chevron
 *     onPress={() => {}}
 *   />
 */
import React, { memo, useCallback, forwardRef } from "react";
import {
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import AppText from "./AppText";
import Divider from "./Divider";
import {
  colors,
  spacing,
  radius,
  springConfig,
} from "@/constants";
import type { ReactNode } from "react";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ListItemProps extends Omit<PressableProps, "style"> {
  /** Leading element (icon, logo, avatar). */
  leading?: ReactNode;
  /** Primary text. */
  title: string;
  /** Secondary text below the title. */
  subtitle?: string;
  /** Trailing element (badge, text, icon). */
  trailing?: ReactNode;
  /** Show a chevron on the trailing edge. */
  chevron?: boolean;
  /** Show a divider below the row. */
  divider?: boolean;
  /** Make the row pressable. */
  onPress?: PressableProps["onPress"];
  /** Container style. */
  style?: StyleProp<ViewStyle>;
}

const ListItem = forwardRef<View, ListItemProps>(function ListItem(
  {
    leading,
    title,
    subtitle,
    trailing,
    chevron = false,
    divider = false,
    onPress,
    style,
    ...rest
  },
  ref
) {
  const bg = useSharedValue(0);

  const animatedBg = useAnimatedStyle(() => {
    "worklet";
    return {
      backgroundColor: interpolateColor(
        bg.value,
        [0, 1],
        [colors.card, colors.surfaceSecondary]
      ),
    };
  });

  const handlePressIn = useCallback(() => {
    "worklet";
    bg.value = withSpring(1, springConfig.button);
  }, [bg]);

  const handlePressOut = useCallback(() => {
    "worklet";
    bg.value = withSpring(0, springConfig.button);
  }, [bg]);

  const handlePress = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
      Haptics.selectionAsync();
      onPress?.(e);
    },
    [onPress],
  );

  return (
    <>
      <AnimatedPressable
        ref={ref as any}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing[12],
            paddingHorizontal: spacing[16],
            borderRadius: radius[16],
          },
          animatedBg,
          style,
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        {...rest}
      >
        {leading && <View style={{ marginRight: spacing[12] }}>{leading}</View>}

        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="500" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle && (
            <AppText
              variant="subheadline"
              color={colors.textSecondary}
              numberOfLines={1}
              style={{ marginTop: 2 }}
            >
              {subtitle}
            </AppText>
          )}
        </View>

        {trailing && <View style={{ marginLeft: spacing[8] }}>{trailing}</View>}

        {chevron && (
          <View style={{ marginLeft: spacing[4] }}>
            <ChevronRight size={18} color={colors.textMuted} />
          </View>
        )}
      </AnimatedPressable>

      {divider && <Divider spacing={spacing[4]} />}
    </>
  );
});

export default memo(ListItem);
