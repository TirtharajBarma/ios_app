/**
 * SearchBar
 *
 * Rounded search input with magnifier icon, animated focus border, clear
 * button, and configurable placeholder.
 *
 * Usage:
 *   <SearchBar
 *     value={query}
 *     onChangeText={setQuery}
 *     placeholder="Search subscriptions"
 *   />
 */
import React, { memo, useState, useCallback, forwardRef } from "react";
import {
  View,
  TextInput,
  Pressable,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { Search, X } from "lucide-react-native";
import AppText from "./AppText";
import { colors, spacing, radius, duration } from "@/constants";

const AnimatedView = Animated.createAnimatedComponent(View);

export interface SearchBarProps extends Omit<TextInputProps, "style"> {
  /** Outer container style. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Override clear-button visibility (defaults to auto when text present). */
  showClear?: boolean;
  /** Placeholder text. */
  placeholder?: string;
}

function SearchBar(
  {
    containerStyle,
    showClear,
    placeholder = "Search",
    value,
    onChangeText,
    ...rest
  }: SearchBarProps,
  ref: React.ForwardedRef<TextInput>,
) {
  const [focused, setFocused] = useState(false);
  const focusSV = useSharedValue(0);

  const handleFocus = useCallback(
    (e: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => {
      setFocused(true);
      focusSV.value = withTiming(1, { duration: duration.fast });
      rest.onFocus?.(e);
    },
    [focusSV, rest],
  );

  const handleBlur = useCallback(
    (e: Parameters<NonNullable<TextInputProps["onBlur"]>>[0]) => {
      setFocused(false);
      focusSV.value = withTiming(0, { duration: duration.fast });
      rest.onBlur?.(e);
    },
    [focusSV, rest],
  );

  const handleClear = useCallback(() => {
    onChangeText?.("");
  }, [onChangeText]);

  const borderAnim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusSV.value,
      [0, 1],
      [colors.border, colors.accent],
    ),
  }));

  const hasText = typeof value === "string" && value.length > 0;
  const clearVisible = showClear ?? hasText;

  return (
    <AnimatedView
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: radius[12],
          borderWidth: 1,
          paddingHorizontal: spacing[12],
          paddingVertical: spacing[8],
        },
        borderAnim,
        containerStyle,
      ]}
    >
      <Search size={18} color={colors.textMuted} />

      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{
          flex: 1,
          marginLeft: spacing[8],
          color: colors.textPrimary,
          fontSize: 17,
          paddingVertical: 0,
        }}
        {...rest}
      />

      {clearVisible && (
        <Pressable onPress={handleClear} hitSlop={8} accessibilityLabel="Clear search">
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: colors.textMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={12} color={colors.white} strokeWidth={3} />
          </View>
        </Pressable>
      )}

      {/* Keeps AppText imported & used for optional accessibility copy */}
      {focused && <AppText variant="caption2" style={{ display: "none" }}>searching</AppText>}
    </AnimatedView>
  );
}

export default memo(forwardRef(SearchBar));
