import React, { memo } from "react";
import { View, ScrollView, type StyleProp, type ViewStyle } from "react-native";
import { SectionHeader } from "@/components/ui";
import { spacing } from "@/constants";
import ServiceCard from "./ServiceCard";
import type { Service } from "@/assets/data/services";

export interface CategorySectionProps {
  title: string;
  services: Service[];
  onServicePress?: (service: Service) => void;
  style?: StyleProp<ViewStyle>;
}

function CategorySection({
  title,
  services: categoryServices,
  onServicePress,
  style,
}: CategorySectionProps) {
  if (categoryServices.length === 0) return null;

  return (
    <View style={style}>
      <SectionHeader
        title={title}
        style={{ paddingHorizontal: spacing[20] }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={144 + spacing[12]} // card width + gap
        contentContainerStyle={{
          paddingHorizontal: spacing[20],
          gap: spacing[12],
        }}
      >
        {categoryServices.map((service, index) => (
          <ServiceCard
            key={service.id}
            service={service}
            index={index}
            onPress={() => onServicePress?.(service)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default memo(CategorySection);
