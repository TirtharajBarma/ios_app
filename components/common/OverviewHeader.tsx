import React, { memo } from "react";
import { View, Pressable, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  interpolate,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Avatar, AppText } from "@/components/ui";
import { colors, spacing, hexToRGBA } from "@/constants";

// ─── Props ─────────────────────────────────────────────────────────

export interface OverviewTopBarProps {
  scrollY: SharedValue<number>;
  title?: string;
  profileImage?: string;
  profileName?: string;
  onProfilePress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export interface OverviewLargeHeaderProps {
  title?: string;
  profileImage?: string;
  profileName?: string;
  onProfilePress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// ─── Collapsible Top Bar (Sticky) ───────────────────────────────────

export const OverviewTopBar = memo(function OverviewTopBar({
  scrollY,
  title = "Overview",
  profileImage,
  profileName = "User Name",
  onProfilePress,
  style,
}: OverviewTopBarProps) {
  const insets = useSafeAreaInsets();
  const topBarHeight = 48 + insets.top;

  // Animate content opacity (fades in as user scrolls down)
  const animatedContentStyle = useAnimatedStyle(() => {
    "worklet";
    const opacity = interpolate(
      scrollY.value,
      [40, 80], // threshold scroll values
      [0, 1],
      "clamp"
    );
    return { opacity };
  });

  // Animate background blur visibility
  const animatedBgStyle = useAnimatedStyle(() => {
    "worklet";
    const opacity = interpolate(
      scrollY.value,
      [10, 50],
      [0, 1],
      "clamp"
    );
    return { opacity };
  });

  return (
    <View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: topBarHeight,
          zIndex: 100,
        },
        style,
      ]}
    >
      {/* Blurry backing that fades in */}
      <Animated.View style={[{ ...StyleSheetAbsoluteFill }, animatedBgStyle]}>
        <BlurView
          intensity={80}
          tint="dark"
          style={{ flex: 1, borderBottomWidth: 0.5, borderColor: colors.border }}
        />
      </Animated.View>

      {/* Top bar content */}
      <Animated.View
        style={[
          {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: insets.top,
            paddingHorizontal: spacing[20],
          },
          animatedContentStyle,
        ]}
      >
        {/* Placeholder spacer to balance the layout */}
        <View style={{ width: 32 }} />

        <AppText variant="headline" weight="700" color={colors.white}>
          {title}
        </AppText>

        <Pressable onPress={onProfilePress} hitSlop={8}>
          <Avatar
            name={profileName}
            source={profileImage}
            size="small"
          />
        </Pressable>
      </Animated.View>
    </View>
  );
});

const StyleSheetAbsoluteFill: ViewStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

// ─── Inline Large Header (Scrolls away) ─────────────────────────────

export const OverviewLargeHeader = memo(function OverviewLargeHeader({
  title = "Overview",
  profileImage,
  profileName = "User Name",
  onProfilePress,
  style,
}: OverviewLargeHeaderProps) {
  const insets = useSafeAreaInsets();
  
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing[4],
          paddingTop: insets.top + spacing[12],
          paddingBottom: spacing[16],
        },
        style,
      ]}
    >
      <AppText variant="largeTitle" weight="800" color={colors.white}>
        {title}
      </AppText>
      <Pressable onPress={onProfilePress} accessibilityLabel="Profile menu">
        <Avatar
          name={profileName}
          source={profileImage}
          bgColor={hexToRGBA(colors.accent, 0.2)}
          size="medium"
        />
      </Pressable>
    </View>
  );
});
