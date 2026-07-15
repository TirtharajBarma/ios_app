/**
 * Divider
 *
 * Horizontal or vertical separator line with adjustable opacity.
 * Defaults to the border token color at full opacity.
 *
 * Usage:
 *   <Divider />
 *   <Divider orientation="vertical" length={40} />
 *   <Divider opacity={0.5} />
 */
import React, { memo, forwardRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { colors, spacing } from "@/constants";

export interface DividerProps {
  /** Line direction. */
  orientation?: "horizontal" | "vertical";
  /** Thickness in px. */
  thickness?: number;
  /** Fixed length (width for horizontal, height for vertical). */
  length?: number | string;
  /** Opacity multiplier applied to the border color. */
  opacity?: number;
  /** Override color. */
  color?: string;
  /** Vertical margin for horizontal dividers (creates breathing room). */
  spacing?: number;
  style?: StyleProp<ViewStyle>;
}

const Divider = forwardRef<View, DividerProps>(function Divider(
  {
    orientation = "horizontal",
    thickness = 1,
    length,
    opacity: op = 1,
    color = colors.border,
    spacing: verticalMargin,
    style,
  },
  ref
) {
  const isHorizontal = orientation === "horizontal";

  const baseStyle: ViewStyle = {
    backgroundColor: color,
    opacity: op,
  };

  if (isHorizontal) {
    baseStyle.height = thickness;
    baseStyle.width = length === undefined ? "100%" : (length as any);
    if (verticalMargin !== undefined) {
      baseStyle.marginVertical = verticalMargin;
    }
  } else {
    baseStyle.width = thickness;
    baseStyle.height = length === undefined ? spacing[24] : (length as any);
  }

  return <View ref={ref} style={[baseStyle, style]} />;
});

export default memo(Divider);
