/**
 * GlassCard
 *
 * A glassmorphism surface built on Expo Blur. Rounded corners, light
 * transparency, optional border. Use over image / gradient backgrounds
 * for the frosted-glass look.
 *
 * Usage:
 *   <GlassCard intensity={60}>
 *     <AppText>Frosted content</AppText>
 *   </GlassCard>
 */
import React, { memo, forwardRef } from "react";
import { View, type StyleProp, type ViewStyle, Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, GlassContainer } from "expo-glass-effect";
import { colors, spacing, radius } from "@/constants";

export interface GlassCardProps {
  /** Blur intensity (0-100). Higher = more frosted. */
  intensity?: number;
  /** Blur tint style. */
  tint?: "light" | "dark" | "default";
  /** Corner radius override. */
  borderRadius?: number;
  /** Internal padding. */
  padding?: number;
  /** Show a subtle white border. */
  bordered?: boolean;
  /** Style overrides. */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const GlassCard = forwardRef<View, GlassCardProps>(function GlassCard(
  {
    intensity = 50,
    tint = "dark",
    borderRadius,
    padding = spacing[16],
    bordered = true,
    style,
    children,
  },
  ref
) {
  const br = borderRadius ?? radius[24];

  if (Platform.OS === "ios") {
    return (
      <GlassContainer style={[{ borderRadius: br }, style]}>
        <GlassView
          ref={ref}
          glassEffectStyle="regular"
          tintColor={tint === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.25)"}
          style={[
            {
              borderRadius: br,
              padding,
              borderWidth: bordered ? 0.5 : 0,
              borderColor: "rgba(255, 255, 255, 0.18)",
              overflow: "hidden",
            },
          ]}
        >
          {children}
        </GlassView>
      </GlassContainer>
    );
  }

  // Android Material Design 3 Surface
  return (
    <View
      ref={ref}
      style={[
        {
          borderRadius: br,
          overflow: "hidden",
          borderWidth: bordered ? 1 : 0,
          borderColor: "rgba(255, 255, 255, 0.08)",
          backgroundColor: tint === "dark" ? "#161822" : "rgba(255, 255, 255, 0.9)",
          padding,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
});

export default memo(GlassCard);
