import React, { useEffect, memo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from "react-native-reanimated";
import { AppText, LogoCircle } from "@/components/ui";
import { colors, spacing, springConfig } from "@/constants";

export interface ServiceHeroProps {
  name: string;
  category: string;
  brandColor: string;
  website?: string;
}

function ServiceHero({ name, category, brandColor, website }: ServiceHeroProps) {
  const logoScale = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withSpring(1, springConfig.bouncy);
  }, [logoScale]);

  const logoAnim = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Large logo circle with spring scaling entry */}
      <Animated.View style={[styles.logoWrapper, logoAnim]}>
        <LogoCircle
          name={name}
          color={brandColor}
          size={96}
          bordered
          shadowed
        />
      </Animated.View>

      {/* Service metadata fade-in */}
      <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.textWrapper}>
        <AppText variant="title1" weight="800" align="center" color={colors.white}>
          {name}
        </AppText>
        <AppText
          variant="subheadline"
          weight="600"
          align="center"
          color={colors.textSecondary}
          style={styles.meta}
        >
          {category}
          {website ? ` • ${website}` : ""}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[24],
  },
  logoWrapper: {
    marginBottom: spacing[20],
  },
  textWrapper: {
    alignItems: "center",
  },
  meta: {
    marginTop: spacing[4],
  },
});

export default memo(ServiceHero);
