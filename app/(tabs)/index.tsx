import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TrendingUp, CreditCard, Inbox, Gift } from "lucide-react-native";
import { colors, spacing } from "@/constants";
import { EmptyState, SectionHeader } from "@/components/ui";
import {
  calculateDueThisMonth,
} from "@/utils/subscriptionUtils";
import {
  OverviewTopBar,
  OverviewLargeHeader,
} from "@/components/common/OverviewHeader";
import SummaryCard from "@/components/cards/SummaryCard";
import SubscriptionCard from "@/components/cards/SubscriptionCard";
import UpcomingSection from "@/components/cards/UpcomingSection";
import AddSubscriptionButton from "@/components/common/AddSubscriptionButton";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { seedDatabase } from "@/database";
import * as Haptics from "expo-haptics";

export default function HomeScreen() {
  const scrollY = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Load store state
  const { subscriptions, stats, loadSubscriptions } = useSubscriptionStore();

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const dueThisMonth = calculateDueThisMonth(subscriptions as any);

  const handleAddPress = () => {
    router.push("/add/search");
  };

  const handleCardPress = (sub: any) => {
    Haptics.selectionAsync();
    router.push(`/subscription/${sub.id}`);
  };

  const handleSeedDatabase = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const seeded = await seedDatabase();
    if (seeded) {
      await loadSubscriptions();
    }
  };

  const hasSubscriptions = subscriptions.length > 0;

  return (
    <View style={styles.container}>
      {/* Sticky iOS Collapsing Navbar */}
      <OverviewTopBar
        scrollY={scrollY}
        profileName="Tirtharaj"
        onProfilePress={handleSeedDatabase}
      />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[40] },
        ]}
      >
        {/* Large Inline Header */}
        <OverviewLargeHeader
          profileName="Tirtharaj"
          onProfilePress={handleSeedDatabase}
        />

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
            {/* Stats Summary Grid */}
            <View style={{ gap: spacing[12] }}>
              <View style={styles.statsRow}>
                <SummaryCard
                  title="MONTHLY SPEND"
                  amount={`$${stats.monthlyTotal.toFixed(2)}`}
                  icon={<TrendingUp size={14} color={colors.white} />}
                  gradient="hero"
                />
                <SummaryCard
                  title="DUE THIS MONTH"
                  amount={`$${dueThisMonth.toFixed(2)}`}
                  icon={<CreditCard size={14} color={colors.white} />}
                  gradient="blue"
                />
              </View>
              <View style={styles.statsRow}>
                <SummaryCard
                  title="ACTIVE SUBS"
                  amount={`${stats.activeCount}`}
                  icon={<Inbox size={14} color={colors.white} />}
                  gradient="darkCard"
                />
                <SummaryCard
                  title="FREE TRIALS"
                  amount={`${stats.trialCount}`}
                  icon={<Gift size={14} color={colors.white} />}
                  gradient="darkCard"
                />
              </View>
            </View>

            {/* Large Call-To-Action Add Button */}
            <AddSubscriptionButton
              onPress={handleAddPress}
              style={styles.addButton}
            />

            {/* Horizontal Upcoming Renewal slider */}
            <UpcomingSection
              subscriptions={subscriptions as any}
              onSeeAllPress={() => console.log("See all pressed")}
              onCardPress={handleCardPress}
              style={styles.upcomingSection}
            />

            {/* Vertical Subscription list */}
            <View>
              <SectionHeader title="Your Subscriptions" />
              <View style={styles.listContainer}>
                {subscriptions.map((sub, index) => (
                  <SubscriptionCard
                    key={sub.id}
                    subscription={sub as any}
                    index={index}
                    onPress={() => handleCardPress(sub)}
                    style={styles.subscriptionCard}
                  />
                ))}
              </View>
            </View>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing[16],
  },
  content: {
    gap: spacing[16],
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[4],
  },
  listContainer: {
    paddingHorizontal: spacing[4],
  },
  addButton: {
    marginVertical: spacing[16],
  },
  upcomingSection: {
    marginBottom: spacing[12],
  },
  subscriptionCard: {
    marginBottom: spacing[12],
  },
  emptyState: {
    marginTop: spacing[40],
  },
});
