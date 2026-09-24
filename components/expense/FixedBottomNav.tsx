import React, { useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Home, ReceiptText, BarChart3, CloudDownload, Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';

export type ExpenseTabType = 'home' | 'ledger' | 'visualizer' | 'import' | 'settings';

interface FixedBottomNavProps {
  activeTab?: ExpenseTabType;
  onTabPress?: (tab: ExpenseTabType) => void;
}

const TAB_INDEX_MAP: Record<ExpenseTabType, number> = {
  home: 0,
  ledger: 1,
  visualizer: 2,
  import: 3,
  settings: 4,
};

export const FixedBottomNav: React.FC<FixedBottomNavProps> = ({
  activeTab,
  onTabPress,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const currentTab: ExpenseTabType = useMemo(() => {
    if (activeTab) return activeTab;
    if (pathname?.includes('/ledger')) return 'ledger';
    if (pathname?.includes('/visualizer')) return 'visualizer';
    if (pathname?.includes('/import')) return 'import';
    if (pathname?.includes('/settings')) return 'settings';
    return 'home';
  }, [activeTab, pathname]);

  const navItems: Array<{ id: ExpenseTabType; label: string; IconComponent: any }> = useMemo(() => [
    { id: 'home', label: 'Home', IconComponent: Home },
    { id: 'ledger', label: 'Ledger', IconComponent: ReceiptText },
    { id: 'visualizer', label: 'Visualizer', IconComponent: BarChart3 },
    { id: 'import', label: 'Import', IconComponent: CloudDownload },
    { id: 'settings', label: 'Settings', IconComponent: Settings },
  ], []);

  // Liquid Morphing Shared Values
  const initialIdx = TAB_INDEX_MAP[currentTab] ?? 0;
  const leftEdgeSV = useSharedValue(initialIdx);
  const rightEdgeSV = useSharedValue(initialIdx);
  const hoveredIdxSV = useSharedValue(initialIdx);
  const tabWidthSV = useSharedValue(0);
  const isDraggingSV = useSharedValue(false);

  useEffect(() => {
    const targetIdx = TAB_INDEX_MAP[currentTab] ?? 0;
    if (!isDraggingSV.value) {
      const prevIdx = hoveredIdxSV.value;
      hoveredIdxSV.value = targetIdx;

      if (targetIdx > prevIdx) {
        rightEdgeSV.value = withSpring(targetIdx, { damping: 17, stiffness: 220, mass: 0.6 });
        leftEdgeSV.value = withSpring(targetIdx, { damping: 22, stiffness: 150, mass: 0.9 });
      } else if (targetIdx < prevIdx) {
        leftEdgeSV.value = withSpring(targetIdx, { damping: 17, stiffness: 220, mass: 0.6 });
        rightEdgeSV.value = withSpring(targetIdx, { damping: 22, stiffness: 150, mass: 0.9 });
      } else {
        leftEdgeSV.value = withSpring(targetIdx, { damping: 20, stiffness: 180 });
        rightEdgeSV.value = withSpring(targetIdx, { damping: 20, stiffness: 180 });
      }
    }
  }, [currentTab, leftEdgeSV, rightEdgeSV, hoveredIdxSV, isDraggingSV]);

  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    tabWidthSV.value = w / 5;
  }, [tabWidthSV]);

  const triggerHaptic = useCallback((type: 'selection' | 'impact') => {
    if (type === 'selection') {
      Haptics.selectionAsync().catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  const handleNavigateToIndex = useCallback((targetIdx: number) => {
    const item = navItems[targetIdx];
    if (!item) return;
    if (onTabPress) {
      onTabPress(item.id);
    }
    const targetRoute = item.id === 'home' ? '/(tabs)' : `/(tabs)/${item.id}`;
    router.replace(targetRoute as any);
  }, [navItems, onTabPress, router]);

  // ── Gestures: Pan & Tap for Fluid Continuous Glide ──
  const panGesture = Gesture.Pan()
    .minDistance(2)
    .onBegin((e) => {
      'worklet';
      isDraggingSV.value = true;
      const tWidth = tabWidthSV.value;
      if (tWidth > 0) {
        const touchIdx = Math.min(4, Math.max(0, Math.floor(e.x / tWidth)));
        if (touchIdx !== hoveredIdxSV.value) {
          hoveredIdxSV.value = touchIdx;
          runOnJS(triggerHaptic)('selection');
        }
        leftEdgeSV.value = withSpring(touchIdx, { damping: 18, stiffness: 220, mass: 0.5 });
        rightEdgeSV.value = withSpring(touchIdx, { damping: 18, stiffness: 220, mass: 0.5 });
      }
    })
    .onUpdate((e) => {
      'worklet';
      const tWidth = tabWidthSV.value;
      if (tWidth > 0) {
        const directIdx = Math.min(4, Math.max(0, (e.x - tWidth / 2) / tWidth));
        const snappedIdx = Math.min(4, Math.max(0, Math.floor(e.x / tWidth)));

        leftEdgeSV.value = directIdx;
        rightEdgeSV.value = directIdx;

        if (snappedIdx !== hoveredIdxSV.value) {
          hoveredIdxSV.value = snappedIdx;
          runOnJS(triggerHaptic)('selection');
        }
      }
    })
    .onEnd((e) => {
      'worklet';
      isDraggingSV.value = false;
      const tWidth = tabWidthSV.value;
      if (tWidth > 0) {
        const finalIdx = Math.min(4, Math.max(0, Math.floor(e.x / tWidth)));
        hoveredIdxSV.value = finalIdx;
        leftEdgeSV.value = withSpring(finalIdx, { damping: 20, stiffness: 200, mass: 0.7 });
        rightEdgeSV.value = withSpring(finalIdx, { damping: 20, stiffness: 200, mass: 0.7 });
        runOnJS(handleNavigateToIndex)(finalIdx);
      }
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      'worklet';
      const tWidth = tabWidthSV.value;
      if (tWidth > 0) {
        const finalIdx = Math.min(4, Math.max(0, Math.floor(e.x / tWidth)));
        const prevIdx = hoveredIdxSV.value;
        hoveredIdxSV.value = finalIdx;

        if (finalIdx > prevIdx) {
          rightEdgeSV.value = withSpring(finalIdx, { damping: 17, stiffness: 230, mass: 0.55 });
          leftEdgeSV.value = withSpring(finalIdx, { damping: 22, stiffness: 150, mass: 0.85 });
        } else if (finalIdx < prevIdx) {
          leftEdgeSV.value = withSpring(finalIdx, { damping: 17, stiffness: 230, mass: 0.55 });
          rightEdgeSV.value = withSpring(finalIdx, { damping: 22, stiffness: 150, mass: 0.85 });
        } else {
          leftEdgeSV.value = withSpring(finalIdx, { damping: 20, stiffness: 190 });
          rightEdgeSV.value = withSpring(finalIdx, { damping: 20, stiffness: 190 });
        }

        runOnJS(triggerHaptic)('impact');
        runOnJS(handleNavigateToIndex)(finalIdx);
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const tWidth = tabWidthSV.value;
    if (tWidth <= 0) return { opacity: 0 };
    const leftPos = leftEdgeSV.value * tWidth + 3;
    const rightPos = (rightEdgeSV.value + 1) * tWidth - 3;
    const pillWidth = Math.max(tWidth - 6, rightPos - leftPos);
    return {
      transform: [{ translateX: leftPos }],
      width: pillWidth,
      opacity: 1,
    };
  });

  // ─────────────────────────────────────────────
  // 1. iOS: APPLE NATIVE LIQUID GLASS GLIDE DOCK
  // ─────────────────────────────────────────────
  if (Platform.OS === 'ios') {
    return (
      <View
        pointerEvents="box-none"
        style={[
          styles.iosDockWrapper,
          { bottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <GestureDetector gesture={composedGesture}>
          <View style={styles.iosLiquidDock} onLayout={handleContainerLayout}>
            <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.iosLiquidDockOverlay} />

            {/* Sliding Liquid Capsule Indicator */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.slidingCapsule,
                indicatorAnimatedStyle,
              ]}
            >
              <View style={styles.capsuleInnerSurface} />
            </Animated.View>

            <View style={styles.iosItemsRow}>
              {navItems.map((item, idx) => {
                const isActive = currentTab === item.id;
                const iconColor = isActive ? '#FFFFFF' : '#7D8296';
                const textColor = isActive ? '#FFFFFF' : '#7D8296';

                return (
                  <View key={item.id} style={styles.iosNavItem}>
                    <item.IconComponent
                      size={20}
                      color={iconColor}
                      strokeWidth={isActive ? 2.4 : 1.9}
                    />
                    <AppText
                      style={[
                        styles.iosNavLabel,
                        { color: textColor, fontWeight: isActive ? '700' : '500' },
                      ]}
                    >
                      {item.label}
                    </AppText>

                    {/* Subtle Liquid Glow Dot */}
                    {isActive ? (
                      <View style={styles.iosActiveGlowDot} />
                    ) : (
                      <View style={styles.dotPlaceholder} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </GestureDetector>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // 2. ANDROID: MATERIAL DESIGN 3 (MATERIAL YOU)
  // ─────────────────────────────────────────────
  return (
    <View style={[styles.androidContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.androidContentRow}>
        {navItems.map((item, idx) => {
          const isActive = currentTab === item.id;
          const iconColor = isActive ? '#0F1015' : expenseColors.textSubtle;
          const textColor = isActive ? expenseColors.accentPeach : expenseColors.textMuted;

          return (
            <Pressable
              key={item.id}
              style={styles.androidNavItem}
              android_ripple={{ color: 'rgba(255, 157, 102, 0.16)', borderless: true, radius: 28 }}
              onPress={() => {
                triggerHaptic('impact');
                handleNavigateToIndex(idx);
              }}
            >
              {/* M3 Stadium Pill Highlight behind icon */}
              <View
                style={[
                  styles.m3PillContainer,
                  isActive && styles.m3PillActive,
                ]}
              >
                <item.IconComponent
                  size={20}
                  color={iconColor}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </View>

              <AppText
                style={[
                  styles.androidNavLabel,
                  { color: textColor, fontWeight: isActive ? '700' : '500' },
                ]}
              >
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // ── iOS Liquid Glass Styles ──
  iosDockWrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 100,
    alignItems: 'center',
  },
  iosLiquidDock: {
    width: '100%',
    borderRadius: 32,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.38)',
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  iosLiquidDockOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18, 20, 28, 0.68)',
  },
  slidingCapsule: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 3,
    borderRadius: 22,
    overflow: 'hidden',
    zIndex: 1,
  },
  capsuleInnerSurface: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderTopColor: 'rgba(255, 255, 255, 0.45)',
  },
  iosItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 2,
  },
  iosNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
    gap: 3,
    position: 'relative',
  },
  iosNavLabel: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: -0.2,
  },
  iosActiveGlowDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },

  // ── Android Material 3 Styles ──
  androidContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#161822',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 6,
    zIndex: 100,
    elevation: 8,
  },
  androidContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  androidNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 3,
    paddingVertical: 4,
  },
  m3PillContainer: {
    width: 52,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  m3PillActive: {
    backgroundColor: expenseColors.accentPeach,
  },
  androidNavLabel: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  dotPlaceholder: {
    width: 3.5,
    height: 3.5,
  },
});
