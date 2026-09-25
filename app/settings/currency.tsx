import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Check, RefreshCw, Globe, ShieldCheck } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, CURRENCIES } from "@/constants";
import { AppText } from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useExpenseStore } from "@/store/useExpenseStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import {
  getExchangeRates,
  getCachedExchangeRatesData,
  getRatesLastUpdatedFormatted,
  convertCurrency,
  FALLBACK_EXCHANGE_RATES,
} from "@/utils/currency";

export default function CurrencyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currencyCode, setCurrencyCode } = useSettingsStore();

  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_EXCHANGE_RATES);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    async function loadRates() {
      const data = await getCachedExchangeRatesData();
      if (data && data.rates) {
        setRates(data.rates);
        setLastUpdated(data.lastUpdated);
      }
      // Also try background refresh
      try {
        const live = await getExchangeRates();
        if (live) {
          setRates(live);
          const freshData = await getCachedExchangeRatesData();
          setLastUpdated(freshData.lastUpdated);
        }
      } catch {}
    }
    loadRates();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const updated = await getExchangeRates();
      if (updated) {
        setRates(updated);
        const freshData = await getCachedExchangeRatesData();
        setLastUpdated(freshData.lastUpdated);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } finally {
      setIsRefreshing(false);
    }
  };

  const currentSym = CURRENCIES.find((c) => c.code === currencyCode)?.symbol || "₹";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <AppText variant="headline" weight="700" color={colors.white}>
          Display Currency
        </AppText>
        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.refreshBtn}
          activeOpacity={0.7}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <RefreshCw size={18} color={colors.accent} />
          )}
        </TouchableOpacity>
      </View>

      {/* Exchange Rate Status & Privacy Banner */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <Globe size={15} color={colors.accent} />
            <AppText variant="footnote" weight="600" color={colors.white}>
              Real-time Exchange Rates
            </AppText>
          </View>
          <AppText variant="caption2" color={colors.textMuted}>
            {getRatesLastUpdatedFormatted(lastUpdated)}
          </AppText>
        </View>

        <AppText variant="caption2" color={colors.textMuted} style={styles.statusDesc}>
          Original transaction amounts and currencies are preserved as source of truth. Display values are converted accurately across Home, Ledger, Visualizer, Accounts, and Subscriptions.
        </AppText>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing[40] }]}
      >
        <View style={styles.sectionCard}>
          {CURRENCIES.map((item, index) => {
            const isSelected = currencyCode === item.code;
            const isLast = index === CURRENCIES.length - 1;

            // Sample conversion from currently active currency
            const activeCode = currencyCode || "INR";
            const activeCurObj = CURRENCIES.find((c) => c.code === activeCode) || CURRENCIES[0];
            const baseAmt = ["JPY", "KRW", "IDR", "VND"].includes(activeCode)
              ? 10000
              : ["INR", "RUB", "THB", "ZAR", "BRL"].includes(activeCode)
              ? 1000
              : 100;
            const sampleConverted = convertCurrency(baseAmt, activeCode, item.code, rates);
            let sampleRateStr = "";
            if (item.code === activeCode) {
              sampleRateStr = "Active currency";
            } else if (sampleConverted > 0) {
              const formattedAmt = sampleConverted < 1
                ? sampleConverted.toFixed(3)
                : sampleConverted < 100
                ? sampleConverted.toFixed(2)
                : Math.round(sampleConverted).toLocaleString();
              sampleRateStr = `${activeCurObj.symbol}${baseAmt.toLocaleString()} ≈ ${item.symbol}${formattedAmt}`;
            }

            return (
              <React.Fragment key={item.code}>
                <TouchableOpacity
                  activeOpacity={0.65}
                  onPress={async () => {
                    Haptics.selectionAsync().catch(() => {});
                    const oldCode = currencyCode || 'INR';
                    try {
                      await Promise.all([
                        useSubscriptionStore.getState().convertAllCurrencies(oldCode, item.code),
                        useExpenseStore.getState().convertAllCurrencies(oldCode, item.code, item.symbol),
                        setCurrencyCode(item.code),
                      ]);
                    } catch (err) {
                      console.warn('Currency conversion error:', err);
                      await setCurrencyCode(item.code);
                      useExpenseStore.getState().setCurrency(item.code, item.symbol);
                    }
                    router.back();
                  }}
                  style={[styles.currencyRow, isSelected && styles.currencyRowSelected]}
                >
                  <View style={styles.currencyLeft}>
                    <AppText style={styles.flag}>{item.flag}</AppText>
                    <View style={styles.currencyMeta}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AppText
                          variant="body"
                          weight={isSelected ? "700" : "500"}
                          color={isSelected ? colors.white : colors.white}
                        >
                          {item.name}
                        </AppText>
                        <View style={styles.codeBadge}>
                          <AppText style={styles.codeBadgeText}>{item.code}</AppText>
                        </View>
                      </View>
                      <AppText variant="footnote" color={colors.textMuted}>
                        {item.symbol} {sampleRateStr ? `• ${sampleRateStr}` : ""}
                      </AppText>
                    </View>
                  </View>

                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Check size={14} color="#0D0E12" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
                {!isLast && <View style={styles.separator} />}
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#101114" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  refreshBtn: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  statusCard: {
    marginHorizontal: spacing[16],
    marginBottom: spacing[16],
    padding: spacing[16],
    backgroundColor: "#171920",
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: "rgba(255, 157, 102, 0.16)",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDesc: {
    lineHeight: 17,
  },
  scrollContent: { paddingHorizontal: spacing[16] },
  sectionCard: {
    backgroundColor: "#171920",
    borderRadius: radius[16],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: 14,
  },
  currencyRowSelected: {
    backgroundColor: "rgba(255, 157, 102, 0.08)",
  },
  currencyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    flex: 1,
  },
  currencyMeta: {
    flex: 1,
    gap: 2,
  },
  flag: { fontSize: 26 },
  codeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  codeBadgeText: {
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "700",
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  separator: { height: 0.5, backgroundColor: "rgba(255, 255, 255, 0.06)", marginLeft: 68 },
});
