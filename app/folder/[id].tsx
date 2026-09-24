import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Tag,
  ArrowRightLeft,
  Users,
  HandCoins,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseTransaction, ExpenseCategory } from '@/types/expense';
import { CategoryIcon } from '@/components/expense/CategoryIcon';

export default function FolderDetailScreen() {
  const { id, name: paramName, emoji: paramEmoji } = useLocalSearchParams<{
    id: string;
    name?: string;
    emoji?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventFolders, transactions, categories, accounts, currencySymbol } = useExpenseStore();

  const sym = currencySymbol || '₹';

  // Find the event folder by ID or name
  const folder = useMemo(() => {
    // 1. Check in eventFolders store
    const fromStore = eventFolders.find(
      (f) =>
        f.id === id ||
        (id && `name_${f.name.toLowerCase()}` === id.toLowerCase()) ||
        (id && f.name.toLowerCase() === id.toLowerCase())
    );
    if (fromStore) {
      return fromStore;
    }

    // 2. Check if passed via route param
    if (paramName && !paramName.startsWith('ef_')) {
      return {
        id: id || 'folder',
        name: paramName,
        emoji: paramEmoji || '🌴',
        createdAt: new Date().toISOString(),
      };
    }

    // 3. Fallback: inspect transactions matching this folder
    const matchingTx = transactions.find(
      (t) =>
        t.folderId === id ||
        (id && t.folderName && t.folderName.toLowerCase() === id.toLowerCase()) ||
        (id && t.folderId && `name_${id.toLowerCase()}` === `name_${t.folderId.toLowerCase()}`)
    );

    const resolvedName =
      matchingTx?.folderName ||
      matchingTx?.tag ||
      (id && !id.startsWith('ef_') ? id.replace('name_', '') : 'Trip Folder');

    return {
      id: id || 'folder',
      name: resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1),
      emoji: paramEmoji || '🌴',
      createdAt: new Date().toISOString(),
    };
  }, [eventFolders, id, paramName, paramEmoji, transactions]);

  // Filter transactions belonging to this folder
  const folderTxs = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.folderId === id ||
        t.folderId === folder.id ||
        (t.folderName && t.folderName.toLowerCase() === folder.name.toLowerCase()) ||
        (t.tag && t.tag.toLowerCase() === folder.name.toLowerCase())
    );
  }, [transactions, folder, id]);

  const totalSpent = useMemo(() => {
    return folderTxs.reduce(
      (sum, t) => sum + (t.type === 'expense' ? (t.split ? t.split.yourShare : t.amount) : 0),
      0
    );
  }, [folderTxs]);

  const totalGross = useMemo(() => {
    return folderTxs.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : 0), 0);
  }, [folderTxs]);

  const getCategoryObj = (catId: string) => {
    return categories.find((c) => c.id === catId) || categories[0];
  };

  const getAccountName = (accId?: string) => {
    if (!accId) return '';
    return accounts.find((a) => a.id === accId)?.name || accId;
  };

  // Group by Date
  const dateGrouped = useMemo(() => {
    const groups: Record<string, ExpenseTransaction[]> = {};
    folderTxs.forEach((tx) => {
      const dateObj = new Date(tx.date);
      const dateHeading = dateObj
        .toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
        .toUpperCase();

      if (!groups[dateHeading]) {
        groups[dateHeading] = [];
      }
      groups[dateHeading].push(tx);
    });
    return groups;
  }, [folderTxs]);

  const renderCategoryIcon = (cat: ExpenseCategory) => {
    return (
      <CategoryIcon
        category={cat}
        size={16}
        color={cat.color || '#FFFFFF'}
        strokeWidth={2}
        fill={true}
      />
    );
  };

  return (
    <View style={styles.screenContainer}>
      {/* Top Safe Area Background */}
      <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary }} />

      {/* Header Bar with native interactive back */}
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

        <AppText style={styles.headerTitle} numberOfLines={1}>
          {folder.emoji || '🌴'} {folder.name}
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
        {/* Folder Hero Summary Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroEmojiCircle}>
              <AppText style={{ fontSize: 28 }}>{folder.emoji || '🌴'}</AppText>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <AppText style={styles.heroFolderName}>{folder.name}</AppText>
              <AppText style={styles.heroFolderSub}>
                Trip & Event Expense Group
              </AppText>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCol}>
              <AppText style={styles.heroStatLabel}>TOTAL SPENT</AppText>
              <AppText style={styles.heroStatValue}>
                {sym}{totalSpent.toLocaleString('en-IN')}
              </AppText>
            </View>
            <View style={styles.heroStatCol}>
              <AppText style={styles.heroStatLabel}>ITEMS LOGGED</AppText>
              <AppText style={styles.heroStatValue}>{folderTxs.length}</AppText>
            </View>
            {totalGross !== totalSpent && (
              <View style={styles.heroStatCol}>
                <AppText style={styles.heroStatLabel}>GROSS BILL</AppText>
                <AppText style={[styles.heroStatValue, { color: '#8E919D' }]}>
                  {sym}{totalGross.toLocaleString('en-IN')}
                </AppText>
              </View>
            )}
          </View>
        </View>

        {/* Transactions List */}
        {Object.keys(dateGrouped).length === 0 ? (
          <View style={styles.emptyContainer}>
            <AppText style={styles.emptyTitle}>No Transactions in this Folder</AppText>
            <AppText style={styles.emptySub}>
              Assign new transactions to "{folder.name}" from the Add Transaction screen.
            </AppText>
          </View>
        ) : (
          Object.entries(dateGrouped).map(([dateHeading, txs]) => (
            <View key={dateHeading} style={styles.dateGroupContainer}>
              <AppText style={styles.dateHeadingText}>{dateHeading}</AppText>

              <View style={styles.groupCard}>
                {txs.map((tx, idx) => {
                  const isLast = idx === txs.length - 1;
                  const cat = getCategoryObj(tx.categoryId);
                  const isTransfer = tx.type === 'transfer';
                  const isSplit = !!tx.split;
                  const isDebtLend = tx.type === 'debt_lend';
                  const isDebtBorrow = tx.type === 'debt_borrow';
                  const isExpense = tx.type === 'expense' || isSplit || isDebtLend;
                  const isIncome = tx.type === 'income' || isDebtBorrow;

                  let amountDisplay = `${sym}${tx.amount.toLocaleString('en-IN')}`;
                  if (isDebtLend) amountDisplay = `-${sym}${tx.amount.toLocaleString('en-IN')}`;
                  else if (isDebtBorrow) amountDisplay = `+${sym}${tx.amount.toLocaleString('en-IN')}`;
                  else if (isExpense) amountDisplay = `-${sym}${tx.amount.toLocaleString('en-IN')}`;
                  else if (isIncome) amountDisplay = `+${sym}${tx.amount.toLocaleString('en-IN')}`;
                  else if (isTransfer) amountDisplay = `⇄ ${sym}${tx.amount.toLocaleString('en-IN')}`;

                  return (
                    <View
                      key={tx.id}
                      style={[styles.transactionRow, !isLast && styles.rowDivider]}
                    >
                      {/* Left Squircle */}
                      <View
                        style={[
                          styles.categoryIconCircle,
                          {
                            backgroundColor: isTransfer
                              ? 'rgba(96, 165, 250, 0.15)'
                              : isSplit
                              ? 'rgba(192, 132, 252, 0.15)'
                              : isDebtLend
                              ? 'rgba(52, 211, 153, 0.15)'
                              : isDebtBorrow
                              ? 'rgba(251, 146, 60, 0.15)'
                              : '#202330',
                          },
                        ]}
                      >
                        {isTransfer ? (
                          <ArrowRightLeft size={16} color="#60A5FA" />
                        ) : isSplit ? (
                          <Users size={16} color="#C084FC" />
                        ) : isDebtLend ? (
                          <HandCoins size={16} color="#34D399" />
                        ) : isDebtBorrow ? (
                          <HandCoins size={16} color="#FB923C" />
                        ) : (
                          renderCategoryIcon(cat)
                        )}
                      </View>

                      {/* Center Info */}
                      <View style={styles.transactionCenter}>
                        <AppText style={styles.transactionTitle} numberOfLines={1}>
                          {tx.note || cat.name.toUpperCase()}
                        </AppText>
                        <View style={styles.badgeRow}>
                          <View style={styles.categoryPill}>
                            <AppText
                              style={[
                                styles.categoryPillText,
                                { color: cat.color || expenseColors.accentPeach },
                              ]}
                            >
                              {cat.name} {cat.emoji || ''}
                            </AppText>
                          </View>
                          {tx.tag && (
                            <View style={styles.tripTagBadge}>
                              <Tag size={10} color={expenseColors.accentPeach} />
                              <AppText style={styles.tripTagBadgeText}>{tx.tag}</AppText>
                            </View>
                          )}
                          <AppText style={styles.accountSubText}>
                            {getAccountName(tx.accountId)}
                          </AppText>
                        </View>
                      </View>

                      {/* Right Amount */}
                      <View style={styles.amountCol}>
                        <AppText
                          style={[
                            styles.transactionAmountText,
                            isExpense && styles.expenseAmount,
                            isIncome && styles.incomeAmount,
                          ]}
                        >
                          {amountDisplay}
                        </AppText>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
    maxWidth: 180,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  heroCard: {
    backgroundColor: '#181A23',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroEmojiCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#202330',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroFolderName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  heroFolderSub: {
    color: '#7E8394',
    fontSize: 12,
    marginTop: 2,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 14,
  },
  heroStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroStatCol: {
    flex: 1,
  },
  heroStatLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroStatValue: {
    color: expenseColors.accentPeach,
    fontSize: 17,
    fontWeight: '800',
  },
  dateGroupContainer: {
    marginBottom: 20,
  },
  dateHeadingText: {
    color: '#7E8394',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 10,
  },
  groupCard: {
    backgroundColor: '#181A23',
    borderRadius: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  categoryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  transactionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryPill: {
    backgroundColor: '#232633',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tripTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(235, 178, 154, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tripTagBadgeText: {
    color: expenseColors.accentPeach,
    fontSize: 10,
    fontWeight: '700',
  },
  accountSubText: {
    color: '#7E8394',
    fontSize: 11,
    fontWeight: '500',
  },
  amountCol: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  transactionAmountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  expenseAmount: {
    color: '#FF6B6B',
  },
  incomeAmount: {
    color: '#34D399',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    color: '#7E8394',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
