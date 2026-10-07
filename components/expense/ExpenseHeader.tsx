import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SlidersHorizontal, Plus } from 'lucide-react-native';
import { AppText, ProfileAvatar } from '@/components/ui';
import { useSettingsStore } from '@/store/useSettingsStore';
import { expenseColors } from '@/constants/expenseColors';

interface ExpenseHeaderProps {
  onAddPress?: () => void;
  onFilterPress?: () => void;
}

export const ExpenseHeader: React.FC<ExpenseHeaderProps> = ({
  onAddPress,
  onFilterPress,
}) => {
  const { userName, userAvatarId } = useSettingsStore();

  const hasCustomName = Boolean(userName && userName.trim().length > 0);
  const nameToUse = hasCustomName ? userName.trim() : 'Monevo';
  const parts = nameToUse.split(/\s+/);
  const firstName = parts[0]?.toUpperCase() || 'MONEVO';
  const lastName = parts.slice(1).join(' ').toUpperCase() || '';

  return (
    <View style={styles.container}>
      {/* Left side profile/app icon & greeting */}
      <View style={styles.leftSection}>
        {hasCustomName ? (
          <ProfileAvatar
            avatarId={userAvatarId}
            name={userName}
            size={46}
            showBorder={true}
          />
        ) : (
          <View style={styles.logoBadgeContainer}>
            <Image
              source={require('@/assets/images/monevo-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        )}

        <View style={styles.nameContainer}>
          <AppText
            style={styles.greetingText}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.8}
          >
            HELLO, {firstName}
          </AppText>
          {lastName ? (
            <AppText
              style={styles.greetingText}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.8}
            >
              {lastName}
            </AppText>
          ) : null}
          <AppText style={styles.dashboardSubtitle} numberOfLines={1}>
            YOUR DASHBOARD
          </AppText>
        </View>
      </View>

      {/* Right side filter & add button */}
      <View style={styles.rightSection}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={onFilterPress}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={20} color={expenseColors.textSubtle} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addButton}
          onPress={onAddPress}
          activeOpacity={0.85}
        >
          <Plus size={22} color="#0F1015" strokeWidth={2.6} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  logoBadgeContainer: {
    width: 46,
    height: 46,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1015',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 11,
  },
  appIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: expenseColors.accentPeach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  greetingText: {
    color: expenseColors.textPrimary,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  dashboardSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 6,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: expenseColors.accentPeach,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
