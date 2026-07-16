import React, { memo, useCallback } from "react";
import { View, StyleSheet, Alert, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import { ChevronRight, Trash2, Repeat } from "lucide-react-native";
import { format, parseISO, differenceInDays, isSameDay } from "date-fns";
import * as Haptics from "expo-haptics";
import { Card, AppText, LogoCircle } from "@/components/ui";
import { colors, spacing, radius, hexToRGBA } from "@/constants";
import type { Subscription } from "@/types/subscription";

export interface SubscriptionCardProps {
  subscription: Subscription;
  index: number;
  onPress?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  style?: StyleProp<ViewStyle>;
}

function getRenewalStatus(dateStr: string) {
  const today = new Date();
  const renewalDate = parseISO(dateStr);
  const diffDays = differenceInDays(renewalDate, today);

  if (diffDays < 0) {
    return { text: "Overdue", color: colors.danger };
  } else if (isSameDay(renewalDate, today)) {
    return { text: "Today", color: colors.danger };
  } else if (diffDays === 1) {
    return { text: "Tomorrow", color: colors.warning };
  } else if (diffDays > 1 && diffDays < 7) {
    return { text: `In ${diffDays} days`, color: colors.accent };
  } else {
    return { text: format(renewalDate, "MMM d"), color: colors.textMuted };
  }
}

const CYCLE_LABELS: Record<string, string> = {
  weekly: "weekly",
  "bi-weekly": "bi-weekly",
  monthly: "monthly",
  quarterly: "quarterly",
  "semi-yearly": "semi-yearly",
  yearly: "yearly",
  custom: "custom",
};

function SubscriptionCard({
  subscription,
  index,
  onPress,
  onDelete,
  onEdit,
  style,
}: SubscriptionCardProps) {
  const { name, price, billingCycle, nextBillingDate, color, isTrial, currency, logoUrl, website } = subscription;
  const status = getRenewalStatus(nextBillingDate);

  const getSymbol = (code: string) => {
    if (code === "INR") return "₹";
    if (code === "EUR") return "€";
    if (code === "GBP") return "£";
    if (code === "JPY") return "¥";
    return "$";
  };
  const formattedPrice = `${getSymbol(currency || "USD")}${price.toFixed(2)}`;

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(name, "Choose an action", [
      { text: "View Details", onPress: () => onPress?.() },
      { text: "Edit", onPress: () => onEdit?.() },
      { text: "Delete", style: "destructive", onPress: () => onDelete?.() },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [name, onPress, onEdit, onDelete]);

  const renderRightActions = useCallback(
    () => (
      <View style={styles.swipeActions}>
        <View style={styles.deleteAction}>
          <Trash2 size={20} color={colors.white} />
          <AppText variant="caption2" weight="700" color={colors.white}>
            Delete
          </AppText>
        </View>
      </View>
    ),
    []
  );

  const cardContent = (
    <Card
      pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      padding="default"
      shadow="small"
      style={{
        backgroundColor: colors.card,
        borderWidth: 0.5,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flex: 1,
          }}
        >
          <LogoCircle
            source={logoUrl}
            name={name}
            color={color}
            size="md"
            bordered
            style={{ marginRight: spacing[16] }}
            website={website}
          />
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[8],
              }}
            >
              <AppText variant="body" weight="700" numberOfLines={1}>
                {name}
              </AppText>
              {isTrial && (
                <View
                  style={{
                    backgroundColor: hexToRGBA(colors.accent, 0.12),
                    paddingHorizontal: spacing[8],
                    paddingVertical: spacing[2],
                    borderRadius: radius[4],
                  }}
                >
                  <AppText
                    variant="caption2"
                    weight="700"
                    color={colors.accent}
                  >
                    TRIAL
                  </AppText>
                </View>
              )}
            </View>
            <AppText
              variant="footnote"
              color={colors.textMuted}
              style={{ marginTop: 3 }}
            >
              Renew {status.text}
            </AppText>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginLeft: spacing[12],
          }}
        >
          <View style={{ alignItems: "flex-end", marginRight: spacing[8] }}>
            <AppText variant="headline" weight="700" color={colors.white}>
              {formattedPrice}
            </AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 }}>
              <AppText
                variant="caption2"
                weight="600"
                color={status.color === colors.textMuted ? colors.textMuted : status.color}
                style={{ opacity: 0.8 }}
              >
                {CYCLE_LABELS[billingCycle] || billingCycle}
              </AppText>
              {!isTrial && (
                <Repeat size={10} color={status.color === colors.textMuted ? colors.textMuted : status.color} style={{ opacity: 0.8 }} />
              )}
            </View>
          </View>
          <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.5} />
        </View>
      </View>
    </Card>
  );

  const wrapped = onDelete ? (
    <Swipeable
      renderRightActions={renderRightActions}
      onSwipeableRightOpen={() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onDelete();
      }}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
    >
      {cardContent}
    </Swipeable>
  ) : (
    cardContent
  );

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 40).springify().mass(0.6).damping(18).stiffness(120)}
      style={style}
    >
      {wrapped}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  swipeActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 1,
  },
  deleteAction: {
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    borderRadius: radius[16],
    marginLeft: spacing[8],
    gap: 4,
  },
});

export default memo(SubscriptionCard);
