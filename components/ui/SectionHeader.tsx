/**
 * SectionHeader
 *
 * Title row with optional subtitle and an optional trailing button
 * (typically a "See all" affordance). Used above grouped lists.
 *
 * Usage:
 *   <SectionHeader title="Upcoming" subtitle="Next 30 days" />
 *   <SectionHeader title="Active" actionLabel="See all" onAction={() => {}} />
 */
import React, { memo, forwardRef } from "react";
import { View, Pressable, type StyleProp, type ViewStyle } from "react-native";
import AppText from "./AppText";
import { colors, spacing } from "@/constants";

export interface SectionHeaderProps {
  /** Section title. */
  title: string;
  /** Optional subtitle below the title. */
  subtitle?: string;
  /** Trailing button label. */
  actionLabel?: string;
  /** Trailing button handler. */
  onAction?: () => void;
  /** Container style. */
  style?: StyleProp<ViewStyle>;
}

const SectionHeader = forwardRef<View, SectionHeaderProps>(function SectionHeader(
  {
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
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingHorizontal: spacing[4],
          paddingTop: spacing[24],
          paddingBottom: spacing[8],
        },
        style,
      ]}
    >
      <View style={{ flex: 1 }}>
        <AppText variant="title3" weight="700">
          {title}
        </AppText>
        {subtitle && (
          <AppText
            variant="subheadline"
            color={colors.textSecondary}
            style={{ marginTop: 2 }}
          >
            {subtitle}
          </AppText>
        )}
      </View>

      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
        >
          {({ pressed }) => (
            <AppText
              variant="subheadline"
              weight="600"
              color={colors.accent}
              style={{ opacity: pressed ? 0.6 : 1 }}
            >
              {actionLabel}
            </AppText>
          )}
        </Pressable>
      )}
    </View>
  );
});

export default memo(SectionHeader);
