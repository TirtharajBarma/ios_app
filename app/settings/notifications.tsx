import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  Linking,
  AppState,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Check, Bell, BellOff, ExternalLink } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius } from "@/constants";
import { AppText } from "@/components/ui";
import { useSettingsStore, NotificationTiming } from "@/store/useSettingsStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import {
  requestNotificationPermissions,
  scheduleAllReminders,
  cancelAllReminders,
  isNotificationsAvailable,
} from "@/utils/notifications";

const TIMING_OPTIONS: { label: string; sublabel: string; value: NotificationTiming; days: number }[] = [
  { label: "1 Day Before",  sublabel: "Get notified the day before renewal",  value: "1day",  days: 1 },
  { label: "3 Days Before", sublabel: "Get notified 3 days before renewal",   value: "3days", days: 3 },
  { label: "1 Week Before", sublabel: "Get notified a week before renewal",   value: "1week", days: 7 },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notificationsEnabled, setNotificationsEnabled, notificationTiming, setNotificationTiming } = useSettingsStore();
  const { subscriptions } = useSubscriptionStore();

  // Automatically synchronize state with iOS Notification Center status when screen mounts or app resumes
  useEffect(() => {
    async function syncSystemPermission() {
      if (!isNotificationsAvailable) return;
      try {
        const expoNotifications = require("expo-notifications");
        const { status } = await expoNotifications.getPermissionsAsync();
        const isGranted = status === "granted";
        if (isGranted !== notificationsEnabled) {
          await setNotificationsEnabled(isGranted);
        }
      } catch (e) {
        console.warn("Failed to check notifications permission:", e);
      }
    }

    syncSystemPermission();

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        syncSystemPermission();
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, [notificationsEnabled]);

  // Toggle notifications on/off — request permission if enabling, cancel all if disabling
  const handleToggle = async (val: boolean) => {
    Haptics.selectionAsync();
    if (val) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "The app needs notification permission to send you renewal reminders. Tap 'Settings' to enable it.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Settings", onPress: () => Linking.openURL("app-settings:") },
          ]
        );
        return;
      }
      await setNotificationsEnabled(true);
      // Re-schedule all existing subscriptions with current timing
      const daysOption = TIMING_OPTIONS.find((o) => o.value === notificationTiming);
      const daysAhead = daysOption?.days ?? 1;
      const enriched = subscriptions.map((s) => ({
        ...s,
        reminderEnabled: s.reminderEnabled !== false,
        reminderDays: daysAhead,
      }));
      await scheduleAllReminders(enriched);
    } else {
      await setNotificationsEnabled(false);
      await cancelAllReminders();
    }
  };

  // When timing changes, re-schedule all reminders with new timing
  const handleTimingChange = async (timing: NotificationTiming) => {
    Haptics.selectionAsync();
    await setNotificationTiming(timing);
    if (!notificationsEnabled) return;
    const daysOption = TIMING_OPTIONS.find((o) => o.value === timing);
    const daysAhead = daysOption?.days ?? 1;
    const enriched = subscriptions.map((s) => ({
      ...s,
      reminderEnabled: s.reminderEnabled !== false,
      reminderDays: daysAhead,
    }));
    await scheduleAllReminders(enriched);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <AppText variant="headline" weight="700" color={colors.white}>Notifications</AppText>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.scrollContent}>
        {/* Enable Toggle */}
        <View style={styles.sectionCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <View style={styles.iconBox}>
                {notificationsEnabled
                  ? <Bell size={18} color="#fff" />
                  : <BellOff size={18} color="#fff" />
                }
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="500" color={colors.white}>Renewal Reminders</AppText>
                <AppText variant="footnote" color={colors.textMuted} style={{ marginTop: 2 }}>
                  Notify me before subscriptions renew
                </AppText>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggle}
              trackColor={{ false: "#3A3A3C", true: colors.accent }}
              thumbColor={Platform.OS === "android" ? (notificationsEnabled ? colors.white : "#8E8E93") : undefined}
            />
          </View>
        </View>

        {/* Timing Options — only shown when enabled */}
        {notificationsEnabled && (
          <View>
            <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
              REMIND ME
            </AppText>
            <View style={styles.sectionCard}>
              {TIMING_OPTIONS.map((opt, index) => {
                const isSelected = notificationTiming === opt.value;
                const isLast = index === TIMING_OPTIONS.length - 1;
                return (
                  <React.Fragment key={opt.value}>
                    <TouchableOpacity
                      activeOpacity={0.65}
                      onPress={() => handleTimingChange(opt.value)}
                      style={styles.row}
                    >
                      <View style={styles.rowLeft}>
                        <AppText variant="body" weight="500" color={colors.white}>{opt.label}</AppText>
                        <AppText variant="footnote" color={colors.textMuted} style={{ marginTop: 2 }}>
                          {opt.sublabel}
                        </AppText>
                      </View>
                      {isSelected && <Check size={20} color={colors.accent} strokeWidth={2.5} />}
                    </TouchableOpacity>
                    {!isLast && <View style={styles.rowSeparator} />}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* Open iOS Settings shortcut */}
        <TouchableOpacity
          style={styles.openSettingsRow}
          activeOpacity={0.7}
          onPress={() => Linking.openURL("app-settings:")}
        >
          <AppText variant="footnote" color={colors.accent}>Manage in iPhone Settings</AppText>
          <ExternalLink size={14} color={colors.accent} />
        </TouchableOpacity>

        <AppText variant="footnote" color={colors.textMuted} style={styles.note}>
          {notificationsEnabled
            ? `Reminders are active. Each subscription will trigger a notification ${TIMING_OPTIONS.find(o => o.value === notificationTiming)?.label.toLowerCase() ?? "1 day before"} its renewal.`
            : "Enable reminders to get notified before your subscriptions renew. The app uses iOS scheduled notifications — they work even when the app is closed."
          }
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111113" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  backBtn: { width: 44, height: 44, alignItems: "flex-start", justifyContent: "center" },
  scrollContent: { paddingHorizontal: spacing[16], gap: spacing[20] },
  sectionLabel: { marginBottom: spacing[8], paddingHorizontal: spacing[4] },
  sectionCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: radius[16],
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
  },
  rowLeft: { flex: 1, marginRight: spacing[12] },
  rowSeparator: {
    height: 0.5,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginLeft: spacing[16],
  },
  openSettingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[4],
  },
  note: { paddingHorizontal: spacing[4] },
});
