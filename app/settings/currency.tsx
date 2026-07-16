import React from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, CURRENCIES } from "@/constants";
import { AppText } from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";

export default function CurrencyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currencyCode, setCurrencyCode } = useSettingsStore();
  const { convertAllCurrencies } = useSubscriptionStore();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <AppText variant="headline" weight="700" color={colors.white}>Currency</AppText>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.infoBox}>
        <AppText variant="footnote" color={colors.textMuted} style={{ textAlign: "center", lineHeight: 18 }}>
          All subscription amounts will display in the selected currency globally across the app.
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
            return (
              <React.Fragment key={item.code}>
                <TouchableOpacity
                  activeOpacity={0.65}
                  onPress={async () => {
                    Haptics.selectionAsync();
                    await convertAllCurrencies(currencyCode, item.code);
                    await setCurrencyCode(item.code);
                    router.back();
                  }}
                  style={[styles.currencyRow, isSelected && styles.currencyRowSelected]}
                >
                  <View style={styles.currencyLeft}>
                    <AppText style={styles.flag}>{item.flag}</AppText>
                    <View>
                      <AppText variant="body" weight={isSelected ? "700" : "500"} color={isSelected ? colors.white : colors.white}>
                        {item.name}
                      </AppText>
                      <AppText variant="footnote" color={colors.textMuted}>
                        {item.code} · {item.symbol}
                      </AppText>
                    </View>
                  </View>
                  {isSelected && <Check size={20} color={colors.accent} strokeWidth={2.5} />}
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
  container: { flex: 1, backgroundColor: "#111113" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[16], paddingVertical: spacing[12] },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  infoBox: {
    marginHorizontal: spacing[16],
    marginBottom: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radius[12],
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  scrollContent: { paddingHorizontal: spacing[16] },
  sectionCard: { backgroundColor: "#1C1C1E", borderRadius: radius[16], overflow: "hidden", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" },
  currencyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[16], paddingVertical: spacing[16] },
  currencyRowSelected: { backgroundColor: "rgba(255,255,255,0.04)" },
  currencyLeft: { flexDirection: "row", alignItems: "center", gap: spacing[16], flex: 1 },
  flag: { fontSize: 28 },
  separator: { height: 0.5, backgroundColor: "rgba(255,255,255,0.08)", marginLeft: 72 },
});
