import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { AppButton } from "@/components/ui";
import { spacing } from "@/constants";

export interface BottomCancelProps {
  label?: string;
  onCancel?: () => void;
}

function BottomCancel({ label = "Cancel", onCancel }: BottomCancelProps) {
  const router = useRouter();

  const handlePress = () => {
    Haptics.selectionAsync();
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <AppButton
        variant="ghost"
        onPress={handlePress}
        style={styles.button}
      >
        {label}
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing[16],
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: "100%",
    maxWidth: 200,
  },
});

export default memo(BottomCancel);
