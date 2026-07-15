import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/constants";
import { SearchBar } from "@/components/ui";
import { services, type Service } from "@/assets/data/services";
import SearchHeader from "@/components/common/SearchHeader";
import PopularServices from "@/components/cards/PopularServices";
import CategorySection from "@/components/cards/CategorySection";
import SearchResults from "@/components/cards/SearchResults";

const CATEGORIES = [
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

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleServicePress = useCallback((service: Service) => {
    router.push({
      pathname: "/add/select",
      params: {
        id: service.id,
        name: service.name,
        category: service.category,
        brandColor: service.brandColor,
        website: service.website || "",
      },
    });
  }, [router]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      {/* Custom Modal Navigation Bar */}
      <SearchHeader onClose={handleClose} />

      <View style={styles.content}>
        {/* Search Input */}
        <View style={styles.searchBarWrapper}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search subscriptions"
          />
        </View>

        {query.trim().length > 0 ? (
          /* Search Results & Empty State */
          <SearchResults
            query={query}
            services={services}
            onServicePress={handleServicePress}
            style={styles.results}
          />
        ) : (
          /* Default Browse Categories List */
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + spacing[40] },
            ]}
          >
            {/* Horizontal Popular Services Carousel */}
            <PopularServices
              services={services}
              onServicePress={handleServicePress}
              style={styles.popularSection}
            />

            {/* Vertically Listed Category Rows */}
            {CATEGORIES.map((category) => {
              const categoryServices = services.filter(
                (s) => s.category === category
              );
              return (
                <CategorySection
                  key={category}
                  title={category}
                  services={categoryServices}
                  onServicePress={handleServicePress}
                  style={styles.categorySection}
                />
              );
            })}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  searchBarWrapper: {
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingTop: spacing[8],
  },
  popularSection: {
    marginBottom: spacing[20],
  },
  categorySection: {
    marginBottom: spacing[8],
  },
  results: {
    flex: 1,
    marginTop: spacing[8],
  },
});
