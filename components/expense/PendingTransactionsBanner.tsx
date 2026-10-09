import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, Smartphone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { colors, spacing, radius } from '@/constants';
import { expenseColors } from '@/constants/expenseColors';
import { useSettingsStore } from '@/store/useSettingsStore';
import { ReviewPendingModal } from './ReviewPendingModal';

export const PendingTransactionsBanner: React.FC = () => {
  const pendingTransactions = useSettingsStore((s) => s.pendingTransactions);
  const [modalVisible, setModalVisible] = useState(false);

  if (!pendingTransactions || pendingTransactions.length === 0) {
    return null;
  }

  const count = pendingTransactions.length;

  return (
    <>
      <TouchableOpacity
        style={styles.banner}
        activeOpacity={0.8}
        onPress={() => {
          Haptics.selectionAsync();
          setModalVisible(true);
        }}
      >
        <View style={styles.iconBox}>
          <Smartphone size={16} color={expenseColors.accentPeach} />
        </View>

        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <AppText variant="subheadline" weight="700" color={colors.white}>
              {count} New Transaction{count > 1 ? 's' : ''}
            </AppText>
            <View style={styles.badge}>
              <AppText variant="caption2" weight="800" color={expenseColors.accentPeach}>
                PENDING
              </AppText>
            </View>
          </View>
          <AppText variant="caption1" color={colors.textMuted} numberOfLines={1}>
            Auto-detected from bank alerts · Review & add to ledger
          </AppText>
        </View>

        <View style={styles.chevronBox}>
          <ChevronRight size={16} color={expenseColors.textSubtle} />
        </View>
      </TouchableOpacity>

      <ReviewPendingModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 177, 149, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248, 177, 149, 0.22)',
    borderRadius: radius[16],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    marginHorizontal: spacing[16],
    marginBottom: spacing[16],
    gap: spacing[12],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius[12],
    backgroundColor: 'rgba(248, 177, 149, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  badge: {
    backgroundColor: 'rgba(248, 177, 149, 0.18)',
    paddingHorizontal: spacing[8],
    paddingVertical: 1.5,
    borderRadius: radius[8],
  },
  chevronBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
