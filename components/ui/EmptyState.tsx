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
        <View
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
        </View>
      )}

      <AppText
        variant="headline"
        align="center"
        style={{ marginBottom: spacing[8] }}
      >
        {title}
      </AppText>

      {subtitle && (
        <AppText
          variant="subheadline"
          color={colors.textSecondary}
          align="center"
          style={{ marginBottom: spacing[24] }}
        >
          {subtitle}
        </AppText>
      )}

      {actionLabel && onAction && (
        <AppButton variant="primary" onPress={onAction}>
          {actionLabel}
        </AppButton>
      )}
    </View>
  );
});

export default memo(EmptyState);
