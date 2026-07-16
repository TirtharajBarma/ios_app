import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  differenceInCalendarDays,
  parseISO,
  startOfDay,
  format,
} from "date-fns";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Info,
  Calendar,
  User,
  Inbox,
  Repeat,
  ChevronRight,
  Users,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  cancelAnimation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { colors, spacing, getCurrencySymbol } from "@/constants";
import {
  EmptyState,
  AppText,
  LogoCircle,
  PressableScale,
  OverviewExplanationSheet,
  ExplanationType,
} from "@/components/ui";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { getSubscriptionActivePrice, toMonthly } from "@/utils/date";
import { LinearGradient } from "expo-linear-gradient";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatCycleLabel(
  rawBillingCycle?: string,
  billingCycle?: string,
): string {
  const cycle = rawBillingCycle || billingCycle || "monthly";
  if (cycle.startsWith("custom:")) {
    const parts = cycle.split(":");
    const val = parts[1] || "1";
    const unit = parts[2] || "months";
    return `Every ${val} ${unit.charAt(0).toUpperCase() + unit.slice(1)}`;
  }
  return cycle.charAt(0).toUpperCase() + cycle.slice(1);
}

function getRenewalStatus(dateStr: string) {
  try {
    const today = startOfDay(new Date());
    const renewalDate = startOfDay(parseISO(dateStr));
    const diffDays = differenceInCalendarDays(renewalDate, today);

    if (diffDays < 0) {
      return { text: "Overdue", color: colors.danger };
    } else if (diffDays === 0) {
      return { text: "Today", color: colors.danger };
    } else if (diffDays === 1) {
      return { text: "Tomorrow", color: colors.warning };
    } else if (diffDays > 1 && diffDays < 30) {
      return {
        text: `${MONTH_NAMES[renewalDate.getMonth()]} ${renewalDate.getDate()}`,
        color: colors.warning,
      };
    } else {
      return {
        text: `${MONTH_NAMES[renewalDate.getMonth()]} ${renewalDate.getDate()}`,
        color: colors.textMuted,
      };
    }
  } catch {
    return { text: "-", color: colors.textMuted };
  }
}

