import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInUp,
} from "react-native-reanimated";
import AsyncStorage from "@/utils/storage";
import * as Haptics from "expo-haptics";
import {
  CreditCard,
  Bell,
  BarChart3,
  Shield,
  ChevronRight,
} from "lucide-react-native";
import { colors, spacing, radius, hexToRGBA, gradients } from "@/constants";
import { AppText, AppButton } from "@/components/ui";
import { LinearGradient } from "expo-linear-gradient";

const ONBOARDING_COMPLETE_KEY = "@onboarding_complete";

const slides = [
  {
    icon: CreditCard,
    title: "Track Every\nSubscription",
    subtitle: "Keep all your recurring payments in one beautiful place. Never lose track of what you're paying for.",
    gradient: gradients.hero,
  },
  {
    icon: Bell,
    title: "Never Miss\nA Renewal",
    subtitle: "Get smart reminders before each renewal so you can decide whether to keep or cancel.",
    gradient: gradients.green,
  },
  {
    icon: BarChart3,
    title: "See Your\nSpending",
    subtitle: "Beautiful analytics show exactly where your money goes each month and year.",
    gradient: gradients.blue,
  },
  {
    icon: Shield,
    title: "Your Data,\nYour Device",
    subtitle: "Everything stays on your phone. No accounts, no cloud, no tracking. Just you and your data.",
    gradient: gradients.brown,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const isLastSlide = currentIndex === slides.length - 1;

  const handleNext = () => {
    Haptics.selectionAsync();
    if (isLastSlide) {
      completeOnboarding();
    } else {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({ x: nextIndex * screenWidth, animated: true });
    }
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    router.replace("/(tabs)");
  };

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const index = Math.round(contentOffset.x / screenWidth);
    if (index !== currentIndex) setCurrentIndex(index);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Skip button */}
      <View style={styles.topBar}>
        {!isLastSlide && (
          <AppButton variant="ghost" onPress={handleSkip} style={styles.skipBtn}>
            Skip
          </AppButton>
        )}
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={styles.scrollContent}
      >
        {slides.map((slide, index) => (
          <View key={index} style={[styles.slide, { width: screenWidth }]}>
            <Animated.View
              entering={FadeIn.delay(200).duration(400)}
              style={styles.slideContent}
            >
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: hexToRGBA(colors.white, 0.1) }]}>
                <LinearGradient
                  colors={slide.gradient}
                  style={styles.iconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <slide.icon size={40} color={colors.white} strokeWidth={1.5} />
                </LinearGradient>
              </View>

              {/* Text */}
              <Animated.View entering={FadeInUp.delay(400).duration(400)}>
                <AppText
                  variant="largeTitle"
                  weight="800"
                  align="center"
                  color={colors.white}
                  style={styles.title}
                >
                  {slide.title}
                </AppText>
              </Animated.View>

              <Animated.View entering={FadeInUp.delay(500).duration(400)}>
                <AppText
                  variant="body"
                  align="center"
                  color={colors.textSecondary}
                  style={styles.subtitle}
                >
                  {slide.subtitle}
                </AppText>
              </Animated.View>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + spacing[20] }]}>
        {/* Dots */}
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot,
                index === currentIndex && { backgroundColor: slides[currentIndex].gradient[0] },
              ]}
            />
          ))}
        </View>

        {/* Button */}
        <AppButton
          variant="primary"
          onPress={handleNext}
          style={styles.nextBtn}
        >
          <View style={styles.btnContent}>
            <AppText variant="body" weight="700" color={colors.white}>
              {isLastSlide ? "Get Started" : "Next"}
            </AppText>
            <ChevronRight size={18} color={colors.white} />
          </View>
        </AppButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    alignItems: "flex-end",
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
    minHeight: 52,
  },
  skipBtn: {
    minWidth: 60,
  },
  scrollContent: {
    flexGrow: 1,
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[32],
  },
  slideContent: {
    alignItems: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[32],
  },
  iconGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    lineHeight: 42,
    marginBottom: spacing[16],
  },
  subtitle: {
    lineHeight: 24,
    paddingHorizontal: spacing[8],
  },
  bottomSection: {
    paddingHorizontal: spacing[32],
    gap: spacing[24],
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing[8],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: hexToRGBA(colors.white, 0.15),
  },
  activeDot: {
    width: 24,
    borderRadius: 4,
  },
  nextBtn: {
    width: "100%",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[4],
  },
});
