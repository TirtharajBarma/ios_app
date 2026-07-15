import React, { memo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { AppText, IconButton } from "@/components/ui";
import { colors, spacing } from "@/constants";

export interface SearchHeaderProps {
  title?: string;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
}

function SearchHeader({ title = "Add Subscription", onClose, style }: SearchHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          paddingTop: insets.top + spacing[12],
          paddingBottom: spacing[16],
          paddingHorizontal: spacing[20],
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 0.5,
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
        style,
      ]}
    >
      {/* Spacer to balance the close button */}
      <View style={{ width: 36 }} />

      {/* Centered Title */}
      <AppText variant="headline" weight="700" color={colors.white}>
        {title}
      </AppText>

      {/* Right close button */}
      <IconButton
        icon={<X size={18} color={colors.textSecondary} strokeWidth={2.5} />}
        variant="filled"
        size="medium"
        onPress={onClose}
      />
    </View>
  );
}

export default memo(SearchHeader);
