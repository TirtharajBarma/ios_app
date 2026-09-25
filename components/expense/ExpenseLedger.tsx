import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowRightLeft,
  Users,
  Tag,
  Trash2,
  Sparkles,
  HandCoins,
  Search,
  X,
  Mic,
  Check,
  ChevronRight,
  ChevronDown,
  Building2,
  Folder,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { MenuAction } from '@expo/ui/community/menu';
import { AppText, NativeLiquidMenu } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseTransaction, ExpenseCategory } from '@/types/expense';
import { CategoryIcon } from './CategoryIcon';
import { AddTransactionModal } from './AddTransactionModal';
import { SplitDetailsModal } from './SplitDetailsModal';
import { getDeviceAiEngineInfo } from '@/services/onDeviceAi';

export interface LedgerGroupItem {
  type: 'single' | 'folder';
  tx?: ExpenseTransaction;
  folderKey?: string;
  folderName?: string;
  folderEmoji?: string;
  folderTxs?: ExpenseTransaction[];
  folderTotal?: number;
}

const ROTATING_SEARCH_PLACEHOLDERS = [
  '"How much did I spend at Amazon in Decemb..."',
  '"Uber trips last weekend"',
  '"Food & dining expenses > ₹500"',
  '"Total spent on Cigarettes this month"',
  '"Transactions paid from Slice"',
  '"Coffee & cafe orders in September"',
];