function FloatingActiveLogo({
  sub,
  index,
  total,
  onPress,
}: {
  sub: any;
  index: number;
  total: number;
  onPress: () => void;
}) {
  const float = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const wasDragged = useSharedValue(false);

  const configsByTotal = {
    1: [{ size: 40, style: styles.activeLogoSolo }],
    2: [
      { size: 36, style: styles.activeLogoTwoMain },
      { size: 28, style: styles.activeLogoTwoTop },
    ],
    3: [
      { size: 34, style: styles.activeLogoThreeMain },
      { size: 28, style: styles.activeLogoThreeLeft },
      { size: 24, style: styles.activeLogoThreeTop },
    ],
    4: [
      { size: 32, style: styles.activeLogoFourMain },
      { size: 26, style: styles.activeLogoFourLeft },
      { size: 24, style: styles.activeLogoFourTop },
      { size: 22, style: styles.activeLogoFourRight },
    ],
  };
  const configs =
    configsByTotal[Math.min(total, 4) as keyof typeof configsByTotal];
  const config = configs[index] || configs[configs.length - 1];

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 + index * 100 }),
        withTiming(0, { duration: 800 + index * 100 }),
      ),
      -1,
      true,
    );
  }, [float, index]);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      wasDragged.value = false;
      cancelAnimation(float);
      float.value = 0.5;
      scale.value = withSpring(1.3, { damping: 12, stiffness: 200 });
    })
    .onUpdate((e) => {
      wasDragged.value = true;
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      rotate.value = e.translationX * 0.15;
    })
    .onEnd((e) => {
      translateX.value = withSpring(0, { damping: 14, stiffness: 120 });
      translateY.value = withSpring(0, { damping: 14, stiffness: 120 });
      rotate.value = withSpring(0, { damping: 14, stiffness: 120 });
      scale.value = withSpring(1, { damping: 14, stiffness: 150 });
      float.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 + index * 100 }),
          withTiming(0, { duration: 800 + index * 100 }),
        ),
        -1,
        true,
      );
    })
    .onFinalize(() => {
      if (!wasDragged.value) {
        scale.value = withSequence(
          withSpring(1.4, { damping: 10, stiffness: 300 }),
          withSpring(1, { damping: 12, stiffness: 150 }),
        );
        rotate.value = withSequence(
          withSpring(8, { damping: 10, stiffness: 200 }),
          withSpring(-5, { damping: 10, stiffness: 200 }),
          withSpring(0, { damping: 12, stiffness: 150 }),
        );
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      if (!wasDragged.value) {
        onPress();
      }
    });

  const composed = Gesture.Simultaneous(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + (float.value - 0.5) * (4 + index) },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value * (0.98 + float.value * 0.04) },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.activeLogoBubble, config.style, animatedStyle]}>
        <LogoCircle
          source={sub.logoUrl}
          name={sub.name}
          color={sub.color}
          size={config.size}
          bordered
          website={sub.website}
        />
      </Animated.View>
    </GestureDetector>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Load store state
  const { subscriptions, stats, loadSubscriptions, removeSubscription } =
    useSubscriptionStore();
  const [sortBy, setSortBy] = useState<"date" | "price" | "name">("date");
  const [cardPage, setCardPage] = useState(0);
  const [explanationType, setExplanationType] = useState<ExplanationType | null>(null);
  const footerProgress = useSharedValue(0);

  useEffect(() => {
    footerProgress.value = withTiming(cardPage, { duration: 250 });
  }, [cardPage]);

  const page0Style = useAnimatedStyle(() => {
    return {
      opacity: 1 - footerProgress.value,
      transform: [{ translateY: footerProgress.value * -12 }],
      pointerEvents: footerProgress.value > 0.5 ? "none" : "auto",
    };
  });

  const page1Style = useAnimatedStyle(() => {
    return {
      opacity: footerProgress.value,
      transform: [{ translateY: (1 - footerProgress.value) * 12 }],
      pointerEvents: footerProgress.value < 0.5 ? "none" : "auto",
    };
  });

  useEffect(() => {
    loadSubscriptions();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadSubscriptions();
    }, [loadSubscriptions])
  );

  const handleAddPress = () => {
    Haptics.selectionAsync();
    router.push("/add/search");
  };

  const handleCardPress = (sub: any) => {
    Haptics.selectionAsync();
    router.push(`/subscription/${sub.id}`);
  };

  const handleEditSubscription = (sub: any) => {
    Haptics.selectionAsync();
    router.push({
      pathname: "/add/paid",
      params: {
        editId: sub.id,
        id: sub.id,
        name: sub.name,
        category: sub.category,
        brandColor: sub.color || "",
        website: sub.website || "",
        logo: sub.logoUrl || "",
      },
    });
  };

  const handleDeleteSubscription = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await removeSubscription(id);
    } catch (error) {
      console.error("Failed to delete subscription:", error);
    }
  };

  const handleLongPress = (sub: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(sub.name, "Choose an action", [
      { text: "View Details", onPress: () => handleCardPress(sub) },
      { text: "Edit", onPress: () => handleEditSubscription(sub) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => handleDeleteSubscription(sub.id),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const toggleSort = () => {
    Haptics.selectionAsync();
    setSortBy((current) => {
      if (current === "date") return "price";
      if (current === "price") return "name";
      return "date";
    });
  };

  const getSortLabel = () => {
    if (sortBy === "price") return "Price ⇅";
    if (sortBy === "name") return "Name ⇅";
    return "Renewal ⇅";
  };

  const sortedSubscriptions = React.useMemo(() => {
    const list = [...subscriptions];
    if (sortBy === "price") {
      return list.sort((a, b) => getSubscriptionActivePrice(b) - getSubscriptionActivePrice(a));
    } else if (sortBy === "name") {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // date
      return list.sort(
        (a, b) =>
          new Date(a.nextBillingDate).getTime() -
          new Date(b.nextBillingDate).getTime(),
      );
    }
  }, [subscriptions, sortBy]);

  const dueThisMonthTotal = React.useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return subscriptions
      .filter((sub) => {
        if (sub.isTrial) return false;
        const d = new Date(sub.nextBillingDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, sub) => sum + getSubscriptionActivePrice(sub), 0);
  }, [subscriptions]);

  const hasSubscriptions = subscriptions.length > 0;
  // Prefer a paid subscription for the stat card, fall back to any subscription
  const nextRenewingSub =
    subscriptions.find((s) => !s.isTrial) ||
    (subscriptions.length > 0 ? subscriptions[0] : null);
  const activeSubscriptions = React.useMemo(
    () => subscriptions.filter((sub) => !sub.isTrial),
    [subscriptions],
  );
  const activeLogoSubs = activeSubscriptions.slice(0, 4);
  const activeOverflowCount = Math.max(
    activeSubscriptions.length - activeLogoSubs.length,
    0,
  );

  // Global currency from settings
  const { currencyCode, userName } = useSettingsStore();
  const currencySymbol = getCurrencySymbol(currencyCode);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["rgba(180, 50, 15, 0.8)", "rgba(0, 0, 0, 0)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.65 }}
      />
      {/* Top Header Row */}
      <View
        style={[styles.headerRow, { paddingTop: insets.top + spacing[12] }]}
      >
        <AppText
          variant="largeTitle"
          weight="800"
          color={colors.white}
          style={styles.headerTitle}
        >
          Overview
        </AppText>
        <View style={styles.headerRight}>
          {/* 2/6 Progress Circle */}
          <View style={styles.progressCircle}>
            <AppText style={styles.progressText}>
              {stats.activeCount}/{subscriptions.length}
            </AppText>
          </View>
          {/* Profile Button */}
          <TouchableOpacity
            style={styles.profileBtn}
            activeOpacity={0.75}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/settings");
            }}
          >
            {userName ? (
              <AppText style={styles.profileInitials}>
                {userName.trim().split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
              </AppText>
            ) : (
              <User size={18} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[40] },
        ]}
      >
        {!hasSubscriptions ? (
          <EmptyState
            icon={<Inbox size={32} color={colors.textSecondary} />}
            title="No subscriptions yet"
            subtitle="Get started by tracking your first subscription cost and renewal date."
            actionLabel="Add your first subscription"
            onAction={handleAddPress}
            style={styles.emptyState}
          />
        ) : (
          <View style={styles.content}>
            {/* Top Stat Cards Grid */}
            <Animated.View
              entering={FadeInUp.delay(0).springify().damping(18)}
              style={styles.statsCardsRow}
            >
              <View style={{ flex: 1.6, position: "relative" }}>
                <PressableScale
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCardPage((p) => (p === 0 ? 1 : 0));
                  }}
                  style={[styles.leftStatCard, { flex: undefined, width: "100%" }]}
                >
                <LinearGradient
                  colors={[
                    "rgba(97, 49, 35, 0.94)",
                    "rgba(44, 31, 28, 0.96)",
                    "rgba(24, 24, 26, 0.98)",
                  ]}
                  locations={[0, 0.52, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGradientFill}
                >
                  <View style={{ flex: 1 }}>
                    {/* 1. Upper Part */}
                    <View style={{ gap: 4 }}>
                      <View style={styles.cardHeader}>
                        <View style={styles.statLabelRow}>
                          <View style={styles.statIconBox}>
                            <Calendar
                              size={14}
                              color="#FF5A00"
                              strokeWidth={2.5}
                            />
                          </View>
                          <AppText style={styles.statLabelText}>
                            Monthly average
                          </AppText>
                        </View>
                      </View>

                      <AppText
                        style={styles.largePriceText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {currencySymbol}
                        {stats.monthlyTotal.toFixed(2)}
                      </AppText>
                    </View>

                    {/* 2. Divider line with explicit gap above & below */}
                    <View style={styles.cardHairline} />

                    {/* 3. Lower Part */}
                    <View style={styles.cardFooterContainer}>
                      {/* Page 0: Next due / Due this month */}
                      <Animated.View
                        style={[styles.cardFooterStacked, page0Style]}
                      >
                        <View style={styles.statLabelRow}>
                          <View style={styles.calendarIconBg}>
                            <Calendar
                              size={14}
                              color="#FF9500"
                              strokeWidth={2.4}
                            />
                          </View>
                          <AppText
                            style={styles.statLabelText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {subscriptions.length === 1
                              ? "Next due"
                              : "Due this month"}
                          </AppText>
                        </View>
                        <AppText
                          style={styles.footerValueText}
                          numberOfLines={1}
                        >
                          {subscriptions.length === 1
                            ? nextRenewingSub
                              ? `${currencySymbol}${getSubscriptionActivePrice(nextRenewingSub).toFixed(2)}`
                              : "-"
                            : `${currencySymbol}${dueThisMonthTotal.toFixed(2)}`}
                        </AppText>
                      </Animated.View>

                      {/* Page 1: Yearly average */}
                      <Animated.View
                        style={[styles.cardFooterStacked, page1Style]}
                      >
                        <View style={styles.statLabelRow}>
                          <View style={styles.calendarIconBg}>
                            <Calendar
                              size={14}
                              color="#FF9500"
                              strokeWidth={2.4}
                            />
                          </View>
                          <AppText
                            style={styles.statLabelText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            Estimated Annual Cost
                          </AppText>
                        </View>
                        <AppText
                          style={styles.footerValueText}
                          numberOfLines={1}
                        >
                          {currencySymbol}
                          {stats.yearlyTotal.toFixed(2)}
                        </AppText>
                      </Animated.View>
                    </View>

                    {/* Animated Dot Carousel */}
                    <View style={[styles.dotsRow, { alignSelf: "flex-start", marginTop: 12 }]}>
                      <View
                        style={[styles.dot, cardPage === 0 && styles.dotActive]}
                      />
                      <View
                        style={[styles.dot, cardPage === 1 && styles.dotActive]}
                      />
                    </View>
                  </View>
                </LinearGradient>
              </PressableScale>

              {/* Absolute Info Button outside PressableScale so it ACTUALLY works */}
              {cardPage === 1 && (
                <TouchableOpacity
                  activeOpacity={0.6}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setExplanationType("annual");
                  }}
                  style={[
                    styles.infoButton,
                    { position: "absolute", bottom: 16, right: 16, zIndex: 100 }
                  ]}
                >
                  <Info size={15} color="rgba(255,255,255,0.72)" />
                </TouchableOpacity>
              )}
            </View>

              {/* Right Card: Next renewing logo + active count */}
              <PressableScale
                onPress={() => {
                  if (nextRenewingSub) {
                    Haptics.selectionAsync();
                    router.push(`/subscription/${nextRenewingSub.id}`);
                  }
                }}
                style={styles.rightStatCard}
              >
                <LinearGradient
                  colors={[
                    "rgba(91, 48, 37, 0.84)",
                    "rgba(37, 29, 28, 0.96)",
                    "rgba(23, 23, 25, 0.98)",
                  ]}
                  locations={[0, 0.58, 1]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.cardGradientFill, styles.rightStatInner]}
                >
                  <View style={styles.activeLogoCluster}>
                    {activeLogoSubs.length > 0 ? (
                      activeLogoSubs.map((sub, index) => (
                        <FloatingActiveLogo
                          key={sub.id}
                          sub={sub}
                          index={index}
                          total={activeLogoSubs.length}
                          onPress={() => handleCardPress(sub)}
                        />
                      ))
                    ) : (
                      <View style={styles.emptyLogo} />
                    )}
                    {activeOverflowCount > 0 && (
                      <View style={styles.activeOverflowBadge}>
                        <AppText style={styles.activeOverflowText}>
                          +{activeOverflowCount}
                        </AppText>
                      </View>
                    )}
                  </View>

                  <View style={styles.activeCountRow}>
                    <AppText style={styles.massiveCountText}>
                      {stats.activeCount}
                    </AppText>
                    <AppText style={styles.activeLabelText}>Active</AppText>
                  </View>
                </LinearGradient>
              </PressableScale>
            </Animated.View>

            {/* capsule Add button */}
            <Animated.View
              entering={FadeInUp.delay(60).springify().damping(18)}
            >
              <PressableScale
                onPress={handleAddPress}
                scale={0.97}
                style={styles.addCapsuleBtn}
              >
                <AppText
                  weight="700"
                  color={colors.white}
                  style={styles.addBtnText}
                >
                  + Add
                </AppText>
              </PressableScale>
            </Animated.View>

            {/* Up Next Section */}
            <Animated.View
              entering={FadeInUp.delay(120).springify().damping(18)}
              style={styles.sectionContainer}
            >
              <AppText style={styles.sectionTitle}>Up next</AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {subscriptions.slice(0, 3).map((sub) => {
                  const subStatus = getRenewalStatus(sub.nextBillingDate);
                  return (
                    <PressableScale
                      key={sub.id}
                      onPress={() => handleCardPress(sub)}
                      onLongPress={() => handleLongPress(sub)}
                      scale={0.96}
                      style={styles.upNextCard}
                    >
                      <LinearGradient
                        colors={[
                          "rgba(62, 62, 64, 0.9)",
                          "rgba(31, 31, 33, 0.98)",
                          "rgba(18, 18, 20, 1)",
                          "rgba(13, 13, 15, 1)",
                        ]}
                        locations={[0, 0.34, 0.72, 1]}
                        start={{ x: 0.05, y: 0 }}
                        end={{ x: 0.9, y: 1 }}
                        style={styles.upNextGradientFill}
                      >
                        <View style={styles.upNextTop}>
                          <LogoCircle
                            source={sub.logoUrl}
                            name={sub.name}
                            color={sub.color}
                            size={44}
                            bordered
                            website={sub.website}
                          />
                          <View style={styles.dateBadge}>
                            <View
                              style={[
                                styles.badgeDot,
                                { backgroundColor: subStatus.color },
                              ]}
                            />
                            <AppText
                              style={[
                                styles.badgeText,
                                { color: colors.white },
                              ]}
                            >
                              {format(parseISO(sub.nextBillingDate), "MMM d")}
                            </AppText>
                          </View>
                        </View>
                        <View>
                          <AppText style={styles.upNextTitle} numberOfLines={1}>
                            {sub.name}
                          </AppText>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginTop: 6,
                              gap: 4,
                            }}
                          >
                            {!sub.isTrial && (
                              <Repeat size={11} color={colors.textMuted} />
                            )}
                            {sub.splitEnabled && (
                              <Users size={11} color={colors.accent} />
                            )}
                            <AppText
                              style={[styles.upNextSubtitle, { marginTop: 0 }]}
                              numberOfLines={1}
                            >
                              {sub.isTrial
                                ? "Free trial"
                                : `${formatCycleLabel(sub.rawBillingCycle, sub.billingCycle)} for ${currencySymbol}${getSubscriptionActivePrice(sub).toFixed(2)}`}
                            </AppText>
                          </View>
                        </View>
                      </LinearGradient>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </Animated.View>

            {/* Subscriptions Section */}
            <Animated.View
              entering={FadeInUp.delay(180).springify().damping(18)}
              style={styles.sectionContainer}
            >
              <View style={styles.subscriptionsHeader}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push("/subscriptions");
                  }}
                  style={styles.titleChevronRow}
                >
                  <AppText style={styles.sectionTitle}>Subscriptions</AppText>
                  <ChevronRight
                    size={22}
                    color="rgba(255, 255, 255, 0.4)"
                    style={{ marginLeft: 6, marginTop: 4 }}
                  />
                </TouchableOpacity>
                <PressableScale
                  onPress={toggleSort}
                  scale={0.95}
                  style={styles.sortToggle}
                >
                  <AppText style={styles.sortText}>{getSortLabel()}</AppText>
                </PressableScale>
              </View>

              {/* Single Grouped List Container */}
              <LinearGradient
                colors={["rgba(35, 35, 37, 0.98)", "rgba(22, 22, 24, 1)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.groupedListContainer}
              >
                {sortedSubscriptions.map((sub, idx) => {
                  const subStatus = getRenewalStatus(sub.nextBillingDate);
                  const isLast = idx === sortedSubscriptions.length - 1;

                  return (
                    <PressableScale
                      key={sub.id}
                      onPress={() => handleCardPress(sub)}
                      onLongPress={() => handleLongPress(sub)}
                      scale={0.98}
                      style={[
                        styles.listItemRow,
                        !isLast && styles.listItemBorder,
                      ]}
                    >
                      <View style={styles.listItemLeft}>
                        <LogoCircle
                          source={sub.logoUrl}
                          name={sub.name}
                          color={sub.color}
                          size={40}
                          bordered
                          website={sub.website}
                        />
                        <View style={styles.listItemTextContainer}>
                          <AppText
                            style={styles.listItemTitle}
                            numberOfLines={1}
                          >
                            {sub.name}
                          </AppText>
                          <AppText
                            style={styles.listItemSubtitle}
                            numberOfLines={1}
                          >
                            {sub.isTrial
                              ? `Trial ends on ${subStatus.text}`
                              : `Renews on ${subStatus.text}`}
                          </AppText>
                        </View>
                      </View>

                      <View style={styles.listItemRight}>
                        <AppText style={styles.listItemPrice}>
                          {sub.isTrial
                            ? "Free"
                            : `${currencySymbol}${getSubscriptionActivePrice(sub).toFixed(2)}`}
                        </AppText>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 3,
                            marginTop: 2,
                          }}
                        >
                          {sub.splitEnabled && (
                            <Users
                              size={11}
                              color={colors.accent}
                              style={{ marginRight: 2 }}
                            />
                          )}
                          <AppText
                            style={[styles.listItemCycle, { marginTop: 0 }]}
                          >
                            {sub.isTrial
                              ? "Trial"
                              : formatCycleLabel(
                                  sub.rawBillingCycle,
                                  sub.billingCycle,
                                )}
                          </AppText>
                          {!sub.isTrial && (
                            <Repeat size={11} color={colors.textMuted} />
                          )}
                        </View>
                      </View>
                    </PressableScale>
                  );
                })}
              </LinearGradient>
            </Animated.View>
          </View>
        )}
      </ScrollView>

      <OverviewExplanationSheet
        visible={explanationType !== null}
        onClose={() => setExplanationType(null)}
        type={explanationType}
        currencySymbol={currencySymbol}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: 0,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderTopColor: colors.accent,
    borderLeftColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
  profileBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255, 255, 255, 0.11)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing[12],
  },
  profileInitials: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: spacing[16],
  },
  content: {
    gap: spacing[16],
    marginTop: spacing[16],
  },
  emptyState: {
    marginTop: spacing[40],
  },
  statsCardsRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  leftStatCard: {
    flex: 1.6,
    height: 178,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.36,
    shadowRadius: 22,
    elevation: 10,
  },
  rightStatCard: {
    flex: 1,
    height: 178,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.36,
    shadowRadius: 22,
    elevation: 10,
  },
  cardGradientFill: {
    flex: 1,
    padding: 14,
    justifyContent: "space-between",
  },
  rightStatInner: {
    alignItems: "center",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orangeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF9500",
  },
  statIconBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: "rgba(255, 90, 0, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.11)",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabelText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.58)",
    letterSpacing: 0,
    flexShrink: 1,
  },
  largePriceText: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: 0,
  },
  cardHairline: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing[8],
  },
  calendarIconBg: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: "rgba(255, 149, 0, 0.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  smallPriceText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.white,
    flexShrink: 0,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 4,
    alignSelf: "flex-end",
    marginTop: spacing[2],
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  dotActive: {
    backgroundColor: "#FF9500",
  },
  activeLogoCluster: {
    width: "100%",
    height: 70,
    position: "relative",
    marginTop: spacing[4],
  },
  activeLogoBubble: {
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  activeLogoSolo: { left: 41, top: 14, zIndex: 4 },
  activeLogoTwoMain: { right: 20, top: 24, zIndex: 4 },
  activeLogoTwoTop: { left: 24, top: 8, zIndex: 3 },
  activeLogoThreeMain: { left: 48, top: 26, zIndex: 4 },
  activeLogoThreeLeft: { left: 22, top: 16, zIndex: 3 },
  activeLogoThreeTop: { right: 28, top: 6, zIndex: 2 },
  activeLogoFourMain: { left: 50, top: 28, zIndex: 4 },
  activeLogoFourLeft: { left: 18, top: 20, zIndex: 3 },
  activeLogoFourTop: { left: 54, top: 4, zIndex: 2 },
  activeLogoFourRight: { right: 18, top: 18, zIndex: 1 },
  activeOverflowBadge: {
    position: "absolute",
    right: 8,
    top: 4,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 7,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeOverflowText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    color: colors.white,
  },
  emptyLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  activeCountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginBottom: spacing[4],
  },
  massiveCountText: {
    fontSize: 38,
    fontWeight: "800",
    color: colors.white,
    lineHeight: 42,
  },
  activeLabelText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
    fontWeight: "700",
    marginBottom: 7,
  },
  addCapsuleBtn: {
    height: 50,
    backgroundColor: "#151517",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing[4],
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  addBtnText: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
  },
  sectionContainer: {},
  sectionTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
    color: colors.white,
  },
  horizontalScrollContent: {
    paddingVertical: spacing[8],
    gap: spacing[12],
  },
  upNextCard: {
    width: 184,
    height: 128,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.095)",
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 9,
  },
  upNextGradientFill: {
    flex: 1,
    padding: 13,
    justifyContent: "space-between",
  },
  upNextTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  upNextTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.white,
  },
  upNextSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    fontWeight: "600",
    marginTop: 6,
  },
  subscriptionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  titleChevronRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sortToggle: {
    paddingHorizontal: 10,
    paddingVertical: spacing[4],
  },
  sortText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.textMuted,
    fontWeight: "600",
  },
  groupedListContainer: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 24,
    paddingHorizontal: spacing[16],
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 10,
  },
  listItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[16],
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  listItemTextContainer: {
    marginLeft: spacing[12],
    flex: 1,
  },
  listItemTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.white,
  },
  listItemSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  listItemRight: {
    alignItems: "flex-end",
    marginLeft: spacing[12],
  },
  listItemPrice: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.white,
  },
  listItemCycle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardFooterContainer: {
    height: 38,
    position: "relative",
    justifyContent: "center",
  },
  cardFooterStacked: {
    width: "100%",
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    gap: 2,
  },
  footerValueText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.white,
    marginLeft: 26,
    marginTop: 1,
  },
});
