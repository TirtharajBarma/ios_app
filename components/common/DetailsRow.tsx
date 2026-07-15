import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { AppText } from "@/components/ui";
import { colors, spacing } from "@/constants";

export interface DetailsRowProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

function DetailsRow({ label, value, icon }: DetailsRowProps) {
  return (
    <View style={styles.row}>
      {/* Left: Icon and Label */}
      <View style={styles.left}>
        {icon && <View style={styles.iconWrapper}>{icon}</View>}
        <AppText variant="body" weight="600" color={colors.textSecondary}>
          {label}
        </AppText>
      </View>

      {/* Right: Value */}
      <AppText variant="body" weight="500" color={colors.white} style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrapper: {
    marginRight: spacing[12],
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    textAlign: "right",
    flex: 1,
    marginLeft: spacing[16],
  },
});

export default memo(DetailsRow);
