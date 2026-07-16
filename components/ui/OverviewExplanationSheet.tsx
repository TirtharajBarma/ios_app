import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SwipeDownSheet from "./SwipeDownSheet";
import AppText from "./AppText";
import { colors, spacing } from "@/constants";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { getSubscriptionActivePrice, toMonthly, toYearly } from "@/utils/date";
import { isThisMonth, parseISO } from "date-fns";

export type ExplanationType = "monthly" | "annual" | "due";

export interface OverviewExplanationSheetProps {
  visible: boolean;
  onClose: () => void;
  type: ExplanationType | null;
  currencySymbol: string;
}

export default function OverviewExplanationSheet({
  visible,
  onClose,
  type,
  currencySymbol,
}: OverviewExplanationSheetProps) {
  const insets = useSafeAreaInsets();
  const { subscriptions, stats } = useSubscriptionStore();

  if (!type) return null;

  const activeSubs = subscriptions.filter((s) => !s.isTrial);

  const renderCalculation = (sub: any) => {
    const price = getSubscriptionActivePrice(sub);
    const c = sub.billingCycle;
    
    let multiplierStr = "";
    
    if (type === "annual") {
      if (c === "weekly") multiplierStr = " × 52";
      else if (c === "bi-weekly") multiplierStr = " × 26";
      else if (c === "monthly") multiplierStr = " × 12";
      else if (c === "quarterly") multiplierStr = " × 4";
      else if (c === "semi-yearly") multiplierStr = " × 2";
      else if (c === "yearly") multiplierStr = "";
      else if (c === "custom") {
        multiplierStr = sub.customIntervalMonths !== 1 ? ` × (12 ÷ ${sub.customIntervalMonths})` : " × 12";
      }
      else if (c.startsWith("custom:")) {
        const [, val, unit] = c.split(":");
        if (unit === "days") multiplierStr = ` × (365 ÷ ${val})`;
        else if (unit === "weeks") multiplierStr = ` × (52 ÷ ${val})`;
        else if (unit === "months") multiplierStr = val !== "1" ? ` × (12 ÷ ${val})` : " × 12";
        else if (unit === "years") multiplierStr = val !== "1" ? ` ÷ ${val}` : "";
      }
      
      const yearly = toYearly(price, c, sub.customIntervalMonths);
      return (
        <View key={sub.id} style={styles.calcRow}>
          <AppText color={colors.white} variant="callout" weight="600">{sub.name}</AppText>
          <AppText color={colors.textSecondary} variant="footnote" style={{ marginTop: 2 }}>
            {currencySymbol}{price.toFixed(2)}{multiplierStr} = {currencySymbol}{yearly.toFixed(2)}
          </AppText>
        </View>
      );
    } 
    
    if (type === "monthly") {
      let calcStr = "";
      if (c === "monthly") calcStr = `${currencySymbol}${price.toFixed(2)}/month`;
      else {
        if (c === "weekly") multiplierStr = " × 52 ÷ 12";
        else if (c === "bi-weekly") multiplierStr = " × 26 ÷ 12";
        else if (c === "yearly") multiplierStr = " ÷ 12";
        else if (c === "quarterly") multiplierStr = " ÷ 3";
        else if (c === "semi-yearly") multiplierStr = " ÷ 6";
        else if (c === "custom") {
          multiplierStr = sub.customIntervalMonths !== 1 ? ` ÷ ${sub.customIntervalMonths}` : "";
        }
        else if (c.startsWith("custom:")) {
          const [, val, unit] = c.split(":");
          if (unit === "days") multiplierStr = ` × (365 ÷ ${val}) ÷ 12`;
          else if (unit === "weeks") multiplierStr = ` × (52 ÷ ${val}) ÷ 12`;
          else if (unit === "months") multiplierStr = val !== "1" ? ` ÷ ${val}` : "";
          else if (unit === "years") multiplierStr = ` ÷ ${Number(val) * 12}`;
        }
        calcStr = `${currencySymbol}${price.toFixed(2)}${multiplierStr} = ${currencySymbol}${toMonthly(price, c, sub.customIntervalMonths).toFixed(2)}/month`;
      }
      
      return (
        <View key={sub.id} style={styles.calcRow}>
          <AppText color={colors.white} variant="callout" weight="600">{sub.name}</AppText>
          <AppText color={colors.textSecondary} variant="footnote" style={{ marginTop: 2 }}>
            {calcStr}
          </AppText>
        </View>
      );
    }
    return null;
  };

  const renderContent = () => {
    if (type === "due") {
      const dueThisMonth = subscriptions.filter((s) => {
        if (!s.nextBillingDate) return false;
        return isThisMonth(parseISO(s.nextBillingDate));
      });

      return (
        <View style={styles.section}>
          <AppText variant="title3" weight="700" color={colors.white} style={styles.title}>
            Due This Month
          </AppText>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {dueThisMonth.length === 0 ? (
              <AppText color={colors.textSecondary}>No subscriptions are due this month.</AppText>
            ) : (
              dueThisMonth.map((s) => {
                 const price = getSubscriptionActivePrice(s);
                 return (
                  <View key={s.id} style={styles.dueRow}>
                    <View>
                      <AppText color={colors.white} variant="callout" weight="600">{s.name}</AppText>
                      <AppText color={colors.textSecondary} variant="footnote">
                        {new Date(s.nextBillingDate!).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                      </AppText>
                    </View>
                    <AppText color={colors.white} variant="callout" weight="600">
                      {currencySymbol}{price.toFixed(2)}
                    </AppText>
                  </View>
                 );
              })
            )}
          </ScrollView>
        </View>
      );
    }

    const title = type === "annual" ? "Estimated Annual Cost" : "Monthly Average";
    const total = type === "annual" ? stats.yearlyTotal : stats.monthlyTotal;
    const suffix = type === "annual" ? "/year" : "/month";

    return (
      <View style={styles.section}>
        <AppText variant="title3" weight="700" color={colors.white} style={styles.title}>
          {title}
        </AppText>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {activeSubs.map(renderCalculation)}
          {activeSubs.length > 0 && <View style={styles.divider} />}
          <View style={styles.totalRow}>
            <AppText color={colors.white} variant="headline" weight="700">Total</AppText>
            <AppText color={colors.white} variant="headline" weight="700">
              {currencySymbol}{total.toFixed(2)}{suffix}
            </AppText>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <SwipeDownSheet
      visible={visible}
      onClose={onClose}
      heightRatio={0.65}
      containerStyle={{
        backgroundColor: "#1C1C1E",
        paddingHorizontal: spacing[24],
        paddingBottom: insets.bottom + spacing[24],
      }}
    >
      {renderContent()}
    </SwipeDownSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    flex: 1,
    marginTop: spacing[8],
  },
  title: {
    marginBottom: spacing[24],
  },
  scroll: {
    flex: 1,
  },
  calcRow: {
    marginBottom: spacing[16],
  },
  dueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[16],
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: spacing[16],
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[24],
  }
});
