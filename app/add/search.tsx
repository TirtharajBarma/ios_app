import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Search, Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { colors, spacing } from "@/constants";
import { AppText, LogoCircle } from "@/components/ui";
import { services, type Service } from "@/assets/data/services";

const TABS = [
  "For You",
  "Entertainment",
  "Music",
  "Productivity",
  "Storage",
  "Gaming",
  "AI",
  "Shopping",
  "Health",
  "Education",
  "Finance",
] as const;

export default function AddSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<string>("For You");
  const [query, setQuery] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Monitor keyboard height dynamically for absolute floating search bar positioning
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleClose = useCallback(() => {
    Haptics.selectionAsync();
    router.back();
  }, [router]);

  const handleServicePress = useCallback((service: Service) => {
    Haptics.selectionAsync();
    router.push({
      pathname: "/add/paid",
      params: {
        id: service.id,
        name: service.name,
        category: service.category,
        brandColor: service.brandColor,
        website: service.website || "",
        logo: service.website ? `https://logo.clearbit.com/${service.website}` : "",
      },
    });
  }, [router]);

  // Navigate to selecting a custom subscription from scratch
  const handleAddCustom = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push({
      pathname: "/add/paid",
      params: {
        id: `custom-${Date.now()}`,
        name: query,
        category: "Entertainment",
        brandColor: colors.accent,
        website: "",
        logo: "",
      },
    });
  };

  // Filter lists based on tab or search query
  const filteredSearchList = useMemo(() => {
    if (!query.trim()) return [];
    return services.filter((s) =>
      s.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  const categoryServices = useMemo(() => {
    if (activeTab === "For You") return [];
    return services.filter((s) => s.category === activeTab);
  }, [activeTab]);

  // Curated categories for "For You" grid
  const popularServices = useMemo(() => services.filter((s) => s.isPopular), []);
  
  const essentialServices = useMemo(() => {
    return services.filter((s) =>
      ["Storage", "Productivity", "Finance"].includes(s.category)
    ).slice(0, 9);
  }, []);

  const appSubscriptions = useMemo(() => {
    return services.filter((s) =>
      ["Health", "Education", "Gaming", "AI"].includes(s.category)
    ).slice(0, 9);
  }, []);

  // Helper helper to chunk array into columns of 3
  const chunk = <T,>(arr: T[], size: number): T[][] => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );
  };

  const essentialColumns = useMemo(() => chunk(essentialServices, 3), [essentialServices]);
  const appSubColumns = useMemo(() => chunk(appSubscriptions, 3), [appSubscriptions]);

  // Compute live absolute position of the search bar above the keyboard
  const searchBarBottomOffset = keyboardHeight > 0
    ? (Platform.OS === "ios" ? keyboardHeight + 12 : 12)
    : insets.bottom + 12;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["rgba(180, 50, 15, 0.8)", "rgba(0, 0, 0, 0)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.65 }}
      />
      {/* Header bar */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[12] }]}>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <X size={18} color={colors.white} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Add new</AppText>
        <View style={{ width: 36 }} />
      </View>

      {/* Main content or Search Overlay */}
      <View style={styles.body}>
        {query.trim().length > 0 ? (
          // Search results view
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.searchResultsContainer,
              { paddingBottom: keyboardHeight + 100 },
            ]}
          >
            {filteredSearchList.length === 0 ? (
              <View style={styles.emptySearchContainer}>
                <View style={styles.emptySearchHeader}>
                  <AppText style={styles.emptySearchTitle}>Service not found?</AppText>
                  <AppText style={styles.emptySearchDesc}>
                    {"We couldn't find \""}{query}{"\" in our catalog. You can create a custom subscription below:"}
                  </AppText>
                </View>
                
                <TouchableOpacity onPress={handleAddCustom} style={styles.customSearchResultItem}>
                  <View style={styles.searchResultLeft}>
                    <View style={styles.customPlusCircle}>
                      <Plus size={20} color={colors.accent} />
                    </View>
                    <View style={styles.searchResultInfo}>
                      <AppText style={styles.searchResultName}>{"Add \""}{query}{"\""}</AppText>
                      <AppText style={styles.searchResultCategory}>Create custom subscription from scratch</AppText>
                    </View>
                  </View>
                  <Plus size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              filteredSearchList.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  onPress={() => handleServicePress(service)}
                  style={styles.searchResultItem}
                >
                  <View style={styles.searchResultLeft}>
                    <LogoCircle
                      source={service.website ? `https://logo.clearbit.com/${service.website}` : undefined}
                      name={service.name}
                      color={service.brandColor}
                      size={40}
                    />
                    <View style={styles.searchResultInfo}>
                      <AppText style={styles.searchResultName}>{service.name}</AppText>
                      <AppText style={styles.searchResultCategory}>{service.category}</AppText>
                    </View>
                  </View>
                  <Plus size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        ) : (
          // Categorized scroll view
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
          >
            {/* Tabs List switcher */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsContainer}
            >
              {TABS.map((tab) => {
                const isActive = tab === activeTab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveTab(tab);
                    }}
                    style={isActive ? [styles.tabPill, styles.tabPillActive] : styles.tabPill}
                  >
                    <AppText
                      style={isActive ? [styles.tabText, styles.tabTextActive] : styles.tabText}
                    >
                      {tab}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {activeTab === "For You" ? (
              <View style={styles.forYouContainer}>
                {/* Popular carousel */}
                <View style={styles.section}>
                  <AppText style={styles.sectionHeader}>Popular</AppText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.popularRow}
                  >
                    {popularServices.map((service) => (
                      <TouchableOpacity
                        key={service.id}
                        onPress={() => handleServicePress(service)}
                        style={styles.popularCircleWrapper}
                      >
                        <LogoCircle
                          source={service.website ? `https://logo.clearbit.com/${service.website}` : undefined}
                          name={service.name}
                          color={service.brandColor}
                          size={64}
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Essentials Columns Grid */}
                <View style={styles.section}>
                  <AppText style={styles.sectionHeader}>Essentials</AppText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.gridHorizontalScroll}
                  >
                    {essentialColumns.map((col, colIdx) => (
                      <View key={colIdx} style={styles.gridColumn}>
                        {col.map((service) => (
                          <TouchableOpacity
                            key={service.id}
                            onPress={() => handleServicePress(service)}
                            style={styles.gridItem}
                          >
                            <View style={styles.gridItemLeft}>
                              <LogoCircle
                                source={service.website ? `https://logo.clearbit.com/${service.website}` : undefined}
                                name={service.name}
                                color={service.brandColor}
                                size={32}
                              />
                              <AppText style={styles.gridItemName} numberOfLines={1}>
                                {service.name}
                              </AppText>
                            </View>
                            <Plus size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                </View>

                {/* App Subscriptions Columns Grid */}
                <View style={styles.section}>
                  <AppText style={styles.sectionHeader}>App subscriptions</AppText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.gridHorizontalScroll}
                  >
                    {appSubColumns.map((col, colIdx) => (
                      <View key={colIdx} style={styles.gridColumn}>
                        {col.map((service) => (
                          <TouchableOpacity
                            key={service.id}
                            onPress={() => handleServicePress(service)}
                            style={styles.gridItem}
                          >
                            <View style={styles.gridItemLeft}>
                              <LogoCircle
                                source={service.website ? `https://logo.clearbit.com/${service.website}` : undefined}
                                name={service.name}
                                color={service.brandColor}
                                size={32}
                              />
                              <AppText style={styles.gridItemName} numberOfLines={1}>
                                {service.name}
                              </AppText>
                            </View>
                            <Plus size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </View>
            ) : (
              // Category Specific List Layout
              <View style={styles.categoryListContainer}>
                <AppText style={styles.sectionHeader}>{activeTab}</AppText>
                {categoryServices.map((service) => (
                  <TouchableOpacity
                    key={service.id}
                    onPress={() => handleServicePress(service)}
                    style={styles.gridItemFullWidth}
                  >
                    <View style={styles.gridItemLeft}>
                      <LogoCircle
                        source={service.website ? `https://logo.clearbit.com/${service.website}` : undefined}
                        name={service.name}
                        color={service.brandColor}
                        size={36}
                      />
                      <AppText style={styles.gridItemName} numberOfLines={1}>
                        {service.name}
                      </AppText>
                    </View>
                    <Plus size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Floating bottom search bar */}
        <View style={[styles.floatingSearchWrapper, { bottom: searchBarBottomOffset }]}>
          <View style={styles.floatingSearchBar}>
            <Search size={18} color={colors.textMuted} style={{ marginRight: spacing[8] }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for any subscription..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[12],
    backgroundColor: "transparent",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.white,
  },
  body: {
    flex: 1,
    position: "relative",
  },
  scrollContent: {
    paddingTop: spacing[8],
  },
  tabsContainer: {
    paddingHorizontal: spacing[16],
    gap: spacing[8],
    paddingBottom: spacing[16],
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: spacing[8],
    borderRadius: 999,
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
  },
  tabPillActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
  },
  tabTextActive: {
    color: "#000000",
    fontWeight: "700",
  },
  forYouContainer: {
    gap: spacing[20],
  },
  section: {
    gap: spacing[12],
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.white,
    paddingHorizontal: spacing[16],
  },
  popularRow: {
    paddingHorizontal: spacing[16],
    gap: 14,
    paddingBottom: 4,
  },
  popularCircleWrapper: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  gridHorizontalScroll: {
    paddingHorizontal: spacing[16],
    gap: spacing[12],
    paddingBottom: 8,
  },
  gridColumn: {
    width: 230,
    gap: 10,
  },
  gridItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 16,
    padding: spacing[12],
    height: 56,
  },
  gridItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  gridItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
    marginLeft: 10,
    flex: 1,
  },
  categoryListContainer: {
    paddingHorizontal: spacing[16],
    gap: 10,
  },
  gridItemFullWidth: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 16,
    padding: spacing[12],
    height: 58,
  },
  floatingSearchWrapper: {
    position: "absolute",
    left: spacing[16],
    right: spacing[16],
    zIndex: 100,
  },
  floatingSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    backgroundColor: "#1C1C1E",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 999,
    paddingHorizontal: spacing[16],
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    color: colors.white,
  },
  searchResultsContainer: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[8],
    gap: 10,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 16,
    padding: spacing[12],
    height: 60,
  },
  searchResultLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  searchResultInfo: {
    marginLeft: spacing[12],
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
  },
  searchResultCategory: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptySearchContainer: {
    marginTop: spacing[20],
    gap: spacing[16],
  },
  emptySearchHeader: {
    paddingHorizontal: spacing[8],
  },
  emptySearchTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.white,
    marginBottom: 6,
  },
  emptySearchDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  customSearchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#161618",
    borderWidth: 0.5,
    borderColor: "#2C2C2E",
    borderRadius: 16,
    padding: spacing[12],
    height: 64,
  },
  customPlusCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  customAddBtn: {
    height: 44,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing[24],
    alignItems: "center",
    justifyContent: "center",
  },
  customAddBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
