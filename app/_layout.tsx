/**
 * Root layout.
 *
 * NOTE: UI/screens are intentionally not built yet. This is the minimal
 * shell required for Expo Router to compile and bundle. It wraps the app
 * in the GestureHandler root (needed by Reanimated + gestures) and imports
 * the global stylesheet so NativeWind's classes are available everywhere.
 */
import "../global.css";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect } from "react";
import { initDatabase } from "@/database/database";

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add/search"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
