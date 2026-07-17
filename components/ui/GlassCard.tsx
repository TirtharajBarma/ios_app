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
import { View, type StyleProp, type ViewStyle, Platform } from "react-native";
import { BlurView } from "expo-blur";
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

  return (
    <View
      ref={ref}
      style={[
        {
          borderRadius: br,
          overflow: "hidden",
          borderWidth: bordered ? 1 : 0,
          borderColor: colors.border,
          ...Platform.select({
            android: {
              backgroundColor: tint === "dark" ? "rgba(20, 20, 22, 0.85)" : "rgba(255, 255, 255, 0.15)",
            },
            default: {},
          }),
        },
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={tint}
        style={{ borderRadius: br, padding }}
      >
        {children}
      </BlurView>
    </View>
  );
});

export default memo(GlassCard);
