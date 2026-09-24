import { Stack } from "expo-router";
import { Platform } from "react-native";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
        fullScreenGestureEnabled: Platform.OS === 'ios',
        gestureDirection: "horizontal",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="personalization"
        options={{
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="appearance"
        options={{
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="currency"
        options={{
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="shared"
        options={{
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="shared/[id]"
        options={{
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="budget"
        options={{
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="data"
        options={{
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
