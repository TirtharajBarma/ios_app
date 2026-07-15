import React, { memo } from "react";
import { View, StyleSheet, TextInput, type KeyboardTypeOptions } from "react-native";
import { AppText } from "@/components/ui";
import { colors, spacing } from "@/constants";

export interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  numberOfLines?: number;
  error?: string;
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
  numberOfLines = 1,
  error,
}: InputFieldProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.row, multiline && styles.rowMultiline]}>
        <AppText variant="body" weight="600" color={colors.white} style={styles.label}>
          {label}
        </AppText>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          style={[
            styles.input,
            multiline ? styles.inputMultiline : styles.inputRightAligned,
          ]}
        />
      </View>
      {error && (
        <AppText variant="footnote" weight="500" color={colors.danger} style={styles.errorText}>
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
  },
  rowMultiline: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: spacing[8],
  },
  label: {
    minWidth: 100,
  },
  input: {
    flex: 1,
    color: colors.white,
    fontFamily: "System",
    fontSize: 17,
  },
  inputRightAligned: {
    textAlign: "right",
  },
  inputMultiline: {
    width: "100%",
    textAlign: "left",
    minHeight: 64,
    paddingTop: 0,
  },
  errorText: {
    marginTop: spacing[4],
    color: colors.danger,
  },
});

export default memo(InputField);
