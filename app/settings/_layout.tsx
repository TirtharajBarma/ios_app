import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
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
        name="privacy"
        options={{
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
