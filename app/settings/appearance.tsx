import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Moon, Sun, Smartphone, Clock } from "lucide-react-native";

import { colors, spacing, radius, hexToRGBA } from "@/constants";
import { AppText } from "@/components/ui";

const OPTIONS = [
  { label: "System", description: "Follows your device setting", icon: <Smartphone size={20} color="#8E8E93" />, value: "system" },
  { label: "Light", description: "Always light", icon: <Sun size={20} color="#8E8E93" />, value: "light" },
  { label: "Dark", description: "Always dark", icon: <Moon size={20} color="#8E8E93" />, value: "dark" },
];

export default function AppearanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <AppText variant="headline" weight="700" color={colors.white}>Appearance</AppText>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        {/* Coming Soon Banner */}
        <View style={styles.comingSoonBanner}>
          <View style={styles.comingSoonIcon}>
            <Clock size={22} color="#FF9500" />
          </View>
          <View style={styles.comingSoonText}>
            <AppText variant="body" weight="700" color={colors.white}>Coming Soon</AppText>
            <AppText variant="footnote" color={colors.textMuted} style={{ marginTop: 2, lineHeight: 18 }}>
              Light & dark mode support is in the works. For now, the app follows your device's system appearance.
            </AppText>
          </View>
        </View>

        {/* Preview (disabled) */}
        <View>
          <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
            PREVIEW
          </AppText>
          <View style={styles.sectionCard}>
            {OPTIONS.map((opt, index) => {
              const isLast = index === OPTIONS.length - 1;
              return (
                <React.Fragment key={opt.value}>
                  <View style={styles.row}>
                    <View style={styles.rowLeft}>
                      {opt.icon}
                      <View>
                        <AppText variant="body" weight="500" color={colors.textMuted}>{opt.label}</AppText>
                        <AppText variant="footnote" color={colors.textMuted} style={{ opacity: 0.6, marginTop: 2 }}>{opt.description}</AppText>
                      </View>
                    </View>
                    {opt.value === "system" && (
                      <View style={styles.activePill}>
                        <AppText variant="caption2" weight="700" color={colors.white}>Active</AppText>
                      </View>
                    )}
                  </View>
                  {!isLast && <View style={styles.separator} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        <View>
          <AppText variant="footnote" color={colors.textMuted} style={styles.note}>
            Tap Settings on your device to control the system-wide appearance preference.
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111113" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[16], paddingVertical: spacing[12] },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  content: { paddingHorizontal: spacing[16], gap: spacing[20] },
  comingSoonBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[12],
    backgroundColor: hexToRGBA("#FF9500", 0.1),
    borderRadius: radius[16],
    padding: spacing[16],
    borderWidth: 0.5,
    borderColor: hexToRGBA("#FF9500", 0.25),
    marginTop: spacing[8],
  },
  comingSoonIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: hexToRGBA("#FF9500", 0.15),
    alignItems: "center",
    justifyContent: "center",
  },
  comingSoonText: { flex: 1 },
  sectionLabel: { marginBottom: spacing[8], paddingHorizontal: spacing[4] },
  sectionCard: { backgroundColor: "#1C1C1E", borderRadius: radius[16], overflow: "hidden", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.08)" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[16], paddingVertical: spacing[16], opacity: 0.55 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: spacing[12], flex: 1 },
  separator: { height: 0.5, backgroundColor: "rgba(255,255,255,0.08)", marginLeft: spacing[16] },
  activePill: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: radius[8], paddingHorizontal: spacing[8], paddingVertical: 4 },
  note: { paddingHorizontal: spacing[4] },
});
