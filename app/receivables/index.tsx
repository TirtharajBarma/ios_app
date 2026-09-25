import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  HandCoins,
  Check,
  X,
  Building2,
  Wallet,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  MessageSquare,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MenuAction } from '@expo/ui/community/menu';
import { AppText, NativeLiquidMenu } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseTransaction } from '@/types/expense';
import { SplitDetailsModal } from '@/components/expense/SplitDetailsModal';

export default function ReceivablesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accounts, transactions, currencySymbol, settleTransaction, settleFriendShare } = useExpenseStore();

  const sym = currencySymbol || '₹';
  const [activeTab, setActiveTab] = useState<'all' | 'lent' | 'borrow'>('all');
  const [selectedSplitTx, setSelectedSplitTx] = useState<ExpenseTransaction | null>(null);
  const [settlingItem, setSettlingItem] = useState<{
    tx: ExpenseTransaction;
    friendId?: string;
    borrower: string;
    amount: number;
  } | null>(null);
  const [settleAccountId, setSettleAccountId] = useState<string>(accounts[0]?.id || 'acc_hdfc');

  // 1. Pending Lent List (Money to Collect)
  // Direct Lent is kept individual. Split Expenses are kept as grouped folder items.
  const pendingLentList = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      borrower: string;
      subtitle: string;
      amount: number;
      date: string;
      kind: 'lent' | 'split';
      tx: ExpenseTransaction;
    }> = [];

    transactions.forEach((tx) => {
      if (tx.type === 'debt_lend' && !tx.isSettled) {
        list.push({
          id: tx.id,
          title: tx.borrowerOrLender || 'Friend',
          borrower: tx.borrowerOrLender || 'Friend',
          subtitle: tx.note || 'Lent to Friend',
          amount: tx.amount,
          date: tx.date,
          kind: 'lent',
          tx,
        });
      } else if (tx.split && !tx.split.settled) {
        let pendingAmt = 0;
        let totalLent = tx.split.friendsShare || 0;
        let friendsCount = 0;
        let settledCount = 0;

        if (tx.split.friends && tx.split.friends.length > 0) {
          friendsCount = tx.split.friends.length;
          settledCount = tx.split.friends.filter((f) => f.settled).length;
          pendingAmt = tx.split.friends.filter((f) => !f.settled).reduce((s, f) => s + f.amount, 0);
          totalLent = tx.split.friends.reduce((s, f) => s + f.amount, 0);
        } else {
          const names = (tx.split.friendNames || '').split(',').map((n) => n.trim()).filter(Boolean);
          friendsCount = names.length || 1;
          pendingAmt = tx.split.friendsShare || 0;
          totalLent = tx.split.friendsShare || 0;
          settledCount = 0;
        }

        if (pendingAmt > 0) {
          list.push({
            id: tx.id,
            title: tx.note || 'Split Bill',
            borrower: `${friendsCount} ${friendsCount === 1 ? 'person' : 'people'}${
              settledCount > 0 ? ` (${settledCount} settled)` : ''
            }`,
            subtitle: `${friendsCount} ${friendsCount === 1 ? 'person' : 'people'}${
              settledCount > 0 ? ` (${settledCount} settled)` : ''
            } • Lent: ${sym}${totalLent.toLocaleString('en-IN')}`,
            amount: pendingAmt,
            date: tx.date,
            kind: 'split',
            tx,
          });
        }
      }
    });
    return list;
  }, [transactions, sym]);

  // 2. Pending Borrow List (Money to Pay)
  const pendingBorrowList = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      borrower: string;
      subtitle: string;
      amount: number;
      date: string;
      kind: 'borrow';
      tx: ExpenseTransaction;
    }> = [];

    transactions.forEach((tx) => {
      if (tx.type === 'debt_borrow' && !tx.isSettled) {
        list.push({
          id: tx.id,
          title: tx.borrowerOrLender || 'Friend',
          borrower: tx.borrowerOrLender || 'Friend',
          subtitle: tx.note || 'Borrowed from Friend',
          amount: tx.amount,
          date: tx.date,
          kind: 'borrow',
          tx,
        });
      }
    });
    return list;
  }, [transactions]);

  const totalPendingLent = useMemo(() => {
    return pendingLentList.reduce((sum, item) => sum + item.amount, 0);
  }, [pendingLentList]);

  const totalPendingBorrow = useMemo(() => {
    return pendingBorrowList.reduce((sum, item) => sum + item.amount, 0);
  }, [pendingBorrowList]);

  // Unique person counts: distinct individual direct debtors + distinct split pending participants
  const uniqueLentCount = useMemo(() => {
    const directNames = new Set<string>();
    let count = 0;
    transactions.forEach((tx) => {
      if (tx.type === 'debt_lend' && !tx.isSettled) {
        directNames.add((tx.borrowerOrLender || 'Friend').toLowerCase());
      }
    });
    count += directNames.size;
    transactions.forEach((tx) => {
      if (tx.split && !tx.split.settled) {
        if (tx.split.friends && tx.split.friends.length > 0) {
          const pending = tx.split.friends.filter((f) => !f.settled);
          count += pending.length;
        } else if ((tx.split.friendsShare || 0) > 0) {
          const names = (tx.split.friendNames || '').split(',').map((n) => n.trim()).filter(Boolean);
          count += names.length || 1;
        }
      }
    });
    return count;
  }, [transactions]);

  const uniqueBorrowCount = useMemo(() => {
    return new Set(pendingBorrowList.map((item) => item.borrower.toLowerCase())).size;
  }, [pendingBorrowList]);

  const displayedList = useMemo(() => {
    if (activeTab === 'lent') return pendingLentList;
    if (activeTab === 'borrow') return pendingBorrowList;
    return [...pendingLentList, ...pendingBorrowList];
  }, [activeTab, pendingLentList, pendingBorrowList]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === settleAccountId) || accounts[0];
  }, [accounts, settleAccountId]);

  const sendWhatsAppReminder = (name: string, netAmount: number) => {
    Haptics.selectionAsync().catch(() => {});
    const isOwed = netAmount >= 0;
    const absAmt = Math.abs(netAmount);
    const message = isOwed
      ? `Hey ${name}! 👋 Gentle reminder from The Ledger: Net balance is ${sym}${absAmt.toLocaleString('en-IN')}. Please settle when convenient!`
      : `Hey ${name}! 👋 Checking our balance on The Ledger: I owe you ${sym}${absAmt.toLocaleString('en-IN')}. Let me know how to send it!`;

    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
        }
      })
      .catch(() => {
        Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
      });
  };

  // Account Menu Actions for iOS Native Menu
  const accountMenuActions: MenuAction[] = useMemo(() => {
    return accounts.map((acc) => ({
      id: acc.id,
      title: `${acc.name} (${sym}${acc.balance.toLocaleString('en-IN')})`,
      state: acc.id === settleAccountId ? ('on' as const) : ('off' as const),
      image: 'building.columns.fill' as any,
    }));
  }, [accounts, settleAccountId, sym]);

  const getAccountIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('wallet') || lower.includes('amazon') || lower.includes('paytm')) {
      return <Wallet size={16} color="#8E919D" />;
    }
    if (lower.includes('credit') || lower.includes('slice') || lower.includes('onecard')) {
      return <CreditCard size={16} color="#8E919D" />;
    }
    return <Building2 size={16} color="#8E919D" />;
  };

  const hasBoth = totalPendingLent > 0 && totalPendingBorrow > 0;

  return (
    <View style={styles.screenContainer}>
      {/* Top Safe Area Background */}
      <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary }} />

      {/* Header Bar with interactive swipe-back support */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={expenseColors.accentPeach} />
          <AppText style={styles.backBtnText}>The Ledger</AppText>
        </TouchableOpacity>

        <AppText style={styles.headerTitle}>
          {hasBoth ? 'Debts & Dues' : totalPendingBorrow > 0 ? 'Money to Pay' : 'Money to Collect'}
        </AppText>

        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Receivables Hero Summary Card - Clean unified alignment grid (No font clipping) */}
        <View style={styles.heroCard}>
          {/* Top Block: Clean vertical block (label -> value) */}
          <View style={styles.heroTopBlock}>
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroIconCircle}>
                <HandCoins size={16} color={expenseColors.accentGreen} />
              </View>
              <AppText style={styles.heroCardLabel}>
                {hasBoth ? 'TOTAL DUES BREAKDOWN' : totalPendingBorrow > 0 ? 'TOTAL TO PAY' : 'TOTAL TO COLLECT'}
              </AppText>
            </View>

            {/* Primary Amount: Coral for To Collect, Yellow for To Pay */}
            <View style={styles.heroAmountRow}>
              <AppText style={totalPendingBorrow > 0 && totalPendingLent === 0 ? styles.heroCardAmountYellow : styles.heroCardAmountRed}>
                {sym}{totalPendingLent > 0 ? totalPendingLent.toLocaleString('en-IN') : totalPendingBorrow.toLocaleString('en-IN')}
              </AppText>
              {hasBoth && (
                <AppText style={styles.heroCardSubAmount}>
                  {' '}· Pay: {sym}{totalPendingBorrow.toLocaleString('en-IN')}
                </AppText>
              )}
            </View>
          </View>

          <View style={styles.heroDivider} />

          {/* 2 Equal Columns Grid starting at exact same baseline */}
          <View style={styles.heroStatsGrid}>
            <View style={styles.heroStatColumn}>
              <AppText style={styles.heroStatLabel}>TO COLLECT</AppText>
              <AppText style={styles.heroStatValue}>
                {sym}{totalPendingLent.toLocaleString('en-IN')} ({uniqueLentCount} {uniqueLentCount === 1 ? 'person' : 'people'})
              </AppText>
            </View>
            <View style={styles.heroStatColumn}>
              <AppText style={styles.heroStatLabel}>TO PAY</AppText>
              <AppText style={[styles.heroStatValue, { color: '#F4CD89' }]}>
                {sym}{totalPendingBorrow.toLocaleString('en-IN')} ({uniqueBorrowCount} {uniqueBorrowCount === 1 ? 'person' : 'people'})
              </AppText>
            </View>
          </View>
        </View>

        {/* Filter Pills if both lent and borrow exist */}
        {hasBoth && (
          <View style={styles.tabPillsRow}>
            <TouchableOpacity
              style={[styles.tabPill, activeTab === 'all' && styles.tabPillActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab('all');
              }}
            >
              <AppText style={[styles.tabPillText, activeTab === 'all' && styles.tabPillTextActive]}>
                All ({pendingLentList.length + pendingBorrowList.length})
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabPill, activeTab === 'lent' && styles.tabPillActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab('lent');
              }}
            >
              <AppText style={[styles.tabPillText, activeTab === 'lent' && styles.tabPillTextActive]}>
                To Collect ({pendingLentList.length})
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabPill, activeTab === 'borrow' && styles.tabPillActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab('borrow');
              }}
            >
              <AppText style={[styles.tabPillText, activeTab === 'borrow' && styles.tabPillTextActive]}>
                To Pay ({pendingBorrowList.length})
              </AppText>
            </TouchableOpacity>
          </View>
        )}

        {/* List Section Heading */}
        <AppText style={styles.sectionHeading}>
          {activeTab === 'borrow' ? 'PENDING PAYABLES' : activeTab === 'lent' ? 'PENDING RECEIVABLES' : 'ALL PENDING DUES'} ({displayedList.length})
        </AppText>

        {displayedList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Check size={22} color={expenseColors.accentGreen} strokeWidth={2.5} />
            </View>
            <AppText style={styles.emptyTitle}>All Settled Up!</AppText>
            <AppText style={styles.emptySub}>
              You have no outstanding dues or money owed to you at this time.
            </AppText>
          </View>
        ) : (
          <View style={styles.receivablesListCard}>
            {displayedList.map((item, idx) => {
              const isLast = idx === displayedList.length - 1;
              const isBorrow = item.kind === 'borrow';
              const isSplit = item.kind === 'split';
              const formattedDate = new Date(item.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.debtorRow, !isLast && styles.rowDivider]}
                  activeOpacity={0.75}
                  onPress={() => {
                    if (isSplit) {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedSplitTx(item.tx);
                    } else {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      setSettlingItem({
                        tx: item.tx,
                        borrower: item.borrower,
                        amount: item.amount,
                      });
                      setSettleAccountId(item.tx.accountId || accounts[0]?.id || 'acc_hdfc');
                    }
                  }}
                >
                  <View style={styles.debtorInfoCol}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <AppText style={styles.debtorName} numberOfLines={1}>
                        {item.title.toUpperCase()}
                      </AppText>
                      <View
                        style={[
                          styles.kindBadge,
                          {
                            backgroundColor: isBorrow
                              ? 'rgba(244, 205, 137, 0.12)'
                              : isSplit
                              ? 'rgba(255, 157, 102, 0.12)'
                              : 'rgba(244, 139, 139, 0.12)',
                          },
                        ]}
                      >
                        <AppText
                          style={[
                            styles.kindBadgeText,
                            { color: isBorrow ? '#F4CD89' : isSplit ? '#FF9D66' : expenseColors.accentRed },
                          ]}
                        >
                          {isBorrow ? 'You owe' : isSplit ? 'SPLIT DUE' : 'Owes you'}
                        </AppText>
                      </View>
                    </View>
                    <AppText style={styles.debtorNote} numberOfLines={1}>
                      {isSplit ? item.subtitle : `${item.subtitle} • ${formattedDate}`}
                    </AppText>
                  </View>

                  <View style={styles.debtorRightCol}>
                    <AppText style={isBorrow ? styles.debtorAmountYellow : styles.debtorAmountRed}>
                      {isBorrow ? `+${sym}` : `-${sym}`}{item.amount.toLocaleString('en-IN')}
                    </AppText>
                    {isSplit ? (
                      <TouchableOpacity
                        style={styles.splitDetailsBtn}
                        activeOpacity={0.8}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setSelectedSplitTx(item.tx);
                        }}
                      >
                        <AppText style={styles.splitDetailsBtnText}>Details</AppText>
                        <ChevronRight size={12} color="#FF9D66" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.settleBtn, isBorrow && styles.payBtn]}
                        activeOpacity={0.8}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                          setSettlingItem({
                            tx: item.tx,
                            borrower: item.borrower,
                            amount: item.amount,
                          });
                          setSettleAccountId(item.tx.accountId || accounts[0]?.id || 'acc_hdfc');
                        }}
                      >
                        <Check size={11} color={isBorrow ? '#F4CD89' : expenseColors.accentGreen} strokeWidth={3} />
                        <AppText style={[styles.settleBtnText, isBorrow && styles.payBtnText]}>
                          {isBorrow ? 'Pay Up' : 'Settle'}
                        </AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── NATIVE iOS STYLE BOTTOM SHEET FOR SETTLING / PAYING DUES ── */}
      <Modal
        visible={settlingItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSettlingItem(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSettlingItem(null)}
        >
          <View style={styles.settleSheetCard} onStartShouldSetResponder={() => true}>
            {/* iOS Sheet Grabber Handle */}
            <View style={styles.sheetGrabber} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderTitleRow}>
                <View style={styles.sheetHeaderIconCircle}>
                  <Check size={13} color={expenseColors.accentGreen} strokeWidth={3} />
                </View>
                <AppText style={styles.sheetTitle}>
                  {settlingItem?.tx?.type === 'debt_borrow' ? 'SETTLE DEBT / PAY' : 'SETTLE RECEIVABLE'}
                </AppText>
              </View>
              <TouchableOpacity
                onPress={() => setSettlingItem(null)}
                style={styles.sheetCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color="#8E919D" />
              </TouchableOpacity>
            </View>

            {settlingItem && (
              <>
                {/* 1. Who Owes / Who to Pay */}
                <View style={styles.whoOwesSection}>
                  <AppText style={styles.whoOwesLabel}>
                    {settlingItem.tx.type === 'debt_borrow' ? 'Pay back to' : 'Receive payment from'}
                  </AppText>
                  <AppText style={styles.whoOwesName}>
                    {settlingItem.borrower}
                  </AppText>
                </View>

                {/* 2. How Much (Never Clipped, Generous Area) */}
                <View style={styles.amountHeroContainer}>
                  <AppText style={styles.amountHeroText}>
                    {sym}{settlingItem.amount.toLocaleString('en-IN')}
                  </AppText>
                </View>

                {/* 3. Account Selection */}
                <View style={styles.accountSection}>
                  <AppText style={styles.accountSectionLabel}>
                    {settlingItem.tx.type === 'debt_borrow' ? 'PAY FROM ACCOUNT' : 'RECEIVE INTO ACCOUNT'}
                  </AppText>
                  <NativeLiquidMenu
                    title={settlingItem.tx.type === 'debt_borrow' ? 'Select Payment Account' : 'Select Deposit Account'}
                    actions={accountMenuActions}
                    onSelect={(accId) => {
                      Haptics.selectionAsync().catch(() => {});
                      setSettleAccountId(accId);
                    }}
                    style={{ width: '100%' }}
                  >
                    <View style={styles.accountSelectorTrigger}>
                      <View style={styles.accountSelectorLeft}>
                        <View style={styles.accountIconWrap}>
                          {getAccountIcon(selectedAccount?.name || '')}
                        </View>
                        <View style={{ flexShrink: 1 }}>
                          <AppText style={styles.accountSelectorName} numberOfLines={1}>
                            {selectedAccount?.name.toUpperCase()}
                          </AppText>
                          <AppText style={styles.accountSelectorBalance}>
                            Balance: {sym}{(selectedAccount?.balance || 0).toLocaleString('en-IN')}
                          </AppText>
                        </View>
                      </View>
                      <ChevronDown size={14} color="#7E8394" />
                    </View>
                  </NativeLiquidMenu>
                </View>

                {/* 4. Action Buttons */}
                <TouchableOpacity
                  style={styles.confirmDepositBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (settlingItem) {
                      if (settlingItem.friendId) {
                        settleFriendShare(settlingItem.tx.id, settlingItem.friendId, settleAccountId);
                      } else {
                        settleTransaction(settlingItem.tx.id, settleAccountId);
                      }
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                      setSettlingItem(null);
                    }
                  }}
                >
                  <AppText style={styles.confirmDepositBtnText}>
                    {settlingItem.tx.type === 'debt_borrow' ? 'Confirm & Repay' : 'Confirm & Deposit'}
                  </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sheetWhatsAppBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (settlingItem) {
                      const net = settlingItem.tx.type === 'debt_borrow' ? -settlingItem.amount : settlingItem.amount;
                      sendWhatsAppReminder(settlingItem.borrower, net);
                    }
                  }}
                >
                  <MessageSquare size={13} color="#70D6BC" />
                  <AppText style={styles.sheetWhatsAppBtnText}>Send Reminder on WhatsApp</AppText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {selectedSplitTx && (
        <SplitDetailsModal
          visible={selectedSplitTx !== null}
          transaction={selectedSplitTx}
          onClose={() => setSelectedSplitTx(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: expenseColors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 60,
  },
  backBtnText: {
    color: expenseColors.accentPeach,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },

  // ── Hero Summary Card ──
  heroCard: {
    backgroundColor: '#181A23',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  heroTopBlock: {
    marginBottom: 4,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  heroIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardLabel: {
    color: '#7E8394',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  heroCardAmountRed: {
    color: expenseColors.accentRed, // Soft Coral Red
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    paddingVertical: 2,
    includeFontPadding: false,
  },
  heroCardAmountYellow: {
    color: '#F4CD89', // Warm Buttercream
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    paddingVertical: 2,
    includeFontPadding: false,
  },
  heroCardSubAmount: {
    color: '#F4CD89',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 14,
  },
  heroStatsGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroStatColumn: {
    flex: 1,
  },
  heroStatLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  heroStatValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Tab Switcher Pills ──
  tabPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  tabPill: {
    backgroundColor: '#1E212B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  tabPillActive: {
    backgroundColor: '#FFFFFF',
  },
  tabPillText: {
    color: '#7E8394',
    fontSize: 12,
    fontWeight: '700',
  },
  tabPillTextActive: {
    color: '#0F1015',
    fontWeight: '800',
  },

  sheetWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(112, 214, 188, 0.1)',
    borderRadius: 14,
    height: 46,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(112, 214, 188, 0.25)',
  },
  sheetWhatsAppBtnText: {
    color: '#70D6BC',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Debtor List Section ──
  sectionHeading: {
    color: '#7E8394',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  receivablesListCard: {
    backgroundColor: '#181A23',
    borderRadius: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  debtorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  debtorInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  debtorName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  kindBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  kindBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  debtorNote: {
    color: '#7E8394',
    fontSize: 11,
    marginTop: 3,
  },
  debtorRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  debtorAmountRed: {
    color: expenseColors.accentRed,
    fontSize: 14,
    fontWeight: '800',
  },
  debtorAmountYellow: {
    color: '#F4CD89',
    fontSize: 14,
    fontWeight: '800',
  },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    borderColor: 'rgba(112, 214, 188, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  settleBtnText: {
    color: expenseColors.accentGreen,
    fontSize: 11,
    fontWeight: '800',
  },
  payBtn: {
    backgroundColor: 'rgba(244, 205, 137, 0.12)',
    borderColor: 'rgba(244, 205, 137, 0.3)',
  },
  payBtnText: {
    color: '#F4CD89',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySub: {
    color: '#7E8394',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Settle Sheet ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  settleSheetCard: {
    width: '100%',
    backgroundColor: '#181A23',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetGrabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetHeaderIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sheetCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#202330',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoOwesSection: {
    marginBottom: 12,
  },
  whoOwesLabel: {
    color: '#7E8394',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 3,
  },
  whoOwesName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  amountHeroContainer: {
    backgroundColor: '#202330',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    minHeight: 74,
  },
  amountHeroText: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 2,
    includeFontPadding: false,
  },
  accountSection: {
    marginBottom: 16,
  },
  accountSectionLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  accountSelectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#202330',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  accountSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  accountIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountSelectorName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  accountSelectorBalance: {
    color: '#7E8394',
    fontSize: 11,
    marginTop: 2,
  },
  confirmDepositBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  confirmDepositBtnText: {
    color: '#0F1015',
    fontSize: 14,
    fontWeight: '800',
  },
  splitDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  splitDetailsBtnText: {
    color: '#FF9D66',
    fontSize: 11,
    fontWeight: '700',
  },
});
