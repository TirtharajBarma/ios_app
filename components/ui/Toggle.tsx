/**
 * Toggle
 *
 * Native-looking iOS switch built on Reanimated. Animated knob slide,
 * color crossfade between off (surface) and on (success green).
 *
 * Usage:
 *   <Toggle value={enabled} onValueChange={setEnabled} />
 */
import React, { memo, useCallback, forwardRef } from "react";
import { Pressable, View, type PressableProps } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, duration } from "@/constants";

// iOS switch dimensions
const TRACK_W = 51;
const TRACK_H = 31;
const KNOB = 27; // diameter
const PADDING = 2; // inset

export interface ToggleProps extends Omit<PressableProps, "onPress"> {
  /** Current on/off state. */
  value: boolean;
  /** Called with the new value when toggled. */
  onValueChange: (value: boolean) => void;
  /** Disabled state. */
  disabled?: boolean;
}

const Toggle = forwardRef<View, ToggleProps>(function Toggle(
  {
    value,
    onValueChange,
    disabled = false,
    ...rest
  },
  ref
) {
  const knobX = useSharedValue(value ? TRACK_W - KNOB - PADDING : PADDING);

  React.useEffect(() => {
    knobX.value = withTiming(
      value ? TRACK_W - KNOB - PADDING : PADDING,
      {
        duration: duration.fast,
        easing: Easing.out(Easing.quad),
      }
    );
  }, [value, knobX]);

  const trackAnim = useAnimatedStyle(() => ({
    backgroundColor:
      knobX.value > TRACK_W / 2 - KNOB / 2
        ? colors.success
        : colors.surfaceSecondary,
  }));

  const knobAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value }],
  }));

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.selectionAsync();
    onValueChange(!value);
  }, [disabled, value, onValueChange]);

  return (
    <Pressable
      ref={ref as any}
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={4}
      {...rest}
    >
      <Animated.View
        style={[
          {
            width: TRACK_W,
            height: TRACK_H,
            borderRadius: TRACK_H / 2,
            padding: PADDING,
            opacity: disabled ? 0.4 : 1,
            justifyContent: "center",
          },
          trackAnim,
        ]}
      >
        <Animated.View
          style={[
            {
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              backgroundColor: colors.white,
              shadowColor: colors.black,
              shadowOpacity: 0.2,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            },
            knobAnim,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
});

export default memo(Toggle);
