import React, { memo } from "react";
import { View, ScrollView, type StyleProp, type ViewStyle } from "react-native";
import { parseISO, differenceInDays, isSameDay } from "date-fns";
import { Card, AppText, LogoCircle, SectionHeader } from "@/components/ui";
import { colors, spacing, radius, hexToRGBA } from "@/constants";
import type { Subscription } from "@/types/subscription";

export interface UpcomingSectionProps {
  subscriptions: Subscription[];
  onSeeAllPress?: () => void;
  onCardPress?: (subscription: Subscription) => void;
  style?: StyleProp<ViewStyle>;
}

function getRelativeDays(dateStr: string): string {
  const today = new Date();
  const renewalDate = parseISO(dateStr);
  const diffDays = differenceInDays(renewalDate, today);

  if (isSameDay(renewalDate, today)) {
    return "Today";
  } else if (diffDays === 1) {
    return "Tomorrow";
  } else {
    return `In ${diffDays} days`;
  }
}

// ─── Upcoming horizontal card ────────────────────────────────────────

const UpcomingCard = memo(function UpcomingCard({
  subscription,
  onPress,
}: {
  subscription: Subscription;
  onPress?: () => void;
}) {
  const { name, price, nextBillingDate, color } = subscription;
  const daysText = getRelativeDays(nextBillingDate);
  
  // Custom transparent-accent border + background look
  const customBg = hexToRGBA(color, 0.06);
  const customBorder = hexToRGBA(color, 0.2);

  return (
    <Card
      pressable
      onPress={onPress}
      padding="compact"
      shadow="none"
      style={{
        width: 144,
        height: 106,
        backgroundColor: customBg,
        borderColor: customBorder,
        borderWidth: 0.5,
        borderRadius: radius[16],
      }}
    >
      <View style={{ flex: 1, justifyContent: "space-between" }}>
        {/* Top row: Logo and Price */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <LogoCircle
            name={name}
            color={color}
            size="sm"
            bordered
          />
          <AppText variant="footnote" weight="700" color={colors.white}>
            ${price.toFixed(0)}
          </AppText>
        </View>

        {/* Bottom text stack */}
        <View>
          <AppText variant="subheadline" weight="700" numberOfLines={1}>
            {name}
          </AppText>
          <AppText
            variant="caption2"
            weight="600"
            color={daysText === "Today" || daysText === "Tomorrow" ? colors.danger : colors.textMuted}
            style={{ marginTop: 2 }}
          >
            {daysText}
          </AppText>
        </View>
      </View>
    </Card>
  );
});

// ─── Main Section Component ─────────────────────────────────────────

function UpcomingSection({
  subscriptions,
  onSeeAllPress,
  onCardPress,
  style,
}: UpcomingSectionProps) {
  // Sort by nearest renewal date first and take top 5
  const upcomingSubscriptions = [...subscriptions]
    .sort((a, b) => parseISO(a.nextBillingDate).getTime() - parseISO(b.nextBillingDate).getTime())
    .slice(0, 5);

  if (upcomingSubscriptions.length === 0) return null;

  return (
    <View style={style}>
      <SectionHeader
        title="Upcoming"
        actionLabel="See All"
        onAction={onSeeAllPress}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={144 + spacing[12]} // width + gap spacing
        contentContainerStyle={{
          paddingHorizontal: spacing[4],
          gap: spacing[12],
        }}
      >
        {upcomingSubscriptions.map((sub) => (
          <UpcomingCard
            key={sub.id}
            subscription={sub}
            onPress={() => onCardPress?.(sub)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default memo(UpcomingSection);
