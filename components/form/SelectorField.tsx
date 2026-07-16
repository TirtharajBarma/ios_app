import React, { useState, useCallback, memo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { ChevronRight, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { AppText } from "@/components/ui";
import { colors, spacing, radius } from "@/constants";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const DISMISS_THRESHOLD = 100;

export interface SelectorFieldProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
}

function SelectorField({ label, value, options, onSelect }: SelectorFieldProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const translateY = useSharedValue(0);

  const handleOpen = () => {
    Haptics.selectionAsync();
    translateY.value = 0;
    setModalVisible(true);
  };

  const handleDismiss = useCallback(() => {
    setModalVisible(false);
    translateY.value = 0;
  }, [translateY]);

  const handleSelect = (option: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelect(option);
    setModalVisible(false);
    translateY.value = 0;
  };

  const panGesture = Gesture.Pan()
    .activeOffsetY(10)
    .onUpdate((e) => {
      // Only allow downward swipe
      if (e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > 800) {
        translateY.value = withSpring(SCREEN_HEIGHT, { damping: 35, stiffness: 350 }, () => {
          runOnJS(handleDismiss)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 28, stiffness: 320 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropOpacity = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - translateY.value / (SCREEN_HEIGHT * 0.6)),
  }));

  return (
    <>
      <Pressable onPress={handleOpen} accessibilityRole="button">
        <View style={styles.row}>
          <AppText variant="body" weight="600" color={colors.white}>
            {label}
          </AppText>
          <View style={styles.rightContent}>
            <AppText variant="body" color={colors.textSecondary} style={{ marginRight: spacing[4] }}>
              {value}
            </AppText>
            <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.5} />
          </View>
        </View>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        statusBarTranslucent
        onRequestClose={handleDismiss}
      >
        <View style={styles.modalRoot}>
          {/* Animated backdrop */}
          <Animated.View style={[styles.modalBackdrop, backdropOpacity]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            </Pressable>
          </Animated.View>

          {/* Draggable sheet */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.sheetContainer, sheetAnimatedStyle]}>
              <SafeAreaView style={styles.sheetContent}>
                {/* Drag handle indicator */}
                <View style={styles.dragHandleWrap}>
                  <View style={styles.headerIndicator} />
                </View>

                {/* Title */}
                <View style={styles.headerWrapper}>
                  <AppText variant="headline" weight="700" color={colors.white}>
                    Select {label}
                  </AppText>
                </View>

                {/* Options list */}
                <FlatList
                  data={options}
                  keyExtractor={(item) => item}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => {
                    const isSelected = item === value;
                    return (
                      <Pressable
                        onPress={() => handleSelect(item)}
                        style={({ pressed }) => [
                          styles.optionRow,
                          pressed && { backgroundColor: "rgba(255,255,255,0.05)" },
                        ]}
                      >
                        <AppText
                          variant="body"
                          weight={isSelected ? "700" : "500"}
                          color={isSelected ? colors.accent : colors.white}
                        >
                          {item}
                        </AppText>
                        {isSelected && (
                          <Check size={18} color={colors.accent} strokeWidth={2.5} />
                        )}
                      </Pressable>
                    );
                  }}
                />
              </SafeAreaView>
            </Animated.View>
          </GestureDetector>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheetContainer: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: radius[24],
    borderTopRightRadius: radius[24],
    maxHeight: "50%",
    borderWidth: 0.5,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  sheetContent: {
    flex: 1,
  },
  dragHandleWrap: {
    alignItems: "center",
    paddingTop: spacing[8],
    paddingBottom: spacing[4],
  },
  headerIndicator: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerWrapper: {
    paddingVertical: spacing[16],
    paddingHorizontal: spacing[20],
    borderBottomWidth: 0.5,
    borderColor: colors.border,
  },
  listContent: {
    paddingBottom: spacing[24],
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[16],
    paddingHorizontal: spacing[20],
    borderBottomWidth: 0.5,
    borderColor: colors.border,
  },
});

export default memo(SelectorField);
