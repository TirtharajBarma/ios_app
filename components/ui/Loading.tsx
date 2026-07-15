/**
 * Loading
 *
 * Skeleton loading primitives. Exposes three composable skeletons:
 *  - Loading.CardSkeleton   → a single card-shaped shimmer block
 *  - Loading.ListSkeleton   → a vertical stack of list-row shimmers
 *  - Loading.Box            → a generic rectangular shimmer block
 *
 * Usage:
 *   <Loading.CardSkeleton />
 *   <Loading.ListSkeleton count={5} />
 */
import React, { memo, useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors, spacing, radius, duration } from "@/constants";

// ─── Base shimmer block ─────────────────────────────────────────────

export interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

function SkeletonBox({
  width = "100%",
  height = 16,
  borderRadius,
  style,
}: SkeletonBoxProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: duration.slow, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: borderRadius ?? radius[8],
          backgroundColor: colors.surfaceSecondary,
        },
        anim,
        style,
      ]}
    />
  );
}

const MemoSkeletonBox = memo(SkeletonBox);

// ─── Card skeleton ──────────────────────────────────────────────────

function CardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius[24],
          padding: spacing[16],
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing[16] }}>
        <MemoSkeletonBox width={44} height={44} borderRadius={22} />
        <View style={{ marginLeft: spacing[12], flex: 1 }}>
          <MemoSkeletonBox width="60%" height={16} style={{ marginBottom: spacing[8] }} />
          <MemoSkeletonBox width="40%" height={12} />
        </View>
      </View>
      <MemoSkeletonBox width="30%" height={20} />
    </View>
  );
}

// ─── List skeleton ──────────────────────────────────────────────────

function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: spacing[12] }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: colors.card,
            borderRadius: radius[16],
            padding: spacing[16],
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <MemoSkeletonBox width={40} height={40} borderRadius={20} />
          <View style={{ marginLeft: spacing[12], flex: 1 }}>
            <MemoSkeletonBox width="50%" height={14} style={{ marginBottom: spacing[8] }} />
            <MemoSkeletonBox width="30%" height={12} />
          </View>
          <MemoSkeletonBox width={48} height={16} />
        </View>
      ))}
    </View>
  );
}

// ─── Barrel-as-namespace export ────────────────────────────────────

export const Loading = {
  CardSkeleton: memo(CardSkeleton),
  ListSkeleton: memo(ListSkeleton),
  Box: MemoSkeletonBox,
};

export default Loading;
