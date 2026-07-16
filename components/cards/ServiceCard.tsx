import React, { memo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Card, AppText, LogoCircle } from "@/components/ui";
import { colors, radius, hexToRGBA } from "@/constants";
import type { Service } from "@/assets/data/services";

export interface ServiceCardProps {
  service: Service;
  index: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function ServiceCard({ service, index, onPress, style }: ServiceCardProps) {
  const { name, category, brandColor, iconUrl, whiteBackground, website } = service;

  // Custom transparent-accent border + background look
  const customBg = hexToRGBA(brandColor, 0.05);
  const customBorder = hexToRGBA(brandColor, 0.25);

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 30).springify().mass(0.6).damping(18).stiffness(120)}
      style={style}
    >
      <Card
        pressable
        onPress={onPress}
        padding="compact"
        shadow="none"
        style={{
          width: 144,
          height: 106,
          backgroundColor: customBg,
          borderColor: customBorder,
          borderWidth: 0.5,
          borderRadius: radius[16],
        }}
      >
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          {/* Top row: Logo Circle */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <LogoCircle
              source={iconUrl}
              name={name}
              color={brandColor}
              whiteBackground={whiteBackground}
              size="sm"
              bordered
              website={website}
            />
          </View>

          {/* Bottom metadata */}
          <View>
            <AppText variant="subheadline" weight="700" numberOfLines={1}>
              {name}
            </AppText>
            <AppText
              variant="caption2"
              weight="600"
              color={colors.textMuted}
              numberOfLines={1}
              style={{ marginTop: 2 }}
            >
              {category}
            </AppText>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

export default memo(ServiceCard);
