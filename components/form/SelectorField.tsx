import React, { useState, memo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  SafeAreaView,
  TouchableWithoutFeedback,
} from "react-native";
import { BlurView } from "expo-blur";
import { ChevronRight, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { AppText } from "@/components/ui";
import { colors, spacing, radius } from "@/constants";

export interface SelectorFieldProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
}

function SelectorField({ label, value, options, onSelect }: SelectorFieldProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const handleOpen = () => {
    Haptics.selectionAsync();
    setModalVisible(true);
  };

  const handleSelect = (option: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelect(option);
    setModalVisible(false);
  };

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
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        {/* Transparent tap-to-dismiss backing */}
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.modalBackdropTap} />
          </View>
        </TouchableWithoutFeedback>

        {/* Modal content bottom sheet container */}
        <View style={styles.sheetContainer}>
          <SafeAreaView style={styles.sheetContent}>
            {/* Header indicator */}
            <View style={styles.headerIndicator} />
            
            {/* Title */}
            <View style={styles.headerWrapper}>
              <AppText variant="headline" weight="700" color={colors.white}>
                Select {label}
              </AppText>
            </View>

            {/* List of options */}
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  modalBackdropTap: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: "#1C1C1E", // iOS dark sheet background
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
  headerIndicator: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginTop: spacing[8],
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
