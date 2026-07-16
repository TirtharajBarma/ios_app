import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { differenceInCalendarDays, parseISO, startOfDay, format } from "date-fns";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Info, Calendar, User, Inbox, Repeat } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp, useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

import { colors, spacing, getCurrencySymbol } from "@/constants";
import {
  EmptyState,
  AppText,
  LogoCircle,
  PressableScale,
} from "@/components/ui";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
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
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Load store state
  const { subscriptions, stats, loadSubscriptions, removeSubscription } =
    useSubscriptionStore();
  const [sortBy, setSortBy] = useState<"date" | "price" | "name">("date");
  const [cardPage, setCardPage] = useState(0);
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
  }, [loadSubscriptions]);

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
      return list.sort((a, b) => b.price - a.price);
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
      .reduce((sum, sub) => sum + sub.price, 0);
  }, [subscriptions]);

  const hasSubscriptions = subscriptions.length > 0;
  // Prefer a paid subscription for the stat card, fall back to any subscription
  const nextRenewingSub =
    subscriptions.find((s) => !s.isTrial) ||
    (subscriptions.length > 0 ? subscriptions[0] : null);

  // Determine dynamic currency symbol from first subscription
  const currencySymbol = nextRenewingSub
    ? getCurrencySymbol(nextRenewingSub.currency)
    : "$";

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
          <View style={styles.profileBtn}>
            <User size={18} color={colors.white} />
          </View>
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
              {/* Left Card: Monthly & Yearly Average */}
              <PressableScale
                onPress={() => {
                  Haptics.selectionAsync();
                  setCardPage((p) => (p === 0 ? 1 : 0));
                }}
                style={styles.leftStatCard}
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
                            <Calendar size={14} color="#FF5A00" strokeWidth={2.5} />
                          </View>
                          <AppText style={styles.statLabelText}>
                            Monthly average
                          </AppText>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            Haptics.selectionAsync();
                            Alert.alert(
                              "Monthly Average",
                              "Normalized average of all your active paid subscriptions.",
                            );
                          }}
                          style={styles.infoButton}
                        >
                          <Info size={15} color="rgba(255,255,255,0.72)" />
                        </TouchableOpacity>
                      </View>

                      <AppText style={styles.largePriceText} numberOfLines={1} adjustsFontSizeToFit>
                        {currencySymbol}
                        {stats.monthlyTotal.toFixed(2)}
                      </AppText>
                    </View>

                    {/* 2. Divider line with explicit gap above & below */}
                    <View style={styles.cardHairline} />

                    {/* 3. Lower Part */}
                    <View style={styles.cardFooterContainer}>
                      {/* Page 0: Next due / Due this month */}
                      <Animated.View style={[styles.cardFooterStacked, page0Style]}>
                        <View style={styles.statLabelRow}>
                          <View style={styles.calendarIconBg}>
                            <Calendar size={14} color="#FF9500" strokeWidth={2.4} />
                          </View>
                          <AppText style={styles.statLabelText} numberOfLines={1} ellipsizeMode="tail">
                            {subscriptions.length === 1 ? "Next due" : "Due this month"}
                          </AppText>
                        </View>
                        <AppText style={styles.footerValueText} numberOfLines={1}>
                          {subscriptions.length === 1
                            ? (nextRenewingSub ? `${currencySymbol}${nextRenewingSub.price.toFixed(2)}` : "-")
                            : `${currencySymbol}${dueThisMonthTotal.toFixed(2)}`}
                        </AppText>
                      </Animated.View>

                      {/* Page 1: Yearly average */}
                      <Animated.View style={[styles.cardFooterStacked, page1Style]}>
                        <View style={styles.statLabelRow}>
                          <View style={styles.calendarIconBg}>
                            <Calendar size={14} color="#FF9500" strokeWidth={2.4} />
                          </View>
                          <AppText style={styles.statLabelText} numberOfLines={1} ellipsizeMode="tail">
                            Yearly average
                          </AppText>
                        </View>
                        <AppText style={styles.footerValueText} numberOfLines={1}>
                          {currencySymbol}{stats.yearlyTotal.toFixed(2)}
                        </AppText>
                      </Animated.View>
                    </View>

                    {/* Animated Dot Carousel */}
                    <View style={styles.dotsRow}>
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
                  <View style={styles.nextRenewLogoBox}>
                    {nextRenewingSub ? (
                      <LogoCircle
                        source={nextRenewingSub.logoUrl}
                        name={nextRenewingSub.name}
                        color={nextRenewingSub.color}
                        size={56}
                        bordered
                        website={nextRenewingSub.website}
                      />
                    ) : (
                      <View style={styles.emptyLogo} />
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
                          `${sub.color}33`,
                          "rgba(31, 31, 33, 0.98)",
                          "rgba(20, 20, 22, 1)",
                        ]}
                        locations={[0, 0.48, 1]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.upNextGradientFill}
                      >
                        <View style={styles.upNextTop}>
                          <LogoCircle
                            source={sub.logoUrl}
                            name={sub.name}
                            color={sub.color}
                            size={54}
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
                          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                            {!sub.isTrial && (
                              <Repeat size={11} color={colors.textMuted} style={{ marginRight: 4 }} />
                            )}
                            <AppText
                              style={[styles.upNextSubtitle, { marginTop: 0 }]}
                              numberOfLines={1}
                            >
                              {sub.isTrial
                                ? "Free trial"
                                : `${formatCycleLabel(sub.rawBillingCycle, sub.billingCycle)} for ${currencySymbol}${sub.price.toFixed(2)}`}
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
                <View style={styles.titleChevronRow}>
                  <AppText style={styles.sectionTitle}>Subscriptions</AppText>
                </View>
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
                            : `${currencySymbol}${sub.price.toFixed(2)}`}
                        </AppText>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 2 }}>
                          <AppText style={[styles.listItemCycle, { marginTop: 0 }]}>
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
  nextRenewLogoBox: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[4],
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
  sectionContainer: {
  },
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
    width: 192,
    height: 138,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
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
    padding: 14,
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
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    color: colors.white,
  },
  upNextSubtitle: {
    fontSize: 13,
    lineHeight: 17,
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
