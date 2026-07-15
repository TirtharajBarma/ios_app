import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Info, Calendar, ArrowRight, User, Inbox } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, spacing } from "@/constants";
import { EmptyState, AppText, LogoCircle } from "@/components/ui";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { seedDatabase } from "@/database";
import { scheduleAllReminders } from "@/utils/notifications";
import { LinearGradient } from "expo-linear-gradient";

function getRenewalStatus(dateStr: string) {
  const today = new Date();
  const renewalDate = new Date(dateStr);
  const diffTime = renewalDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { text: "Today", color: colors.danger };
  } else if (diffDays === 1) {
    return { text: "Tomorrow", color: colors.warning };
  } else if (diffDays > 1 && diffDays < 30) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return { text: `${monthNames[renewalDate.getMonth()]} ${renewalDate.getDate()}`, color: "#FFCC00" };
  } else {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return { text: `${monthNames[renewalDate.getMonth()]} ${renewalDate.getDate()}`, color: colors.textMuted };
  }
}

export default function HomeScreen() {

  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Load store state
  const { subscriptions, stats, loadSubscriptions, removeSubscription } = useSubscriptionStore();
  const [sortBy, setSortBy] = useState<"date" | "price" | "name">("date");
  const [cardPage, setCardPage] = useState(0);

  useEffect(() => {
    loadSubscriptions().then(() => {
      scheduleAllReminders(useSubscriptionStore.getState().subscriptions);
    });
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
        brandColor: sub.brandColor || "",
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
      { text: "Delete", style: "destructive", onPress: () => handleDeleteSubscription(sub.id) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSeedDatabase = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const seeded = await seedDatabase();
    if (seeded) {
      await loadSubscriptions();
      scheduleAllReminders(useSubscriptionStore.getState().subscriptions);
    }
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
      return list.sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());
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
  const nextRenewingSub = subscriptions.length > 0 ? subscriptions[0] : null;

  // Determine dynamic currency symbol based on first sub
  const currencySymbol = nextRenewingSub ? (nextRenewingSub.currency.includes("INR") || nextRenewingSub.currency.includes("₹") ? "₹" : "$") : "₹";

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["rgba(180, 50, 15, 0.8)", "rgba(0, 0, 0, 0)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.65 }}
      />
      {/* Top Header Row */}
      <View style={[styles.headerRow, { paddingTop: insets.top + spacing[12] }]}>
        <AppText variant="largeTitle" weight="800" color={colors.white}>
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
          <TouchableOpacity onPress={handleSeedDatabase} style={styles.profileBtn}>
            <User size={18} color={colors.white} />
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
            <View style={styles.statsCardsRow}>
              {/* Left Card: Monthly & Yearly Average */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.selectionAsync();
                  setCardPage((p) => (p === 0 ? 1 : 0));
                }}
                style={styles.leftStatCard}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.statLabelRow}>
                    <View style={styles.orangeDot} />
                    <AppText style={styles.statLabelText}>
                      {cardPage === 0 ? "Monthly average" : "Due this month"}
                    </AppText>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      Alert.alert(
                        cardPage === 0 ? "Monthly Average" : "Due This Month",
                        cardPage === 0
                          ? "Normalized average of your active paid subscriptions."
                          : "Total amount of subscription renewals due in the current calendar month."
                      );
                    }}
                  >
                    <Info size={12} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <AppText style={styles.largePriceText}>
                  {currencySymbol}{(cardPage === 0 ? stats.monthlyTotal : dueThisMonthTotal).toFixed(2)}
                </AppText>

                <View style={styles.cardHairline} />

                <View style={styles.cardFooter}>
                  <View style={styles.statLabelRow}>
                    <View style={styles.calendarIconBg}>
                      <Calendar size={10} color="#FF9500" />
                    </View>
                    <AppText style={styles.statLabelText}>Yearly average</AppText>
                  </View>
                  <AppText style={styles.smallPriceText}>
                    {currencySymbol}{stats.yearlyTotal.toFixed(2)}
                  </AppText>
                </View>

                {/* Orange Dot Carousels */}
                <View style={styles.dotsRow}>
                  <View style={[styles.dot, cardPage === 0 && styles.dotActive]} />
                  <View style={[styles.dot, cardPage === 1 && styles.dotActive]} />
                </View>
              </TouchableOpacity>

              {/* Right Card: Next renewing logo + active count */}
              <View style={styles.rightStatCard}>
                <View style={styles.nextRenewLogoBox}>
                  {nextRenewingSub ? (
                    <LogoCircle
                      source={nextRenewingSub.logoUrl}
                      name={nextRenewingSub.name}
                      color={nextRenewingSub.color}
                      size={44}
                      bordered
                    />
                  ) : (
                    <View style={styles.emptyLogo} />
                  )}
                </View>

                <View style={styles.activeCountRow}>
                  <AppText style={styles.massiveCountText}>
                    {stats.activeCount}
                  </AppText>
                  <AppText style={styles.activeLabelText}>
                    Active
                  </AppText>
                </View>
              </View>
            </View>

            {/* capsule Add button */}
            <TouchableOpacity onPress={handleAddPress} style={styles.addCapsuleBtn}>
              <AppText weight="700" color={colors.white} style={styles.addBtnText}>
                + Add
              </AppText>
            </TouchableOpacity>

            {/* Up Next Section */}
            <View style={styles.sectionContainer}>
              <AppText style={styles.sectionTitle}>Up next</AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
              >
                {subscriptions.slice(0, 3).map((sub) => {
                  const subStatus = getRenewalStatus(sub.nextBillingDate);
                  return (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => handleCardPress(sub)}
                      onLongPress={() => handleLongPress(sub)}
                      style={styles.upNextCard}
                    >
                      <View style={styles.upNextTop}>
                        <LogoCircle
                          source={sub.logoUrl}
                          name={sub.name}
                          color={sub.color}
                          size={40}
                          bordered
                        />
                        <View style={styles.dateBadge}>
                          <View style={[styles.badgeDot, { backgroundColor: subStatus.color }]} />
                          <AppText style={[styles.badgeText, { color: subStatus.color }]}>
                            {subStatus.text}
                          </AppText>
                        </View>
                      </View>
                      <AppText style={styles.upNextTitle} numberOfLines={1}>
                        {sub.name}
                      </AppText>
                      <AppText style={styles.upNextSubtitle} numberOfLines={1}>
                        {sub.isTrial ? "Trial" : "Monthly"} for {currencySymbol}{sub.price.toFixed(2)}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Subscriptions Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.subscriptionsHeader}>
                <TouchableOpacity onPress={() => console.log("Header pressed")} style={styles.titleChevronRow}>
                  <AppText style={styles.sectionTitle}>Subscriptions</AppText>
                  <ArrowRight size={16} color={colors.white} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleSort} style={styles.sortToggle}>
                  <AppText style={styles.sortText}>
                    {getSortLabel()}
                  </AppText>
                </TouchableOpacity>
              </View>

              {/* Single Grouped List Container */}
              <View style={styles.groupedListContainer}>
                {sortedSubscriptions.map((sub, idx) => {
                  const subStatus = getRenewalStatus(sub.nextBillingDate);
                  const isLast = idx === sortedSubscriptions.length - 1;

                  return (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => handleCardPress(sub)}
                      onLongPress={() => handleLongPress(sub)}
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
                        />
                        <View style={styles.listItemTextContainer}>
                          <AppText style={styles.listItemTitle} numberOfLines={1}>
                            {sub.name}
                          </AppText>
                          <AppText style={styles.listItemSubtitle} numberOfLines={1}>
                            {sub.isTrial ? `Trial ends on ${subStatus.text}` : `Starts on ${subStatus.text}`}
                          </AppText>
                        </View>
                      </View>
                      
                      <View style={styles.listItemRight}>
                        <AppText style={styles.listItemPrice}>
                          {sub.isTrial ? "Free" : `${currencySymbol}${sub.price.toFixed(2)}`}
                        </AppText>
                        <AppText style={styles.listItemCycle}>
                          {sub.isTrial ? "Trial" : sub.billingCycle.charAt(0).toUpperCase() + sub.billingCycle.slice(1)} {sub.isTrial ? "" : "🔁"}
                        </AppText>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderTopColor: colors.accent,
    borderLeftColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.white,
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
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
    height: 154,
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 20,
    padding: 14,
    justifyContent: "space-between",
  },
  rightStatCard: {
    flex: 1,
    height: 154,
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 20,
    padding: 14,
    alignItems: "center",
    justifyContent: "space-between",
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF9500",
  },
  statLabelText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  largePriceText: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: colors.white,
    marginTop: spacing[4],
  },
  cardHairline: {
    height: 0.5,
    backgroundColor: "#2C2C2E",
    marginVertical: spacing[4],
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calendarIconBg: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: "rgba(255, 149, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  smallPriceText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 4,
    alignSelf: "flex-end",
    marginTop: spacing[2],
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  dotActive: {
    backgroundColor: "#FF9500",
  },
  nextRenewLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  activeCountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginBottom: spacing[2],
  },
  massiveCountText: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.white,
    lineHeight: 38,
  },
  activeLabelText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
    marginBottom: 4,
  },
  addCapsuleBtn: {
    height: 48,
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing[8],
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionContainer: {
    marginTop: spacing[12],
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.white,
  },
  horizontalScrollContent: {
    paddingVertical: spacing[8],
    gap: spacing[12],
  },
  upNextCard: {
    width: 172,
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 18,
    padding: spacing[12],
    gap: 10,
  },
  upNextTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 204, 0, 0.08)",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderRadius: 999,
    gap: 4,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  upNextTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
  upNextSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
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
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  groupedListContainer: {
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 20,
    paddingHorizontal: 14,
  },
  listItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  listItemBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#2C2C2E",
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
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
  listItemSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  listItemRight: {
    alignItems: "flex-end",
    marginLeft: spacing[12],
  },
  listItemPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
  listItemCycle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
