import "../global.css";
import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useState, useRef } from "react";
import { AppState, View, StyleSheet, TouchableOpacity } from "react-native";
import { Lock } from "lucide-react-native";
import * as LocalAuthentication from "expo-local-authentication";

import { initDatabase } from "@/database/database";
import { initAuditLogs, installConsoleCapture, logAction, logWarn, logInfo, logException } from "@/utils/auditLog";
import { requestNotificationPermissions, rescheduleAllAppNotifications } from "@/utils/notifications";
import AsyncStorage from "@/utils/storage";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { useExpenseStore, monthKeyOf } from "@/store/useExpenseStore";
import { isSupabaseConfigured, fetchShareGroups, updateMyName } from "@/api/supabase";
import { initSharedRealtimeSync } from "@/utils/sync";
import { drainPendingQuickAdds, syncShortcutsParameters } from "@/services/expense/quickAddNative";
import { checkAndAutoApplyUpdates } from "@/services/updates/updateManager";
import { trackDeviceTelemetry } from "@/services/telemetry/deviceTracker";
import { colors, radius } from "@/constants";
import { AppText } from "@/components/ui";
import { authState } from "@/utils/auth";

/** Debounced fire-and-forget pull of shared subscriptions (no-op when not configured). */
function triggerSharedSync() {
  const { shareGroups } = useSettingsStore.getState();
  if (!shareGroups.length || !isSupabaseConfigured()) return;
  useSubscriptionStore.getState().syncGroup().catch(() => {});
}

/**
 * Reconciles expenses the iOS App Intent saved while the app was terminated.
 *
 * The intent writes the persisted state itself, then leaves a durable outbox
 * entry. Draining it here re-reads the ledger from disk and replays anything
 * that went missing, so a save the user already saw confirmed in Shortcuts can
 * never be dropped by a stale in-memory snapshot.
 */
function drainQuickAdds() {
  drainPendingQuickAdds().catch(() => {});
  syncShortcutsParameters().catch(() => {});
}

