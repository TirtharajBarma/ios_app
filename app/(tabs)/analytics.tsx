import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  TrendingUp,
  CreditCard,
  Calendar,
  Gift,
  BarChart3,
  PieChart,
} from "lucide-react-native";
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { colors, spacing, hexToRGBA } from "@/constants";
import { AppText, Card, SectionHeader } from "@/components/ui";
import {
  OverviewTopBar,
  OverviewLargeHeader,
} from "@/components/common/OverviewHeader";
import SummaryCard from "@/components/cards/SummaryCard";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import type { Subscription } from "@/types/subscription";

function AnalyticsScreen() {
  const scrollY = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const { subscriptions, stats, loadSubscriptions } = useSubscriptionStore();

  const [nowTime, setNowTime] = React.useState(0);

  useEffect(() => {
    loadSubscriptions();
    const handle = setTimeout(() => {
      setNowTime(Date.now());
    }, 0);
    return () => clearTimeout(handle);
  }, [loadSubscriptions]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Billing cycle breakdown (memoized)
  const cycleBreakdown = React.useMemo(() => ({
    monthly: subscriptions.filter((s) => s.billingCycle === "monthly" && !s.isTrial).length,
    yearly: subscriptions.filter((s) => s.billingCycle === "yearly" && !s.isTrial).length,
    other: subscriptions.filter((s) => !["monthly", "yearly"].includes(s.billingCycle) && !s.isTrial).length,
  }), [subscriptions]);

  // Trial status
  const trialEndingSoon = React.useMemo(() => {
    if (nowTime === 0) return [];
    return subscriptions.filter(
      (s) =>
        s.isTrial &&
        s.trialEndDate &&
        new Date(s.trialEndDate).getTime() > nowTime &&
        new Date(s.trialEndDate).getTime() - nowTime < 7 * 24 * 60 * 60 * 1000
    );
  }, [subscriptions, nowTime]);

  const hasSubscriptions = subscriptions.length > 0;

  // Determine currency symbol from subscriptions
  const getSymbol = (code?: string) => {
    if (code === "INR") return "₹";
    if (code === "EUR") return "€";
    if (code === "GBP") return "£";
    if (code === "JPY") return "¥";
    return "$";
  };
  const firstCurrency = subscriptions.find((s) => s.currency)?.currency;
  const currencySymbol = getSymbol(firstCurrency);

  // Memoize category breakdown
  const { categories, maxCategorySpend } = React.useMemo(() => {
    const categoryMap = new Map<string, number>();
    for (const sub of subscriptions) {
      if (sub.isTrial) continue;
      const cat = sub.category.charAt(0).toUpperCase() + sub.category.slice(1);
      const monthly = sub.billingCycle === "yearly"
        ? sub.price / 12
        : sub.billingCycle === "quarterly"
        ? sub.price / 3
        : sub.billingCycle === "semi-yearly"
        ? sub.price / 6
        : sub.billingCycle === "weekly"
        ? sub.price * 52 / 12
        : sub.billingCycle === "bi-weekly"
        ? sub.price * 26 / 12
        : sub.billingCycle === "custom" && sub.customIntervalMonths
        ? sub.price / sub.customIntervalMonths
        : sub.price;
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + monthly);
    }
    const sorted = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
    return { categories: sorted, maxCategorySpend: sorted.length > 0 ? sorted[0][1] : 1 };
  }, [subscriptions]);

  return (
    <View style={styles.container}>
      <OverviewTopBar
        scrollY={scrollY}
        title="Analytics"
        profileName="Analytics"
        onProfilePress={() => {}}
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
        <OverviewLargeHeader
          title="Analytics"
          profileName="Analytics"
          onProfilePress={() => {}}
        />

        {!hasSubscriptions ? (
          <View style={styles.emptyContainer}>
            <BarChart3 size={32} color={colors.textSecondary} />
            <AppText variant="headline" color={colors.textSecondary} style={{ marginTop: spacing[12] }}>
              No data to analyze
            </AppText>
            <AppText variant="footnote" color={colors.textMuted} style={{ marginTop: spacing[4] }}>
              Add subscriptions to see spending analytics
            </AppText>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Summary Cards */}
            <View style={{ gap: spacing[12] }}>
              <View style={styles.statsRow}>
                <SummaryCard
                  title="MONTHLY SPEND"
                  amount={`${currencySymbol}${stats.monthlyTotal.toFixed(2)}`}
                  icon={<TrendingUp size={14} color={colors.white} />}
                  gradient="hero"
                />
                <SummaryCard
                  title="YEARLY SPEND"
                  amount={`${currencySymbol}${stats.yearlyTotal.toFixed(2)}`}
                  icon={<CreditCard size={14} color={colors.white} />}
                  gradient="blue"
                />
              </View>
              <View style={styles.statsRow}>
                <SummaryCard
                  title="ACTIVE SUBS"
                  amount={`${stats.activeCount}`}
                  icon={<Calendar size={14} color={colors.white} />}
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

            {/* Spending by Category */}
            {categories.length > 0 && (
              <Animated.View entering={FadeInUp.delay(100).springify()}>
                <Card padding="default" shadow="small" style={styles.chartCard}>
                  <View style={styles.cardHeader}>
                    <PieChart size={16} color={colors.accent} />
                    <AppText variant="headline" weight="700" color={colors.white}>
                      Spending by Category
                    </AppText>
                  </View>
                  <View style={styles.categoryList}>
                    {categories.map(([name, amount], idx) => {
                      const barWidth = (amount / maxCategorySpend) * 100;
                      return (
                        <View key={name} style={styles.categoryRow}>
                          <View style={styles.categoryLabel}>
                            <AppText variant="footnote" color={colors.textSecondary} style={{ width: 90 }}>
                              {name}
                            </AppText>
                            <AppText variant="footnote" weight="600" color={colors.white}>
                              {currencySymbol}{amount.toFixed(2)}
                            </AppText>
                          </View>
                          <View style={styles.barBackground}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  width: `${barWidth}%`,
                                  backgroundColor: getCategoryColor(idx),
                                },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </Card>
              </Animated.View>
            )}

            {/* Billing Cycle Breakdown */}
            <Animated.View entering={FadeInUp.delay(200).springify()}>
              <Card padding="default" shadow="small" style={styles.chartCard}>
                <View style={styles.cardHeader}>
                  <BarChart3 size={16} color={colors.success} />
                  <AppText variant="headline" weight="700" color={colors.white}>
                    Billing Cycles
                  </AppText>
                </View>
                <View style={styles.cycleGrid}>
                  <CycleStat label="Monthly" count={cycleBreakdown.monthly} color={colors.accent} />
                  <CycleStat label="Yearly" count={cycleBreakdown.yearly} color={colors.success} />
                  <CycleStat label="Other" count={cycleBreakdown.other} color={colors.warning} />
                </View>
              </Card>
            </Animated.View>

            {/* Average Cost */}
            <Animated.View entering={FadeInUp.delay(300).springify()}>
              <Card padding="default" shadow="small" style={styles.chartCard}>
                <View style={styles.cardHeader}>
                  <TrendingUp size={16} color={colors.warning} />
                  <AppText variant="headline" weight="700" color={colors.white}>
                    Cost Breakdown
                  </AppText>
                </View>
                <View style={styles.costRow}>
                  <View style={styles.costItem}>
                    <AppText variant="caption2" weight="600" color={colors.textMuted}>
                      AVG PER SUB
                    </AppText>
                    <AppText variant="title2" weight="800" color={colors.white}>
                      {currencySymbol}{stats.activeCount > 0 ? (stats.monthlyTotal / stats.activeCount).toFixed(2) : "0.00"}
                    </AppText>
                  </View>
                  <View style={styles.costDivider} />
                  <View style={styles.costItem}>
                    <AppText variant="caption2" weight="600" color={colors.textMuted}>
                      MOST EXPENSIVE
                    </AppText>
                    <AppText variant="title2" weight="800" color={colors.white}>
                      {currencySymbol}{getMostExpensive(subscriptions)}
                    </AppText>
                  </View>
                </View>
              </Card>
            </Animated.View>

            {/* Trials Ending Soon */}
            {trialEndingSoon.length > 0 && (
              <Animated.View entering={FadeInUp.delay(400).springify()}>
                <SectionHeader title="Trials Ending Soon" />
                {trialEndingSoon.map((sub) => (
                  <Card key={sub.id} padding="compact" shadow="small" style={styles.trialCard}>
                    <View style={styles.trialRow}>
                      <View style={[styles.trialDot, { backgroundColor: hexToRGBA(colors.warning, 0.3) }]} />
                      <View style={{ flex: 1 }}>
                        <AppText variant="body" weight="600" color={colors.white}>
                          {sub.name}
                        </AppText>
                        <AppText variant="caption2" color={colors.textMuted}>
                          Ends {sub.trialEndDate ? new Date(sub.trialEndDate).toLocaleDateString() : "soon"}
                        </AppText>
                      </View>
                    </View>
                  </Card>
                ))}
              </Animated.View>
            )}
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

function CycleStat({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={styles.cycleStat}>
      <View style={[styles.cycleDot, { backgroundColor: color }]} />
      <AppText variant="footnote" weight="600" color={colors.textSecondary}>
        {label}
      </AppText>
      <AppText variant="title3" weight="800" color={colors.white}>
        {count}
      </AppText>
    </View>
  );
}

function getCategoryColor(index: number): string {
  const palette = [
    colors.accent,
    colors.success,
    colors.warning,
    colors.danger,
    "#AF52DE",
    "#FF9F0A",
    "#64D2FF",
    "#30D158",
  ];
  return palette[index % palette.length];
}

function getMostExpensive(subs: Subscription[]): string {
  let max = 0;
  for (const sub of subs) {
    if (sub.isTrial) continue;
    if (sub.price > max) max = sub.price;
  }
  return max > 0 ? max.toFixed(2) : "0.00";
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
  chartCard: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
    marginBottom: spacing[16],
  },
  categoryList: {
    gap: spacing[12],
  },
  categoryRow: {
    gap: spacing[4],
  },
  categoryLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  barBackground: {
    height: 8,
    backgroundColor: hexToRGBA(colors.white, 0.06),
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  cycleGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  cycleStat: {
    alignItems: "center",
    gap: spacing[4],
  },
  cycleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  costItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing[4],
  },
  costDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  trialCard: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing[8],
  },
  trialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
  },
  trialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: spacing[48],
  },
});

export default AnalyticsScreen;
