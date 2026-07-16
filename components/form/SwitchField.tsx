import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { AppText, Toggle } from "@/components/ui";
import { colors } from "@/constants";

export interface SwitchFieldProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

function SwitchField({ label, value, onValueChange }: SwitchFieldProps) {
  return (
    <View style={styles.container}>
      <AppText variant="body" weight="600" color={colors.white}>
        {label}
      </AppText>
      <Toggle
        value={value}
        onValueChange={onValueChange}
      />
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
});

export default memo(SwitchField);
