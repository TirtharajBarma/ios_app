import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Check,
  ExternalLink,
  Smartphone,
  Plus,
  Zap,
  Info,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { expenseColors } from "@/constants/expenseColors";
import { AppText } from "@/components/ui";
import { useSettingsStore } from "@/store/useSettingsStore";

const isIOS = Platform.OS === "ios";

const OPEN_APP_SETTINGS_URL = isIOS
  ? "app-settings:"
  : "package:com.tirtharajbarma.subscription";

const SAVE_STEPS = [
  "Open the Shortcuts app on your iPhone.",
  "Tap the Search bar or scroll to the App section, and look for “Add Expense”.",
  "Tap “Add Expense” (or long-press and select “Add to Shortcuts”) to add it to your Shortcuts list.",
  "Once it appears under “My Shortcuts”, iOS Back Tap can recognize and run it.",
];

const BACK_TAP_STEPS = [
  "Open iOS Settings › Accessibility › Touch.",
  "Tap Back Tap, then choose Double Tap.",
  "Scroll down to the Shortcuts section and select “Add Expense”.",
  "Double tap the back of your iPhone to log an expense instantly.",
];

const ANDROID_STEPS = [
  "Touch and hold the app icon on your home screen.",
  "Tap Add Expense in the shortcut menu.",
  "Log the expense, and it is saved straight to your ledger.",
];

function Step({ index, children }: { index: number; children: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepBadge}>
        <AppText style={styles.stepBadgeText}>
          {index + 1}
        </AppText>
      </View>
      <AppText style={styles.stepText}>
        {children}
      </AppText>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  sublabel,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={styles.row}
    >
      <View style={styles.rowLeft}>
        {icon}
        <View style={{ flex: 1 }}>
          <AppText style={styles.rowLabel}>
            {label}
          </AppText>
          {sublabel ? (
            <AppText style={styles.rowSublabel}>
              {sublabel}
            </AppText>
          ) : null}
        </View>
      </View>
      <ExternalLink size={16} color="#7E8394" />
    </TouchableOpacity>
  );
}

export default function ShortcutSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const shortcutSaved = useSettingsStore((s) => s.shortcutSaved);
  const setShortcutSaved = useSettingsStore((s) => s.setShortcutSaved);

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert("Could not open", `Nothing on this device handles ${url}.`);
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={22} color="#FF9D66" strokeWidth={2.4} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>
          QUICK ADD SHORTCUT
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        {/* Status Card */}
        <View style={styles.sectionCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusIcon}>
              <Zap size={18} color="#FF9D66" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.statusTitle}>
                Native App Intent Installed
              </AppText>
              <AppText style={styles.statusSub}>
                Built into Siri and the iOS Shortcuts library
              </AppText>
            </View>
          </View>
        </View>

        {isIOS && (
          <AppText style={styles.note}>
            Back Tap only surfaces shortcuts saved in "My Shortcuts". Follow the 2 steps below to activate Back Tap logging.
          </AppText>
        )}

        {isIOS ? (
          <>
            {/* Step 1 — save tile */}
            <View style={styles.sectionWrap}>
              <AppText style={styles.sectionLabel}>
                {shortcutSaved ? "1 · SAVED TO SHORTCUTS ✓" : "1 · ADD TO SHORTCUTS APP"}
              </AppText>
              <View style={styles.sectionCard}>
                <ActionRow
                  icon={<Plus size={18} color="#A9DFBF" />}
                  label="Open Shortcuts App"
                  sublabel="Search “Add Expense” in library to add"
                  onPress={() => open("workflow://")}
                />
                <View style={styles.rowSeparator} />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setShortcutSaved(!shortcutSaved);
                  }}
                  style={styles.row}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.checkBox, shortcutSaved && styles.checkBoxOn]}>
                      {shortcutSaved ? (
                        <Check size={13} color="#0D1117" strokeWidth={3.5} />
                      ) : null}
                    </View>
                    <AppText style={styles.rowLabel}>
                      I added "Add Expense" in Shortcuts
                    </AppText>
                  </View>
                </TouchableOpacity>
              </View>
              {!shortcutSaved && (
                <View style={styles.steps}>
                  {SAVE_STEPS.map((step, index) => (
                    <Step key={step} index={index}>
                      {step}
                    </Step>
                  ))}
                </View>
              )}
            </View>

            {/* Step 2 — assign Back Tap */}
            <View style={styles.sectionWrap}>
              <AppText style={styles.sectionLabel}>
                2 · ASSIGN TO BACK TAP
              </AppText>
              <View style={styles.sectionCard}>
                <View style={styles.steps}>
                  {BACK_TAP_STEPS.map((step, index) => (
                    <Step key={step} index={index}>
                      {step}
                    </Step>
                  ))}
                </View>
                <View style={styles.rowSeparator} />
                <ActionRow
                  icon={<Smartphone size={18} color="#FF9D66" />}
                  label="Open iOS Settings"
                  sublabel="Navigate to Accessibility › Touch › Back Tap"
                  onPress={() => open(OPEN_APP_SETTINGS_URL)}
                />
              </View>
            </View>

            {/* Troubleshooting Note Card without nested text overlap */}
            <View style={styles.troubleshootCard}>
              <View style={styles.troubleshootHeader}>
                <Info size={16} color="#FF9D66" />
                <AppText style={styles.troubleshootTitle}>
                  Back Tap Troubleshooting Tip
                </AppText>
              </View>
              <AppText style={styles.troubleshootText}>
                If double-tapping does not trigger, go to Settings › Accessibility › Touch › Back Tap › Double Tap, select None, wait 2 seconds, and re-select Add Expense to refresh iOS's connection.
              </AppText>
            </View>
          </>
        ) : (
          <View style={styles.sectionWrap}>
            <AppText style={styles.sectionLabel}>
              HOME SCREEN SHORTCUT
            </AppText>
            <View style={styles.sectionCard}>
              <View style={styles.steps}>
                {ANDROID_STEPS.map((step, index) => (
                  <Step key={step} index={index}>
                    {step}
                  </Step>
                ))}
              </View>
            </View>
          </View>
        )}

        <AppText style={styles.footerNote}>
          Once configured, Quick Add works 100% offline and records straight to your ledger.
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: expenseColors.bgPrimary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 157, 102, 0.1)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 20,
  },
  sectionWrap: {
    gap: 8,
  },
  sectionLabel: {
    color: "#7E8394",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255, 157, 102, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  statusSub: {
    color: "#7E8394",
    fontSize: 12,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  rowSublabel: {
    color: "#7E8394",
    fontSize: 12,
    marginTop: 2,
  },
  rowSeparator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    marginLeft: 16,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxOn: {
    backgroundColor: "#A9DFBF",
    borderColor: "#A9DFBF",
  },
  steps: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 4,
  },
  stepBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF9D66",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepBadgeText: {
    color: "#0D0E12",
    fontSize: 10,
    fontWeight: "800",
  },
  stepText: {
    color: "#A2AEBB",
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  note: {
    color: "#8E919D",
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
  },
  troubleshootCard: {
    backgroundColor: "rgba(255, 157, 102, 0.08)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 157, 102, 0.2)",
    gap: 8,
  },
  troubleshootHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  troubleshootTitle: {
    color: "#FF9D66",
    fontSize: 13,
    fontWeight: "700",
  },
  troubleshootText: {
    color: "#C4C8D6",
    fontSize: 13,
    lineHeight: 20,
  },
  footerNote: {
    color: "#555866",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 8,
    marginTop: 8,
  },
});
