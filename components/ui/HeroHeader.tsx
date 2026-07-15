/**
 * HeroHeader
 *
 * Large feature header with a background gradient, large title, subtitle,
 * and an optional logo. Used at the top of dashboard/home screens.
 *
 * Usage:
 *   <HeroHeader
 *     title="Subscriptions"
 *     subtitle="Track every renewal in one place"
 *     logo={<LogoCircle name="S" size="xl" color={colors.accent} />}
 *   />
 */
import React, { memo, forwardRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppText from "./AppText";
import { colors, spacing, radius, shadows, gradients } from "@/constants";
import type { GradientStops } from "@/constants/gradients";
import type { ReactNode } from "react";

export interface HeroHeaderProps {
  /** Large headline. */
  title: string;
  /** Subtitle below the title. */
  subtitle?: string;
  /** Optional node rendered on the trailing side (logo, avatar, icon). */
  logo?: ReactNode;
  /** Gradient key from the design system. */
  gradient?: keyof typeof gradients;
  /** Override the gradient stops directly. */
  gradientStops?: GradientStops;
  /** Container style. */
  style?: StyleProp<ViewStyle>;
}

const HeroHeader = forwardRef<View, HeroHeaderProps>(function HeroHeader(
  {
    title,
    subtitle,
    logo,
    gradient = "hero",
    gradientStops,
    style,
  },
  ref
) {
  const stops = gradientStops ?? (gradients[gradient] as unknown as GradientStops);

  return (
    <View ref={ref} style={[{ borderRadius: radius[32], overflow: "hidden", ...shadows.large.native }, style]}>
      <LinearGradient
        colors={stops}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: spacing[24] }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText
              variant="largeTitle"
              weight="700"
              color={colors.white}
            >
              {title}
            </AppText>
            {subtitle && (
              <AppText
                variant="subheadline"
                color={colors.white}
                style={{ opacity: 0.8, marginTop: spacing[4] }}
              >
                {subtitle}
              </AppText>
            )}
          </View>

          {logo && <View style={{ marginLeft: spacing[16] }}>{logo}</View>}
        </View>
      </LinearGradient>
    </View>
  );
});

export default memo(HeroHeader);
