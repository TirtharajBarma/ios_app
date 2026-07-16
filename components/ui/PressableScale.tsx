import React, { memo, useCallback } from "react";
import { Pressable, type PressableProps } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { springConfig } from "@/constants";

export interface PressableScaleProps extends Omit<PressableProps, "onPress"> {
  onPress?: () => void;
  scale?: number;
  children: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PressableScale({
  onPress,
  scale = 0.95,
  children,
  disabled,
  style,
  ...rest
}: PressableScaleProps) {
  const scaleValue = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const handlePressIn = useCallback(() => {
    "worklet";
    scaleValue.value = withSpring(scale, springConfig.button);
  }, [scaleValue, scale]);

  const handlePressOut = useCallback(() => {
    "worklet";
    scaleValue.value = withSpring(1, springConfig.button);
  }, [scaleValue]);

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

export default memo(PressableScale);
