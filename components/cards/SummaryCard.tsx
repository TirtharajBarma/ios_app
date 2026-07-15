import React, { memo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Card, AppText } from "@/components/ui";
import { colors, hexToRGBA } from "@/constants";

export interface SummaryCardProps {
  /** The small subtitle / label of the card. */
  title: string;
  /** The main stat amount. */
  amount: string;
  /** Lucide icon or other React element to render. */
  icon: React.ReactNode;
  /** Gradient theme from design tokens. */
  gradient?: "hero" | "blue" | "green" | "red" | "darkCard" | "black";
  /** Optional style override. */
  style?: StyleProp<ViewStyle>;
}

function SummaryCard({
  title,
  amount,
  icon,
  gradient = "darkCard",
  style,
}: SummaryCardProps) {
  return (
    <Card
      gradient={gradient}
      padding="default"
      shadow="medium"
      style={[{ flex: 1, height: 116, borderWidth: 0.5, borderColor: colors.border }, style]}
    >
      <View style={{ flex: 1, justifyContent: "space-between" }}>
        {/* Header row: Title and Icon */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <AppText
            variant="footnote"
            weight="600"
            color={hexToRGBA(colors.white, 0.5)}
            style={{ letterSpacing: 0.5 }}
          >
            {title}
          </AppText>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: hexToRGBA(colors.white, 0.12),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </View>
        </View>

        {/* Amount */}
        <AppText
          variant="title2"
          weight="800"
          color={colors.white}
          style={{ letterSpacing: 0.25 }}
        >
          {amount}
        </AppText>
      </View>
    </Card>
  );
}

export default memo(SummaryCard);
