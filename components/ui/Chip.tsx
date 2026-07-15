/**
 * Chip
 *
 * Selectable rounded pill with a selected/unselected animated state.
 * Optional leading icon. Designed for filter rows and category pickers.
 *
 * Usage:
 *   <Chip label="All" selected onPress={() => setSelected("all")} />
 *   <Chip label="Music" icon={<Music size={14} />} selected={selected === "music"} />
 */
import React, { memo, useCallback, forwardRef } from "react";
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AppText from "./AppText";
import { colors, spacing, radius, duration } from "@/constants";
import type { ReactNode } from "react";

export interface ChipProps extends Omit<PressableProps, "style"> {
  /** Chip label. */
  label: string;
  /** Whether the chip is currently selected. */
  selected?: boolean;
  /** Optional leading icon. */
  icon?: ReactNode;
  /** Disabled state. */
  disabled?: boolean;
  /** Style overrides. */
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const Chip = forwardRef<View, ChipProps>(function Chip(
  {
    label,
    selected = false,
    icon,
    disabled = false,
    style,
    onPress,
    ...rest
  },
  ref
) {
  const selectedSV = useSharedValue(selected ? 1 : 0);

  // Keep shared value in sync if `selected` prop changes externally.
  React.useEffect(() => {
    selectedSV.value = withTiming(selected ? 1 : 0, {
      duration: duration.fast,
    });
  }, [selected, selectedSV]);

  // Animated background interpolates opacity of the accent tint.
  const animatedBg = useAnimatedStyle(() => {
    "worklet";
    return {
      backgroundColor:
        selectedSV.value > 0.5 ? colors.accent : colors.surfaceSecondary,
    };
  });

  const handlePress = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
      if (disabled) return;
      Haptics.selectionAsync();
      onPress?.(e);
    },
    [disabled, onPress],
  );

  const textColor = selected ? colors.white : colors.textSecondary;

  return (
    <AnimatedPressable
      ref={ref as any}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: spacing[8],
          paddingHorizontal: spacing[12],
          borderRadius: radius[20],
          borderWidth: selected ? 0 : 1,
          borderColor: colors.border,
          opacity: disabled ? 0.4 : 1,
        },
        animatedBg,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      {...rest}
    >
      {icon && (
        <View style={{ marginRight: spacing[4] }}>{icon}</View>
      )}
      <AppText variant="subheadline" weight="600" color={textColor}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
});

export default memo(Chip);
