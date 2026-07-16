import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Fingerprint,
  BarChart2,
  AlertTriangle,
  ShieldCheck,
  Database,
  Eye,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, hexToRGBA } from "@/constants";
import { AppText } from "@/components/ui";
import { authState } from "@/utils/auth";
import { useSettingsStore } from "@/store/useSettingsStore";

// Safe dynamic require for expo-local-authentication
let LocalAuthentication: any = null;
let isBiometricsAvailable = false;
try {
  LocalAuthentication = require("expo-local-authentication");
  isBiometricsAvailable = !!LocalAuthentication;
} catch (e) {
  isBiometricsAvailable = false;
}

interface ToggleRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description: string;
  statusText: string;
  statusColor?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({
  icon,
  iconBg,
  label,
  description,
  statusText,
  statusColor = colors.textMuted as string,
  value,
  onChange,
  disabled,
}: ToggleRowProps) {
  return (
    <View style={[styles.toggleRow, disabled && { opacity: 0.6 }]}>
      <View style={[styles.iconBox, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={styles.toggleText}>
        <AppText variant="body" weight="500" color={colors.white}>{label}</AppText>
        <AppText variant="footnote" color={colors.textMuted} style={{ marginTop: 2, lineHeight: 17 }}>
          {description}
        </AppText>
        <AppText variant="caption2" weight="600" color={statusColor} style={{ marginTop: 4 }}>
          Status: {statusText}
        </AppText>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.selectionAsync(); onChange(v); }}
        trackColor={{ false: "#3A3A3C", true: colors.accent }}
        thumbColor={Platform.OS === "android" ? (value ? colors.white : "#8E8E93") : undefined}
        disabled={disabled}
      />
    </View>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    faceIdEnabled, setFaceIdEnabled,
    analyticsEnabled, setAnalyticsEnabled,
    crashReportsEnabled, setCrashReportsEnabled,
  } = useSettingsStore();

  const [hasHardware, setHasHardware] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [authType, setAuthType] = useState<string>("Face ID / Touch ID");

  useEffect(() => {
    async function checkBiometrics() {
      if (!isBiometricsAvailable || !LocalAuthentication) return;
      try {
        const hasHW = await LocalAuthentication.hasHardwareAsync();
        setHasHardware(hasHW);
        
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setHasBiometrics(enrolled);

        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(1)) setAuthType("Touch ID");
        else if (types.includes(2)) setAuthType("Face ID");
      } catch (e) {
        console.warn("Error checking biometrics:", e);
      }
    }
    checkBiometrics();
  }, []);

  const handleFaceId = async (val: boolean) => {
    if (!isBiometricsAvailable) {
      Alert.alert("Module Missing", "Local Authentication library is missing or failed to load.");
      return;
    }
    if (!hasHardware) {
      Alert.alert("Hardware Unsupported", "This device doesn't support biometric authentication.");
      return;
    }
    if (!hasBiometrics) {
      Alert.alert(
        "No Passcode/FaceID",
        "Face ID or Passcode is not registered on this device. Please enroll it in your iOS device settings first."
      );
      return;
    }

    if (val) {
      try {
        authState.isAuthenticating = true;
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Verify your identity to enable ${authType}`,
          fallbackLabel: "Use Passcode",
          disableDeviceFallback: false,
        });
        if (result.success) {
          await setFaceIdEnabled(true);
        } else {
          Alert.alert("Authentication Failed", "Could not verify identity.");
        }
      } catch (e) {
        Alert.alert("Error", "Biometric authentication error occurred.");
      } finally {
        setTimeout(() => {
          authState.isAuthenticating = false;
        }, 800);
      }
    } else {
      await setFaceIdEnabled(false);
    }
  };

  // Status computation for Face ID
  let faceIdStatus = "Disabled";
  let faceIdColor: string = colors.textMuted;
  if (!isBiometricsAvailable) {
    faceIdStatus = "Module not linked (Requires App Rebuild)";
    faceIdColor = colors.danger;
  } else if (!hasHardware) {
    faceIdStatus = "Hardware unsupported";
    faceIdColor = colors.warning;
  } else if (!hasBiometrics) {
    faceIdStatus = "Not enrolled (Set up in iOS Settings)";
    faceIdColor = colors.warning;
  } else if (faceIdEnabled) {
    faceIdStatus = "Active (App is secure)";
    faceIdColor = colors.success;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.accent} />
        </TouchableOpacity>
        <AppText variant="headline" weight="700" color={colors.white}>Privacy & Security</AppText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing[40] }]}
      >
        {/* Security */}
        <View>
          <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
            SECURITY
          </AppText>
          <View style={styles.sectionCard}>
            <ToggleRow
              icon={<Fingerprint size={18} color="#fff" />}
              iconBg="#007AFF"
              label={authType}
              description={`Require ${authType} to unlock the app when opened`}
              statusText={faceIdStatus}
              statusColor={faceIdColor}
              value={faceIdEnabled}
              onChange={handleFaceId}
              disabled={!isBiometricsAvailable || !hasHardware || !hasBiometrics}
            />
          </View>
          <AppText variant="caption2" color={colors.textMuted} style={styles.footnote}>
            Ensure biometrics are configured in iOS Settings → Face ID & Passcode.
          </AppText>
        </View>

        {/* Privacy */}
        <View>
          <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
            PRIVACY
          </AppText>
          <View style={styles.sectionCard}>
            <ToggleRow
              icon={<BarChart2 size={18} color="#fff" />}
              iconBg="#5856D6"
              label="Usage Analytics"
              description="Share anonymous usage data to improve the app"
              statusText={analyticsEnabled ? "Active (Sending anonymous telemetry)" : "Paused"}
              statusColor={analyticsEnabled ? colors.success : colors.textMuted}
              value={analyticsEnabled}
              onChange={async (v) => { await setAnalyticsEnabled(v); }}
            />
            <View style={styles.separator} />
            <ToggleRow
              icon={<AlertTriangle size={18} color="#fff" />}
              iconBg="#FF9500"
              label="Crash Reports"
              description="Automatically send crash logs to the dev team"
              statusText={crashReportsEnabled ? "Active (Reporting crashes)" : "Paused"}
              statusColor={crashReportsEnabled ? colors.success : colors.textMuted}
              value={crashReportsEnabled}
              onChange={async (v) => { await setCrashReportsEnabled(v); }}
            />
          </View>
          <AppText variant="caption2" color={colors.textMuted} style={styles.footnote}>
            Analytics and crash reports never contain your private subscription details.
          </AppText>
        </View>

        {/* What we store */}
        <View>
          <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
            DATA STORAGE
          </AppText>
          <View style={[styles.sectionCard, { paddingHorizontal: spacing[16], paddingVertical: spacing[16], gap: spacing[16] }]}>
            <View style={styles.dataRow}>
              <View style={[styles.iconBox, { backgroundColor: hexToRGBA(colors.success, 0.15) }]}>
                <Database size={16} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="footnote" weight="600" color={colors.white}>Stored locally on device</AppText>
                <AppText variant="caption2" color={colors.textMuted} style={{ marginTop: 2 }}>Your subscriptions never leave your phone</AppText>
              </View>
            </View>
            <View style={styles.dataRow}>
              <View style={[styles.iconBox, { backgroundColor: hexToRGBA(colors.success, 0.15) }]}>
                <Eye size={16} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="footnote" weight="600" color={colors.white}>No account required</AppText>
                <AppText variant="caption2" color={colors.textMuted} style={{ marginTop: 2 }}>Use the app without signing up for anything</AppText>
              </View>
            </View>
            <View style={styles.dataRow}>
              <View style={[styles.iconBox, { backgroundColor: hexToRGBA(colors.success, 0.15) }]}>
                <ShieldCheck size={16} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="footnote" weight="600" color={colors.white}>No data sold, ever</AppText>
                <AppText variant="caption2" color={colors.textMuted} style={{ marginTop: 2 }}>We don't sell or share your data with anyone</AppText>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
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
  scrollContent: { paddingHorizontal: spacing[16], gap: spacing[24] },
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
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
    gap: spacing[12],
  },
  toggleText: { flex: 1 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  separator: { height: 0.5, backgroundColor: "rgba(255,255,255,0.08)", marginLeft: 64 },
  footnote: { marginTop: spacing[8], paddingHorizontal: spacing[4], lineHeight: 16 },
  dataRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing[12] },
});
