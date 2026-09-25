import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import {
  X,
  Users,
  Check,
  Calendar,
  CreditCard,
  Building2,
  Wallet,
  ChevronDown,
  Edit3,
  CheckCircle2,
  Clock,
  Banknote,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MenuAction } from '@expo/ui/community/menu';
import { AppText, NativeLiquidMenu } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseTransaction, SplitFriend } from '@/types/expense';
import { CategoryIcon } from './CategoryIcon';

interface SplitDetailsModalProps {
  visible: boolean;
  transaction: ExpenseTransaction | null;
  onClose: () => void;
  onEdit?: (tx: ExpenseTransaction) => void;
}

export const SplitDetailsModal: React.FC<SplitDetailsModalProps> = ({
  visible,
  transaction,
  onClose,
  onEdit,
}) => {
  const {
    accounts,
    categories,
    currencySymbol,
    settleFriendShare,
    settleTransaction,
    transactions,
  } = useExpenseStore();

  const sym = currencySymbol || '₹';

  // Keep transaction synced with store updates in case of settlement
  const currentTx = useMemo(() => {
    if (!transaction) return null;
    return transactions.find((t) => t.id === transaction.id) || transaction;
  }, [transaction, transactions]);

  // Account for settling
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    currentTx?.accountId || accounts[0]?.id || 'acc_hdfc'
  );

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  }, [accounts, selectedAccountId]);

  const accountMenuActions: MenuAction[] = useMemo(() => {
    return accounts.map((acc) => ({
      id: acc.id,
      title: `${acc.name} (${sym}${acc.balance.toLocaleString('en-IN')})`,
      state: acc.id === selectedAccountId ? ('on' as const) : ('off' as const),
      image: 'building.columns.fill' as any,
    }));
  }, [accounts, selectedAccountId, sym]);

  const category = useMemo(() => {
    if (!currentTx) return categories[0];
    return categories.find((c) => c.id === currentTx.categoryId) || categories[0];
  }, [currentTx, categories]);

  // Robust friends list resolution
  const friends: SplitFriend[] = useMemo(() => {
    if (!currentTx || !currentTx.split) return [];
    if (currentTx.split.friends && currentTx.split.friends.length > 0) {
      return currentTx.split.friends;
    }
    const names = (currentTx.split.friendNames || 'Friend')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    const total = currentTx.split.friendsShare || 0;
    const perAmt = Math.round(total / Math.max(names.length, 1));
    return names.map((n, i) => ({
      id: `f_${i}`,
      name: n,
      amount: perAmt,
      settled: currentTx.split?.settled || false,
    }));
  }, [currentTx]);

  const totalBill = currentTx?.amount || 0;
  const myShare = currentTx?.split?.yourShare || 0;
  const totalFriendsShare = useMemo(() => {
    if (!friends.length) return currentTx?.split?.friendsShare || 0;
    return friends.reduce((s, f) => s + f.amount, 0);
  }, [friends, currentTx]);

  const collectedAmount = useMemo(() => {
    return friends.filter((f) => f.settled).reduce((s, f) => s + f.amount, 0);
  }, [friends]);

  const pendingAmount = useMemo(() => {
    return friends.filter((f) => !f.settled).reduce((s, f) => s + f.amount, 0);
  }, [friends]);

  const settledCount = friends.filter((f) => f.settled).length;
  const isAllSettled = currentTx?.split?.settled || (friends.length > 0 && settledCount === friends.length);
  const progressPct = totalFriendsShare > 0 ? Math.round((collectedAmount / totalFriendsShare) * 100) : 0;

  const formattedDate = useMemo(() => {
    if (!currentTx?.date) return '';
    try {
      const d = new Date(currentTx.date);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return currentTx.date;
    }
  }, [currentTx]);

  const getAccountIcon = (name: string) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('wallet') || lower.includes('paytm')) {
      return <Wallet size={15} color="#8E919D" />;
    }
    if (lower.includes('credit') || lower.includes('card') || lower.includes('slice')) {
      return <CreditCard size={15} color="#8E919D" />;
    }
    return <Building2 size={15} color="#8E919D" />;
  };

  const handleSettleFriend = (friend: SplitFriend) => {
    if (!currentTx) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    settleFriendShare(currentTx.id, friend.id, selectedAccountId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleSettleAll = () => {
    if (!currentTx) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    settleTransaction(currentTx.id, selectedAccountId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  if (!currentTx) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* iOS Drag Handle */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <X size={18} color="#A0A5B5" />
          </TouchableOpacity>

          <AppText style={styles.headerTitle}>SPLIT DETAILS</AppText>

          {onEdit ? (
            <TouchableOpacity
              onPress={() => {
                onClose();
                onEdit(currentTx);
              }}
              style={styles.editBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Edit3 size={15} color={expenseColors.accentPeach} />
              <AppText style={styles.editText}>Edit</AppText>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Hero Summary Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroCategoryBadge}>
                {category && (
                  <CategoryIcon
                    category={category}
                    size={13}
                    color={category.color || '#FFFFFF'}
                    strokeWidth={2}
                    fill={true}
                  />
                )}
                <AppText style={[styles.heroCategoryText, { color: category.color || '#FFFFFF' }]}>
                  {category.name}
                </AppText>
              </View>

              <View style={styles.heroDateRow}>
                <Calendar size={12} color="#7E8394" />
                <AppText style={styles.heroDateText}>{formattedDate}</AppText>
              </View>
            </View>

            <AppText style={styles.heroExpenseName} numberOfLines={2}>
              {currentTx.note || 'Split Expense'}
            </AppText>

            <View style={styles.heroTotalRow}>
              <View>
                <AppText style={styles.heroTotalLabel}>TOTAL BILL</AppText>
                <AppText style={styles.heroTotalAmount}>
                  {sym}{totalBill.toLocaleString('en-IN')}
                </AppText>
              </View>

              <View
                style={[
                  styles.overallStatusPill,
                  {
                    backgroundColor: isAllSettled
                      ? 'rgba(112, 214, 188, 0.15)'
                      : 'rgba(255, 157, 102, 0.15)',
                  },
                ]}
              >
                {isAllSettled ? (
                  <CheckCircle2 size={13} color={expenseColors.accentGreen} />
                ) : (
                  <Clock size={13} color={expenseColors.accentPeach} />
                )}
                <AppText
                  style={[
                    styles.overallStatusText,
                    { color: isAllSettled ? expenseColors.accentGreen : expenseColors.accentPeach },
                  ]}
                >
                  {isAllSettled ? 'Fully Settled' : `${pendingAmount > 0 ? `${sym}${pendingAmount.toLocaleString('en-IN')} Pending` : 'Pending'}`}
                </AppText>
              </View>
            </View>
          </View>

          {/* 2. Breakdown Grid */}
          <View style={styles.breakdownGrid}>
            {/* My Share */}
            <View style={styles.metricTile}>
              <AppText style={styles.metricLabel}>MY SHARE</AppText>
              <AppText style={styles.metricValue}>
                {sym}{myShare.toLocaleString('en-IN')}
              </AppText>
              <AppText style={styles.metricSub}>Your net budget cost</AppText>
            </View>

            {/* Lent to Friends */}
            <View style={styles.metricTile}>
              <AppText style={styles.metricLabel}>LENT TO FRIENDS</AppText>
              <AppText style={[styles.metricValue, { color: expenseColors.accentPeach }]}>
                {sym}{totalFriendsShare.toLocaleString('en-IN')}
              </AppText>
              <AppText style={styles.metricSub}>{friends.length} friend{friends.length !== 1 ? 's' : ''} total</AppText>
            </View>
          </View>

          {/* 3. Progress & Collection Summary */}
          <View style={styles.collectionProgressCard}>
            <View style={styles.progressHeaderRow}>
              <AppText style={styles.progressTitle}>COLLECTION PROGRESS</AppText>
              <AppText style={styles.progressPercent}>
                {settledCount} of {friends.length} settled ({progressPct}%)
              </AppText>
            </View>

            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(progressPct, 100)}%`,
                    backgroundColor: isAllSettled
                      ? expenseColors.accentGreen
                      : expenseColors.accentPeach,
                  },
                ]}
              />
            </View>

            <View style={styles.progressStatsRow}>
              <View style={styles.progressStatItem}>
                <AppText style={styles.progressStatLabel}>Collected</AppText>
                <AppText style={[styles.progressStatValue, { color: expenseColors.accentGreen }]}>
                  {sym}{collectedAmount.toLocaleString('en-IN')}
                </AppText>
              </View>
              <View style={styles.progressStatDivider} />
              <View style={styles.progressStatItem}>
                <AppText style={styles.progressStatLabel}>Still Pending</AppText>
                <AppText style={[styles.progressStatValue, { color: pendingAmount > 0 ? expenseColors.accentRed : expenseColors.textMuted }]}>
                  {sym}{pendingAmount.toLocaleString('en-IN')}
                </AppText>
              </View>
            </View>
          </View>

          {/* 4. Target Deposit Account Selector */}
          {!isAllSettled && (
            <View style={styles.accountSelectorBox}>
              <AppText style={styles.accountSelectorLabel}>DEPOSIT SETTLEMENTS INTO</AppText>
              <NativeLiquidMenu
                title="Select Deposit Account"
                actions={accountMenuActions}
                onSelect={(accId) => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedAccountId(accId);
                }}
                style={{ width: '100%' }}
              >
                <View style={styles.accountTrigger}>
                  <View style={styles.accountTriggerLeft}>
                    <View style={styles.accountIconWrap}>
                      {getAccountIcon(selectedAccount?.name || '')}
                    </View>
                    <View style={{ flexShrink: 1 }}>
                      <AppText style={styles.accountTriggerName} numberOfLines={1}>
                        {selectedAccount?.name.toUpperCase()}
                      </AppText>
                      <AppText style={styles.accountTriggerBal}>
                        Balance: {sym}{(selectedAccount?.balance || 0).toLocaleString('en-IN')}
                      </AppText>
                    </View>
                  </View>
                  <ChevronDown size={14} color="#7E8394" />
                </View>
              </NativeLiquidMenu>
            </View>
          )}

          {/* 5. Participants List */}
          <View style={styles.participantsSection}>
            <View style={styles.sectionHeaderRow}>
              <Users size={14} color="#FF9D66" />
              <AppText style={styles.sectionHeading}>
                PEOPLE INVOLVED ({friends.length})
              </AppText>
            </View>

            <View style={styles.participantsStack}>
              {friends.map((friend, idx) => {
                const isSettled = friend.settled;
                const initials = (friend.name || 'F').charAt(0).toUpperCase();

                return (
                  <View
                    key={friend.id || `f_${idx}`}
                    style={[
                      styles.participantRow,
                      isSettled && styles.participantRowSettled,
                    ]}
                  >
                    {/* Avatar Circle */}
                    <View
                      style={[
                        styles.avatarCircle,
                        isSettled && styles.avatarCircleSettled,
                      ]}
                    >
                      {isSettled ? (
                        <Check size={14} color={expenseColors.accentGreen} strokeWidth={3} />
                      ) : (
                        <AppText style={styles.avatarText}>{initials}</AppText>
                      )}
                    </View>

                    {/* Friend Name & Share Info */}
                    <View style={styles.participantInfo}>
                      <AppText
                        style={[
                          styles.participantName,
                          isSettled && styles.participantNameSettled,
                        ]}
                        numberOfLines={1}
                      >
                        {friend.name || `Friend ${idx + 1}`}
                      </AppText>
                      <AppText style={styles.participantShareLabel}>
                        {isSettled ? 'Paid their share' : 'Owes share'}
                      </AppText>
                    </View>

                    {/* Amount & Settle Button */}
                    <View style={styles.participantRight}>
                      <AppText
                        style={[
                          styles.participantAmount,
                          isSettled ? styles.participantAmountSettled : styles.participantAmountPending,
                        ]}
                      >
                        {sym}{friend.amount.toLocaleString('en-IN')}
                      </AppText>

                      {!isSettled ? (
                        <TouchableOpacity
                          style={styles.settlePersonBtn}
                          activeOpacity={0.8}
                          onPress={() => handleSettleFriend(friend)}
                        >
                          <Check size={11} color={expenseColors.accentGreen} strokeWidth={3} />
                          <AppText style={styles.settlePersonBtnText}>Settle</AppText>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.settledBadge}>
                          <AppText style={styles.settledBadgeText}>✓ Settled</AppText>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 6. Action Button: Settle All Remaining */}
          {!isAllSettled && pendingAmount > 0 && friends.length > 1 && (
            <TouchableOpacity
              style={styles.settleAllBtn}
              activeOpacity={0.85}
              onPress={handleSettleAll}
            >
              <CheckCircle2 size={16} color="#0D0E12" strokeWidth={2.5} />
              <AppText style={styles.settleAllBtnText}>
                Settle All Remaining ({sym}{pendingAmount.toLocaleString('en-IN')})
              </AppText>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#12131A',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#353945',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E202B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  editText: {
    color: expenseColors.accentPeach,
    fontSize: 12,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#1A1D26',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroCategoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroDateText: {
    color: '#7E8394',
    fontSize: 11,
    fontWeight: '500',
  },
  heroExpenseName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    marginBottom: 14,
  },
  heroTotalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  heroTotalLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  heroTotalAmount: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  overallStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  overallStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  breakdownGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricTile: {
    flex: 1,
    backgroundColor: '#1A1D26',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  metricLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricSub: {
    color: '#656A7B',
    fontSize: 11,
    fontWeight: '500',
  },
  collectionProgressCard: {
    backgroundColor: '#1A1D26',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  progressPercent: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressStatItem: {
    flex: 1,
  },
  progressStatLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  progressStatValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 12,
  },
  accountSelectorBox: {
    backgroundColor: '#1A1D26',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  accountSelectorLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  accountTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  accountTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  accountIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#252836',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTriggerName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  accountTriggerBal: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '500',
  },
  participantsSection: {
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionHeading: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  participantsStack: {
    backgroundColor: '#1A1D26',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  participantRowSettled: {
    backgroundColor: 'rgba(112, 214, 188, 0.02)',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#262938',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarCircleSettled: {
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  participantNameSettled: {
    color: '#A0A5B5',
  },
  participantShareLabel: {
    color: '#6E7385',
    fontSize: 11,
    fontWeight: '500',
  },
  participantRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  participantAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  participantAmountPending: {
    color: '#FFFFFF',
  },
  participantAmountSettled: {
    color: '#7E8394',
  },
  settlePersonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(112, 214, 188, 0.3)',
  },
  settlePersonBtnText: {
    color: expenseColors.accentGreen,
    fontSize: 10,
    fontWeight: '700',
  },
  settledBadge: {
    backgroundColor: 'rgba(112, 214, 188, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  settledBadgeText: {
    color: expenseColors.accentGreen,
    fontSize: 10,
    fontWeight: '700',
  },
  settleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: expenseColors.accentPeach,
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
  },
  settleAllBtnText: {
    color: '#0D0E12',
    fontSize: 13,
    fontWeight: '800',
  },
});
