import React from "react";
import { View, StyleSheet } from "react-native";
import { PiggyBank, Lightbulb, Sparkles, Users, AlertTriangle } from "lucide-react-native";
import { AppText } from "@/components/ui";
import type { VaultState } from "@/store/useSubscriptionStore";

interface SavingsVaultCardProps {
  vault: VaultState;
  currencySymbol: string;
}

export default function SavingsVaultCard({
  vault,
  currencySymbol,
}: SavingsVaultCardProps) {
  if (vault.vaultMode === "saved" && vault.totalSavings > 0) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ gap: 4 }}>
          <View style={styles.cardHeader}>
            <View style={styles.statLabelRow}>
              <View style={styles.greenIconBox}>
                <PiggyBank size={14} color="#30D158" strokeWidth={2.5} />
              </View>
              <AppText style={styles.statLabelText}>Savings Vault</AppText>
            </View>
            <Sparkles size={14} color="rgba(48, 209, 88, 0.6)" />
          </View>
          <AppText
            style={styles.largePriceText}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {currencySymbol}
            {vault.totalSavings.toFixed(2)}
          </AppText>
        </View>

        <View style={styles.cardHairline} />

        <View style={styles.footerContainer}>
          <View style={styles.statLabelRow}>
            <View style={styles.greenIconBg}>
              <PiggyBank size={14} color="#30D158" strokeWidth={2.4} />
            </View>
            <AppText
              style={styles.statLabelText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Money you&apos;ve kept
            </AppText>
          </View>
          <AppText
            style={styles.footerValueText}
            numberOfLines={1}
          >
            {vault.savingsBreakdown.length} subscription{vault.savingsBreakdown.length !== 1 ? "s" : ""} saved
          </AppText>
        </View>
      </View>
    );
  }

  // Advisor mode
  const advisorIcon =
    vault.advisorType === "trials" ? (
      <AlertTriangle size={14} color="#0A84FF" strokeWidth={2.5} />
    ) : vault.advisorType === "splits" ? (
      <Users size={14} color="#0A84FF" strokeWidth={2.5} />
    ) : (
      <Lightbulb size={14} color="#0A84FF" strokeWidth={2.5} />
    );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ gap: 4 }}>
        <View style={styles.cardHeader}>
          <View style={styles.statLabelRow}>
            <View style={styles.blueIconBox}>
              {advisorIcon}
            </View>
            <AppText style={styles.statLabelText}>Savings Vault</AppText>
          </View>
          <Lightbulb size={14} color="rgba(10, 132, 255, 0.6)" />
        </View>
        <AppText
          style={styles.advisorMessageText}
          numberOfLines={3}
        >
          {vault.advisorMessage}
        </AppText>
      </View>

      <View style={styles.cardHairline} />

      <View style={styles.footerContainer}>
        <View style={styles.statLabelRow}>
          <View style={styles.blueIconBg}>
            <Lightbulb size={14} color="#0A84FF" strokeWidth={2.4} />
          </View>
          <AppText
            style={styles.statLabelText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Tap to learn more
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greenIconBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: "rgba(48, 209, 88, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  blueIconBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: "rgba(10, 132, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabelText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.58)",
    letterSpacing: 0,
    flexShrink: 1,
  },
  largePriceText: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: "#30D158",
    letterSpacing: 0,
  },
  advisorMessageText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.85)",
    letterSpacing: 0,
  },
  cardHairline: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 12,
  },
  footerContainer: {
    gap: 2,
  },
  greenIconBg: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: "rgba(48, 209, 88, 0.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  blueIconBg: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: "rgba(10, 132, 255, 0.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  footerValueText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: "#30D158",
    marginLeft: 26,
    marginTop: 1,
  },
});
