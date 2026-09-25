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
  WifiOff,
  Globe,
  Cpu,
  Lock,
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
        {/* Local-First Architecture Badge */}
        <View style={styles.localFirstBanner}>
          <View style={styles.bannerHeaderRow}>
            <View style={styles.bannerBadge}>
              <ShieldCheck size={14} color="#70D6BC" />
              <AppText style={styles.bannerBadgeText}>OFFLINE-FIRST ARCHITECTURE</AppText>
            </View>
          </View>
          <AppText variant="subheadline" weight="700" color={colors.white} style={{ marginBottom: 4 }}>
            100% Private, On-Device Financial Intelligence
          </AppText>
          <AppText variant="footnote" color={colors.textMuted} style={{ lineHeight: 18 }}>
            Your bank statements, account balances, transaction records, and personal budgets are processed and stored exclusively on your device. We do not operate remote servers for financial storage.
          </AppText>
        </View>

        {/* Security */}
        <View>
          <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
            SECURITY
          </AppText>
          <View style={styles.sectionCard}>
            <ToggleRow
              icon={<Fingerprint size={18} color="#fff" />}
              iconBg="#9DC6EB"
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

        {/* How Network & Calculations Work */}
        <View>
          <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
            NETWORK & DATA USAGE
          </AppText>
          <View style={[styles.sectionCard, { padding: spacing[16], gap: spacing[16] }]}>
            <View style={styles.dataRow}>
              <View style={[styles.iconBox, { backgroundColor: "rgba(112, 214, 188, 0.15)" }]}>
                <WifiOff size={16} color="#70D6BC" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="footnote" weight="600" color={colors.white}>Zero Financial Telemetry</AppText>
                <AppText variant="caption2" color={colors.textMuted} style={{ marginTop: 2, lineHeight: 16 }}>
                  Financial data is never transmitted across the network. All expense analytics and budgets run entirely offline.
                </AppText>
              </View>
            </View>

            <View style={styles.separatorNoMargin} />

            <View style={styles.dataRow}>
              <View style={[styles.iconBox, { backgroundColor: "rgba(255, 157, 102, 0.15)" }]}>
                <Globe size={16} color="#FF9D66" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="footnote" weight="600" color={colors.white}>Selective Network Use (Exchange Rates)</AppText>
                <AppText variant="caption2" color={colors.textMuted} style={{ marginTop: 2, lineHeight: 16 }}>
                  Internet is only required for fetching public currency exchange rate tables. Currency conversion math is computed locally without transmitting transaction amounts.
                </AppText>
              </View>
            </View>

            <View style={styles.separatorNoMargin} />

            <View style={styles.dataRow}>
              <View style={[styles.iconBox, { backgroundColor: "rgba(167, 139, 250, 0.15)" }]}>
                <Cpu size={16} color="#A78BFA" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="footnote" weight="600" color={colors.white}>100% On-Device AI Classification</AppText>
                <AppText variant="caption2" color={colors.textMuted} style={{ marginTop: 2, lineHeight: 16 }}>
                  Smart Search and statement merchant parsing run locally on your Apple Neural Engine / device hardware without cloud APIs.
                </AppText>
              </View>
            </View>
          </View>
        </View>

        {/* Optional Diagnostics */}
        <View>
          <AppText variant="footnote" weight="700" color={colors.textMuted} style={styles.sectionLabel}>
            OPTIONAL DIAGNOSTICS
          </AppText>
          <View style={styles.sectionCard}>
            <ToggleRow
              icon={<BarChart2 size={18} color="#fff" />}
              iconBg="#C4A7E7"
              label="Usage Analytics"
              description="Share anonymous navigation metrics to improve the UI"
              statusText={analyticsEnabled ? "Active (Anonymous UI telemetry)" : "Paused"}
              statusColor={analyticsEnabled ? colors.success : colors.textMuted}
              value={analyticsEnabled}
              onChange={async (v) => { await setAnalyticsEnabled(v); }}
            />
            <View style={styles.separator} />
            <ToggleRow
              icon={<AlertTriangle size={18} color="#fff" />}
              iconBg="#F8A888"
              label="Crash Reports"
              description="Automatically send crash logs for app stability"
              statusText={crashReportsEnabled ? "Active (Crash reporting)" : "Paused"}
              statusColor={crashReportsEnabled ? colors.success : colors.textMuted}
              value={crashReportsEnabled}
              onChange={async (v) => { await setCrashReportsEnabled(v); }}
            />
          </View>
          <AppText variant="caption2" color={colors.textMuted} style={styles.footnote}>
            Analytics and crash reports never include transaction details, account numbers, notes, or balances.
          </AppText>
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
  scrollContent: { paddingHorizontal: spacing[16], gap: spacing[24] },
  localFirstBanner: {
    backgroundColor: "#161920",
    borderRadius: radius[16],
    padding: spacing[16],
    borderWidth: 1,
    borderColor: "rgba(112, 214, 188, 0.25)",
  },
  bannerHeaderRow: {
    marginBottom: 8,
  },
  bannerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(112, 214, 188, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  bannerBadgeText: {
    color: "#70D6BC",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  sectionLabel: { marginBottom: spacing[8], paddingHorizontal: spacing[4] },
  sectionCard: {
    backgroundColor: "#171920",
    borderRadius: radius[16],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
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
  separator: { height: 0.5, backgroundColor: "rgba(255, 255, 255, 0.06)", marginLeft: 64 },
  separatorNoMargin: { height: 0.5, backgroundColor: "rgba(255, 255, 255, 0.06)" },
  footnote: { marginTop: spacing[8], paddingHorizontal: spacing[4], lineHeight: 16 },
  dataRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing[12] },
});
