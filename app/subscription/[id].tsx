import React from "react";
import { StyleSheet, View, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, CreditCard, Bell, FileText, ChevronLeft } from "lucide-react-native";
import { format, parseISO, differenceInDays } from "date-fns";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { colors, spacing } from "@/constants";
import { AppButton, IconButton, AppText } from "@/components/ui";
import FormSection from "@/components/form/FormSection";
import DetailsHero from "@/components/cards/DetailsHero";
import DetailsRow from "@/components/common/DetailsRow";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";

export default function SubscriptionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Fetch subscription from Zustand store
  const { subscriptions, removeSubscription } = useSubscriptionStore();
  const subscription = subscriptions.find((s) => s.id === id);

  if (!subscription) {
    return (
      <View style={styles.errorContainer}>
        <AppText variant="headline" color={colors.textSecondary}>
          Subscription not found
        </AppText>
        <AppButton onPress={() => router.back()} style={{ marginTop: spacing[16] }}>Go Back</AppButton>
      </View>
    );
  }

  const {
    name,
    price,
    currency,
    billingCycle,
    nextBillingDate,
    category,
    brandColor,
    isTrial,
    startDate,
    paymentMethod,
    reminderEnabled,
    reminderDays,
    note,
  } = subscription;

  const formattedStartDate = startDate ? format(parseISO(startDate), "MMMM d, yyyy") : "N/A";
  const formattedNextDate = nextBillingDate ? format(parseISO(nextBillingDate), "MMMM d, yyyy") : "N/A";

  const diffDays = nextBillingDate ? differenceInDays(parseISO(nextBillingDate), new Date()) : -1;
  const remainingText = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : diffDays > 1 ? `In ${diffDays} days` : "Lapsed";

  const handleBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  const handleEdit = () => {
    Haptics.selectionAsync();
    // Navigate to the edit screen in the forms flow
    router.push({
      pathname: isTrial ? "/add/trial" : "/add/paid",
      params: {
        editId: id,
        id,
        name,
        category,
        brandColor: brandColor || "",
        website: subscription.website || "",
      },
    });
  };

  const handleDelete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await removeSubscription(id);
      router.back();
    } catch (error) {
      console.error("Failed to delete subscription:", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Premium Custom Navbar */}
      <View style={[styles.navbar, { paddingTop: insets.top + spacing[12] }]}>
        <IconButton
          icon={<ChevronLeft size={22} color={colors.textSecondary} strokeWidth={2.5} />}
          variant="filled"
          onPress={handleBack}
        />
        <AppButton variant="ghost" onPress={handleEdit} style={styles.editBtn}>
          Edit
        </AppButton>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[40] },
        ]}
      >
        {/* Dynamic Hero Banner */}
        <Animated.View entering={FadeIn.duration(350)} style={styles.heroWrapper}>
          <DetailsHero
            name={name}
            price={price}
            currency={currency}
            billingCycle={billingCycle}
            brandColor={brandColor || colors.accent}
            category={category}
            isTrial={isTrial}
          />
        </Animated.View>

        {/* Section 1: Schedule Details */}
        <FormSection title="Billing Schedule">
          <DetailsRow
            label="Start Date"
            value={formattedStartDate}
            icon={<Calendar size={18} color={colors.textMuted} />}
          />
          <DetailsRow
            label={isTrial ? "Trial End Date" : "Renewal Date"}
            value={formattedNextDate}
            icon={<Calendar size={18} color={colors.textMuted} />}
          />
          <DetailsRow
            label="Remaining Time"
            value={remainingText}
            icon={<Calendar size={18} color={colors.textMuted} />}
          />
        </FormSection>

        {/* Section 2: Payment Details */}
        <FormSection title="Account & Billing">
          {!isTrial && (
            <DetailsRow
              label="Payment Method"
              value={paymentMethod || "None"}
              icon={<CreditCard size={18} color={colors.textMuted} />}
            />
          )}
          <DetailsRow
            label="Billing Cycle"
            value={billingCycle.charAt(0).toUpperCase() + billingCycle.slice(1)}
            icon={<CreditCard size={18} color={colors.textMuted} />}
          />
          <DetailsRow
            label="Reminders"
            value={reminderEnabled ? `Enabled (${reminderDays}d before)` : "Disabled"}
            icon={<Bell size={18} color={colors.textMuted} />}
          />
        </FormSection>

        {/* Section 3: Notes Details */}
        {note ? (
          <FormSection title="Notes">
            <View style={styles.noteBox}>
              <FileText size={18} color={colors.textMuted} style={styles.noteIcon} />
              <AppText variant="body" color={colors.white} style={styles.noteText}>
                {note}
              </AppText>
            </View>
          </FormSection>
        ) : null}

        {/* Destructive Action Button */}
        <View style={styles.deleteWrapper}>
          <AppButton variant="danger" onPress={handleDelete} style={{ width: "100%" }}>
            Delete Subscription
          </AppButton>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[20],
    paddingBottom: spacing[12],
    backgroundColor: colors.background,
    zIndex: 10,
  },
  editBtn: {
    minWidth: 60,
  },
  scrollContent: {
    paddingHorizontal: spacing[20],
  },
  heroWrapper: {
    marginBottom: spacing[24],
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noteIcon: {
    marginRight: spacing[12],
    marginTop: 2,
  },
  noteText: {
    flex: 1,
    lineHeight: 22,
  },
  deleteWrapper: {
    marginTop: spacing[20],
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[24],
  },
});
