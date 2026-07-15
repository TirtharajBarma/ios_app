import React, { memo } from "react";
import { View, ScrollView, type StyleProp, type ViewStyle } from "react-native";
import { Search } from "lucide-react-native";
import { ListItem, LogoCircle, EmptyState } from "@/components/ui";
import { colors, spacing } from "@/constants";
import type { Service } from "@/assets/data/services";

export interface SearchResultsProps {
  query: string;
  services: Service[];
  onServicePress?: (service: Service) => void;
  style?: StyleProp<ViewStyle>;
}

function SearchResults({
  query,
  services: allServices,
  onServicePress,
  style,
}: SearchResultsProps) {
  // Local search filter logic
  const filteredServices = allServices.filter(
    (service) =>
      service.name.toLowerCase().includes(query.toLowerCase()) ||
      service.category.toLowerCase().includes(query.toLowerCase())
  );

  const hasResults = filteredServices.length > 0;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={[style]}
      contentContainerStyle={{
        paddingHorizontal: spacing[20],
        paddingBottom: spacing[40],
      }}
    >
      {hasResults ? (
        <View style={{ gap: spacing[8] }}>
          {filteredServices.map((service) => (
            <ListItem
              key={service.id}
              leading={
                <LogoCircle
                  name={service.name}
                  color={service.brandColor}
                  size="sm"
                  bordered
                />
              }
              title={service.name}
              subtitle={service.category}
              chevron
              onPress={() => onServicePress?.(service)}
              style={{
                backgroundColor: colors.card,
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          icon={<Search size={32} color={colors.textSecondary} />}
          title="No subscriptions found"
          subtitle="Try searching for another keyword or service name."
          style={{ marginTop: spacing[48] }}
        />
      )}
    </ScrollView>
  );
}

export default memo(SearchResults);
