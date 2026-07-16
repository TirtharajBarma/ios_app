import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { DollarSign, Gift } from "lucide-react-native";
import { colors, spacing } from "@/constants";
import ServiceHero from "@/components/common/ServiceHero";
import OptionCard from "@/components/cards/OptionCard";
import BottomCancel from "@/components/common/BottomCancel";

export default function SelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Read service params passed from search screen
  const { id, name, category, brandColor, website, logo } = useLocalSearchParams<{
    id: string;
    name: string;
    category: string;
    brandColor: string;
    website: string;
    logo: string;
  }>();

  const handleSelectPaid = () => {
    router.push({
      pathname: "/add/paid",
      params: { id, name, category, brandColor, website, logo },
    });
  };

  const handleSelectTrial = () => {
    router.push({
      pathname: "/add/paid",
      params: { id, name, category, brandColor, website, logo, trial: "1" },
    });
  };

  return (
    <View style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(350)}
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing[40],
            paddingBottom: insets.bottom + spacing[20],
          },
        ]}
      >
        {/* Service Title and Large Logo */}
        <ServiceHero
          name={name || "Subscription"}
          category={category || ""}
          brandColor={brandColor || colors.accent}
          website={website || undefined}
        />

        {/* Vertical Spacing Spacer */}
        <View style={styles.spacer} />

        {/* Subscription Options */}
        <View style={styles.optionsContainer}>
          <OptionCard
            title="Paid Subscription"
            description="I already pay for this."
            icon={<DollarSign size={22} color={colors.white} strokeWidth={2.5} />}
            gradient="blue"
            onPress={handleSelectPaid}
          />

          <OptionCard
            title="Free Trial"
            description="I'm currently in a trial."
            icon={<Gift size={22} color={colors.white} strokeWidth={2.5} />}
            gradient="hero"
            onPress={handleSelectTrial}
          />
        </View>

        {/* Footer cancel action */}
        <BottomCancel />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[24],
    justifyContent: "space-between",
  },
  spacer: {
    height: spacing[32],
  },
  optionsContainer: {
    flex: 1,
    justifyContent: "center",
  },
});
