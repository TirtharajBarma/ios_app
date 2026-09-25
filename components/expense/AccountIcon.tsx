import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SymbolView, SFSymbol } from 'expo-symbols';
import { Landmark, CreditCard as LucideCreditCard, Wallet as LucideWallet } from 'lucide-react-native';

interface AccountIconProps {
  type: 'savings' | 'credit' | 'wallet' | 'cash' | string;
  size?: number;
  containerSize?: number;
  borderRadius?: number;
  highlighted?: boolean;
}

export const AccountIcon: React.FC<AccountIconProps> = ({
  type,
  size = 18,
  containerSize = 38,
  borderRadius = 12,
  highlighted = false,
}) => {
  const isCredit = type === 'credit';
  const isWallet = type === 'wallet' || type === 'cash';

  // Premium iOS Fintech Color Palettes
  const config = isCredit
    ? {
        sfName: 'creditcard.fill' as SFSymbol,
        tint: '#FF9D66',
        bg: '#2A1C16',
        border: 'rgba(255, 157, 102, 0.18)',
        LucideIcon: LucideCreditCard,
      }
    : isWallet
    ? {
        sfName: 'wallet.pass.fill' as SFSymbol,
        tint: '#70D6BC',
        bg: '#132822',
        border: 'rgba(112, 214, 188, 0.18)',
        LucideIcon: LucideWallet,
      }
    : {
        sfName: 'building.columns.fill' as SFSymbol,
        tint: '#60A5FA',
        bg: '#152238',
        border: 'rgba(96, 165, 250, 0.18)',
        LucideIcon: Landmark,
      };

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius,
          backgroundColor: config.bg,
          borderColor: highlighted ? config.tint : config.border,
        },
      ]}
    >
      {Platform.OS === 'ios' ? (
        <SymbolView
          name={config.sfName}
          size={size}
          tintColor={config.tint}
          type="hierarchical"
        />
      ) : (
        <config.LucideIcon size={size} color={config.tint} strokeWidth={2.2} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
