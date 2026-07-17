/**
 * SegmentedControl
 *
 * iOS-style segmented control with a sliding indicator. Supports any
 * number of segments. The indicator animates between positions using
 * Reanimated's `useAnimatedStyle` + layout measurement.
 *
 * Usage:
 *   <SegmentedControl
 *     segments={["Paid", "Free Trial", "All"]}
 *     value={index}
 *     onChange={setIndex}
 *   />
 */
import React, { memo, useCallback, useRef, useState, forwardRef } from "react";
import {
  View,
  Pressable,
  type LayoutChangeEvent,
  type ViewStyle,
  type StyleProp,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius, springConfig } from "@/constants";

export interface SegmentedControlProps {
  /** Segment labels. */
  segments: string[];
  /** Currently selected index. */
  value: number;
  /** Called with the new index when a segment is pressed. */
  onChange: (index: number) => void;
  /** Container style. */
  style?: StyleProp<ViewStyle>;
}

const SegmentedControl = forwardRef<View, SegmentedControlProps>(function SegmentedControl(
  {
    segments,
    value,
    onChange,
    style,
  },
  ref
) {
  const { width: windowWidth } = useWindowDimensions();
  const containerWidth = useRef(windowWidth);
  const segmentWidth = useRef(0);
  const segmentWidthSV = useSharedValue(0);
  const [measured, setMeasured] = useState(false);

  // Animated indicator position (0..segments.length-1)
  const activeSV = useSharedValue(value);

  React.useEffect(() => {
    activeSV.value = withSpring(value, springConfig.default);
  }, [value, activeSV]);

  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    containerWidth.current = e.nativeEvent.layout.width;
    segmentWidth.current = containerWidth.current / segments.length;
    segmentWidthSV.value = segmentWidth.current;
    setMeasured(true);
  }, [segments.length, segmentWidthSV]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: activeSV.value * segmentWidthSV.value },
    ],
    width: segmentWidthSV.value
      ? segmentWidthSV.value - spacing[4] * 2
      : 0,
    opacity: measured ? 1 : 0,
  }));

  const handlePress = useCallback(
    (index: number) => {
      Haptics.selectionAsync();
      onChange(index);
    },
    [onChange],
  );

  return (
    <View
      ref={ref}
      onLayout={handleContainerLayout}
      style={[
        {
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: radius[12],
          padding: spacing[4],
          position: "relative",
        },
        style,
      ]}
    >
      {/* Sliding indicator */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: spacing[4],
            bottom: spacing[4],
            left: spacing[4],
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius[8],
            shadowColor: colors.black,
            shadowOpacity: 0.1,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
          },
          indicatorStyle,
        ]}
      />

      {segments.map((label, i) => {
        const isActive = i === value;
        return (
          <SegmentButton
            key={label}
            label={label}
            index={i}
            activeSV={activeSV}
            isActive={isActive}
            onPress={handlePress}
          />
        );
      })}
    </View>
  );
});

// ─── Internal segment button ───────────────────────────────────────

interface SegmentButtonProps {
  label: string;
  index: number;
  activeSV: SharedValue<number>;
  isActive: boolean;
  onPress: (index: number) => void;
}

const SegmentButton = memo(function SegmentButton({
  label,
  index,
  activeSV,
  isActive,
  onPress,
}: SegmentButtonProps) {
  const textStyle = useAnimatedStyle(() => {
    const active = Math.round(activeSV.value) === index;
    return {
      color: interpolateColor(
        activeSV.value,
        [index - 1, index, index + 1],
        [colors.textSecondary, colors.textPrimary, colors.textSecondary],
      ),
      // force re-render when activeSV changes; rounded comparison above
      fontWeight: active ? ("700" as const) : ("500" as const),
    };
  });

  return (
    <Pressable
      onPress={() => onPress(index)}
      style={{
        flex: 1,
        paddingVertical: spacing[8],
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Animated.Text style={[{ fontSize: 15 }, textStyle]}>
        {label}
      </Animated.Text>
    </Pressable>
  );
});

export default memo(SegmentedControl);
