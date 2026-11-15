import React, { useMemo, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput } from "react-native";
import {
  UtensilsCrossed,
  Pizza,
  Coffee,
  CupSoda,
  Beer,
  Wine,
  Martini,
  Cigarette,
  PartyPopper,
  Sparkles,
  Smile,
  Ticket,
  Popcorn,
  Gamepad2,
  Music,
  Film,
  Tv,
  Video,
  Headphones,
  BookOpen,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Scissors,
  Gift,
  Tag,
  Camera,
  Car,
  Fuel,
  Bike,
  Plane,
  Home,
  Heart,
  Pill,
  Dumbbell,
  PawPrint,
  GraduationCap,
  Wrench,
  Zap,
  Wifi,
  Droplets,
  Receipt,
  Wallet,
  Banknote,
  Smartphone,
  Shield,
  Calendar,
  Cloud,
  Shapes,
  Layers,
  Package,
  Star,
  Crown,
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
    title: "Habits, Drinks & Food",
    icons: [
      { icon: Cigarette, name: "Cigarette", label: "Smokes" },
      { icon: Beer, name: "Beer", label: "Beer" },
      { icon: Wine, name: "Wine", label: "Wine" },
      { icon: Martini, name: "Martini", label: "Cocktail" },
      { icon: CupSoda, name: "CupSoda", label: "Drinks" },
      { icon: Coffee, name: "Coffee", label: "Coffee" },
      { icon: UtensilsCrossed, name: "UtensilsCrossed", label: "Dining" },
      { icon: Pizza, name: "Pizza", label: "Food" },
    ],
  },
  {
    title: "Entertainment & Social",
    icons: [
      { icon: PartyPopper, name: "PartyPopper", label: "Party" },
      { icon: Sparkles, name: "Sparkles", label: "Enjoy" },
      { icon: Ticket, name: "Ticket", label: "Events" },
      { icon: Popcorn, name: "Popcorn", label: "Cinema" },
      { icon: Smile, name: "Smile", label: "Leisure" },
      { icon: Gamepad2, name: "Gamepad2", label: "Gaming" },
      { icon: Music, name: "Music", label: "Music" },
      { icon: Film, name: "Film", label: "Movies" },
      { icon: Tv, name: "Tv", label: "TV" },
      { icon: Video, name: "Video", label: "Video" },
      { icon: Headphones, name: "Headphones", label: "Audio" },
      { icon: BookOpen, name: "BookOpen", label: "Books" },
    ],
  },
  {
    title: "Shopping & Style",
    icons: [
      { icon: ShoppingBag, name: "ShoppingBag", label: "Shopping" },
      { icon: ShoppingCart, name: "ShoppingCart", label: "Groceries" },
      { icon: Shirt, name: "Shirt", label: "Clothing" },
      { icon: Scissors, name: "Scissors", label: "Salon" },
      { icon: Gift, name: "Gift", label: "Gifts" },
      { icon: Tag, name: "Tag", label: "Deals" },
      { icon: Camera, name: "Camera", label: "Photo" },
    ],
  },
  {
    title: "Commute & Travel",
    icons: [
      { icon: Car, name: "Car", label: "Car" },
      { icon: Fuel, name: "Fuel", label: "Fuel" },
      { icon: Bike, name: "Bike", label: "Bike" },
      { icon: Plane, name: "Plane", label: "Travel" },
    ],
  },
  {
    title: "Living & Health",
    icons: [
      { icon: Home, name: "Home", label: "Home" },
      { icon: Heart, name: "Heart", label: "Health" },
      { icon: Pill, name: "Pill", label: "Medicine" },
      { icon: Dumbbell, name: "Dumbbell", label: "Fitness" },
      { icon: PawPrint, name: "PawPrint", label: "Pets" },
      { icon: GraduationCap, name: "GraduationCap", label: "Education" },
      { icon: Wrench, name: "Wrench", label: "Repairs" },
    ],
  },
  {
    title: "Bills & Finance",
    icons: [
      { icon: Zap, name: "Zap", label: "Power" },
      { icon: Wifi, name: "Wifi", label: "Internet" },
      { icon: Droplets, name: "Droplets", label: "Water" },
      { icon: Receipt, name: "Receipt", label: "Bills" },
      { icon: Wallet, name: "Wallet", label: "Wallet" },
      { icon: Banknote, name: "Banknote", label: "Cash" },
      { icon: Smartphone, name: "Smartphone", label: "Mobile" },
      { icon: Calendar, name: "Calendar", label: "Calendar" },
      { icon: Cloud, name: "Cloud", label: "Cloud" },
      { icon: Shield, name: "Shield", label: "Insurance" },
    ],
  },
  {
    title: "General & Misc",
    icons: [
      { icon: Shapes, name: "Shapes", label: "Misc" },
      { icon: Layers, name: "Layers", label: "Other" },
      { icon: Package, name: "Package", label: "Package" },
      { icon: Star, name: "Star", label: "Special" },
      { icon: Crown, name: "Crown", label: "VIP" },
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
            Choose an icon for this category or item
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
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
