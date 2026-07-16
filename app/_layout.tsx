import "../global.css";
import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect } from "react";
import { initDatabase } from "@/database/database";
import { requestNotificationPermissions } from "@/utils/notifications";
import AsyncStorage from "@/utils/storage";

const ONBOARDING_KEY = "@onboarding_complete";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    initDatabase().catch((e) => console.error("DB init failed:", e));
    requestNotificationPermissions().catch((e) => console.warn("Notification permissions failed:", e));

    AsyncStorage.getItem(ONBOARDING_KEY).then((value: string | null) => {
      if (!value) {
        router.replace("/onboarding");
      }
    });
  }, [router]);

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
          }}
        />
        <Stack.Screen
          name="subscription/[id]"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
