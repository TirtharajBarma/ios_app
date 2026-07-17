import React from "react";
import { Tabs } from "expo-router";
import { Platform, View, StyleSheet } from "react-native";
import { Home, BarChart3, Settings } from "lucide-react-native";
import { colors, spacing, hexToRGBA } from "@/constants";

function TabIcon({ icon: Icon, focused, color }: { icon: typeof Home; focused: boolean; color: any }) {
  return (
    <View style={styles.iconContainer}>
      <Icon size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
      {focused && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
    </View>
  );
}

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
          title: "Overview",
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: hexToRGBA(colors.background, 0.92),
    borderTopColor: colors.border,
    borderTopWidth: 0.5,
    height: Platform.OS === "ios" ? 88 : 64,
    paddingTop: spacing[8],
    paddingBottom: Platform.OS === "ios" ? spacing[20] : spacing[8],
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
