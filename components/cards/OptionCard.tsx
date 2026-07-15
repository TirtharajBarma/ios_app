import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Card, AppText } from "@/components/ui";
import { colors, spacing, hexToRGBA } from "@/constants";

export interface OptionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: "blue" | "hero";
  onPress: () => void;
}

function OptionCard({ title, description, icon, gradient, onPress }: OptionCardProps) {
  const handlePress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onPress();
  };

  return (
    <Card
      pressable
      gradient={gradient}
      onPress={handlePress}
      padding="default"
      shadow="medium"
      style={styles.card}
    >
      <View style={styles.content}>
        {/* Left column: Circular Icon */}
        <View style={styles.iconWrapper}>
          {icon}
        </View>

        {/* Right column: Text details */}
        <View style={styles.textWrapper}>
          <AppText variant="headline" weight="700" color={colors.white}>
            {title}
          </AppText>
          <AppText
            variant="footnote"
            weight="600"
            color={hexToRGBA(colors.white, 0.7)}
            style={styles.desc}
          >
            {description}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: spacing[16],
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing[16],
  },
  textWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  desc: {
    marginTop: spacing[2],
  },
});

export default memo(OptionCard);
