import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronDown,
  ShieldCheck,
  Tag,
  Building,
  CheckCheck,
  Mail,
  AlertTriangle,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText, NativeLiquidMenu } from '@/components/ui';
import type { MenuAction } from '@/components/ui';
import { colors, spacing, radius } from '@/constants';
import { expenseColors } from '@/constants/expenseColors';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useExpenseStore } from '@/store/useExpenseStore';
import { PendingTransaction } from '@/types/expense';
import {
  autoApproveTransaction,
  resolvePendingAccount,
  resolvePendingCategory,
  findMatchingExistingTransaction,
} from '@/services/expense/autoTrackService';

interface ReviewPendingModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatToDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  }
  return dateStr;
}

export const ReviewPendingModal: React.FC<ReviewPendingModalProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { pendingTransactions, dismissPendingTransaction } = useSettingsStore();
  const { accounts, categories, transactions, currencySymbol } = useExpenseStore();

  const [activeTab, setActiveTab] = useState<'new' | 'matched'>('new');
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>({});
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});

  // Partition pending transactions into unlogged (new) and already logged (matched)
  const newItems = useMemo(
    () => pendingTransactions.filter((tx) => !findMatchingExistingTransaction(tx, transactions)),
    [pendingTransactions, transactions]
  );

  const matchedItems = useMemo(
    () => pendingTransactions.filter((tx) => !!findMatchingExistingTransaction(tx, transactions)),
    [pendingTransactions, transactions]
  );

  // If there are no new items but matched items exist when modal opens, default to matched tab
  useEffect(() => {
    if (visible) {
      if (newItems.length === 0 && matchedItems.length > 0) {
        setActiveTab('matched');
      } else {
        setActiveTab('new');
      }
    }
  }, [visible, newItems.length, matchedItems.length]);

  // Guards against double-taps adding the same transaction twice while an approval is in flight.
  const inFlight = useRef(new Set<string>());

  const handleApprove = async (tx: PendingTransaction) => {
    if (inFlight.current.has(tx.id)) return;
    inFlight.current.add(tx.id);
    try {
      const targetAccountId = selectedAccounts[tx.id] || tx.suggestedAccountId;
      const targetCategoryId = selectedCategories[tx.id] || tx.suggestedCategoryId;
      await autoApproveTransaction(tx, targetAccountId, {
        manual: true,
        overrideCategoryId: targetCategoryId,
      });
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

  const handleApproveAll = async (items: PendingTransaction[]) => {
    for (const tx of [...items]) {
      if (inFlight.current.has(tx.id)) continue;
      inFlight.current.add(tx.id);
      try {
        const targetAccountId = selectedAccounts[tx.id] || tx.suggestedAccountId;
        const targetCategoryId = selectedCategories[tx.id] || tx.suggestedCategoryId;
        await autoApproveTransaction(tx, targetAccountId, {
          manual: true,
          overrideCategoryId: targetCategoryId,
        });
        await dismissPendingTransaction(tx.id);
      } catch {
        Alert.alert('Could not add a transaction', 'Some items are still in your review list. Please try again.');
        return;
      } finally {
        inFlight.current.delete(tx.id);
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (pendingTransactions.length <= items.length) {
      onClose();
    }
  };

  const handleDismissAll = async (items: PendingTransaction[]) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    for (const tx of [...items]) {
      await dismissPendingTransaction(tx.id);
    }
    if (pendingTransactions.length <= items.length) {
      onClose();
    }
  };

  const displayedItems = activeTab === 'new' ? newItems : matchedItems;

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
                  {pendingTransactions.length} TOTAL
                </AppText>
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            activeOpacity={0.7}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Segmented Tabs (New vs Already Logged) */}
        {pendingTransactions.length > 0 ? (
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'new' && styles.tabButtonActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab('new');
              }}
              activeOpacity={0.8}
            >
              <AppText
                variant="subheadline"
                weight="700"
                color={activeTab === 'new' ? colors.white : colors.textMuted}
              >
                New
              </AppText>
              <View style={[styles.tabBadge, activeTab === 'new' && styles.tabBadgeActive]}>
                <AppText
                  variant="caption2"
                  weight="700"
                  color={activeTab === 'new' ? '#101114' : colors.textMuted}
                >
                  {newItems.length}
                </AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'matched' && styles.tabButtonActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab('matched');
              }}
              activeOpacity={0.8}
            >
              <AppText
                variant="subheadline"
                weight="700"
                color={activeTab === 'matched' ? colors.white : colors.textMuted}
              >
                Already Logged
              </AppText>
              <View style={[styles.tabBadge, activeTab === 'matched' && styles.tabBadgeActive]}>
                <AppText
                  variant="caption2"
                  weight="700"
                  color={activeTab === 'matched' ? '#101114' : colors.textMuted}
                >
                  {matchedItems.length}
                </AppText>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Content */}
        {pendingTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <ShieldCheck size={32} color={expenseColors.accentPeach} />
            </View>
            <AppText variant="headline" weight="700" color={colors.white}>
              All Caught Up!
            </AppText>
            <AppText
              variant="subheadline"
              color={colors.textMuted}
              style={{ textAlign: 'center', lineHeight: 20 }}
            >
              No pending transactions to review. Bank alerts will appear here as they arrive.
            </AppText>
          </View>
        ) : displayedItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <ShieldCheck size={32} color={expenseColors.accentPeach} />
            </View>
            <AppText variant="headline" weight="700" color={colors.white}>
              {activeTab === 'new' ? 'No New Transactions' : 'No Matched Duplicates'}
            </AppText>
            <AppText
              variant="subheadline"
              color={colors.textMuted}
              style={{ textAlign: 'center', lineHeight: 20 }}
            >
              {activeTab === 'new' && matchedItems.length > 0
                ? `You have ${matchedItems.length} already recorded transaction${matchedItems.length === 1 ? '' : 's'} in the other tab.`
                : 'All pending items in this tab have been reviewed.'}
            </AppText>
            {activeTab === 'new' && matchedItems.length > 0 ? (
              <TouchableOpacity
                style={styles.switchTabBtn}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab('matched');
                }}
              >
                <AppText variant="footnote" weight="700" color={expenseColors.accentPeach}>
                  View Already Logged ({matchedItems.length})
                </AppText>
              </TouchableOpacity>
            ) : null}
            {activeTab === 'matched' && newItems.length > 0 ? (
              <TouchableOpacity
                style={styles.switchTabBtn}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab('new');
                }}
              >
                <AppText variant="footnote" weight="700" color={expenseColors.accentPeach}>
                  View New ({newItems.length})
                </AppText>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 90 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {displayedItems.map((tx) => {
              const isExpense = tx.type === 'expense';
              const matchedAccount = resolvePendingAccount(
                tx,
                selectedAccounts[tx.id] || tx.suggestedAccountId,
                accounts
              );
              const matchedCategory = resolvePendingCategory(
                tx,
                categories,
                selectedCategories[tx.id] || tx.suggestedCategoryId
              );
              const potentialMatch = findMatchingExistingTransaction(tx, transactions);

              const accountMenuActions: MenuAction[] = accounts.map((a) => ({
                id: a.id,
                title: a.name,
                state: a.id === matchedAccount?.id ? 'on' : 'off',
                image: a.type === 'credit' ? 'creditcard' : 'building.columns',
              }));

              const categoryMenuActions: MenuAction[] = categories.map((c) => ({
                id: c.id,
                title: c.name,
                state: c.id === matchedCategory?.id ? 'on' : 'off',
                image: 'tag',
              }));

              return (
                <View key={tx.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.senderPill}>
                      {tx.source === 'email' ? (
                        <Mail size={12} color={colors.textMuted} />
                      ) : (
                        <Smartphone size={12} color={colors.textMuted} />
                      )}
                      <AppText variant="caption2" color={colors.textMuted} weight="600">
                        {tx.sender}
                      </AppText>
                    </View>
                    <AppText variant="caption2" color="rgba(255,255,255,0.4)">
                      {formatToDDMMYYYY(tx.date)}
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

                  {/* Duplicate / Existing Match Banner */}
                  {potentialMatch ? (
                    <View style={styles.duplicateWarningBox}>
                      <AlertTriangle size={13} color="#FF9F0A" />
                      <AppText variant="caption2" color="#FF9F0A" weight="600" style={{ flex: 1 }}>
                        Likely already recorded ({potentialMatch.merchant || potentialMatch.note || 'Expense'} · {currencySymbol}{potentialMatch.amount.toFixed(2)} on {formatToDDMMYYYY(potentialMatch.date)})
                      </AppText>
                    </View>
                  ) : null}

                  {/* Account & Category Interactive Selectors - 1 Row Side-by-Side */}
                  <View style={styles.chipsRow}>
                    <View style={styles.chipWrapper}>
                      <NativeLiquidMenu
                        title="Select Account"
                        actions={accountMenuActions}
                        style={{ width: '100%' }}
                        onSelect={(actionId) => {
                          Haptics.selectionAsync();
                          setSelectedAccounts((prev) => ({ ...prev, [tx.id]: actionId }));
                        }}
                      >
                        <View style={styles.chipInteractive}>
                          <View style={styles.chipContent}>
                            <Building size={12} color={expenseColors.accentPeach} />
                            <AppText
                              variant="caption1"
                              color={colors.white}
                              weight="600"
                              numberOfLines={1}
                              style={{ flex: 1 }}
                            >
                              {matchedAccount?.name || 'Account'}
                            </AppText>
                          </View>
                          <ChevronDown size={11} color={expenseColors.accentPeach} />
                        </View>
                      </NativeLiquidMenu>
                    </View>

                    <View style={styles.chipWrapper}>
                      <NativeLiquidMenu
                        title="Select Category"
                        actions={categoryMenuActions}
                        style={{ width: '100%' }}
                        onSelect={(actionId) => {
                          Haptics.selectionAsync();
                          setSelectedCategories((prev) => ({ ...prev, [tx.id]: actionId }));
                        }}
                      >
                        <View style={styles.chipInteractive}>
                          <View style={styles.chipContent}>
                            <Tag size={12} color={matchedCategory?.color || expenseColors.accentPeach} />
                            <AppText
                              variant="caption1"
                              color={matchedCategory?.color || expenseColors.accentPeach}
                              weight="600"
                              numberOfLines={1}
                              style={{ flex: 1 }}
                            >
                              {matchedCategory?.name || 'Category'}
                            </AppText>
                          </View>
                          <ChevronDown size={11} color={matchedCategory?.color || expenseColors.accentPeach} />
                        </View>
                      </NativeLiquidMenu>
                    </View>
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
                        {potentialMatch ? 'Add as New' : 'Add to Ledger'}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Batch Footer */}
        {pendingTransactions.length > 0 && displayedItems.length > 0 ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[12] }]}>
            {activeTab === 'new' ? (
              <TouchableOpacity
                style={styles.approveAllBtn}
                activeOpacity={0.8}
                onPress={() => handleApproveAll(newItems)}
              >
                <CheckCheck size={16} color="#101114" />
                <AppText variant="subheadline" weight="700" color="#101114">
                  Approve All ({newItems.length})
                </AppText>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.dismissAllBtn}
                activeOpacity={0.8}
                onPress={() => handleDismissAll(matchedItems)}
              >
                <Trash2 size={16} color={colors.white} />
                <AppText variant="subheadline" weight="700" color={colors.white}>
                  Dismiss All ({matchedItems.length})
                </AppText>
              </TouchableOpacity>
            )}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: spacing[16],
    marginTop: spacing[12],
    marginBottom: spacing[4],
    padding: 3,
    borderRadius: radius[12],
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing[8],
    borderRadius: radius[8],
  },
  tabButtonActive: {
    backgroundColor: '#2C2C2E',
  },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: expenseColors.accentPeach,
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
  switchTabBtn: {
    marginTop: spacing[8],
    backgroundColor: 'rgba(248,177,149,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(248,177,149,0.25)',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
    borderRadius: radius[8],
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
  duplicateWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,159,10,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,159,10,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius[8],
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    width: '100%',
  },
  chipWrapper: {
    flex: 1,
    minWidth: 0,
  },
  chipInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius[8],
    width: '100%',
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
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
  dismissAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: spacing[12],
    borderRadius: radius[12],
  },
});
