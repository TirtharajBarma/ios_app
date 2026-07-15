import React, { memo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { ChevronRight } from "lucide-react-native";
import { format, parseISO, differenceInDays, isSameDay } from "date-fns";
import { Card, AppText, LogoCircle } from "@/components/ui";
import { colors, spacing, radius, hexToRGBA } from "@/constants";
import type { Subscription } from "@/assets/data/mockSubscriptions";

export interface SubscriptionCardProps {
  subscription: Subscription;
  index: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function getRenewalStatus(dateStr: string) {
  const today = new Date();
  const renewalDate = parseISO(dateStr);
  const diffDays = differenceInDays(renewalDate, today);

  if (isSameDay(renewalDate, today)) {
    return { text: "Today", color: colors.danger };
  } else if (diffDays === 1) {
    return { text: "Tomorrow", color: colors.warning };
  } else if (diffDays > 1 && diffDays < 7) {
    return { text: `In ${diffDays} days`, color: colors.accent };
  } else {
    return { text: format(renewalDate, "MMM d"), color: colors.textMuted };
  }
}

function SubscriptionCard({
  subscription,
  index,
  onPress,
  style,
}: SubscriptionCardProps) {
  const { name, price, currency, billingCycle, nextRenewal, themeColor, isTrial } = subscription;
  const status = getRenewalStatus(nextRenewal);
  
  // Format price: $15.99
  const formattedPrice = `${currency}${price.toFixed(2)}`;

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 40).springify().mass(0.6).damping(18).stiffness(120)}
      style={style}
    >
      <Card
        pressable
        onPress={onPress}
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
          {/* Left section: Logo and Name / Billing info */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flex: 1,
            }}
          >
            <LogoCircle
              name={name}
              color={themeColor}
              size="md"
              bordered
              style={{ marginRight: spacing[16] }}
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

          {/* Right section: Price, status, and chevron */}
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
              <AppText
                variant="caption2"
                weight="600"
                color={status.color === colors.textMuted ? colors.textMuted : status.color}
                style={{ opacity: 0.8, marginTop: 2 }}
              >
                {billingCycle === "monthly" ? "monthly" : "yearly"}
              </AppText>
            </View>
            <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.5} />
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

export default memo(SubscriptionCard);