export default function RootLayout() {
  const router = useRouter();
  const { loadSettings } = useSettingsStore();
  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Unlock");
  const appState = useRef(AppState.currentState);

  // Initial setup: load db and lock the app on start if faceId is enabled in storage
  useEffect(() => {
    async function initialize() {
      let isBiometricProtected = false;
      try {
        // Read lock preference BEFORE any database, network, or UI operations
        let settingsStr = await AsyncStorage.getItem("@expense_settings_v3");
        if (!settingsStr) {
          settingsStr = await AsyncStorage.getItem("@legacy_settings_v3");
        }
        if (settingsStr) {
          try {
            const parsed = JSON.parse(settingsStr);
            if (parsed.faceIdEnabled) {
              isBiometricProtected = true;
              setIsLocked(true);
              setTimeout(() => authenticate(), 150);
            }
          } catch {}
        }

        logInfo("app", "App launch started");
        installConsoleCapture();
        // Best-effort, non-blocking: never delay the UI behind log init.
        await initAuditLogs().catch(() => {});
        await initDatabase();
        await requestNotificationPermissions();
        await loadSettings();

        logInfo("app", "App initialized successfully", {
          hasBiometrics: useSettingsStore.getState().faceIdEnabled,
          shareGroupCount: useSettingsStore.getState().shareGroups.length,
        });

        // Re-push the persisted display name so group members see the latest
        // Personalization name even if a previous push failed while offline.
        const persistedName = useSettingsStore.getState().userName.trim();
        if (persistedName && isSupabaseConfigured()) {
          updateMyName(persistedName).catch((err) =>
            console.warn("Startup: could not push display name to groups:", err)
          );
        }

        // Always re-fetch groups from Supabase on startup so membership
        // is restored even if AsyncStorage was cleared (e.g. Android system
        // clears app data, reinstall, or the local cache is stale).
        // This is non-blocking: the UI becomes ready immediately and the
        // group list updates reactively when the fetch completes.
        // On a fetch FAILURE the cached groups are deliberately left intact —
        // a transient network blip must never look like "your groups vanished".
        if (isSupabaseConfigured()) {
          initSharedRealtimeSync();
          const mapToPlain = (g: { id: string; name: string; code: string | null; role: "owner" | "member"; ownerUserId: string | null }) => ({
            id: g.id,
            name: g.name,
            code: g.code,
            role: g.role,
            ownerUserId: g.ownerUserId,
          });
          fetchShareGroups()
            .then((groups) => {
              useSettingsStore.getState().setShareGroups(groups.map(mapToPlain));
              if (groups.length > 0) {
                useSubscriptionStore.getState().syncGroup().catch(() => {});
              }
            })
            .catch((err) => {
              console.warn("Startup: could not re-fetch groups from Supabase:", err);
            });
        }

        // Fall back to the cached groups while the fetch (if configured) is
        // still resolving, so shared subscriptions sync promptly on cold start.
        if (useSettingsStore.getState().shareGroups.length) {
          triggerSharedSync();
        }

        // A cold start after an App Intent run has no AppState transition, so
        // drain the native outbox here too.
        drainQuickAdds();

        // Non-blocking background check for OTA updates and 2-day auto-apply
        checkAndAutoApplyUpdates().catch(() => {});
        if (useSettingsStore.getState().analyticsEnabled) {
          trackDeviceTelemetry().catch(() => {});
        }
        rescheduleAllAppNotifications().catch(() => {});
      } catch (e) {
        logException("app", "Startup initialization failed", e);
        console.warn("Startup initialization failed:", e);
        if (isBiometricProtected) {
          setIsLocked(true); // Fail closed
        }
      }
      setIsReady(true);
    }
    initialize();
  }, [router, loadSettings]);

  const authenticate = async () => {
    try {
      const hasHW = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHW && enrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const hasFaceId = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        setBiometricLabel(hasFaceId ? "Unlock with Face ID" : "Unlock with Fingerprint");
      } else {
        setBiometricLabel("Unlock with Passcode");
      }

      authState.isAuthenticating = true;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Monevo",
        fallbackLabel: "Use Passcode",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
        logAction("security", "App unlocked via biometrics");
      } else {
        // Fail closed
        setIsLocked(true);
        logWarn("security", "Biometric unlock cancelled or failed");
      }
    } catch (e) {
      logException("security", "Biometric authentication error", e);
      console.warn("Auth failed:", e);
      // Fail closed: never unlock the app on error
      setIsLocked(true);
    } finally {
      // Clear flag after small delay to let AppState state transitions settle
      setTimeout(() => {
        authState.isAuthenticating = false;
      }, 800);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current === "background" &&
        nextAppState === "active"
      ) {
        if (authState.isAuthenticating) {
          // Bypassing AppState change because it was triggered by the biometric modal dismissing itself!
          appState.current = nextAppState;
          return;
        }

        const faceId = useSettingsStore.getState().faceIdEnabled;
        if (faceId) {
          setIsLocked(true);
          logAction("security", "App locked on resume");
          authenticate();
        }

        triggerSharedSync();
        drainQuickAdds();
        useExpenseStore.getState().setSelectedMonth(monthKeyOf());
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: "#111113" }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="quick-add-expense"
          options={{
            presentation: "modal",
            headerShown: false,
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="add/search"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="add/paid"
          options={{
            headerShown: false,
            animation: "simple_push",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="subscription/[id]"
          options={{
            headerShown: false,
            animation: "simple_push",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="subscriptions"
          options={{
            headerShown: false,
            animation: "simple_push",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="folder/[id]"
          options={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="receivables/index"
          options={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="account/[id]"
          options={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
      </Stack>

      {isLocked && (
        <View style={styles.lockOverlay}>
          <View style={styles.lockContent}>
            <View style={styles.lockIconBox}>
              <Lock size={32} color={colors.accent} />
            </View>
            <AppText variant="title3" weight="800" color={colors.white} style={styles.lockTitle}>
              App Locked
            </AppText>
            <AppText variant="body" color={colors.textMuted} style={styles.lockSubtitle}>
              Authentication is required to view your subscription details.
            </AppText>
            <TouchableOpacity
              onPress={authenticate}
              style={styles.unlockBtn}
              activeOpacity={0.85}
              accessibilityLabel="Unlock app with biometrics"
              accessibilityRole="button"
              accessibilityHint="Authenticates using Face ID or fingerprint"
            >
              <AppText variant="body" weight="700" color={colors.black}>
                {biometricLabel}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#111113",
    zIndex: 99999,
    alignItems: "center",
    justifyContent: "center",
  },
  lockContent: {
    alignItems: "center",
    paddingHorizontal: 40,
    width: "100%",
  },
  lockIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(255, 96, 48, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  lockTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  lockSubtitle: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 36,
  },
  unlockBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: radius[16],
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
});
