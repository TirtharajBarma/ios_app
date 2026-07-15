import React, { useState, memo } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
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
  const [showAndroid, setShowAndroid] = useState(false);

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowAndroid(false);
    }
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  const showAndroidPicker = () => {
    if (Platform.OS === "android") {
      setShowAndroid(true);
    }
  };

  return (
    <View style={styles.container}>
      <AppText variant="body" weight="600" color={colors.white}>
        {label}
      </AppText>

      {Platform.OS === "ios" ? (
        // iOS: Native Compact picker handles its own toggle modal inline
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          themeVariant="dark"
          minimumDate={minimumDate}
          onChange={handleDateChange}
          style={styles.pickerIos}
        />
      ) : (
        // Android: Pressable row that triggers Dialog modal
        <View>
          <Pressable onPress={showAndroidPicker} style={styles.triggerAndroid}>
            <AppText variant="body" weight="500" color={colors.textSecondary}>
              {format(value, "yyyy-MM-dd")}
            </AppText>
          </Pressable>
          {showAndroid && (
            <DateTimePicker
              value={value}
              mode="date"
              display="default"
              minimumDate={minimumDate}
              onChange={handleDateChange}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
  },
  pickerIos: {
    marginRight: -spacing[4], // Align compact picker boundary nicely
  },
  triggerAndroid: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[12],
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
  },
});

export default memo(DateField);
