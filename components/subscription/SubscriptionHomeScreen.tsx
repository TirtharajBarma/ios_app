import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  differenceInCalendarDays,
  parseISO,
  startOfDay,
  format,
  differenceInCalendarMonths,
} from "date-fns";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Info,
  Calendar,
  User,
  Inbox,
  Repeat,
  ChevronRight,
  ChevronDown,
  Users,
  Plus,
  PiggyBank,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInUp,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { colors, spacing, radius, getCurrencySymbol, textStyleFor, hexToRGBA } from "@/constants";
import {
  EmptyState,
  AppText,
  SubscriptionLogo,
  PressableScale,
  OverviewExplanationSheet,
  ExplanationType,
  Loading,
  SavingsBottomSheet,
} from "@/components/ui";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { getSubscriptionActivePrice, toMonthly } from "@/utils/date";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

export default function SubscriptionHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { subscriptions, stats, loadSubscriptions, removeSubscription, isLoaded, vault } =
    useSubscriptionStore();
  const [sortBy, setSortBy] = useState<"date" | "price" | "name">("date");
  const [showOnlyShared, setShowOnlyShared] = useState(false);
  const [cardPage, setCardPage] = useState(0);
  const [showSavingsSheet, setShowSavingsSheet] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadSubscriptions();
    }, [loadSubscriptions])
  );

  const handleAddPress = () => {
    Haptics.selectionAsync();
    router.push("/add/search");
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <AppText variant="largeTitle" weight="800" color={colors.white}>
          Subscriptions Overview
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111113",
  },
});
