/**
 * Spinner
 *
 * Small indeterminate loading indicator. Thin wrapper over the native
 * ActivityIndicator, themed to the accent color.
 *
 * Usage:
 *   <Spinner size="large" />
 */
import React, { memo, forwardRef } from "react";
import { ActivityIndicator, type ActivityIndicatorProps } from "react-native";
import { colors } from "@/constants";

export interface SpinnerProps extends ActivityIndicatorProps {
  /** Override color. */
  color?: string;
}

const Spinner = forwardRef<ActivityIndicator, SpinnerProps>(function Spinner(
  { color = colors.accent, ...rest },
  ref
) {
  return <ActivityIndicator ref={ref} color={color} {...rest} />;
});

export default memo(Spinner);
