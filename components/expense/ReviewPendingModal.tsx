import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Check,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  Tag,
  Building,
  CheckCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { colors, spacing, radius } from '@/constants';
import { expenseColors } from '@/constants/expenseColors';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useExpenseStore } from '@/store/useExpenseStore';
import { PendingTransaction } from '@/types/expense';
import { autoApproveTransaction, resolvePendingAccount, resolvePendingCategory } from '@/services/expense/autoTrackService';

interface ReviewPendingModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ReviewPendingModal: React.FC<ReviewPendingModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { pendingTransactions, dismissPendingTransaction } =
    useSettingsStore();
  const { accounts, categories, currencySymbol } = useExpenseStore();

  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});

  // Guards against double-taps adding the same transaction twice while an approval is in flight.
  const inFlight = useRef(new Set<string>());

  const handleApprove = async (tx: PendingTransaction) => {
    if (inFlight.current.has(tx.id)) return;
    inFlight.current.add(tx.id);
    try {
      const targetAccountId = selectedAccounts[tx.id] || tx.suggestedAccountId;
      await autoApproveTransaction(tx, targetAccountId, { manual: true });
      // Only remove it from the review list once it is safely in the ledger.
      await dismissPendingTransaction(tx.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Could not add transaction', 'It is still in your review list. Please try again.');
    } finally {
      inFlight.current.delete(tx.id);
    }
  };

  const handleDismiss = async (txId: string) => {
    Haptics.selectionAsync();
    await dismissPendingTransaction(txId);
  };

  const handleApproveAll = async () => {
    // Approve one by one and dismiss each only after it is added, so a failure never loses the rest.
    for (const tx of [...pendingTransactions]) {
      if (inFlight.current.has(tx.id)) continue;
      inFlight.current.add(tx.id);
      try {
        const targetAccountId = selectedAccounts[tx.id] || tx.suggestedAccountId;
        await autoApproveTransaction(tx, targetAccountId, { manual: true });
        await dismissPendingTransaction(tx.id);
      } catch {
        Alert.alert('Could not add a transaction', 'Some items are still in your review list. Please try again.');
        return;
      } finally {
        inFlight.current.delete(tx.id);
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : spacing[16] }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AppText variant="headline" weight="700" color={colors.white}>
              Review Transactions
            </AppText>
            {pendingTransactions.length > 0 ? (
              <View style={styles.countBadge}>
                <AppText variant="caption2" weight="700" color={expenseColors.accentPeach}>
                  {pendingTransactions.length} NEW
                </AppText>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              Haptics.selectionAsync();
              onClose();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={18} color={colors.white} />
          </TouchableOpacity>
        </View>

        {pendingTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <ShieldCheck size={36} color={expenseColors.accentPeach} />
            </View>
            <AppText variant="headline" weight="600" color={colors.white}>
              All Caught Up!
            </AppText>
            <AppText
              variant="footnote"
              color={colors.textMuted}
              style={{ textAlign: 'center', maxWidth: 260, lineHeight: 18 }}
            >
              No pending transactions to review. Incoming SMS alerts and banking notifications will show up here.
            </AppText>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + spacing[64] + spacing[16] },
            ]}
          >
            {pendingTransactions.map((tx) => {
              const isExpense = tx.type === 'expense';
              // Same resolvers as approval, so what is shown here is exactly what gets saved.
              const matchedAccount = resolvePendingAccount(tx, selectedAccounts[tx.id] || tx.suggestedAccountId, accounts);
              const matchedCategory = resolvePendingCategory(tx, categories);

              return (
                <View key={tx.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.senderPill}>
                      <Smartphone size={12} color={colors.textMuted} />
                      <AppText variant="caption2" color={colors.textMuted} weight="600">
                        {tx.sender}
                      </AppText>
                    </View>
                    <AppText variant="caption2" color="rgba(255,255,255,0.4)">
                      {tx.date}
                    </AppText>
                  </View>

                  <View style={styles.cardMain}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="body" weight="700" color={colors.white} numberOfLines={1}>
                        {tx.merchant || 'Unknown Merchant'}
                      </AppText>
                      {tx.accountHint ? (
                        <AppText variant="caption1" color={colors.textMuted}>
                          {tx.accountHint}
                        </AppText>
                      ) : null}
                    </View>
                    <AppText
                      variant="headline"
                      weight="700"
                      color={isExpense ? '#FF453A' : '#30D158'}
                    >
                      {isExpense ? '-' : '+'}
                      {currencySymbol}
                      {tx.amount.toFixed(2)}
                    </AppText>
                  </View>

                  {/* Account & Automatically Detected Category */}
                  <View style={styles.chipsRow}>
                    <View style={styles.chip}>
                      <Building size={12} color={colors.textMuted} />
                      <AppText variant="caption1" color={colors.white}>
                        {matchedAccount?.name || 'Account'}
                      </AppText>
                    </View>
                    {matchedCategory ? (
                      <View style={styles.chip}>
                        <Tag size={12} color={matchedCategory.color || expenseColors.accentPeach} />
                        <AppText variant="caption1" color={matchedCategory.color || expenseColors.accentPeach}>
                          {matchedCategory.name}
                        </AppText>
                      </View>
                    ) : null}
                  </View>

                  {/* Actions */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.dismissBtn}
                      activeOpacity={0.7}
                      onPress={() => handleDismiss(tx.id)}
                    >
                      <AppText variant="footnote" weight="600" color={colors.textMuted}>
                        Dismiss
                      </AppText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.approveBtn}
                      activeOpacity={0.7}
                      onPress={() => handleApprove(tx)}
                    >
                      <Check size={14} color="#101114" />
                      <AppText variant="footnote" weight="700" color="#101114">
                        Add to Ledger
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Batch Footer */}
        {pendingTransactions.length > 0 ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[12] }]}>
            <TouchableOpacity
              style={styles.approveAllBtn}
              activeOpacity={0.8}
              onPress={handleApproveAll}
            >
              <CheckCheck size={16} color="#101114" />
              <AppText variant="subheadline" weight="700" color="#101114">
                Approve All ({pendingTransactions.length})
              </AppText>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111113',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },
  countBadge: {
    backgroundColor: 'rgba(248,177,149,0.16)',
    paddingHorizontal: spacing[8],
    paddingVertical: 2,
    borderRadius: radius[8],
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing[16],
    gap: spacing[12],
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[12],
    paddingHorizontal: spacing[32],
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: radius[16],
    padding: spacing[16],
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: spacing[12],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  senderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing[8],
    paddingVertical: 2,
    borderRadius: radius[8],
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing[8],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing[12],
    paddingVertical: 4,
    borderRadius: radius[8],
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[8],
    marginTop: spacing[4],
  },
  dismissBtn: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: radius[8],
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: expenseColors.accentPeach,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    borderRadius: radius[12],
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    backgroundColor: '#111113',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  approveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    backgroundColor: expenseColors.accentPeach,
    paddingVertical: spacing[12],
    borderRadius: radius[12],
  },
});
