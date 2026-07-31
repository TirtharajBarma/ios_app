import React, { useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput } from "react-native";
import {
  Music,
  Video,
  Gamepad2,
  BookOpen,
  Brain,
  Cloud,
  Tv,
  Headphones,
  Film,
  Code2,
  Database,
  Server,
  HardDrive,
  Globe,
  Mail,
  Camera,
  Smartphone,
  Monitor,
  ShoppingCart,
  Coffee,
  Dumbbell,
  Car,
  Plane,
  Home,
  Zap,
  Wifi,
  Droplets,
  Heart,
  Star,
  Crown,
  Lock,
  Shield,
  Bell,
  Calendar,
  Clock,
  Search,
  X,
  type LucideIcon,
} from "lucide-react-native";
import SwipeDownSheet from "./SwipeDownSheet";
import AppText from "./AppText";
import { colors, spacing } from "@/constants";

interface IconEntry {
  icon: LucideIcon;
  name: string;
  label: string;
}

const ICON_SETS: { title: string; icons: IconEntry[] }[] = [
  {
    title: "Entertainment",
    icons: [
      { icon: Film, name: "Film", label: "Movies" },
      { icon: Tv, name: "Tv", label: "TV" },
      { icon: Video, name: "Video", label: "Video" },
      { icon: Music, name: "Music", label: "Music" },
      { icon: Headphones, name: "Headphones", label: "Audio" },
      { icon: Gamepad2, name: "Gamepad2", label: "Gaming" },
      { icon: BookOpen, name: "BookOpen", label: "Books" },
    ],
  },
  {
    title: "Tech",
    icons: [
      { icon: Cloud, name: "Cloud", label: "Cloud" },
      { icon: Database, name: "Database", label: "Database" },
      { icon: Server, name: "Server", label: "Server" },
      { icon: Code2, name: "Code2", label: "Code" },
      { icon: HardDrive, name: "HardDrive", label: "Storage" },
      { icon: Globe, name: "Globe", label: "Web" },
      { icon: Mail, name: "Mail", label: "Email" },
      { icon: Shield, name: "Shield", label: "Security" },
      { icon: Lock, name: "Lock", label: "Lock" },
      { icon: Brain, name: "Brain", label: "AI" },
    ],
  },
  {
    title: "Lifestyle",
    icons: [
      { icon: Dumbbell, name: "Dumbbell", label: "Fitness" },
      { icon: Heart, name: "Heart", label: "Health" },
      { icon: Coffee, name: "Coffee", label: "Coffee" },
      { icon: ShoppingCart, name: "ShoppingCart", label: "Shopping" },
      { icon: Car, name: "Car", label: "Auto" },
      { icon: Plane, name: "Plane", label: "Travel" },
      { icon: Home, name: "Home", label: "Home" },
      { icon: Camera, name: "Camera", label: "Photo" },
      { icon: Smartphone, name: "Smartphone", label: "Mobile" },
      { icon: Monitor, name: "Monitor", label: "Desktop" },
    ],
  },
  {
    title: "Utilities",
    icons: [
      { icon: Zap, name: "Zap", label: "Energy" },
      { icon: Wifi, name: "Wifi", label: "Internet" },
      { icon: Droplets, name: "Droplets", label: "Water" },
      { icon: Bell, name: "Bell", label: "Alerts" },
      { icon: Calendar, name: "Calendar", label: "Calendar" },
      { icon: Clock, name: "Clock", label: "Clock" },
      { icon: Star, name: "Star", label: "Star" },
      { icon: Crown, name: "Crown", label: "Premium" },
    ],
  },
];

export interface IconPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (iconName: string) => void;
}

const ICON_SIZE = 28;

export default function IconPicker({ visible, onClose, onSelect }: IconPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  const filteredSets = useMemo(() => {
    if (!searchQuery.trim()) return ICON_SETS;
    const q = searchQuery.toLowerCase();
    return ICON_SETS
      .map((section) => ({
        ...section,
        icons: section.icons.filter(
          (e) =>
            e.label.toLowerCase().includes(q) ||
            e.name.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.icons.length > 0);
  }, [searchQuery]);

  const handleSelect = (name: string) => {
    setSelectedIcon(name);
    onSelect(name);
    onClose();
  };

  return (
    <SwipeDownSheet visible={visible} onClose={onClose} heightRatio={0.78}>
      <View style={styles.container}>
        <View style={styles.header}>
          <AppText variant="title3" weight="700" color={colors.white}>
            Pick an Icon
          </AppText>
          <AppText variant="caption1" color={colors.textSecondary}>
            Choose a symbol for this subscription
          </AppText>
        </View>

        <View style={styles.searchRow}>
          <Search size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search icons..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {filteredSets.map((section) => (
            <View key={section.title} style={styles.section}>
              <AppText
                variant="subheadline"
                weight="600"
                color={colors.textSecondary}
                style={styles.sectionTitle}
              >
                {section.title}
              </AppText>
              <View style={styles.grid}>
                {section.icons.map((entry) => {
                  const Icon = entry.icon;
                  const isSelected = selectedIcon === entry.name;
                  return (
                    <TouchableOpacity
                      key={entry.name}
                      onPress={() => handleSelect(entry.name)}
                      accessibilityLabel={`${entry.label} icon`}
                      accessibilityRole="button"
                      style={[
                        styles.iconItem,
                        isSelected && styles.iconItemSelected,
                      ]}
                    >
                      <Icon
                        size={ICON_SIZE}
                        color={isSelected ? colors.accent : colors.white}
                      />
                      <AppText
                        variant="caption2"
                        color={isSelected ? colors.accent : colors.textSecondary}
                        style={styles.iconLabel}
                        numberOfLines={1}
                      >
                        {entry.label}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </SwipeDownSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[24],
    paddingBottom: spacing[24],
  },
  header: {
    marginBottom: spacing[16],
    gap: 4,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    marginBottom: spacing[16],
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: colors.white,
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[40],
  },
  section: {
    marginBottom: spacing[24],
  },
  sectionTitle: {
    marginBottom: spacing[12],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  iconItem: {
    width: "18%",
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  iconItemSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(10, 132, 255, 0.12)",
  },
  iconLabel: {
    fontSize: 9,
    textAlign: "center",
  },
});
