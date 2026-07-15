/**
 * Badge
 *
 * Small status pill. 4 semantic variants with appropriate background
 * opacity + foreground color pairing.
 *
 * Usage:
 *   <Badge variant="success">Active</Badge>
 *   <Badge variant="danger">Past due</Badge>
 */
import React, { memo, forwardRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import AppText from "./AppText";
import { colors, spacing, radius, hexToRGBA } from "@/constants";
import type { ReactNode } from "react";

export type BadgeVariant = "success" | "warning" | "danger" | "neutral";

interface BadgeTokens {
  fg: string;
  bg: string;
}

const variantTokens: Record<BadgeVariant, BadgeTokens> = {
  success: { fg: colors.success, bg: hexToRGBA(colors.success, 0.16) },
  warning: { fg: colors.warning, bg: hexToRGBA(colors.warning, 0.16) },
  danger: { fg: colors.danger, bg: hexToRGBA(colors.danger, 0.16) },
  neutral: { fg: colors.textSecondary, bg: hexToRGBA(colors.white, 0.08) },
};

export interface BadgeProps {
  /** Semantic variant. */
  variant?: BadgeVariant;
  /** Badge content (text or custom node). */
  children: ReactNode;
  /** Optional leading icon. */
  icon?: ReactNode;
  /** Style overrides. */
  style?: StyleProp<ViewStyle>;
}

const Badge = forwardRef<View, BadgeProps>(function Badge(
  {
    variant = "neutral",
    children,
    icon,
    style,
  },
  ref
) {
  const v = variantTokens[variant];

  return (
    <View
      ref={ref}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: v.bg,
          borderRadius: radius[8],
          paddingVertical: spacing[2],
          paddingHorizontal: spacing[8],
        },
        style,
      ]}
    >
      {icon && <View style={{ marginRight: spacing[4] }}>{icon}</View>}
      {typeof children === "string" ? (
        <AppText variant="caption2" weight="600" color={v.fg}>
          {children}
        </AppText>
      ) : (
        children
      )}
    </View>
  );
});

export default memo(Badge);
