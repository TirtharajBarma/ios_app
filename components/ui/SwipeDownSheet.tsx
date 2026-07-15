/**
 * SwipeDownSheet
 *
 * A gesture-driven bottom sheet that closes with an iOS-style swipe-down.
 * Built on `react-native-gesture-handler` + `react-native-reanimated` so it
 * works smoothly with the existing GestureHandlerRootView in `_layout.tsx`.
 *
 * - Drag down anywhere on the sheet to dismiss.
 * - Flick = instant dismiss; small drag snaps back.
 * - Backdrop fades proportionally as the sheet is pulled.
 * - **Smooth close**: the sheet animates off-screen *before* unmounting, so
 *   you never see a snap-to-gone.
 *
 * Usage:
 *   <SwipeDownSheet visible={open} onClose={() => setOpen(false)}>
 *     {content}
 *   </SwipeDownSheet>
 */
import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, ViewStyle, StyleProp } from "react-native";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { colors, spacing } from "@/constants";

export interface SwipeDownSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Style applied to the sheet container (the dark panel). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Height as a fraction of screen. Default 0.84. */
  heightRatio?: number;
}

const SPRING_OPEN = { damping: 40, stiffness: 280, mass: 0.9 };
const SPRING_CLOSE = { damping: 34, stiffness: 340, mass: 0.7 };
const CLOSE_THRESHOLD = 100; // px dragged before dismiss
const CLOSE_VELOCITY = 500; // px/s flick dismisses regardless of distance
const ANIM_CLOSE_MS = 260; // time to animate off-screen before unmount

export default function SwipeDownSheet({
  visible,
  onClose,
  children,
  containerStyle,
  heightRatio = 0.84,
}: SwipeDownSheetProps) {
  // Internal "showing" state: true while `visible` is true AND during the
  // close animation.  Set to false only after the close animation finishes,
  // so React doesn't unmount the sheet mid-animation.
  const [showing, setShowing] = useState(false);

  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  // ── Open / Close lifecycle ──────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      // Show the sheet immediately, then spring into position.
      setShowing(true);
      translateY.value = 0;
      backdropOpacity.value = withTiming(1, { duration: 240 });
    }
    // When `visible` flips to false we do NOT hide yet — the close gesture
    // (or backdrop tap) already kicked the animation and will call
    // `handleAnimationEnd` which sets `showing = false` after it finishes.
  }, [visible]);

  const handleAnimationEnd = useCallback(() => {
    setShowing(false);
  }, []);

  // Called from worklet to fire after close animation finishes.
  const finishClose = useCallback(() => {
    runOnJS(onClose)();
    // Delay unmount so the spring animation visually completes first.
    setTimeout(() => runOnJS(handleAnimationEnd)(), ANIM_CLOSE_MS);
  }, [onClose, handleAnimationEnd]);

  // ── Gesture ─────────────────────────────────────────────────────────
  const pan = Gesture.Pan()
    .activeOffsetY(6)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
      backdropOpacity.value = interpolate(
        translateY.value,
        [0, 300],
        [1, 0.15],
        Extrapolate.CLAMP,
      );
    })
    .onEnd((e) => {
      if (translateY.value > CLOSE_THRESHOLD || e.velocityY > CLOSE_VELOCITY) {
        // Animate fully off-screen
        backdropOpacity.value = withTiming(0, { duration: 200 });
        translateY.value = withSpring(999, SPRING_CLOSE);
        runOnJS(finishClose)();
      } else {
        // Snap back
        translateY.value = withSpring(0, SPRING_OPEN);
        backdropOpacity.value = withTiming(1, { duration: 160 });
      }
    });

  const backdropTap = Gesture.Tap().onEnd(() => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withSpring(999, SPRING_CLOSE);
    runOnJS(finishClose)();
  });

  // ── Animated styles ─────────────────────────────────────────────────
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Don't render at all when fully hidden.
  if (!showing) return null;

  return (
    <GestureHandlerRootView style={styles.overlay}>
      {/* Backdrop */}
      <GestureDetector gesture={backdropTap}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </GestureDetector>

      {/* Sheet */}
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sheet,
            { height: `${heightRatio * 100}%` },
            sheetStyle,
            containerStyle,
          ]}
        >
          {/* Drag handle */}
          <Animated.View style={styles.handle} />
          {children}
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    zIndex: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing[8],
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#3A3A3C",
    alignSelf: "center",
    marginBottom: spacing[12],
  },
});
