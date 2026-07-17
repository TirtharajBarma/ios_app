import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pause, CheckCircle, AlertTriangle, Users, Lightbulb, Sparkles } from "lucide-react-native";
import SwipeDownSheet from "./SwipeDownSheet";
import AppText from "./AppText";
import LogoCircle from "./LogoCircle";
import { colors, spacing } from "@/constants";
import type { VaultState } from "@/store/useSubscriptionStore";

export interface SavingsBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  vault: VaultState;
  currencySymbol: string;
}

export default function SavingsBottomSheet({
  visible,
  onClose,
  vault,
  currencySymbol,
}: SavingsBottomSheetProps) {
  const insets = useSafeAreaInsets();

  const renderSavedContent = () => (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <AppText variant="title3" weight="700" color={colors.white} style={styles.title}>
          Savings Breakdown
        </AppText>
        <Sparkles size={20} color="#30D158" />
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {vault.savingsBreakdown.map((item, idx) => {
          const isLast = idx === vault.savingsBreakdown.length - 1;
          return (
            <View
              key={item.subscriptionId}
              style={[styles.savingRow, !isLast && styles.savingRowBorder]}
            >
              <View style={styles.savingLeft}>
                <LogoCircle
                  source={item.logoUrl}
                  name={item.name}
                  color={item.color}
                  size={40}
                  bordered
                  website={item.website}
                />
                <View style={styles.savingTextContainer}>
                  <AppText
                    style={styles.savingName}
                    numberOfLines={1}
                  >
                    {item.name}
                  </AppText>
                  <View style={styles.savingMeta}>
                    <View style={styles.statusBadge}>
                      <Pause size={10} color="#30D158" />
                      <AppText style={styles.statusText}>Paused</AppText>
                    </View>
                    <AppText style={styles.savingMetaText}>
                      {currencySymbol}{item.monthlyPrice.toFixed(2)}/month
                    </AppText>
                  </View>
                  <AppText style={styles.savingSkipped}>
                    {item.monthsSkipped} month{item.monthsSkipped !== 1 ? "s" : ""} skipped
                  </AppText>
                </View>
              </View>
              <View style={styles.savingRight}>
                <CheckCircle size={14} color="#30D158" />
                <AppText style={styles.savingAmount}>
                  Saved {currencySymbol}{item.totalSaved.toFixed(2)}
                </AppText>
              </View>
            </View>
          );
        })}

        {vault.savingsBreakdown.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <AppText color={colors.white} variant="headline" weight="700">
                Total Savings
              </AppText>
              <AppText style={styles.totalAmount}>
                {currencySymbol}{vault.totalSavings.toFixed(2)}
              </AppText>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );

  const renderAdvisorContent = () => {
    if (vault.advisorType === "trials") {
      return (
        <View style={styles.section}>
          <View style={styles.titleRow}>
            <AppText variant="title3" weight="700" color={colors.white} style={styles.title}>
              Active Trials
            </AppText>
            <AlertTriangle size={20} color="#0A84FF" />
          </View>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.advisorCard}>
              <AppText style={styles.advisorMessage}>{vault.advisorMessage}</AppText>
            </View>
            {vault.trialWarnings.map((trial, idx) => {
              const isLast = idx === vault.trialWarnings.length - 1;
              return (
                <View
                  key={trial.subscriptionId}
                  style={[styles.advisorRow, !isLast && styles.advisorRowBorder]}
                >
                  <View style={styles.advisorRowLeft}>
                    <LogoCircle
                      source={trial.logoUrl}
                      name={trial.name}
                      color={trial.color}
                      size={36}
                      bordered
                      website={trial.website}
                    />
                    <View>
                      <AppText style={styles.advisorRowName} numberOfLines={1}>
                        {trial.name}
                      </AppText>
                      <AppText style={styles.advisorRowMeta}>
                        Trial ends {new Date(trial.trialEndDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </AppText>
                    </View>
                  </View>
                  <AlertTriangle size={14} color="#FFD60A" />
                </View>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    if (vault.advisorType === "splits") {
      return (
        <View style={styles.section}>
          <View style={styles.titleRow}>
            <AppText variant="title3" weight="700" color={colors.white} style={styles.title}>
              Shared Savings
            </AppText>
            <Users size={20} color="#0A84FF" />
          </View>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.advisorCard}>
              <AppText style={styles.advisorMessage}>{vault.advisorMessage}</AppText>
            </View>
            {vault.splitSavings.map((split, idx) => {
              const isLast = idx === vault.splitSavings.length - 1;
              return (
                <View
                  key={split.subscriptionId}
                  style={[styles.advisorRow, !isLast && styles.advisorRowBorder]}
                >
                  <View style={styles.advisorRowLeft}>
                    <LogoCircle
                      source={split.logoUrl}
                      name={split.name}
                      color={split.color}
                      size={36}
                      bordered
                      website={split.website}
                    />
                    <View>
                      <AppText style={styles.advisorRowName} numberOfLines={1}>
                        {split.name}
                      </AppText>
                      <AppText style={styles.advisorRowMeta}>
                        {currencySymbol}{split.fullPrice.toFixed(2)} → {currencySymbol}{split.userShare.toFixed(2)} you pay
                      </AppText>
                    </View>
                  </View>
                  <AppText style={styles.splitSavingText}>
                    Save {currencySymbol}{split.monthlySaving.toFixed(0)}/mo
                  </AppText>
                </View>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    // suggestions
    return (
      <View style={styles.section}>
        <View style={styles.titleRow}>
          <AppText variant="title3" weight="700" color={colors.white} style={styles.title}>
            Savings Tips
          </AppText>
          <Lightbulb size={20} color="#0A84FF" />
        </View>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.advisorCard}>
            <AppText style={styles.advisorMessage}>{vault.advisorMessage}</AppText>
          </View>
          <View style={styles.tipCard}>
            <AppText style={styles.tipTitle}>How to save more</AppText>
            <AppText style={styles.tipBody}>
              Pause subscriptions you rarely use. When paused, the Savings Vault
              will track every billing cycle you skip and show you exactly how
              much money you keep.
            </AppText>
          </View>
          <View style={styles.tipCard}>
            <AppText style={styles.tipTitle}>Split shared subscriptions</AppText>
            <AppText style={styles.tipBody}>
              Share costs with friends or family. Enable bill splitting to see
              how much you save compared to paying full price.
            </AppText>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <SwipeDownSheet
      visible={visible}
      onClose={onClose}
      heightRatio={0.65}
      containerStyle={{
        backgroundColor: "#1C1C1E",
        paddingHorizontal: spacing[24],
        paddingBottom: insets.bottom + spacing[24],
      }}
    >
      {vault.vaultMode === "saved" ? renderSavedContent() : renderAdvisorContent()}
    </SwipeDownSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    flex: 1,
    marginTop: spacing[8],
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[24],
  },
  title: {},
  scroll: {
    flex: 1,
  },
  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[16],
  },
  savingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  savingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  savingTextContainer: {
    marginLeft: spacing[12],
    flex: 1,
  },
  savingName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.white,
  },
  savingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(48, 209, 88, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#30D158",
    letterSpacing: 0.3,
  },
  savingMetaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  savingSkipped: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  savingRight: {
    alignItems: "flex-end",
    marginLeft: spacing[12],
    gap: 4,
  },
  savingAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#30D158",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: spacing[16],
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[24],
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: "800",
    color: "#30D158",
  },
  advisorCard: {
    backgroundColor: "rgba(10, 132, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(10, 132, 255, 0.15)",
    borderRadius: 16,
    padding: spacing[16],
    marginBottom: spacing[20],
  },
  advisorMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255, 255, 255, 0.85)",
    fontWeight: "600",
  },
  advisorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[12],
  },
  advisorRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  advisorRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  advisorRowName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
  advisorRowMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  splitSavingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A84FF",
  },
  tipCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: spacing[16],
    marginBottom: spacing[12],
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
    marginBottom: 6,
  },
  tipBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
