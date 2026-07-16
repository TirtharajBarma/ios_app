import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Calendar,
  Folder,
  Bell,
  FileText,
  ChevronLeft,
  Trash2,
  Users,
  Percent,
} from "lucide-react-native";
import { format, parseISO } from "date-fns";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { colors, spacing, getCurrencySymbol } from "@/constants";
import { AppText, LogoCircle, Toggle, PressableScale } from "@/components/ui";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { getSubscriptionActivePrice } from "@/utils/date";

export default function SubscriptionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Fetch subscription from Zustand store
  const { subscriptions, isLoaded, removeSubscription, updateSubscription } = useSubscriptionStore();
  const subscription = subscriptions.find((s) => s.id === id);

  if (!isLoaded || !subscription) {
    return (
      <View style={styles.errorContainer}>
        <AppText variant="headline" color={colors.textSecondary}>
          {!isLoaded ? "Loading..." : "Subscription not found"}
        </AppText>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <AppText color={colors.white} weight="700">Go Back</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  const {
    name,
    price,
    currency,
    billingCycle,
    rawBillingCycle,
    nextBillingDate,
    category,
    color: brandColor,
    isTrial,
    reminderEnabled,
    note,
  } = subscription;

  const formatBillingCycleLabel = (cycle: string) => {
    if (!cycle) return "Monthly";
    if (cycle === "custom") return "Custom";
    if (cycle.startsWith("custom:")) {
      const parts = cycle.split(":");
      const val = parts[1] || "1";
      const unit = parts[2] || "months";
      const unitCapitalized = unit.charAt(0).toUpperCase() + unit.slice(1);
      return `Every ${val} ${unitCapitalized}`;
    }
    return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  const handleEdit = () => {
    Haptics.selectionAsync();
    router.push({
      pathname: "/add/paid",
      params: {
        editId: id,
        id,
        name,
        category,
        brandColor: brandColor || "",
        website: subscription.website || "",
        logo: subscription.logoUrl || "",
      },
    });
  };

  const handleDelete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Subscription",
      `Are you sure you want to delete ${name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeSubscription(id);
              router.back();
            } catch (error) {
              console.error("Failed to delete subscription:", error);
            }
          },
        },
      ]
    );
  };

  const handleToggleReminder = async (value: boolean) => {
    Haptics.selectionAsync();
    try {
      await updateSubscription(id, {
        reminderEnabled: value,
      });
    } catch (e) {
      console.error("Failed to update reminder:", e);
    }
  };

  const parseDate = (d: string | Date | undefined | null): Date => {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    try {
      const parsed = parseISO(d);
      if (isNaN(parsed.getTime())) return new Date();
      return parsed;
    } catch {
      const fallback = new Date(d);
      return isNaN(fallback.getTime()) ? new Date() : fallback;
    }
  };

  const safeFormat = (d: Date, fmt: string): string => {
    try {
      return format(d, fmt);
    } catch {
      return "Unknown";
    }
  };

  const formattedStartDate = safeFormat(parseDate(subscription.startDate || subscription.createdAt), "MMM d, yyyy");
  const formattedNextDate = safeFormat(parseDate(nextBillingDate), "MMM d, yyyy");

  return (
    <View style={[styles.container, { backgroundColor: brandColor || colors.accent }]}>
      {/* Background Gradient overlay */}
      <LinearGradient
        colors={["rgba(0, 0, 0, 0.1)", "rgba(0, 0, 0, 0.88)"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Navbar row */}
      <View style={[styles.navbar, { paddingTop: insets.top + spacing[12] }]}>
        <PressableScale onPress={handleBack} scale={0.88} style={styles.navCircleBtn}>
          <ChevronLeft size={22} color={colors.white} strokeWidth={2.5} />
        </PressableScale>
        <View style={styles.navbarRight}>
          <PressableScale onPress={handleEdit} scale={0.92} style={styles.navEditBtn}>
            <AppText weight="700" color={colors.white} style={styles.navEditBtnText}>
              Edit
            </AppText>
          </PressableScale>
          <PressableScale onPress={handleDelete} scale={0.88} style={styles.navCircleBtn}>
            <Trash2 size={18} color={colors.white} />
          </PressableScale>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[40] },
        ]}
      >
        {/* Centered Brand Info */}
        <View style={styles.brandContainer}>
          <LogoCircle
            source={subscription.logoUrl || undefined}
            name={name}
            color="#FFFFFF"
            size={120}
            bordered
            website={subscription.website}
          />
          <AppText weight="800" color={colors.white} style={styles.brandName}>
            {name}
          </AppText>
          <AppText style={styles.brandStatus}>
            {isTrial
              ? `Trial ${formattedStartDate} → ${subscription.trialEndDate ? safeFormat(parseDate(subscription.trialEndDate), "MMM d, yyyy") : "Ongoing"}`
              : `Starts on ${formattedStartDate}`
            }
          </AppText>
        </View>

        {/* Floating Details Card */}
        <View style={styles.floatingStatsCard}>
          <View style={styles.statColumn}>
            <AppText weight="700" color={colors.white} style={styles.statValue}>
              {isTrial ? "Trial" : formatBillingCycleLabel(rawBillingCycle || billingCycle)}
            </AppText>
            <AppText style={styles.statLabel}>Plan</AppText>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.statColumn}>
            <AppText weight="700" color={colors.white} style={styles.statValue}>
              {getSubscriptionActivePrice(subscription) === 0
                ? "Free"
                : `${getCurrencySymbol(currency)}${getSubscriptionActivePrice(subscription).toFixed(2)}`}
            </AppText>
            <AppText style={styles.statLabel}>
              {subscription.splitEnabled ? "Your share" : "Cost"}
            </AppText>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.statColumn}>
            <AppText weight="700" color={colors.white} style={styles.statValue}>
              {isTrial ? "Scheduled" : "Active"}
            </AppText>
            <AppText style={styles.statLabel}>Status</AppText>
          </View>
        </View>

        {/* Rows sections */}
        <View style={styles.rowsContainer}>
          {/* Row 1: Next Bill */}
          <View style={styles.detailRow}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapper}>
                <Calendar size={18} color={colors.white} />
              </View>
              <AppText weight="600" color={colors.white} style={styles.rowLabel}>
                Next bill
              </AppText>
            </View>
            <AppText weight="600" color={colors.white} style={styles.rowValue}>
              on {formattedNextDate}
            </AppText>
          </View>

          {/* Splitting Details Row */}
          {subscription.splitEnabled && (
            <View style={styles.detailRow}>
              <View style={styles.rowLeft}>
                <View style={styles.iconWrapper}>
                  <Users size={18} color={colors.white} />
                </View>
                <AppText weight="600" color={colors.white} style={styles.rowLabel}>
                  Bill split
                </AppText>
              </View>
              <AppText weight="600" color={colors.white} style={styles.rowValue} numberOfLines={1} adjustsFontSizeToFit>
                {subscription.splitType === "people"
                  ? `1/${subscription.splitValue} share of ${getCurrencySymbol(currency)}${price.toFixed(2)}`
                  : subscription.splitType === "percentage"
                  ? `${subscription.splitValue}% share of ${getCurrencySymbol(currency)}${price.toFixed(2)}`
                  : `Your share: ${getCurrencySymbol(currency)}${subscription.splitValue?.toFixed(2)} / ${getCurrencySymbol(currency)}${price.toFixed(2)}`}
              </AppText>
            </View>
          )}

          {/* Promo Details Row */}
          {subscription.promoEnabled && (
            <View style={styles.detailRow}>
              <View style={styles.rowLeft}>
                <View style={styles.iconWrapper}>
                  <Percent size={17} color={colors.white} />
                </View>
                <AppText weight="600" color={colors.white} style={styles.rowLabel}>
                  Promo price
                </AppText>
              </View>
              <AppText weight="600" color={colors.white} style={styles.rowValue} numberOfLines={1} adjustsFontSizeToFit>
                {subscription.promoEndDate && new Date() <= new Date(subscription.promoEndDate)
                  ? `${getCurrencySymbol(currency)}${subscription.promoPrice?.toFixed(2)} until ${safeFormat(parseDate(subscription.promoEndDate), "MMM d, yyyy")}`
                  : `Expired on ${subscription.promoEndDate ? safeFormat(parseDate(subscription.promoEndDate), "MMM d, yyyy") : "-"}`}
              </AppText>
            </View>
          )}

          {/* Row 2: Category */}
          <View style={styles.detailRow}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapper}>
                <Folder size={18} color={colors.white} />
              </View>
              <AppText weight="600" color={colors.white} style={styles.rowLabel}>
                Category
              </AppText>
            </View>
            <AppText weight="600" color={colors.white} style={styles.rowValue}>
              {(category || "Other").charAt(0).toUpperCase() + (category || "Other").slice(1)}
            </AppText>
          </View>

          {/* Row 3: Reminders toggle */}
          <View style={styles.detailRow}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapper}>
                <Bell size={18} color={colors.white} />
              </View>
              <AppText weight="600" color={colors.white} style={styles.rowLabel}>
                Payment reminder
              </AppText>
            </View>
            <View style={styles.switchSlot}>
              <Toggle
                value={reminderEnabled}
                onValueChange={handleToggleReminder}
              />
            </View>
          </View>

          {/* Row 4: Notes */}
          <View style={styles.detailRow}>
            <View style={styles.rowLeft}>
              <View style={styles.iconWrapper}>
                <FileText size={18} color={colors.white} />
              </View>
              <AppText weight="600" color={colors.white} style={styles.rowLabel}>
                Notes
              </AppText>
            </View>
            <AppText weight="600" color={colors.white} style={styles.rowValue} numberOfLines={1}>
              {note || "No notes"}
            </AppText>
          </View>
        </View>

        {/* Floating Cancel Scheduled Start / Delete Button */}
        <PressableScale
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            handleDelete();
          }}
          scale={0.96}
          style={styles.cancelBtn}
        >
          <AppText weight="700" color="#FF3B30" style={styles.cancelBtnText}>
            {isTrial ? "Cancel scheduled start" : "Delete Subscription"}
          </AppText>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[12],
    backgroundColor: "transparent",
    zIndex: 10,
  },
  navCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  navbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navEditBtn: {
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    paddingHorizontal: spacing[16],
    alignItems: "center",
    justifyContent: "center",
  },
  navEditBtnText: {
    fontSize: 14,
  },
  scrollContent: {
    paddingTop: spacing[16],
  },
  brandContainer: {
    alignItems: "center",
    paddingHorizontal: spacing[20],
  },
  brandName: {
    fontSize: 32,
    lineHeight: 40,
    color: colors.white,
    marginTop: spacing[16],
    textAlign: "center",
  },
  brandStatus: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 6,
    textAlign: "center",
  },
  floatingStatsCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    paddingVertical: spacing[16],
    marginHorizontal: spacing[16],
    marginTop: spacing[24],
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  statColumn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 16,
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
  },
  verticalDivider: {
    width: 0.5,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    height: 24,
  },
  rowsContainer: {
    marginTop: spacing[20],
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    paddingHorizontal: 14,
    marginHorizontal: spacing[16],
    height: 56,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  switchAlign: {
    alignSelf: "center",
  },
  switchSlot: {
    width: 52,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    flexShrink: 0,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    flex: 1,
    marginLeft: spacing[12],
    textAlign: "right",
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: "#FF3B30",
    borderRadius: 24,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: spacing[16],
    marginTop: spacing[24],
  },
  cancelBtnText: {
    fontSize: 15,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[24],
  },
  backButton: {
    height: 44,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing[24],
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[20],
  },
});
