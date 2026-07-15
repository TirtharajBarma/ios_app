import React, { useState, memo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Modal,
  TouchableOpacity,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { AppText } from "@/components/ui";
import { colors, spacing } from "@/constants";

export interface DateFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

function DateField({ label, value, onChange, minimumDate }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  const handleOpen = () => {
    setShowPicker(true);
  };

  const handleClose = () => {
    setShowPicker(false);
  };

  if (Platform.OS === "android") {
    return (
      <View style={styles.container}>
        <AppText variant="body" weight="600" color={colors.white}>
          {label}
        </AppText>
        <View>
          <Pressable onPress={handleOpen} style={styles.triggerAndroid}>
            <AppText variant="body" weight="500" color={colors.textSecondary}>
              {format(value, "yyyy-MM-dd")}
            </AppText>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={value}
              mode="date"
              display="default"
              minimumDate={minimumDate}
              onChange={handleDateChange}
            />
          )}
        </View>
      </View>
    );
  }

  // iOS: tappable row → modal spinner picker
  return (
    <>
      <Pressable onPress={handleOpen} style={styles.row}>
        <AppText variant="body" weight="600" color={colors.white}>
          {label}
        </AppText>
        <AppText variant="body" color={colors.textSecondary}>
          {format(value, "MMM d, yyyy")}
        </AppText>
      </Pressable>

      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleClose}>
                <AppText variant="callout" weight="600" color={colors.accent}>
                  Cancel
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose}>
                <AppText variant="callout" weight="600" color={colors.accent}>
                  Done
                </AppText>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={value}
              mode="date"
              display="spinner"
              themeVariant="dark"
              minimumDate={minimumDate}
              onChange={handleDateChange}
              textColor={colors.white}
              style={styles.iosPicker}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[8],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
  },
  triggerAndroid: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[12],
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing[24],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  iosPicker: {
    height: 200,
  },
});

export default memo(DateField);