export const ExpenseLedger: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    accounts,
    categories,
    transactions,
    eventFolders,
    activeAccountFilter,
    smartSearchQuery,
    selectedTransactionIds,
    currencySymbol,
    setActiveAccountFilter,
    setSmartSearchQuery,
    getFilteredTransactions,
    getSmartSearchResult,
    toggleSelectTransaction,
    clearSelectedTransactions,
    removeTransactions,
    updateTransactionsCategory,
    settleTransaction,
  } = useExpenseStore();

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [editingTx, setEditingTx] = useState<ExpenseTransaction | null>(null);
  const [selectedSplitTx, setSelectedSplitTx] = useState<ExpenseTransaction | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const sym = currencySymbol || '₹';

  const animHeader = useRef(new Animated.Value(1)).current;
  const animSearch = useRef(new Animated.Value(1)).current;
  const animFilters = useRef(new Animated.Value(1)).current;
  const animList = useRef(new Animated.Value(1)).current;

  // Rotate smart search placeholder smoothly every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % ROTATING_SEARCH_PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleSelectMode = () => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (isSelectMode) {
      clearSelectedTransactions();
      setIsSelectMode(false);
    } else {
      setIsSelectMode(true);
    }
  };

  // Category Actions for Batch Categorization
  const categoryMenuActions: MenuAction[] = useMemo(() => {
    return categories
      .filter((c) => c.id !== 'cat_income')
      .map((c) => ({
        id: c.id,
        title: c.name,
        image: 'tag.fill' as any,
      }));
  }, [categories]);

  // Statistical Anomaly / Outlier Calculation (Z-Score approximation per category)
  const categoryAverages = useMemo(() => {
    const map: Record<string, { avg: number; stdDev: number }> = {};
    categories.forEach((cat) => {
      const catTxs = transactions.filter((t) => t.categoryId === cat.id && t.type === 'expense');
      if (catTxs.length >= 2) {
        const sum = catTxs.reduce((acc, t) => acc + t.amount, 0);
        const avg = sum / catTxs.length;
        const variance = catTxs.reduce((acc, t) => acc + Math.pow(t.amount - avg, 2), 0) / catTxs.length;
        const stdDev = Math.sqrt(variance);
        map[cat.id] = { avg, stdDev };
      }
    });
    return map;
  }, [categories, transactions]);

  // Unified Pending Debts & Lent Receivables (Soft Pastel Aesthetics)
  const pendingLentList = useMemo(() => {
    const list: Array<{ id: string; title: string; borrower: string; amount: number; tx: ExpenseTransaction }> = [];
    transactions.forEach((tx) => {
      if (tx.type === 'debt_lend' && !tx.isSettled) {
        list.push({
          id: tx.id,
          title: tx.note || 'Lent to Friend',
          borrower: tx.borrowerOrLender || 'Friend',
          amount: tx.amount,
          tx,
        });
      } else if (tx.split && !tx.split.settled && (tx.split.friendsShare || 0) > 0) {
        list.push({
          id: tx.id,
          title: tx.note || 'Split Bill',
          borrower: tx.split.friendNames || 'Friends',
          amount: tx.split.friendsShare,
          tx,
        });
      }
    });
    return list;
  }, [transactions]);

  const pendingBorrowList = useMemo(() => {
    const list: Array<{ id: string; title: string; borrower: string; amount: number; tx: ExpenseTransaction }> = [];
    transactions.forEach((tx) => {
      if (tx.type === 'debt_borrow' && !tx.isSettled) {
        list.push({
          id: tx.id,
          title: tx.note || 'Borrowed from Friend',
          borrower: tx.borrowerOrLender || 'Friend',
          amount: tx.amount,
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

  const hasPendingDebts = totalPendingLent > 0 || totalPendingBorrow > 0;

  const deviceAiInfo = useMemo(() => getDeviceAiEngineInfo(), []);
  const aiResult = useMemo(() => getSmartSearchResult(), [transactions, activeAccountFilter, smartSearchQuery, accounts, categories]);

  const filteredTxs = useMemo(() => {
    return getFilteredTransactions();
  }, [transactions, activeAccountFilter, smartSearchQuery, accounts, categories]);

  const getCategoryObj = (catId: string) => {
    return categories.find((c) => c.id === catId) || categories[0];
  };

  const getAccountName = (accId?: string, fallbackName?: string) => {
    if (!accId) return fallbackName || '';
    const acc = accounts.find((a) => a.id === accId);
    if (acc) return acc.name;
    return fallbackName || accId.replace(/^acc_/, '').toUpperCase();
  };

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

  const accountFilterList = ['All', ...accounts.map((a) => a.name)];

  // Group All Transactions by Date and Folder (No Pagination Limit)
  const dateGrouped = useMemo(() => {
    const groups: Record<string, LedgerGroupItem[]> = {};
    filteredTxs.forEach((tx) => {
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

      const folderKey = tx.folderId || (tx.folderName ? `name_${tx.folderName.toLowerCase()}` : null);
      if (folderKey) {
        const existing = groups[dateHeading].find(
          (item) => item.type === 'folder' && item.folderKey === folderKey
        );
        const folderObj = eventFolders.find((f) => f.id === tx.folderId);
        const folderName = folderObj?.name || tx.folderName || 'Event';
        const folderEmoji = folderObj?.emoji || '🌴';

        if (existing && existing.folderTxs) {
          existing.folderTxs.push(tx);
          existing.folderTotal = (existing.folderTotal || 0) + (tx.type === 'expense' ? tx.amount : 0);
        } else {
          groups[dateHeading].push({
            type: 'folder',
            folderKey,
            folderName,
            folderEmoji,
            folderTxs: [tx],
            folderTotal: tx.type === 'expense' ? tx.amount : 0,
          });
        }
      } else {
        groups[dateHeading].push({
          type: 'single',
          tx,
        });
      }
    });
    return groups;
  }, [filteredTxs, eventFolders]);

  const renderTransactionItem = (tx: ExpenseTransaction, isLast: boolean) => {
    const cat = getCategoryObj(tx.categoryId);
    const isSelected = selectedTransactionIds.includes(tx.id);
    const formattedDate = new Date(tx.date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
    });

    const isTransfer = tx.type === 'transfer';
    const isDebtLend = tx.type === 'debt_lend';
    const isDebtBorrow = tx.type === 'debt_borrow';
    const isDebt = isDebtLend || isDebtBorrow;
    const isExpense = tx.type === 'expense' || !!tx.split || isDebtLend;
    const isIncome = tx.type === 'income' || isDebtBorrow;

    const isSettled = isDebtLend ? tx.isSettled : isDebtBorrow ? tx.isSettled : tx.split?.settled;

    let amountDisplay = `${sym}${tx.amount.toLocaleString('en-IN')}`;
    if (isDebtLend) {
      amountDisplay = isSettled
        ? `✓ ${sym}${tx.amount.toLocaleString('en-IN')}`
        : `-${sym}${tx.amount.toLocaleString('en-IN')}`;
    } else if (isDebtBorrow) {
      amountDisplay = isSettled
        ? `✓ ${sym}${tx.amount.toLocaleString('en-IN')}`
        : `+${sym}${tx.amount.toLocaleString('en-IN')}`;
    } else if (isExpense) {
      amountDisplay = `-${sym}${tx.amount.toLocaleString('en-IN')}`;
    } else if (isIncome) {
      amountDisplay = `+${sym}${tx.amount.toLocaleString('en-IN')}`;
    } else if (isTransfer) {
      amountDisplay = `⇄ ${sym}${tx.amount.toLocaleString('en-IN')}`;
    }

    const catStats = categoryAverages[tx.categoryId];
    const isOutlier =
      tx.type === 'expense' &&
      catStats &&
      catStats.stdDev > 25 &&
      tx.amount > catStats.avg + 1.8 * catStats.stdDev;

    const txActions: MenuAction[] = [
      {
        id: 'edit',
        title: 'Edit Transaction',
        image: 'pencil' as any,
      },
      {
        id: 'copy',
        title: 'Copy Details',
        image: 'doc.on.doc' as any,
      },
      {
        id: 'select',
        title: 'Select Item',
        image: 'checklist' as any,
      },
      {
        id: 'delete',
        title: 'Delete Transaction',
        image: 'trash.fill' as any,
        attributes: { destructive: true },
      },
    ];

    const isSplit = Boolean(tx.split);
    const splitFriendsCount = tx.split
      ? tx.split.friends && tx.split.friends.length > 0
        ? tx.split.friends.length
        : ((tx.split.friendNames || '').split(',').map((n) => n.trim()).filter(Boolean).length || 1)
      : 0;
    const splitCollected = tx.split
      ? tx.split.friends && tx.split.friends.length > 0
        ? tx.split.friends.filter((f) => f.settled).reduce((s, f) => s + f.amount, 0)
        : tx.split.settled
        ? tx.split.friendsShare || 0
        : 0
      : 0;
    const splitTotalLent = tx.split ? tx.split.friendsShare || 0 : 0;
    const splitIsAllSettled = Boolean(
      tx.split?.settled || (splitTotalLent > 0 && splitCollected >= splitTotalLent)
    );

    const rowContent = (
      <TouchableOpacity
        style={[styles.transactionRow, !isLast && styles.rowDivider]}
        activeOpacity={0.7}
        onPress={() => {
          if (isSelectMode) {
            Haptics.selectionAsync().catch(() => {});
            toggleSelectTransaction(tx.id);
          } else if (isSplit) {
            Haptics.selectionAsync().catch(() => {});
            setSelectedSplitTx(tx);
          }
        }}
        onLongPress={() => {
          if (!isSelectMode) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setEditingTx(tx);
          }
        }}
      >
        {/* Circular Checkbox in Select Mode (Exact reference style) */}
        {isSelectMode && (
          <TouchableOpacity
            style={styles.checkboxTouchTarget}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              toggleSelectTransaction(tx.id);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {isSelected ? (
              <View style={styles.radioSelected}>
                <Check size={12} color="#0D0E12" strokeWidth={3.5} />
              </View>
            ) : (
              <View style={styles.radioUnselected} />
            )}
          </TouchableOpacity>
        )}

        {/* Left: Category / Transfer / Debt Icon Squircle */}
        <View
          style={[
            styles.categoryIconCircle,
            {
              backgroundColor: isTransfer
                ? 'rgba(96, 165, 250, 0.15)'
                : isSplit
                ? splitIsAllSettled
                  ? 'rgba(124, 217, 168, 0.12)'
                  : 'rgba(255, 157, 102, 0.15)'
                : isDebtLend
                ? isSettled
                  ? 'rgba(124, 217, 168, 0.12)'
                  : 'rgba(242, 139, 130, 0.12)'
                : isDebtBorrow
                ? isSettled
                  ? 'rgba(124, 217, 168, 0.12)'
                  : 'rgba(251, 191, 36, 0.12)'
                : '#202330',
            },
          ]}
        >
          {isTransfer ? (
            <ArrowRightLeft size={16} color="#9DC6EB" />
          ) : isSplit ? (
            <Users size={16} color={splitIsAllSettled ? '#70D6BC' : '#FF9D66'} />
          ) : isDebtLend ? (
            <HandCoins size={16} color={isSettled ? '#70D6BC' : '#F48B8B'} />
          ) : isDebtBorrow ? (
            <HandCoins size={16} color={isSettled ? '#70D6BC' : '#F4CD89'} />
          ) : (
            renderCategoryIcon(cat)
          )}
        </View>

        {/* Center: Title & Subtitle Badge */}
        <View style={styles.transactionCenter}>
          <AppText style={styles.transactionTitle} numberOfLines={1}>
            {(tx.note || (isTransfer ? 'ACCOUNT TRANSFER' : cat.name)).toUpperCase()}
          </AppText>

          {/* Badges / Flow details */}
          <View style={styles.badgeRow}>
            {isTransfer ? (
              <View style={styles.transferFlowPill}>
                <AppText style={styles.transferFlowText}>
                  {getAccountName(tx.accountId, tx.accountName).toUpperCase()} ➔ {getAccountName(tx.toAccountId, tx.toAccountName).toUpperCase()}
                </AppText>
              </View>
            ) : isDebtLend ? (
              <View
                style={[
                  styles.debtLentPill,
                  isSettled && styles.settledPill,
                ]}
              >
                <AppText
                  style={[
                    styles.debtLentText,
                    isSettled && styles.settledPillText,
                  ]}
                >
                  {isSettled ? 'RECOVERED FROM ' : 'LENT TO '}
                  {(tx.borrowerOrLender || 'Friend').toUpperCase()}
                </AppText>
              </View>
            ) : isDebtBorrow ? (
              <View
                style={[
                  styles.debtBorrowPill,
                  isSettled && styles.settledPill,
                ]}
              >
                <AppText
                  style={[
                    styles.debtBorrowText,
                    isSettled && styles.settledPillText,
                  ]}
                >
                  {isSettled ? 'REPAID TO ' : 'BORROWED FROM '}
                  {(tx.borrowerOrLender || 'Friend').toUpperCase()}
                </AppText>
              </View>
            ) : (
              <View style={styles.categoryPill}>
                <AppText style={[styles.categoryPillText, { color: cat.color || expenseColors.accentPeach }]}>
                  {cat.name.toUpperCase()}
                </AppText>
              </View>
            )}

            {/* Event / Trip Tag Badge */}
            {tx.tag && (
              <View style={styles.tripTagBadge}>
                <AppText style={styles.tripTagBadgeText}>{tx.tag.toUpperCase()}</AppText>
              </View>
            )}

            {/* Split Bill Badge */}
            {isSplit && (
              <View style={[styles.splitPill, splitIsAllSettled && styles.splitSettledPill]}>
                <AppText style={[styles.splitPillText, splitIsAllSettled && styles.splitSettledPillText]}>
                  {splitIsAllSettled ? 'SPLIT · SETTLED' : `SPLIT (${splitFriendsCount})`}
                </AppText>
              </View>
            )}

            {/* Statistical Anomaly / Outlier Badge */}
            {isOutlier && (
              <View style={styles.outlierBadge}>
                <AppText style={styles.outlierBadgeText}>⚠️ HIGH</AppText>
              </View>
            )}

            <AppText style={styles.transactionDateText}>{formattedDate.toUpperCase()}</AppText>
          </View>
        </View>

        {/* Right: Amount (Clean, right-aligned, dynamic colors) */}
        <View style={styles.amountCol}>
          <AppText
            style={[
              styles.transactionAmountText,
              isDebtLend && (isSettled ? styles.settledAmount : styles.debtLendPendingAmount),
              isDebtBorrow && (isSettled ? styles.settledAmount : styles.debtBorrowPendingAmount),
              !isDebt && isExpense && styles.expenseAmount,
              !isDebt && isIncome && styles.incomeAmount,
              isTransfer && styles.transferAmount,
            ]}
          >
            {amountDisplay}
          </AppText>
          {isSplit && (
            <View style={styles.splitSubAmtRow}>
              <AppText style={styles.splitSubAmountText}>
                {splitIsAllSettled ? 'All settled' : `My share: ${sym}${tx.split?.yourShare || 0}`}
              </AppText>
              <ChevronRight size={11} color="#7E8394" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );

    if (isSelectMode) {
      return <React.Fragment key={tx.id}>{rowContent}</React.Fragment>;
    }

    return (
      <NativeLiquidMenu
        key={tx.id}
        title={(tx.note || (isTransfer ? 'Account Transfer' : cat.name)).toUpperCase()}
        actions={txActions}
        shouldOpenOnLongPress={true}
        onSelect={(actionId) => {
          if (actionId === 'edit') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setEditingTx(tx);
          } else if (actionId === 'copy') {
            const copyText = `${(tx.note || cat.name).toUpperCase()}: ${amountDisplay} (${formattedDate.toUpperCase()})`;
            Clipboard.setStringAsync(copyText).catch(() => {});
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } else if (actionId === 'select') {
            handleToggleSelectMode();
            toggleSelectTransaction(tx.id);
          } else if (actionId === 'delete') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            removeTransactions([tx.id]);
          }
        }}
        style={{ width: '100%' }}
      >
        {rowContent}
      </NativeLiquidMenu>
    );
  };

  const renderFolderItem = (
    folderKey: string,
    folderName: string,
    folderEmoji: string,
    folderTxs: ExpenseTransaction[],
    folderTotal: number,
    isLast: boolean
  ) => {
    return (
      <TouchableOpacity
        key={folderKey}
        style={[styles.folderRowContainer, !isLast && styles.rowDivider]}
        activeOpacity={0.75}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          router.push({
            pathname: '/folder/[id]',
            params: {
              id: folderKey,
              name: folderName,
              emoji: folderEmoji,
            },
          });
        }}
      >
        {/* Folder Icon Circle */}
        <View style={styles.folderIconCircle}>
          <AppText style={{ fontSize: 16 }}>{folderEmoji || '📁'}</AppText>
        </View>

        {/* Center Info */}
        <View style={styles.folderInfoCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppText style={styles.folderTitleText} numberOfLines={1}>
              {folderName.toUpperCase()}
            </AppText>
            <View style={styles.tripFolderPill}>
              <AppText style={styles.tripFolderPillText}>TRIP FOLDER</AppText>
            </View>
          </View>
          <AppText style={styles.folderSubText}>
            {folderTxs.length} ITEM{folderTxs.length > 1 ? 'S' : ''} • TAP TO VIEW FOLDER
          </AppText>
        </View>

        {/* Right Amount & Push Chevron */}
        <View style={styles.folderRightCol}>
          <AppText style={styles.folderTotalText}>
            -{sym}{folderTotal.toLocaleString('en-IN')}
          </AppText>
          <ChevronRight size={15} color="#7E8394" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screenContainer}>
      {/* Top Safe Area Background */}
      <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary, zIndex: 10 }} />

      {/* ── FIXED TOP SECTION (Header, Smart Search, Bank Filters, Receivables Summary) ── */}
      <View style={styles.fixedTopSection}>
        {/* Top Header Row */}
        <Animated.View
          style={[
            styles.headerRow,
            {
              opacity: animHeader,
              transform: [
                {
                  translateY: animHeader.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleToggleSelectMode}
            activeOpacity={0.7}
            style={styles.headerTextBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <AppText style={styles.headerTextBtnLabel}>
              {isSelectMode ? 'Done' : 'Select'}
            </AppText>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <AppText style={styles.titleThe}>THE </AppText>
            <AppText style={styles.titleLedger}>LEDGER</AppText>
          </View>

          {/* Placeholder spacer on right to keep THE LEDGER centered */}
          <View style={styles.headerRightSpacer} />
        </Animated.View>

        {/* Smart Search Card */}
        <Animated.View
          style={[
            styles.smartSearchCard,
            {
              opacity: animSearch,
              transform: [
                {
                  translateY: animSearch.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.smartSearchHeadingRow}>
            <View style={styles.headingTitleLeft}>
              <Sparkles size={14} color={expenseColors.accentPeach} />
              <AppText style={styles.smartSearchHeading}>SMART SEARCH</AppText>
            </View>
          </View>

          {/* Search Input Box */}
          <View style={[styles.inputContainer, isSearchFocused && styles.inputContainerFocused]}>
            <Search size={15} color={isSearchFocused ? expenseColors.accentPeach : '#6C7082'} style={{ marginRight: 8 }} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={ROTATING_SEARCH_PLACEHOLDERS[placeholderIndex]}
              placeholderTextColor="#555866"
              value={smartSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChangeText={(text) => {
                if (text.length === 1 && smartSearchQuery.length === 0) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
                setSmartSearchQuery(text);
              }}
              autoCorrect={false}
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={() => {
                Keyboard.dismiss();
                setIsSearchFocused(false);
              }}
            />
            {smartSearchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setSmartSearchQuery('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.clearBtn}
              >
                <X size={15} color={expenseColors.textSubtle} />
              </TouchableOpacity>
            )}
            {isSearchFocused ? (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  Keyboard.dismiss();
                  searchInputRef.current?.blur();
                  setIsSearchFocused(false);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.doneDismissBtn}
              >
                <AppText style={styles.doneDismissText}>Done</AppText>
              </TouchableOpacity>
            ) : smartSearchQuery.length === 0 ? (
              <View style={styles.micBadge}>
                <Mic size={15} color="#555866" />
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* On-Device AI Insight Card */}
        {aiResult && (
          <View style={styles.aiInsightCard}>
            <View style={styles.aiInsightTopRow}>
              <View style={styles.aiInsightBadge}>
                <Sparkles size={13} color="#EBB29A" />
                <AppText style={styles.aiInsightBadgeText}>AI INSIGHT</AppText>
              </View>
              <AppText style={styles.aiEngineSubtext}>{deviceAiInfo.chip}</AppText>
            </View>

            <AppText style={styles.aiAnswerText}>{aiResult.naturalLanguageAnswer}</AppText>

            {aiResult.metrics.length > 0 && (
              <View style={styles.aiMetricsRow}>
                {aiResult.metrics.map((m) => (
                  <View key={m.label} style={styles.metricPill}>
                    <AppText style={styles.metricLabel}>{m.label}</AppText>
                    <AppText style={styles.metricValue}>{m.value}</AppText>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Account Filters Row (All, HDFC, Slice, Cash...) */}
        <Animated.View
          style={{
            opacity: animFilters,
            transform: [
              {
                translateY: animFilters.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.filterScrollContainer}
            style={styles.filterScrollView}
          >
            {accountFilterList.map((filterName) => {
              const isActive = activeAccountFilter.toLowerCase() === filterName.toLowerCase();
              return (
                <TouchableOpacity
                  key={filterName}
                  style={[
                    styles.filterPill,
                    isActive ? styles.filterPillActive : styles.filterPillInactive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Keyboard.dismiss();
                    setIsSearchFocused(false);
                    Haptics.selectionAsync().catch(() => {});
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setActiveAccountFilter(filterName);
                  }}
                >
                  <AppText
                    style={[
                      styles.filterPillText,
                      isActive ? styles.filterTextActive : styles.filterTextInactive,
                    ]}
                  >
                    {filterName}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Compact Debts & Receivables Summary Bar (Links to /receivables) */}
        {hasPendingDebts && !isSelectMode && (
          <TouchableOpacity
            style={styles.compactLentRow}
            activeOpacity={0.75}
            onPress={() => {
              Keyboard.dismiss();
              setIsSearchFocused(false);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/receivables');
            }}
          >
            <View style={styles.compactLentLeft}>
              <View style={styles.compactLentIconCircle}>
                <HandCoins size={17} color={expenseColors.accentPeach} />
              </View>
              <View style={styles.compactLentTextCol}>
                <AppText style={styles.compactLentTitle}>
                  {totalPendingLent > 0 && totalPendingBorrow > 0
                    ? 'DEBTS & RECEIVABLES'
                    : totalPendingLent > 0
                    ? 'MONEY TO COLLECT'
                    : 'MONEY TO PAY'}
                </AppText>
                <AppText style={styles.compactLentSubtitle}>
                  {totalPendingLent > 0 && totalPendingBorrow > 0
                    ? `${pendingLentList.length} to collect · ${pendingBorrowList.length} to pay`
                    : totalPendingLent > 0
                    ? `${pendingLentList.length} ${pendingLentList.length === 1 ? 'person' : 'people'} · pending`
                    : `${pendingBorrowList.length} ${pendingBorrowList.length === 1 ? 'person' : 'people'} · to pay`}
                </AppText>
              </View>
            </View>
            <View style={styles.compactLentRight}>
              <ChevronRight size={16} color="#7E8394" />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* ── INDEPENDENT SCROLLABLE TRANSACTIONS LIST ── */}
      <ScrollView
        style={styles.transactionsScroll}
        contentContainerStyle={[
          styles.transactionsScrollContent,
          {
            paddingTop: 8,
            paddingBottom: insets.bottom + (isSelectMode ? 100 : 70),
          },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => {
          Keyboard.dismiss();
          setIsSearchFocused(false);
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: animList,
            transform: [
              {
                translateY: animList.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          {Object.keys(dateGrouped).length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconCircle}>
                <Search size={22} color={expenseColors.textMuted} />
              </View>
              <AppText style={styles.emptyStateTitle}>
                {smartSearchQuery ? 'No matching transactions' : 'No transactions found'}
              </AppText>
              <AppText style={styles.emptyStateSubtitle}>
                {smartSearchQuery
                  ? `No transactions matched "${smartSearchQuery}".`
                  : 'Try adjusting your account selection or add a new transaction.'}
              </AppText>
              {smartSearchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchBtn}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSmartSearchQuery('');
                  }}
                  activeOpacity={0.8}
                >
                  <AppText style={styles.clearSearchBtnText}>Clear Search</AppText>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            Object.entries(dateGrouped).map(([dateHeading, items]) => (
              <View key={dateHeading} style={styles.dateGroupContainer}>
                {/* Centered Date Header */}
                <AppText style={styles.dateHeadingText}>{dateHeading}</AppText>

                {/* Group Card */}
                <View style={styles.groupCard}>
                  {items.map((item, idx) => {
                    const isLast = idx === items.length - 1;
                    if (item.type === 'folder' && item.folderKey && item.folderTxs) {
                      return renderFolderItem(
                        item.folderKey,
                        item.folderName || 'Event',
                        item.folderEmoji || '🌴',
                        item.folderTxs,
                        item.folderTotal || 0,
                        isLast
                      );
                    } else if (item.tx) {
                      return renderTransactionItem(item.tx, isLast);
                    }
                    return null;
                  })}
                </View>
              </View>
            ))
          )}
        </Animated.View>
      </ScrollView>

      {/* ── FIXED BOTTOM ACTION BAR IN SELECTION MODE (Exact reference layout & proportions) ── */}
      {isSelectMode && (
        <View style={[styles.bottomActionBarContainer, { bottom: Math.max(insets.bottom, 12) }]}>
          {/* Left: Selected Count */}
          <AppText style={styles.selectedCountText}>
            {selectedTransactionIds.length} Selected
          </AppText>

          {/* Right Action Buttons: Delete, Category, X */}
          <View style={styles.actionBarRightButtons}>
            {/* Delete Action Button */}
            <TouchableOpacity
              style={[
                styles.deleteActionButton,
                selectedTransactionIds.length === 0 && { opacity: 0.5 },
              ]}
              disabled={selectedTransactionIds.length === 0}
              onPress={() => {
                if (selectedTransactionIds.length > 0) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                  removeTransactions(selectedTransactionIds);
                  clearSelectedTransactions();
                  setIsSelectMode(false);
                }
              }}
              activeOpacity={0.8}
            >
              <Trash2 size={14} color="#FFFFFF" />
              <AppText style={styles.deleteActionButtonText}>Delete</AppText>
            </TouchableOpacity>

            {/* Category Action Menu Button */}
            <NativeLiquidMenu
              title="Assign Category"
              actions={categoryMenuActions}
              onSelect={(catId) => {
                if (selectedTransactionIds.length > 0) {
                  updateTransactionsCategory(selectedTransactionIds, catId);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  clearSelectedTransactions();
                  setIsSelectMode(false);
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                }
              }}
            >
              <View
                style={[
                  styles.categoryActionButton,
                  selectedTransactionIds.length === 0 && { opacity: 0.5 },
                ]}
              >
                <AppText style={styles.categoryActionButtonText}>Category</AppText>
              </View>
            </NativeLiquidMenu>

            {/* Close / X Icon Button */}
            <TouchableOpacity
              style={styles.closeActionButton}
              onPress={handleToggleSelectMode}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={18} color="#A0A5B5" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {editingTx && (
        <AddTransactionModal
          visible={!!editingTx}
          initialTransaction={editingTx}
          onClose={() => setEditingTx(null)}
        />
      )}

      {selectedSplitTx && (
        <SplitDetailsModal
          visible={selectedSplitTx !== null}
          transaction={selectedSplitTx}
          onClose={() => setSelectedSplitTx(null)}
          onEdit={(tx) => {
            setSelectedSplitTx(null);
            setEditingTx(tx);
          }}
        />
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: expenseColors.bgPrimary,
  },
  fixedTopSection: {
    backgroundColor: expenseColors.bgPrimary,
    zIndex: 5,
  },
  transactionsScroll: {
    flex: 1,
  },
  transactionsScrollContent: {
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTextBtn: {
    minWidth: 60,
    justifyContent: 'center',
  },
  headerTextBtnLabel: {
    color: '#FF9D66',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  titleThe: {
    color: expenseColors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  titleLedger: {
    color: expenseColors.textPrimary,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: 1.0,
  },
  headerRightSpacer: {
    minWidth: 60,
  },
  smartSearchCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  smartSearchHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headingTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smartSearchHeading: {
    color: expenseColors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  inputContainer: {
    backgroundColor: '#1E212B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  inputContainerFocused: {
    borderColor: 'rgba(235, 178, 154, 0.45)',
    backgroundColor: '#222532',
  },
  searchInput: {
    flex: 1,
    color: expenseColors.textPrimary,
    fontSize: 13,
    padding: 0,
  },
  clearBtn: {
    padding: 4,
    marginRight: 4,
  },
  doneDismissBtn: {
    backgroundColor: 'rgba(235, 178, 154, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 4,
  },
  doneDismissText: {
    color: expenseColors.accentPeach,
    fontSize: 12,
    fontWeight: '800',
  },
  micBadge: {
    padding: 4,
  },
  aiInsightCard: {
    backgroundColor: 'rgba(235, 178, 154, 0.08)',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(235, 178, 154, 0.35)',
  },
  aiInsightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aiInsightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(235, 178, 154, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  aiInsightBadgeText: {
    color: expenseColors.accentPeach,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  aiEngineSubtext: {
    color: expenseColors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  aiAnswerText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  aiMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    backgroundColor: '#1E202B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    color: expenseColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: expenseColors.accentGreen,
    fontSize: 12,
    fontWeight: '800',
  },
  filterScrollView: {
    height: 42,
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 16,
  },
  filterScrollContainer: {
    height: 42,
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  filterPill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
  },
  filterPillInactive: {
    backgroundColor: '#1E212B',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#0F1015',
    fontWeight: '800',
  },
  filterTextInactive: {
    color: '#7E8394',
  },

  // ── Date Group Header (Centered, matching exact reference) ──
  dateGroupContainer: {
    marginBottom: 20,
  },
  dateHeadingText: {
    color: '#7E8394',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 12,
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

  // ── Folder Row (Single item that pushes into dedicated page) ──
  folderRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  folderIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#202330',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  folderInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  folderTitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  folderCountBadge: {
    backgroundColor: 'rgba(235, 178, 154, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  folderCountBadgeText: {
    color: expenseColors.accentPeach,
    fontSize: 10,
    fontWeight: '800',
  },
  folderSubText: {
    color: '#7E8394',
    fontSize: 11,
    marginTop: 2,
  },
  folderRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  folderTotalText: {
    color: expenseColors.accentPeach,
    fontSize: 14,
    fontWeight: '800',
  },

  // ── Circular Checkbox (Shifted right in selection mode) ──
  checkboxTouchTarget: {
    paddingRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioUnselected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#4E5365',
    backgroundColor: 'transparent',
  },
  radioSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF9D66',
    alignItems: 'center',
    justifyContent: 'center',
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
  transferFlowPill: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  transferFlowText: {
    color: '#9DC6EB',
    fontSize: 11,
    fontWeight: '700',
  },
  debtLentPill: {
    backgroundColor: expenseColors.accentRedBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  debtLentText: {
    color: expenseColors.accentRed,
    fontSize: 11,
    fontWeight: '700',
  },
  debtBorrowPill: {
    backgroundColor: 'rgba(244, 205, 137, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  debtBorrowText: {
    color: '#F4CD89',
    fontSize: 11,
    fontWeight: '700',
  },
  settledPill: {
    backgroundColor: expenseColors.accentGreenBg,
  },
  settledPillText: {
    color: expenseColors.accentGreen,
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
  splitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  splitPillText: {
    color: '#FF9D66',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tripFolderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  tripFolderPillText: {
    color: '#A78BFA',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  splitSettledPill: {
    backgroundColor: 'rgba(112, 214, 188, 0.15)',
  },
  splitSettledPillText: {
    color: '#70D6BC',
  },
  splitPeoplePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  splitPeoplePillText: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '700',
  },
  splitStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  splitStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  splitCleanSubRow: {
    marginTop: 4,
  },
  splitCleanSubText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '500',
  },
  splitCleanBold: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  splitSubAmtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  splitSubAmountText: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '500',
  },
  categoryPill: {
    backgroundColor: '#232633',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryPillText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  transactionDateText: {
    color: '#7E8394',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  amountCol: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  transactionAmountText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  expenseAmount: {
    color: expenseColors.accentRed,
  },
  incomeAmount: {
    color: expenseColors.accentGreen,
  },
  transferAmount: {
    color: '#9DC6EB',
  },
  debtLendPendingAmount: {
    color: expenseColors.accentRed, // Pastel Coral / Red when pending
  },
  debtBorrowPendingAmount: {
    color: '#F4CD89', // Warm Yellow when pending
  },
  settledAmount: {
    color: expenseColors.accentGreen, // Pastel Green when settled
  },
  debtLendAmount: {
    color: expenseColors.accentRed,
  },
  debtBorrowAmount: {
    color: '#F4CD89',
  },
  outlierBadge: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  outlierBadgeText: {
    color: '#FF9D66',
    fontSize: 9,
    fontWeight: '800',
  },
  emptyStateContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E202B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyStateTitle: {
    color: expenseColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  clearSearchBtn: {
    backgroundColor: 'rgba(235, 178, 154, 0.16)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: expenseColors.accentPeach,
  },
  clearSearchBtnText: {
    color: expenseColors.accentPeach,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Compact Lent / Receivables Bar (Fixed above transaction feed) ──
  compactLentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181A23',
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  compactLentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  compactLentIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  compactLentTextCol: {
    justifyContent: 'center',
  },
  compactLentTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  compactLentSubtitle: {
    color: '#7E8394',
    fontSize: 11,
    marginTop: 2,
  },
  compactLentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },

  // ── FIXED BOTTOM ACTION BAR (Exact match to reference image) ──
  bottomActionBarContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#12141C',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
  },
  selectedCountText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  actionBarRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: expenseColors.accentRed,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  deleteActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryActionButton: {
    backgroundColor: '#FF9D66',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeActionButton: {
    padding: 6,
    marginLeft: 2,
  },
});
