import React, { memo, useCallback } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import { AppText } from "@/components/ui";
import { colors, spacing, shadows, springConfig, gradients, buttonPressScale } from "@/constants";
import type { GradientStops } from "@/constants/gradients";

export interface AddSubscriptionButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function AddSubscriptionButton({ onPress, style }: AddSubscriptionButtonProps) {
  const scale = useSharedValue(1);

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

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress?.();
  }, [onPress]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        {
          alignSelf: "center",
          borderRadius: 9999,
          ...shadows.medium.native,
        },
        animatedStyle,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Add Subscription"
    >
      <LinearGradient
        colors={gradients.hero as unknown as GradientStops}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing[16],
          paddingHorizontal: spacing[32],
          borderRadius: 9999,
          borderWidth: 0.5,
          borderColor: "rgba(255, 255, 255, 0.15)",
        }}
      >
        <Plus size={20} color={colors.white} strokeWidth={2.5} style={{ marginRight: spacing[8] }} />
        <AppText variant="body" weight="700" color={colors.white}>
          Add Subscription
        </AppText>
      </LinearGradient>
    </AnimatedPressable>
  );
}

export default memo(AddSubscriptionButton);
