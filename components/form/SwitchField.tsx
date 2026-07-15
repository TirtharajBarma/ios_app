import React, { memo } from "react";
import { View, StyleSheet, Switch } from "react-native";
import { AppText } from "@/components/ui";
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
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.border}
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
