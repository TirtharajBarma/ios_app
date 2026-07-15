import React, { memo } from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { AppText } from "@/components/ui";
import { colors, spacing, radius } from "@/constants";

export interface FormSectionProps {
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function FormSection({ title, children, style }: FormSectionProps) {
  const childrenArray = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={[styles.container, style]}>
      {title && (
        <AppText
          variant="footnote"
          weight="600"
          color={colors.textMuted}
          style={styles.title}
        >
          {title.toUpperCase()}
        </AppText>
      )}
      <View style={styles.card}>
        {childrenArray.map((child, index) => (
          <React.Fragment key={index}>
            {index > 0 && <View style={styles.divider} />}
            <View style={styles.itemWrapper}>{child}</View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[20],
  },
  title: {
    marginLeft: spacing[16],
    marginBottom: spacing[8],
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius[16],
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: "hidden",
  },
  itemWrapper: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    justifyContent: "center",
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginLeft: spacing[16], // iOS inset separator style
  },
});

export default memo(FormSection);
