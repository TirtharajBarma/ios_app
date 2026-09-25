import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Target, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { formatCompactCurrency } from './MoneyFlowCard';

interface SavingsGoalsPillProps {
  onPress?: () => void;
}

export const SavingsGoalsPill: React.FC<SavingsGoalsPillProps> = ({ onPress }) => {
  const { savingsVaults, currencySymbol } = useExpenseStore();
  const sym = currencySymbol || '₹';

  const totalSaved = (savingsVaults || []).reduce((sum, v) => sum + (v.currentAmount || 0), 0);
  const activeCount = savingsVaults.length;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.pillContainer}
        activeOpacity={0.75}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress?.();
        }}
      >
        <View style={styles.leftContent}>
          <View style={styles.iconCircle}>
            <Target size={13} color="#70D6BC" strokeWidth={2.5} />
          </View>
          <View style={styles.textWrap}>
            <AppText style={styles.label}>SAVINGS GOALS</AppText>
            <AppText style={styles.summaryText}>
              {activeCount > 0
                ? `${formatCompactCurrency(totalSaved, sym)} saved in ${activeCount} goal${activeCount === 1 ? '' : 's'}`
                : 'Set up Emergency & Travel Goals'}
            </AppText>
          </View>
        </View>

        <View style={styles.rightAction}>
          <AppText style={styles.actionText}>
            {activeCount > 0 ? 'View All' : 'Create'}
          </AppText>
          <ChevronRight size={13} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16181D',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  label: {
    color: '#8E919D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  summaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  actionText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
});
