import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AppText from './AppText';

export interface LiquidGlassSegmentedControlProps<T extends string = string> {
  /** Array of segment values (e.g. ['1W', '1M', '6M', '1Y', 'ALL']) */
  values: T[];
  /** Optional custom labels dictionary if labels differ from values */
  labels?: Partial<Record<T, string>>;
  /** Currently selected value */
  selectedValue: T;
  /** Callback fired when a segment is selected */
  onValueChange: (value: T) => void;
  /** Optional outer container style overrides */
  style?: StyleProp<ViewStyle>;
  /** Accent tint color for the active indicator (defaults to Monevo brand peach #FF9D66) */
  tintColor?: string;
  /** Background glow color for the active indicator */
  indicatorGlowColor?: string;
}

/**
 * LiquidGlassSegmentedControl
 *
 * Implements Apple Native Hardware Liquid Glass matching the bottom tab bar:
 * - iOS UIKit `systemMaterialDark` Metal frosted glass blur via Expo Blur
 * - 120fps hardware-accelerated spring sliding indicator pill
 * - Monevo navbar brand peach luminescence (`rgba(255, 157, 102, 0.18)`)
 * - Native iOS tactile selection haptic feedback (`Haptics.selectionAsync()`)
 */
export const LiquidGlassSegmentedControl = <T extends string = string>({
  values,
  labels,
  selectedValue,
  onValueChange,
  style,
  tintColor = '#FF9D66',
  indicatorGlowColor = 'rgba(255, 157, 102, 0.18)',
}: LiquidGlassSegmentedControlProps<T>) => {
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const selectedIndex = Math.max(0, values.indexOf(selectedValue));

  // Width of each segment inside the 4px padded container
  const padding = 4;
  const availableWidth = containerWidth > 0 ? containerWidth - padding * 2 : 0;
  const segmentWidth = values.length > 0 && availableWidth > 0 ? availableWidth / values.length : 0;

  // Shared value for the active indicator's X coordinate
  const indicatorX = useSharedValue<number>(selectedIndex * segmentWidth);

  // Smooth Apple spring physics matching the UITabBar pop-up indicator
  useEffect(() => {
    if (segmentWidth > 0) {
      indicatorX.value = withSpring(selectedIndex * segmentWidth, {
        damping: 19,
        stiffness: 220,
        mass: 0.7,
      });
    }
  }, [selectedIndex, segmentWidth, indicatorX]);

  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== containerWidth) {
      setContainerWidth(w);
    }
  }, [containerWidth]);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: indicatorX.value }],
      width: segmentWidth,
      opacity: segmentWidth > 0 ? 1 : 0,
    };
  });

  const handlePress = useCallback(
    (val: T) => {
      if (val !== selectedValue) {
        Haptics.selectionAsync().catch(() => {});
        onValueChange(val);
      }
    },
    [selectedValue, onValueChange]
  );

  return (
    <View style={[styles.outerWrapper, style]} onLayout={handleContainerLayout}>
      {/* Native Apple Hardware Frosted Glass Surface */}
      <BlurView
        tint="systemMaterialDark"
        intensity={Platform.OS === 'ios' ? 70 : 85}
        style={StyleSheet.absoluteFill}
      />

      {/* Specular hairline inner overlay for dark mode contrast */}
      <View style={styles.specularOverlay} pointerEvents="none" />

      {/* Sliding Liquid Indicator Bubble */}
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              backgroundColor: indicatorGlowColor,
              borderColor: 'rgba(255, 157, 102, 0.38)',
            },
            animatedIndicatorStyle,
          ]}
        />
      )}

      {/* Interactive Segment Buttons */}
      <View style={styles.segmentsRow}>
        {values.map((val) => {
          const isSelected = val === selectedValue;
          const displayLabel = labels?.[val] ?? val;

          return (
            <Pressable
              key={val}
              style={styles.segmentButton}
              onPress={() => handlePress(val)}
              android_ripple={{
                color: 'rgba(255, 157, 102, 0.12)',
                borderless: false,
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
            >
              <AppText
                style={[
                  styles.segmentText,
                  isSelected && {
                    color: tintColor,
                    fontWeight: '800',
                  },
                ]}
                numberOfLines={1}
              >
                {displayLabel}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: Platform.select({
      ios: 'rgba(18, 20, 26, 0.55)',
      android: '#14161E',
      default: 'rgba(18, 20, 26, 0.85)',
    }),
    position: 'relative',
    justifyContent: 'center',
  },
  specularOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: '#FF9D66',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});

export default memo(LiquidGlassSegmentedControl) as typeof LiquidGlassSegmentedControl;
