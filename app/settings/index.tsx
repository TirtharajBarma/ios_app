import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  ChevronRight,
  User,
  Sun,
  Bell,
  Globe,
  Grid3X3,
  ShieldCheck,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, getCurrencySymbol } from "@/constants";
import { AppText } from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";

function IconBox({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <View style={[styles.iconBox, { backgroundColor: bg }]}>
      {children}
    </View>
  );
}

interface RowProps {
  iconBg: string;
  icon: React.ReactNode;
  label: string;
  value?: string;
  badge?: string;
  onPress: () => void;
}

function Row({ iconBg, icon, label, value, badge, onPress }: RowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={styles.row}
    >
      <View style={styles.rowLeft}>
        <IconBox bg={iconBg}>{icon}</IconBox>
        <AppText variant="body" weight="500" color={colors.white} style={{ flex: 1 }}>
          {label}
        </AppText>
      </View>
      <View style={styles.rowRight}>
        {badge ? (
          <View style={styles.badge}>
            <AppText variant="caption2" weight="600" color="rgba(255,255,255,0.5)">
              {badge}
            </AppText>
          </View>
        ) : value ? (
          <AppText variant="body" color={colors.textMuted} style={{ marginRight: spacing[4] }}>
            {value}
          </AppText>
        ) : null}
        <ChevronRight size={16} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionCard}>{children}</View>;
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function SettingsIndex() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currencyCode, userName } = useSettingsStore();

  const currencySymbol = getCurrencySymbol(currencyCode);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <AppText variant="headline" weight="700" color={colors.white}>
          Settings
        </AppText>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          style={styles.closeBtn}
          activeOpacity={0.7}
        >
          <X size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing[40] },
        ]}
      >
        {/* Section 1 — Preferences */}
        <View>
          <SectionCard>
            <Row
              iconBg="#636366"
              icon={<User size={18} color="#fff" />}
              label="Personalization"
              value={userName ? userName : undefined}
              onPress={() => router.push("/settings/personalization")}
            />
            <Divider />
            <Row
              iconBg="#007AFF"
              icon={<Sun size={18} color="#fff" />}
              label="Appearance"
              badge="Soon"
              onPress={() => router.push("/settings/appearance")}
            />
            <Divider />
            <Row
              iconBg="#FF3B30"
              icon={<Bell size={18} color="#fff" />}
              label="Notifications"
              onPress={() => router.push("/settings/notifications")}
            />
            <Divider />
            <Row
              iconBg="#5856D6"
              icon={<Globe size={18} color="#fff" />}
              label="Currency"
              value={`${currencyCode} (${currencySymbol})`}
              onPress={() => router.push("/settings/currency")}
            />
          </SectionCard>
        </View>

        {/* Section 2 — Organize */}
        <View>
          <SectionCard>
            <Row
              iconBg="#FF9500"
              icon={<Grid3X3 size={18} color="#fff" />}
              label="Organize Subscriptions"
              onPress={() => router.push("/subscriptions")}
            />
          </SectionCard>
        </View>

        {/* Section 3 — Privacy */}
        <View>
          <SectionCard>
            <Row
              iconBg="#8E8E93"
              icon={<ShieldCheck size={18} color="#fff" />}
              label="Privacy & Security"
              onPress={() => router.push("/settings/privacy")}
            />
          </SectionCard>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111113",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    right: spacing[20],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: spacing[16],
    gap: spacing[16],
  },
  sectionCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: radius[16],
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    minHeight: 58,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    flex: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginLeft: 64,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: radius[8],
    paddingHorizontal: spacing[8],
    paddingVertical: 3,
    marginRight: spacing[8],
  },
});
