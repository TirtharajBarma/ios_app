import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
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
} from "lucide-react-native";
import { format, parseISO } from "date-fns";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { colors, spacing } from "@/constants";
import { AppText, LogoCircle } from "@/components/ui";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";

export default function SubscriptionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Fetch subscription from Zustand store
  const { subscriptions, removeSubscription, updateSubscription } = useSubscriptionStore();
  const subscription = subscriptions.find((s) => s.id === id);

  if (!subscription) {
    return (
      <View style={styles.errorContainer}>
        <AppText variant="headline" color={colors.textSecondary}>
          Subscription not found
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

  const parseDate = (d: any) => {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    try {
      return parseISO(d);
    } catch {
      return new Date(d);
    }
  };

  const formattedStartDate = format(parseDate(subscription.startDate || subscription.createdAt), "MMM d, yyyy");
  const formattedNextDate = format(parseDate(nextBillingDate), "MMM d, yyyy");

  const getCurrencySymbol = (code: string) => {
    if (code === "INR") return "₹";
    if (code === "USD") return "$";
    if (code === "EUR") return "€";
    if (code === "GBP") return "£";
    return "$";
  };

  return (
    <View style={[styles.container, { backgroundColor: brandColor || colors.accent }]}>
      {/* Background Gradient overlay */}
      <LinearGradient
        colors={["rgba(0, 0, 0, 0.1)", "rgba(0, 0, 0, 0.88)"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Navbar row */}
      <View style={[styles.navbar, { paddingTop: insets.top + spacing[12] }]}>
        <TouchableOpacity onPress={handleBack} style={styles.navCircleBtn}>
          <ChevronLeft size={22} color={colors.white} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.navbarRight}>
          <TouchableOpacity onPress={handleEdit} style={styles.navEditBtn}>
            <AppText weight="700" color={colors.white} style={styles.navEditBtnText}>
              Edit
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.navCircleBtn}>
            <Trash2 size={18} color={colors.white} />
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
        {/* Centered Brand Info */}
        <View style={styles.brandContainer}>
          <LogoCircle
            source={subscription.logoUrl || undefined}
            name={name}
            color="#FFFFFF"
            size={120}
            bordered
          />
          <AppText weight="800" color={colors.white} style={styles.brandName}>
            {name}
          </AppText>
          <AppText style={styles.brandStatus}>
            {isTrial ? `Trial starts on ${formattedStartDate}` : `Starts on ${formattedStartDate}`}
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
              {price === 0 ? "Free" : `${getCurrencySymbol(currency)}${price.toFixed(2)}`}
            </AppText>
            <AppText style={styles.statLabel}>Cost</AppText>
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
              {category.charAt(0).toUpperCase() + category.slice(1)}
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
             <Switch
              value={reminderEnabled}
              onValueChange={handleToggleReminder}
              trackColor={{ false: "rgba(255, 255, 255, 0.1)", true: colors.accent }}
              thumbColor={colors.white}
              style={Platform.OS === "ios" ? { marginRight: -2 } : undefined}
            />
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
        <TouchableOpacity onPress={handleDelete} style={styles.cancelBtn}>
          <AppText weight="700" color="#FF3B30" style={styles.cancelBtnText}>
            {isTrial ? "Cancel scheduled start" : "Delete Subscription"}
          </AppText>
        </TouchableOpacity>
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
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
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
