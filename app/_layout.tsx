import "../global.css";
import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useState, useRef } from "react";
import { AppState, View, StyleSheet, TouchableOpacity } from "react-native";
import { Lock } from "lucide-react-native";
import * as LocalAuthentication from "expo-local-authentication";

import { initDatabase } from "@/database/database";
import { requestNotificationPermissions } from "@/utils/notifications";
import AsyncStorage from "@/utils/storage";
import { useSettingsStore } from "@/store/useSettingsStore";
import { colors, radius } from "@/constants";
import { AppText } from "@/components/ui";
import { authState } from "@/utils/auth";

const ONBOARDING_KEY = "@onboarding_complete";

export default function RootLayout() {
  const router = useRouter();
  const { loadSettings } = useSettingsStore();
  const [isLocked, setIsLocked] = useState(false);
  const appState = useRef(AppState.currentState);

  // Initial setup: load db, check onboarding, and lock the app on start if faceId is enabled in storage
  useEffect(() => {
    initDatabase().catch((e) => console.error("DB init failed:", e));
    requestNotificationPermissions().catch((e) => console.warn("Notification permissions failed:", e));
    loadSettings();

    // Check onboarding status
    AsyncStorage.getItem(ONBOARDING_KEY).then((value: string | null) => {
      if (!value) {
        router.replace("/onboarding");
      }
    });

    // Check Face ID preference directly in AsyncStorage on start (instant lock before store loads)
    AsyncStorage.getItem("@subo_settings_v2").then((val: string | null) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (parsed.state && parsed.state.faceIdEnabled) {
            setIsLocked(true);
            setTimeout(() => authenticate(), 150);
          }
        } catch (e) {
          console.warn("Failed to parse settings for startup lock:", e);
        }
      }
    });
  }, [router]);

  const authenticate = async () => {
    try {
      const hasHW = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHW || !enrolled) {
        setIsLocked(false);
        return;
      }

      authState.isAuthenticating = true;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock App",
        fallbackLabel: "Use Passcode",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
      } else {
        setIsLocked(true);
      }
    } catch (e) {
      console.warn("Auth failed:", e);
      setIsLocked(false); // Fallback to prevent permanent lockouts
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
          authenticate();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
            animation: "slide_from_right",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="subscription/[id]"
          options={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="subscriptions"
          options={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            presentation: "modal",
            headerShown: false,
            gestureEnabled: true,
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
            <TouchableOpacity onPress={authenticate} style={styles.unlockBtn} activeOpacity={0.85}>
              <AppText variant="body" weight="700" color={colors.black}>
                Unlock with Face ID
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
