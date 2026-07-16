/**
 * EmptyState
 *
 * Centered placeholder for empty lists / screens. Icon, title, subtitle,
 * optional CTA button.
 *
 * Usage:
 *   <EmptyState
 *     icon={<Inbox />}
 *     title="No subscriptions yet"
 *     subtitle="Add your first subscription to start tracking."
 *     actionLabel="Add Subscription"
 *     onAction={() => router.push("/add")}
 *   />
 */
import React, { memo, forwardRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import AppText from "./AppText";
import AppButton from "./AppButton";
import { colors, spacing } from "@/constants";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** Leading icon node (usually a lucide icon). */
  icon?: ReactNode;
  /** Bold title. */
  title: string;
  /// Subtitle / description.
  subtitle?: string;
  /** Label for the optional CTA button. */
  actionLabel?: string;
  /** CTA press handler. */
  onAction?: () => void;
  /** Container style. */
  style?: StyleProp<ViewStyle>;
}

const EmptyState = forwardRef<View, EmptyStateProps>(function EmptyState(
  {
    icon,
    title,
    subtitle,
    actionLabel,
    onAction,
    style,
  },
  ref
) {
  return (
    <View
      ref={ref}
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: spacing[48],
          paddingHorizontal: spacing[24],
        },
        style,
      ]}
    >
      {icon && (
        <Animated.View
          entering={FadeInUp.delay(0).springify().damping(20)}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing[16],
          }}
        >
          {icon}
        </Animated.View>
      )}

      <Animated.View entering={FadeInUp.delay(80).springify().damping(20)}>
        <AppText
          variant="headline"
          align="center"
          style={{ marginBottom: spacing[8] }}
        >
          {title}
        </AppText>
      </Animated.View>

      {subtitle && (
        <Animated.View entering={FadeInUp.delay(140).springify().damping(20)}>
          <AppText
            variant="subheadline"
            color={colors.textSecondary}
            align="center"
            style={{ marginBottom: spacing[24] }}
          >
            {subtitle}
          </AppText>
        </Animated.View>
      )}

      {actionLabel && onAction && (
        <Animated.View entering={FadeInUp.delay(200).springify().damping(20)}>
          <AppButton variant="primary" onPress={onAction}>
            {actionLabel}
          </AppButton>
        </Animated.View>
      )}
    </View>
  );
});

export default memo(EmptyState);
