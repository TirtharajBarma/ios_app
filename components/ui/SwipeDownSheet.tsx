/**
 * SwipeDownSheet
 *
 * A gesture-driven bottom sheet that closes with an iOS-style swipe-down.
 * Built on `react-native-gesture-handler` + `react-native-reanimated`.
 *
 * - Drag down anywhere on the sheet to dismiss.
 * - Flick = instant dismiss; small drag snaps back.
 * - Backdrop fades proportionally as the sheet is pulled.
 * - Always stays mounted so gesture handlers never unmount/remount.
 *   Hidden via translateY + pointerEvents when not visible.
 *
 * Usage:
 *   <SwipeDownSheet visible={open} onClose={() => setOpen(false)}>
 *     {content}
 *   </SwipeDownSheet>
 */
import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View, ViewStyle, StyleProp, useWindowDimensions } from "react-native";
import {
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from "react-native-reanimated";
import { colors, spacing } from "@/constants";

export interface SwipeDownSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  /** Height as a fraction of screen. Default 0.84. */
  heightRatio?: number;
}

const SPRING_OPEN = { damping: 45, stiffness: 320, mass: 0.8 };
const SPRING_CLOSE = { damping: 38, stiffness: 380, mass: 0.6 };
const CLOSE_THRESHOLD = 80;
const CLOSE_VELOCITY = 600;

export default function SwipeDownSheet({
  visible,
  onClose,
  children,
  containerStyle,
  heightRatio = 0.84,
}: SwipeDownSheetProps) {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();

  // Start off-screen so the sheet is invisible on mount.
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const prevVisible = useRef(visible);
  const gestureClosing = useRef(false);

  // ── Animated helpers ────────────────────────────────────────────────
  const animateOpen = useCallback(() => {
    translateY.value = SCREEN_HEIGHT;
    translateY.value = withSpring(0, SPRING_OPEN);
    backdropOpacity.value = withTiming(1, { duration: 240 });
  }, [backdropOpacity, translateY, SCREEN_HEIGHT]);

  const animateClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withSpring(SCREEN_HEIGHT, SPRING_CLOSE);
  }, [backdropOpacity, translateY, SCREEN_HEIGHT]);

  // ── Prop-driven open / close ────────────────────────────────────────
  useEffect(() => {
    if (visible && !prevVisible.current) {
      gestureClosing.current = false;
      animateOpen();
    } else if (!visible && prevVisible.current) {
      if (!gestureClosing.current) {
        animateClose();
      }
    }
    prevVisible.current = visible;
  }, [visible, animateOpen, animateClose]);

  // ── Gesture dismiss ────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    gestureClosing.current = true;
    animateClose();
    onCloseRef.current();
  }, [animateClose]);

  const pan = Gesture.Pan()
    .activeOffsetY(6)
    .onUpdate((e) => {
      "worklet";
      translateY.value = Math.max(0, e.translationY);
      backdropOpacity.value = interpolate(
        translateY.value,
        [0, 300],
        [1, 0.15],
        "clamp",
      );
    })
    .onEnd((e) => {
      "worklet";
      if (translateY.value > CLOSE_THRESHOLD || e.velocityY > CLOSE_VELOCITY) {
        runOnJS(dismiss)();
      } else {
        translateY.value = withSpring(0, SPRING_OPEN);
        backdropOpacity.value = withTiming(1, { duration: 160 });
      }
    });

  const backdropTap = Gesture.Tap().onEnd(() => {
    "worklet";
    runOnJS(dismiss)();
  });

  // ── Animated styles ────────────────────────────────────────────────
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <View
      style={styles.overlay}
      pointerEvents={visible ? "auto" : "none"}
    >
      <GestureDetector gesture={backdropTap}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </GestureDetector>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sheet,
            heightRatio ? { height: `${heightRatio * 100}%` } : undefined,
            sheetStyle,
            containerStyle,
          ]}
        >
          <Animated.View style={styles.handle} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
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
