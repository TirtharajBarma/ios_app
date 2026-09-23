import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SlidersHorizontal, Plus, Scan } from 'lucide-react-native';
import { AppText } from '@/components/ui';
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
  const { userName } = useSettingsStore();

  const nameToUse = userName && userName.trim().length > 0 ? userName.trim() : 'TIRTHARAJ BARMA';
  const parts = nameToUse.split(/\s+/);
  const firstName = parts[0]?.toUpperCase() || 'TIRTHARAJ';
  const lastName = parts.slice(1).join(' ').toUpperCase() || 'BARMA';

  return (
    <View style={styles.container}>
      {/* Left side profile/app icon & greeting */}
      <View style={styles.leftSection}>
        <View style={styles.appIconContainer}>
          <Scan size={22} color="#0F1015" strokeWidth={2.2} />
        </View>

        <View style={styles.nameContainer}>
          <AppText style={styles.greetingText}>
            HELLO, {firstName}
          </AppText>
          {lastName ? (
            <AppText style={styles.greetingText}>
              {lastName}
            </AppText>
          ) : null}
          <AppText style={styles.dashboardSubtitle}>
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
    paddingBottom: 8,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  appIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
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
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  dashboardSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
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
