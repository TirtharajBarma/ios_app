import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  Download,
  Upload,
  Trash2,
  Database,
  ChevronRight,
  Shield,
  Info,
} from "lucide-react-native";
import Animated, { FadeInUp, useSharedValue, useAnimatedScrollHandler } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
let Sharing: any = null;
let isSharingAvailable = false;
try {
  Sharing = require("expo-sharing");
  isSharingAvailable = !!(Sharing && Sharing.isAvailableAsync);
} catch (e) {
  console.warn("Sharing native module is not available.");
}
import { colors, spacing, radius, hexToRGBA } from "@/constants";
import { AppText, Card, Divider } from "@/components/ui";
import {
  OverviewTopBar,
  OverviewLargeHeader,
} from "@/components/common/OverviewHeader";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { seedDatabase } from "@/database";
import { cancelAllReminders, getScheduledReminders } from "@/utils/notifications";

export default function SettingsScreen() {
  const scrollY = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const { subscriptions, loadSubscriptions, removeSubscription } = useSubscriptionStore();
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    loadSubscriptions();
    loadReminderCount();
  }, [loadSubscriptions]);

  const loadReminderCount = async () => {
    const reminders = await getScheduledReminders();
    setReminderCount(reminders.length);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleExportData = async () => {
    Haptics.selectionAsync();
    try {
      const data = {
        version: 1,
        exportDate: new Date().toISOString(),
        subscriptions: subscriptions,
      };
      const json = JSON.stringify(data, null, 2);
      const fileName = `subtracker-export-${new Date().toISOString().split("T")[0]}.json`;
      const cacheDir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? "";
      const filePath = `${cacheDir}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, json);

      if (Sharing && isSharingAvailable && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(filePath, {
          mimeType: "application/json",
          dialogTitle: "Export Subscriptions",
          UTI: "public.json",
        });
      } else {
        Alert.alert("Export Successful", `Backup JSON saved locally to: ${filePath}\n\nNote: Native sharing sheet is not available on this build.`);
      }
    } catch (error) {
      Alert.alert("Export Failed", "Could not export your data.");
    }
  };

  const handleImportData = async () => {
    Haptics.selectionAsync();
    Alert.prompt(
      "Import JSON Data",
      "Paste your exported JSON backup data here to import:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          onPress: async (text?: string) => {
            if (!text) return;
            try {
              const data = JSON.parse(text);
              if (data && Array.isArray(data.subscriptions)) {
                // Clear existing
                for (const sub of subscriptions) {
                  await removeSubscription(sub.id);
                }
                // Import new
                const { addSubscription } = useSubscriptionStore.getState();
                for (const sub of data.subscriptions) {
                  await addSubscription({
                    name: sub.name,
                    color: sub.color || sub.brandColor || "#007AFF",
                    logoUrl: sub.logoUrl || sub.logo || undefined,
                    price: sub.price,
                    currency: sub.currency,
                    billingCycle: sub.billingCycle,
                    nextBillingDate: sub.nextBillingDate,
                    category: sub.category,
                    reminderEnabled: sub.reminderEnabled,
                    reminderDays: sub.reminderDays,
                    note: sub.note || sub.notes || undefined,
                    isTrial: sub.isTrial || false,
                    trialStartDate: sub.trialStartDate,
                    trialEndDate: sub.trialEndDate,
                    startDate: sub.startDate,
                    paymentMethod: sub.paymentMethod,
                    website: sub.website,
                  });
                }
                Alert.alert("Success", `Successfully imported ${data.subscriptions.length} subscriptions!`);
                await loadSubscriptions();
                loadReminderCount();
              } else {
                Alert.alert("Invalid Data", "The pasted JSON does not match the backup format.");
              }
            } catch (error) {
              Alert.alert("Import Failed", "Invalid JSON format.");
            }
          }
        }
      ],
      "plain-text"
    );
  };

  const handleSeedData = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const seeded = await seedDatabase();
    if (seeded) {
      await loadSubscriptions();
      loadReminderCount();
    }
  };

  const handleClearAllData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all subscriptions. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              for (const sub of subscriptions) {
                await removeSubscription(sub.id);
              }
              await cancelAllReminders();
              setReminderCount(0);
            } catch (error) {
              console.error("Failed to clear data:", error);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <OverviewTopBar
        scrollY={scrollY}
        profileName="Settings"
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
          profileName="Settings"
          onProfilePress={() => {}}
        />

        <View style={styles.content}>
          {/* Data Management */}
          <Animated.View entering={FadeInUp.delay(100).springify()}>
            <SectionTitle icon={<Database size={16} color={colors.accent} />} title="Data" />
            <Card padding="none" shadow="small" style={styles.sectionCard}>
              <SettingsRow
                icon={<Download size={18} color={colors.accent} />}
                label="Export Data"
                subtitle="Save subscriptions as JSON"
                onPress={handleExportData}
              />
              <RowDivider />
              <SettingsRow
                icon={<Upload size={18} color={colors.success} />}
                label="Import Data"
                subtitle="Restore from a backup file"
                onPress={handleImportData}
              />
            </Card>
          </Animated.View>

          {/* Notifications */}
          <Animated.View entering={FadeInUp.delay(200).springify()}>
            <SectionTitle icon={<Bell size={16} color={colors.warning} />} title="Notifications" />
            <Card padding="none" shadow="small" style={styles.sectionCard}>
              <SettingsRow
                icon={<Bell size={18} color={colors.warning} />}
                label="Scheduled Reminders"
                subtitle={`${reminderCount} active reminder${reminderCount !== 1 ? "s" : ""}`}
                onPress={loadReminderCount}
              />
            </Card>
          </Animated.View>

          {/* App Info */}
          <Animated.View entering={FadeInUp.delay(300).springify()}>
            <SectionTitle icon={<Info size={16} color={colors.textMuted} />} title="App" />
            <Card padding="none" shadow="small" style={styles.sectionCard}>
              <SettingsRow
                icon={<Database size={18} color={colors.success} />}
                label="Load Sample Data"
                subtitle={`${subscriptions.length} subscription${subscriptions.length !== 1 ? "s" : ""} in database`}
                onPress={handleSeedData}
              />
              <RowDivider />
              <SettingsRow
                icon={<Shield size={18} color={colors.textMuted} />}
                label="Version"
                subtitle="1.0.0"
                onPress={() => {}}
              />
            </Card>
          </Animated.View>

          {/* Danger Zone */}
          <Animated.View entering={FadeInUp.delay(400).springify()}>
            <SectionTitle icon={<Trash2 size={16} color={colors.danger} />} title="Danger Zone" />
            <Card padding="none" shadow="small" style={styles.dangerCard}>
              <SettingsRow
                icon={<Trash2 size={18} color={colors.danger} />}
                label="Clear All Data"
                subtitle="Permanently delete everything"
                onPress={handleClearAllData}
                danger
              />
            </Card>
          </Animated.View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      {icon}
      <AppText variant="footnote" weight="700" color={colors.textMuted}>
        {title.toUpperCase()}
      </AppText>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  subtitle,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Animated.View>
      <Animated.View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={styles.iconWrap}>{icon}</View>
          <View>
            <AppText
              variant="body"
              weight="600"
              color={danger ? colors.danger : colors.white}
            >
              {label}
            </AppText>
            {subtitle && (
              <AppText variant="caption2" color={colors.textMuted}>
                {subtitle}
              </AppText>
            )}
          </View>
        </View>
        <ChevronRight size={14} color={colors.textMuted} />
      </Animated.View>
    </Animated.View>
  );
}

function RowDivider() {
  return (
    <View style={styles.rowDivider}>
      <Divider style={{ flex: 1, marginLeft: spacing[48] }} />
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
    gap: spacing[24],
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
    marginBottom: spacing[8],
    paddingHorizontal: spacing[4],
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius[16],
    overflow: "hidden",
  },
  dangerCard: {
    backgroundColor: hexToRGBA(colors.danger, 0.06),
    borderWidth: 0.5,
    borderColor: hexToRGBA(colors.danger, 0.15),
    borderRadius: radius[16],
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius[8],
    backgroundColor: hexToRGBA(colors.white, 0.06),
    alignItems: "center",
    justifyContent: "center",
  },
  rowDivider: {
    paddingVertical: 0,
  },
});
