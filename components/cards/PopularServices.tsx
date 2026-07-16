import React, { memo } from "react";
import { View, Pressable, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { AppText, LogoCircle } from "@/components/ui";
import { colors, spacing } from "@/constants";
import type { Service } from "@/assets/data/services";

export interface PopularServicesProps {
  services: Service[];
  onServicePress?: (service: Service) => void;
  style?: StyleProp<ViewStyle>;
}

const ITEM_SIZE = 72; // size of the item container (circle is 60)
const ITEM_GAP = spacing[16];
const ITEM_WIDTH = ITEM_SIZE + ITEM_GAP;

// ─── Popular item with scroll-driven scale ────────────────────────────

const PopularItem = memo(function PopularItem({
  service,
  index,
  scrollX,
  onPress,
}: {
  service: Service;
  index: number;
  scrollX: SharedValue<number>;
  onPress?: () => void;
}) {
  const { name, brandColor, iconUrl, whiteBackground, website } = service;

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    // Distance from the current scroll position
    const itemPosition = index * ITEM_WIDTH;
    const distance = Math.abs(scrollX.value - itemPosition);
    
    // Scale items up slightly as they approach the center/left scrolling focus
    const scale = interpolate(
      distance,
      [0, ITEM_WIDTH * 2],
      [1.08, 0.92],
      "clamp"
    );

    return {
      transform: [{ scale }],
    };
  });

  const handlePress = () => {
    Haptics.selectionAsync();
    onPress?.();
  };

  return (
    <Pressable onPress={handlePress} accessibilityRole="button">
      <Animated.View
        style={[
          {
            width: ITEM_SIZE,
            alignItems: "center",
            justifyContent: "center",
          },
          animatedStyle,
        ]}
      >
        <LogoCircle
          source={iconUrl}
          name={name}
          color={brandColor}
          whiteBackground={whiteBackground}
          size={60}
          bordered
          shadowed
          style={{ marginBottom: spacing[8] }}
          website={website}
        />
        <AppText
          variant="caption2"
          weight="600"
          numberOfLines={1}
          align="center"
          color={colors.textSecondary}
          style={{ width: "100%" }}
        >
          {name}
        </AppText>
      </Animated.View>
    </Pressable>
  );
});

// ─── Main Popular Component ──────────────────────────────────────────

function PopularServices({
  services,
  onServicePress,
  style,
}: PopularServicesProps) {
  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const popularItems = services.filter((s) => s.isPopular);

  if (popularItems.length === 0) return null;

  return (
    <View style={style}>
      <AppText
        variant="subheadline"
        weight="700"
        color={colors.textMuted}
        style={{
          paddingHorizontal: spacing[20],
          marginBottom: spacing[12],
          letterSpacing: 0.5,
          textTransform: "uppercase" as const,
        }}
      >
        Popular
      </AppText>

      <Animated.ScrollView
        horizontal
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing[20],
          gap: ITEM_GAP,
        }}
      >
        {popularItems.map((service, index) => (
          <PopularItem
            key={service.id}
            service={service}
            index={index}
            scrollX={scrollX}
            onPress={() => onServicePress?.(service)}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

export default memo(PopularServices);
