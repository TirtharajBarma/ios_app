import React from "react";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: "Ledger",
        }}
      />
      <Tabs.Screen
        name="visualizer"
        options={{
          title: "Visualizer",
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: "Import",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
        }}
      />
    </Tabs>
  );
}
