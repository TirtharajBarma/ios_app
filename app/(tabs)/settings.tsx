import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
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
import { cancelAllReminders, getScheduledReminders } from "@/utils/notifications";
import { subscriptionsToCSV, parseCSVToSubscriptions } from "@/utils/csv";

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

  const handleExportCSV = async () => {
    Haptics.selectionAsync();
    try {
      const csv = subscriptionsToCSV(subscriptions);
      const fileName = `subtracker-export-${new Date().toISOString().split("T")[0]}.csv`;
      const cacheDir = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? "";
      const filePath = `${cacheDir}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, csv);

      if (Sharing && isSharingAvailable && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(filePath, {
          mimeType: "text/csv",
          dialogTitle: "Export Subscriptions (CSV)",
          UTI: "public.comma-separated-values-text",
        });
      } else {
        Alert.alert("Export Successful", `Backup CSV saved locally to: ${filePath}`);
      }
    } catch (error) {
      Alert.alert("Export Failed", "Could not export your data as CSV.");
    }
  };

  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleImportData = async () => {
    Haptics.selectionAsync();
    setImportText("");
    setShowImportModal(true);
  };

  const processImport = async () => {
    if (!importText.trim()) return;
    if (isImporting) return;
    setIsImporting(true);
    try {
      const trimmed = importText.trim();
      let importInputs: any[] = [];

      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const data = JSON.parse(trimmed);
        if (data && Array.isArray(data.subscriptions)) {
          importInputs = data.subscriptions;
        } else {
          Alert.alert("Invalid Data", "The pasted JSON does not match the backup format.");
          setIsImporting(false);
          return;
        }
      } else {
        const parsed = parseCSVToSubscriptions(trimmed);
        if (parsed.length > 0) {
          importInputs = parsed;
        } else {
          Alert.alert("Invalid Data", "The pasted text is not a valid CSV or JSON format.");
          setIsImporting(false);
          return;
        }
      }

      const normalizedInputs = importInputs.map((sub: any) => ({
        name: sub.name || "Unnamed",
        color: sub.color || sub.brandColor || "#007AFF",
        logoUrl: sub.logoUrl || sub.logo || undefined,
        price: Number(sub.price) || 0,
        currency: sub.currency || "USD",
        billingCycle: sub.billingCycle || "monthly",
        rawBillingCycle: sub.rawBillingCycle || sub.billingCycle || "monthly",
        customIntervalMonths: sub.customIntervalMonths,
        nextBillingDate: sub.nextBillingDate || new Date().toISOString(),
        category: sub.category || "other",
        reminderEnabled: sub.reminderEnabled !== false,
        reminderDays: sub.reminderDays !== undefined && sub.reminderDays !== null ? Number(sub.reminderDays) : 1,
        note: sub.note || sub.notes || undefined,
        isTrial: sub.isTrial === true || String(sub.isTrial).toLowerCase() === "true",
        trialStartDate: sub.trialStartDate,
        trialEndDate: sub.trialEndDate,
        startDate: sub.startDate || sub.nextBillingDate || new Date().toISOString(),
        paymentMethod: sub.paymentMethod || "None",
        website: sub.website,
      }));

      const { importSubscriptions } = useSubscriptionStore.getState();
      await importSubscriptions(normalizedInputs);

      Alert.alert("Success", `Successfully imported ${normalizedInputs.length} subscriptions!`);
      loadReminderCount();
      setShowImportModal(false);
    } catch (error) {
      Alert.alert("Import Failed", "Failed to parse import data. Please check your file format.");
    } finally {
      setIsImporting(false);
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
              Alert.alert("Cleared", "All subscriptions have been deleted.");
            } catch (error) {
              console.error("Failed to clear data:", error);
              Alert.alert("Error", "Failed to clear all data.");
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
        title="Settings"
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
          title="Settings"
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
                label="Export JSON"
                subtitle="Save backup file as JSON"
                onPress={handleExportData}
              />
              <RowDivider />
              <SettingsRow
                icon={<Download size={18} color={colors.accent} />}
                label="Export CSV"
                subtitle="Open in Excel or Google Sheets"
                onPress={handleExportCSV}
              />
              <RowDivider />
              <SettingsRow
                icon={<Upload size={18} color={colors.success} />}
                label="Import JSON/CSV"
                subtitle="Paste backup data directly"
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

      {/* Import Modal (cross-platform) */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImportModal(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ ...StyleSheet.absoluteFill, backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onPress={() => setShowImportModal(false)}
        />
        <View style={{
          position: "absolute",
          left: spacing[40],
          right: spacing[40],
          top: "30%",
          backgroundColor: "#1C1C1E",
          borderRadius: 20,
          borderWidth: 0.5,
          borderColor: "rgba(255, 255, 255, 0.12)",
          padding: spacing[20],
        }}>
          <AppText variant="headline" weight="700" color={colors.white} style={{ marginBottom: spacing[8] }}>
            Import JSON Data
          </AppText>
          <AppText variant="caption1" color={colors.textSecondary} style={{ marginBottom: spacing[16] }}>
            Paste your exported JSON backup data here.
          </AppText>
          <TextInput
            style={{
              backgroundColor: "#2C2C2E",
              borderRadius: 12,
              padding: spacing[12],
              fontSize: 14,
              color: colors.white,
              borderWidth: 0.5,
              borderColor: "rgba(255, 255, 255, 0.12)",
              minHeight: 120,
              textAlignVertical: "top",
              fontFamily: "monospace",
            }}
            placeholder="Paste JSON here..."
            placeholderTextColor={colors.textMuted}
            value={importText}
            onChangeText={setImportText}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: "row", gap: spacing[12], marginTop: spacing[16] }}>
            <TouchableOpacity
              onPress={() => setShowImportModal(false)}
              style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: "#2C2C2E", alignItems: "center", justifyContent: "center" }}
            >
              <AppText weight="600" color={colors.textSecondary}>Cancel</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                processImport();
              }}
              disabled={isImporting}
              style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: isImporting ? colors.textMuted : colors.white, alignItems: "center", justifyContent: "center" }}
            >
              <AppText weight="700" color={colors.black}>{isImporting ? "Importing..." : "Import"}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <View style={styles.row}>
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
      </View>
    </TouchableOpacity>
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
