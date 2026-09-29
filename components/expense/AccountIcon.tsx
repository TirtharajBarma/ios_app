import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';
import { SymbolView, SFSymbol } from 'expo-symbols';
import { Image } from 'expo-image';
import { Landmark, CreditCard as LucideCreditCard, Wallet as LucideWallet } from 'lucide-react-native';
import { getBankBranding } from '@/utils/bankBranding';

interface AccountIconProps {
  name?: string;
  type?: 'savings' | 'credit' | 'wallet' | 'cash' | string;
  size?: number;
  containerSize?: number;
  borderRadius?: number;
  highlighted?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const AccountIcon: React.FC<AccountIconProps> = ({
  name,
  type = 'savings',
  size = 18,
  containerSize = 38,
  borderRadius = 12,
  highlighted = false,
  style,
}) => {
  const [triedFallback, setTriedFallback] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const branding = name ? getBankBranding(name, type) : { isBranded: false };

  useEffect(() => {
    setTriedFallback(false);
    setImageError(false);
  }, [name, branding.logoUrl]);

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

  const currentUri = !triedFallback ? branding.logoUrl : branding.fallbackUrl;
  const showBrandLogo = branding.isBranded && currentUri && !imageError;

  // Generous inside padding so the logo never touches edges and sits with crisp breathing room
  const internalPadding = containerSize >= 48 ? 8 : containerSize >= 34 ? 6 : 4;

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius,
          backgroundColor: showBrandLogo ? '#FFFFFF' : config.bg,
          borderColor: highlighted ? (branding.brandColor || config.tint) : (showBrandLogo ? 'rgba(255, 255, 255, 0.15)' : config.border),
          padding: showBrandLogo ? internalPadding : 0,
        },
        style,
      ]}
    >
      {showBrandLogo ? (
        <Image
          source={{ uri: currentUri }}
          style={styles.logoImage}
          contentFit="contain"
          transition={150}
          priority="high"
          onError={() => {
            if (!triedFallback && branding.fallbackUrl) {
              setTriedFallback(true);
            } else {
              setImageError(true);
            }
          }}
        />
      ) : Platform.OS === 'ios' ? (
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
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
});
