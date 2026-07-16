import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { AppText, LogoCircle } from "@/components/ui";
import { colors, spacing, radius, hexToRGBA, getCurrencySymbol } from "@/constants";
import { getSubscriptionActivePrice } from "@/utils/date";
import { useSettingsStore } from "@/store/useSettingsStore";

export interface DetailsHeroProps {
  name: string;
  price: number;
  currency: string;
  billingCycle: string;
  brandColor: string;
  category: string;
  isTrial: boolean;
  logoUrl?: string;
  whiteBackground?: boolean;
  website?: string;
  promoEnabled?: boolean;
  promoPrice?: number;
  promoEndDate?: string;
  splitEnabled?: boolean;
  splitType?: "people" | "percentage" | "share";
  splitValue?: number;
}

function DetailsHero({
  name,
  price,
  currency,
  billingCycle,
  brandColor,
  category,
  isTrial,
  logoUrl,
  whiteBackground,
  website,
  promoEnabled,
  promoPrice,
  promoEndDate,
  splitEnabled,
  splitType,
  splitValue,
}: DetailsHeroProps) {
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const symbol = getCurrencySymbol(currencyCode);
  const activePrice = getSubscriptionActivePrice({
    price,
    isTrial,
    promoEnabled,
    promoPrice,
    promoEndDate,
    splitEnabled,
    splitType,
    splitValue,
  });
  const formattedPrice = `${symbol}${activePrice.toFixed(2)}`;

  const getCycleSuffix = (cycle: string) => {
    const c = cycle.toLowerCase();
    if (c === "weekly") return "wk";
    if (c === "bi-weekly") return "2wk";
    if (c === "monthly") return "mo";
    if (c === "quarterly") return "qtr";
    if (c === "semi-yearly") return "6mo";
    if (c === "yearly") return "yr";
    if (c.startsWith("custom:")) return "cycle";
    return "mo";
  };
  const cycleSuffix = getCycleSuffix(billingCycle);

  return (
    <View style={[styles.container, { backgroundColor: brandColor }]}>
      {/* Subtle overlay gradient to keep text readable */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      <View style={styles.content}>
        {/* Large Logo */}
        <LogoCircle
          source={logoUrl}
          name={name}
          color={colors.white}
          size={80}
          bordered
          shadowed
          whiteBackground={whiteBackground}
          style={styles.logo}
          website={website}
        />

        {/* Subscription Name */}
        <AppText variant="title1" weight="800" align="center" color={colors.white}>
          {name}
        </AppText>

        {/* Category Tag */}
        <View style={styles.tagWrapper}>
          <View style={styles.tag}>
            <AppText variant="caption2" weight="700" color={colors.white} style={{ opacity: 0.9 }}>
              {isTrial ? "FREE TRIAL" : category.toUpperCase()}
            </AppText>
          </View>
        </View>

        {/* Price display */}
        <View style={styles.priceRow}>
          <AppText variant="largeTitle" weight="800" color={colors.white}>
            {isTrial ? "Free" : formattedPrice}
          </AppText>
          {!isTrial && (
            <AppText variant="body" weight="600" color={colors.white} style={styles.cycleText}>
              / {cycleSuffix}
            </AppText>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing[32],
    paddingHorizontal: spacing[24],
    borderRadius: radius[24],
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.15)", // subtle shade
  },
  content: {
    alignItems: "center",
    zIndex: 1,
  },
  logo: {
    marginBottom: spacing[16],
  },
  tagWrapper: {
    marginTop: spacing[8],
    marginBottom: spacing[16],
  },
  tag: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[4],
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  cycleText: {
    opacity: 0.8,
    marginLeft: spacing[4],
    marginBottom: 4,
  },
});

export default memo(DetailsHero);
