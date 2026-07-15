/**
 * Surface
 *
 * A plain elevated container — the building block behind Card and other
 * surfaces. No padding, no shadow by default; just background, border,
 * and radius. Use it when you need a flat styled box without Card's
 * chrome.
 *
 * Usage:
 *   <Surface bgColor={colors.surface} radius={16} padded>
 *     <AppText>Content</AppText>
 *   </Surface>
 */
import React, { memo, forwardRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { colors, spacing, radius } from "@/constants";

export interface SurfaceProps {
  /** Background color token. */
  bgColor?: string;
  /** Corner radius (number or radius token key). */
  radius?: number;
  /** Apply default horizontal+vertical padding. */
  padded?: boolean;
  /** Show a subtle border. */
  bordered?: boolean;
  /** Custom border color. */
  borderColor?: string;
  /** Style overrides. */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const Surface = forwardRef<View, SurfaceProps>(function Surface(
  {
    bgColor = colors.surface,
    radius: r = radius[16],
    padded = false,
    bordered = false,
    borderColor = colors.border,
    style,
    children,
  },
  ref
) {
  return (
    <View
      ref={ref}
      style={[
        {
          backgroundColor: bgColor,
          borderRadius: r,
          padding: padded ? spacing[16] : undefined,
          borderWidth: bordered ? 1 : 0,
          borderColor,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
});

export default memo(Surface);
