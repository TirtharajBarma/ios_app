import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Platform,
  Linking,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
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
  Search,
  Plus,
  CheckCircle2,
  User,
  History,
  Receipt,
  Sparkles,
  Calendar,
  Share2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText, NativeLiquidMenu } from '@/components/ui';
import type { MenuAction } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useShallow } from 'zustand/react/shallow';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseTransaction, ExpenseCategory, SplitFriend } from '@/types/expense';
import { formatMoney } from '@/utils/currency';
import { CategoryIcon } from '@/components/expense/CategoryIcon';
import { SplitDetailsModal } from '@/components/expense/SplitDetailsModal';
import { AddTransactionModal } from '@/components/expense/AddTransactionModal';

type ViewTab = 'splits' | 'loans' | 'friends' | 'history';

function formatLocalDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface SplitBillNameInfo {
  title: string;
  subtitle?: string;
}

function getSplitBillDisplayNames(
  tx: ExpenseTransaction,
  category?: ExpenseCategory
): SplitBillNameInfo {
  const merchant = tx.merchant?.trim();
  const note = tx.note?.trim();
  const tag = tx.folderName?.trim() || tx.tag?.trim();
  const catName = category?.name?.trim();

  const isSyntheticMerchant = !merchant || merchant.toLowerCase().startsWith('split with');

  // 1. Real merchant specified by user (e.g. "Starbucks", "Uber", "Dominos")
  if (merchant && !isSyntheticMerchant) {
    return {
      title: merchant,
      subtitle: note || tag || (catName && catName !== merchant ? catName : undefined),
    };
  }

  // 2. Custom memo/note specified by user (e.g. "Team Dinner", "Friday Drinks")
  if (note) {
    return {
      title: note,
      subtitle: tag || catName || undefined,
    };
  }

  // 3. Event folder or tag specified (e.g. "Goa Trip")
  if (tag) {
    return {
      title: `${tag} Split`,
      subtitle: catName || undefined,
    };
  }

  // 4. Category name specified (e.g. "Food & Dining")
  if (catName) {
    return {
      title: `${catName} Bill`,
      subtitle: isSyntheticMerchant && merchant ? merchant : undefined,
    };
  }

  // 5. Fallback to merchant even if synthetic
  if (merchant) {
    return {
      title: merchant,
      subtitle: undefined,
    };
  }

  return {
    title: 'Split Bill',
    subtitle: undefined,
  };
}

interface GroupSplitItem {
  tx: ExpenseTransaction;
  title: string;
  subtitle?: string;
  totalBill: number;
  yourShare: number;
  friendsShare: number;
  category?: ExpenseCategory;
  date: string;
  friends: SplitFriend[];
  settledCount: number;
  totalCount: number;
  pendingAmount: number;
  collectedAmount: number;
  isAllSettled: boolean;
}

export default function ReceivablesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    accounts,
    categories,
    transactions,
    currencySymbol,
    settleTransaction,
    settleFriendShare,
  } = useExpenseStore(
    useShallow((s) => ({
      accounts: s.accounts,
      categories: s.categories,
      transactions: s.transactions,
      currencySymbol: s.currencySymbol,
      settleTransaction: s.settleTransaction,
      settleFriendShare: s.settleFriendShare,
    }))
  );

  const sym = currencySymbol || '₹';
  const [activeTab, setActiveTab] = useState<ViewTab>('splits');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSplitTx, setSelectedSplitTx] = useState<ExpenseTransaction | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addModalTab, setAddModalTab] = useState<'debt' | 'expense'>('expense');

  const [settlingItem, setSettlingItem] = useState<{
    tx: ExpenseTransaction;
    friendId?: string;
    borrower: string;
    amount: number;
    note?: string;
    type: 'lent' | 'split' | 'borrow';
  } | null>(null);

  const [settleAccountId, setSettleAccountId] = useState<string>(
    accounts[0]?.id || 'acc_primary'
  );

  // ─────────────────────────────────────────────────────────────
  // 1. GROUPED SPLIT BILLS
  // ─────────────────────────────────────────────────────────────
  const splitBillsList = useMemo<GroupSplitItem[]>(() => {
    const list: GroupSplitItem[] = [];

    transactions.forEach((tx) => {
      if (tx.split) {
        const cat = categories.find((c) => c.id === tx.categoryId);
        const { title, subtitle } = getSplitBillDisplayNames(tx, cat);
        let friends: SplitFriend[] = [];

        if (tx.split.friends && tx.split.friends.length > 0) {
          friends = tx.split.friends;
        } else {
          const names = (tx.split.friendNames || 'Friend')
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean);
          const perAmt = Math.round(
            (tx.split.friendsShare || 0) / Math.max(names.length, 1)
          );
          friends = names.map((name, i) => ({
            id: `f_${i}`,
            name,
            amount: perAmt,
            settled: tx.split?.settled || false,
          }));
        }

        const settledCount = friends.filter((f) => f.settled).length;
        const totalCount = friends.length;
        const pendingAmount = friends
          .filter((f) => !f.settled)
          .reduce((s, f) => s + f.amount, 0);
        const collectedAmount = friends
          .filter((f) => f.settled)
          .reduce((s, f) => s + f.amount, 0);
        const isAllSettled = Boolean(tx.split.settled || (totalCount > 0 && settledCount === totalCount));

        list.push({
          tx,
          title,
          subtitle,
          totalBill: tx.amount,
          yourShare: tx.split.yourShare || 0,
          friendsShare: tx.split.friendsShare || 0,
          category: cat,
          date: tx.date,
          friends,
          settledCount,
          totalCount,
          pendingAmount,
          collectedAmount,
          isAllSettled,
        });
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, categories]);

  const activeSplitBills = useMemo(() => {
    return splitBillsList.filter((b) => !b.isAllSettled && b.pendingAmount > 0);
  }, [splitBillsList]);

  // ─────────────────────────────────────────────────────────────
  // 2. DIRECT 1-ON-1 LOANS (Lent vs Borrowed)
  // ─────────────────────────────────────────────────────────────
  const pendingLentList = useMemo(() => {
    return transactions
      .filter((tx) => tx.type === 'debt_lend' && !tx.isSettled)
      .map((tx) => ({
        id: tx.id,
        person: (tx.borrowerOrLender || 'Friend').trim(),
        title: tx.note || `Lent to ${tx.borrowerOrLender || 'Friend'}`,
        amount: tx.amount,
        date: tx.date,
        kind: 'lent' as const,
        tx,
      }));
  }, [transactions]);

  const pendingBorrowList = useMemo(() => {
    return transactions
      .filter((tx) => tx.type === 'debt_borrow' && !tx.isSettled)
      .map((tx) => ({
        id: tx.id,
        person: (tx.borrowerOrLender || 'Friend').trim(),
        title: tx.note || `Borrowed from ${tx.borrowerOrLender || 'Friend'}`,
        amount: tx.amount,
        date: tx.date,
        kind: 'borrow' as const,
        tx,
      }));
  }, [transactions]);

  // ─────────────────────────────────────────────────────────────
  // 3. CONSOLIDATED FRIEND BALANCES
  // ─────────────────────────────────────────────────────────────
  const friendSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        totalOwedToYou: number;
        totalYouOwe: number;
        netBalance: number;
        splitItems: Array<{ title: string; amount: number; date: string; tx: ExpenseTransaction; friendId?: string }>;
        loanItems: Array<{ title: string; amount: number; date: string; kind: 'lent' | 'borrow'; tx: ExpenseTransaction }>;
      }
    >();

    const getOrCreate = (rawName: string) => {
      const clean = rawName.trim() || 'Friend';
      const key = clean.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: clean,
          totalOwedToYou: 0,
          totalYouOwe: 0,
          netBalance: 0,
          splitItems: [],
          loanItems: [],
        });
      }
      return map.get(key)!;
    };

    // Add active split shares
    activeSplitBills.forEach((bill) => {
      bill.friends.forEach((f) => {
        if (!f.settled) {
          const p = getOrCreate(f.name);
          p.totalOwedToYou += f.amount;
          p.splitItems.push({
            title: bill.title,
            amount: f.amount,
            date: bill.date,
            tx: bill.tx,
            friendId: f.id,
          });
        }
      });
    });

    // Add active direct lent
    pendingLentList.forEach((l) => {
      const p = getOrCreate(l.person);
      p.totalOwedToYou += l.amount;
      p.loanItems.push({
        title: l.title,
        amount: l.amount,
        date: l.date,
        kind: 'lent',
        tx: l.tx,
      });
    });

    // Add active direct borrowed
    pendingBorrowList.forEach((b) => {
      const p = getOrCreate(b.person);
      p.totalYouOwe += b.amount;
      p.loanItems.push({
        title: b.title,
        amount: b.amount,
        date: b.date,
        kind: 'borrow',
        tx: b.tx,
      });
    });

    return Array.from(map.values())
      .map((p) => {
        p.netBalance = p.totalOwedToYou - p.totalYouOwe;
        return p;
      })
      .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));
  }, [activeSplitBills, pendingLentList, pendingBorrowList]);

  // ─────────────────────────────────────────────────────────────
  // 4. SETTLED ARCHIVE
  // ─────────────────────────────────────────────────────────────
  const settledHistoryList = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      person: string;
      amount: number;
      date: string;
      type: 'split' | 'lent' | 'borrow';
      tx: ExpenseTransaction;
    }> = [];

    transactions.forEach((tx) => {
      if (tx.type === 'debt_lend' && tx.isSettled) {
        list.push({
          id: tx.id,
          title: tx.note || 'Lent to Friend (Settled)',
          person: (tx.borrowerOrLender || 'Friend').trim(),
          amount: tx.amount,
          date: tx.date,
          type: 'lent',
          tx,
        });
      } else if (tx.type === 'debt_borrow' && tx.isSettled) {
        list.push({
          id: tx.id,
          title: tx.note || 'Borrowed from Friend (Repaid)',
          person: (tx.borrowerOrLender || 'Friend').trim(),
          amount: tx.amount,
          date: tx.date,
          type: 'borrow',
          tx,
        });
      } else if (tx.split) {
        if (tx.split.friends && tx.split.friends.length > 0) {
          tx.split.friends
            .filter((f) => f.settled)
            .forEach((f) => {
              list.push({
                id: `${tx.id}_settled_${f.id}`,
                title: tx.note ? `${tx.note} (${f.name})` : `Split Share (${f.name})`,
                person: (f.name || 'Friend').trim(),
                amount: f.amount,
                date: tx.date,
                type: 'split',
                tx,
              });
            });
        } else if (tx.split.settled && (tx.split.friendsShare || 0) > 0) {
          list.push({
            id: `${tx.id}_settled_all`,
            title: tx.note || 'Split Bill (Settled)',
            person: (tx.split.friendNames || 'Friends').trim(),
            amount: tx.split.friendsShare || 0,
            date: tx.date,
            type: 'split',
            tx,
          });
        }
      }
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // ─────────────────────────────────────────────────────────────
  // 5. TOTALS
  // ─────────────────────────────────────────────────────────────
  const totalSplitPending = useMemo(
    () => activeSplitBills.reduce((s, b) => s + b.pendingAmount, 0),
    [activeSplitBills]
  );
  const totalLentPending = useMemo(
    () => pendingLentList.reduce((s, l) => s + l.amount, 0),
    [pendingLentList]
  );
  const totalToCollect = totalSplitPending + totalLentPending;
  const totalToPay = useMemo(
    () => pendingBorrowList.reduce((s, b) => s + b.amount, 0),
    [pendingBorrowList]
  );
  const netPosition = totalToCollect - totalToPay;

  // Search Filter
  const cleanQ = searchQuery.trim().toLowerCase();

  const filteredSplitBills = useMemo(() => {
    if (!cleanQ) return activeSplitBills;
    return activeSplitBills.filter(
      (b) =>
        b.title.toLowerCase().includes(cleanQ) ||
        (b.subtitle && b.subtitle.toLowerCase().includes(cleanQ)) ||
        (b.category?.name && b.category.name.toLowerCase().includes(cleanQ)) ||
        b.friends.some((f) => f.name.toLowerCase().includes(cleanQ))
    );
  }, [activeSplitBills, cleanQ]);

  const filteredLentList = useMemo(() => {
    if (!cleanQ) return pendingLentList;
    return pendingLentList.filter(
      (l) => l.person.toLowerCase().includes(cleanQ) || l.title.toLowerCase().includes(cleanQ)
    );
  }, [pendingLentList, cleanQ]);

  const filteredBorrowList = useMemo(() => {
    if (!cleanQ) return pendingBorrowList;
    return pendingBorrowList.filter(
      (b) => b.person.toLowerCase().includes(cleanQ) || b.title.toLowerCase().includes(cleanQ)
    );
  }, [pendingBorrowList, cleanQ]);

  const filteredFriendSummaries = useMemo(() => {
    if (!cleanQ) return friendSummaries;
    return friendSummaries.filter(
      (f) =>
        f.name.toLowerCase().includes(cleanQ) ||
        f.splitItems.some((i) => i.title.toLowerCase().includes(cleanQ)) ||
        f.loanItems.some((i) => i.title.toLowerCase().includes(cleanQ))
    );
  }, [friendSummaries, cleanQ]);

  const filteredHistoryList = useMemo(() => {
    if (!cleanQ) return settledHistoryList;
    return settledHistoryList.filter(
      (h) => h.person.toLowerCase().includes(cleanQ) || h.title.toLowerCase().includes(cleanQ)
    );
  }, [settledHistoryList, cleanQ]);

  // Account Menu for Settle Sheet
  const accountMenuActions: MenuAction[] = useMemo(() => {
    return accounts.map((acc) => ({
      id: acc.id,
      title: `${acc.name} (${sym}${acc.balance.toLocaleString('en-IN')})`,
      state: acc.id === settleAccountId ? ('on' as const) : ('off' as const),
      image: 'building.columns.fill' as any,
    }));
  }, [accounts, settleAccountId, sym]);

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === settleAccountId) || accounts[0];
  }, [accounts, settleAccountId]);

  const getAccountIcon = (name: string) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('wallet') || lower.includes('amazon') || lower.includes('paytm')) {
      return <Wallet size={15} color="#8E919D" />;
    }
    if (lower.includes('credit') || lower.includes('card') || lower.includes('slice')) {
      return <CreditCard size={15} color="#8E919D" />;
    }
    return <Building2 size={15} color="#8E919D" />;
  };

  const sendWhatsAppReminder = (name: string, amount: number, billTitle?: string) => {
    Haptics.selectionAsync().catch(() => {});
    const absAmt = Math.abs(amount);
    let message = '';

    if (billTitle) {
      message = `Hey ${name}! 👋 Friendly note from The Ledger:\n• Bill: ${billTitle}\n• Your share: ${sym}${formatMoney(absAmt, '', { showCurrency: false })}\nPlease settle whenever convenient! 🙏`;
    } else {
      message = `Hey ${name}! 👋 Friendly note on our balance:\n• Amount pending: ${sym}${formatMoney(absAmt, '', { showCurrency: false })}\nPlease settle whenever convenient! 🙏`;
    }

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

  const handleOpenSettle = (item: {
    tx: ExpenseTransaction;
    friendId?: string;
    borrower: string;
    amount: number;
    note?: string;
    type: 'lent' | 'split' | 'borrow';
  }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSettlingItem(item);
    const accountExists = accounts.some((a) => a.id === item.tx.accountId);
    setSettleAccountId(accountExists ? item.tx.accountId : (accounts[0]?.id || 'acc_primary'));
  };

  return (
    <View style={styles.screenContainer}>
      {/* Top Safe Area */}
      <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary }} />

      {/* ── HEADER ── */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <AppText style={styles.titleThe}>SPLITS & </AppText>
          <AppText style={styles.titleMain}>DUES</AppText>
        </View>

        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setAddModalTab('expense');
            setShowAddModal(true);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.8}
        >
          <Plus size={15} color="#FF9D66" />
          <AppText style={styles.headerAddBtnText}>New</AppText>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO POSITION CARD ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconCircle}>
              <HandCoins size={13} color={expenseColors.accentPeach} />
            </View>
            <AppText style={styles.heroCardLabel}>
              {totalToCollect > 0 && totalToPay > 0
                ? 'NET POSITION'
                : totalToPay > 0
                ? 'TOTAL TO REPAY'
                : 'TOTAL TO COLLECT'}
            </AppText>
          </View>

          <View style={styles.heroAmountRow}>
            <AppText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={
                netPosition > 0
                  ? styles.heroAmountGreen
                  : netPosition < 0
                  ? styles.heroAmountAmber
                  : styles.heroAmountNeutral
              }
            >
              {netPosition > 0 ? `+${sym}` : netPosition < 0 ? `-${sym}` : sym}
              {formatMoney(Math.abs(netPosition), '', { showCurrency: false })}
            </AppText>
          </View>

          <View style={styles.heroDivider} />

          {/* Dual Metrics */}
          <View style={styles.heroDualGrid}>
            <TouchableOpacity
              style={styles.heroDualCol}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab('splits');
              }}
            >
              <View style={styles.dualHeaderRow}>
                <ArrowDownLeft size={12} color="#A9DFBF" />
                <AppText style={styles.dualColLabel}>TO COLLECT</AppText>
              </View>
              <AppText style={styles.dualColAmountGreen}>
                +{sym}{formatMoney(totalToCollect, '', { showCurrency: false })}
              </AppText>
              <AppText style={styles.dualColSub}>
                {activeSplitBills.length} split bill{activeSplitBills.length !== 1 ? 's' : ''} • {pendingLentList.length} lent
              </AppText>
            </TouchableOpacity>

            <View style={styles.heroDualDivider} />

            <TouchableOpacity
              style={styles.heroDualCol}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab('loans');
              }}
            >
              <View style={styles.dualHeaderRow}>
                <ArrowUpRight size={12} color="#F4CD89" />
                <AppText style={styles.dualColLabel}>TO REPAY</AppText>
              </View>
              <AppText style={styles.dualColAmountAmber}>
                -{sym}{formatMoney(totalToPay, '', { showCurrency: false })}
              </AppText>
              <AppText style={styles.dualColSub}>
                {pendingBorrowList.length} borrowed
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── SEARCH BAR ── */}
        <View style={styles.searchContainer}>
          <Search size={14} color="#7E8394" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search split bills, friends, or notes..."
            placeholderTextColor="#6D7180"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={14} color="#7E8394" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── SEGMENTED TABS (Clear Functional Separation) ── */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'splits' && styles.tabItemActive]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('splits');
            }}
            activeOpacity={0.8}
          >
            <AppText
              style={[styles.tabItemText, activeTab === 'splits' && styles.tabItemTextActive]}
            >
              Split Bills ({activeSplitBills.length})
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'loans' && styles.tabItemActive]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('loans');
            }}
            activeOpacity={0.8}
          >
            <AppText
              style={[styles.tabItemText, activeTab === 'loans' && styles.tabItemTextActive]}
            >
              Direct Loans ({pendingLentList.length + pendingBorrowList.length})
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'friends' && styles.tabItemActive]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('friends');
            }}
            activeOpacity={0.8}
          >
            <AppText
              style={[styles.tabItemText, activeTab === 'friends' && styles.tabItemTextActive]}
            >
              By Friend ({friendSummaries.length})
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('history');
            }}
            activeOpacity={0.8}
          >
            <AppText
              style={[styles.tabItemText, activeTab === 'history' && styles.tabItemTextActive]}
            >
              History
            </AppText>
          </TouchableOpacity>
        </View>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: GROUP SPLIT BILLS (The Natural Group Model)
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'splits' && (
          <View style={styles.sectionWrap}>
            {filteredSplitBills.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Receipt size={20} color="#A9DFBF" />
                </View>
                <AppText style={styles.emptyTitle}>No Active Split Bills</AppText>
                <AppText style={styles.emptySub}>
                  When you split expenses with friends, they will appear here as unified group bill cards.
                </AppText>
              </View>
            ) : (
              <View style={styles.cardsStack}>
                {filteredSplitBills.map((bill) => {
                  const progressPct =
                    bill.totalCount > 0
                      ? Math.round((bill.settledCount / bill.totalCount) * 100)
                      : 0;
                  const formattedDate = formatLocalDate(bill.date);

                  return (
                    <View key={bill.tx.id} style={styles.splitGroupCard}>
                      {/* Top Header of Split Bill */}
                      <View style={styles.splitGroupHeader}>
                        <View style={styles.splitIconBox}>
                          {bill.category ? (
                            <CategoryIcon category={bill.category} size={15} />
                          ) : (
                            <Users size={15} color="#FF9D66" />
                          )}
                        </View>

                        <View style={styles.splitHeaderInfo}>
                          <AppText style={styles.splitBillTitle} numberOfLines={1}>
                            {bill.title}
                          </AppText>
                          <AppText style={styles.splitBillMeta} numberOfLines={1}>
                            {bill.subtitle ? `${bill.subtitle} • ` : ''}{formattedDate} • Total: {sym}{formatMoney(bill.totalBill, '', { showCurrency: false })} • You: {sym}{formatMoney(bill.yourShare, '', { showCurrency: false })}
                          </AppText>
                        </View>

                        <TouchableOpacity
                          style={styles.splitDetailsPill}
                          activeOpacity={0.7}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setSelectedSplitTx(bill.tx);
                          }}
                        >
                          <AppText style={styles.splitDetailsPillText}>Full Bill</AppText>
                        </TouchableOpacity>
                      </View>

                      {/* Collection Progress Bar */}
                      <View style={styles.progressContainer}>
                        <View style={styles.progressHeaderRow}>
                          <AppText style={styles.progressLabel}>COLLECTION PROGRESS</AppText>
                          <AppText style={styles.progressValue}>
                            {bill.settledCount} of {bill.totalCount} settled ({progressPct}%)
                          </AppText>
                        </View>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${Math.min(progressPct, 100)}%` },
                            ]}
                          />
                        </View>
                      </View>

                      {/* Participants Table Inside the Bill Card */}
                      <View style={styles.participantsBox}>
                        {bill.friends.map((friend) => {
                          const isSettled = friend.settled;

                          return (
                            <View
                              key={friend.id}
                              style={[
                                styles.participantRow,
                                isSettled && styles.participantRowSettled,
                              ]}
                            >
                              <View style={styles.participantLeft}>
                                <View
                                  style={[
                                    styles.participantAvatar,
                                    isSettled && styles.participantAvatarSettled,
                                  ]}
                                >
                                  {isSettled ? (
                                    <Check size={11} color="#A9DFBF" strokeWidth={3} />
                                  ) : (
                                    <AppText style={styles.participantInitials}>
                                      {friend.name.slice(0, 2).toUpperCase()}
                                    </AppText>
                                  )}
                                </View>
                                <AppText
                                  style={[
                                    styles.participantName,
                                    isSettled && styles.participantNameSettled,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {friend.name}
                                </AppText>
                              </View>

                              <View style={styles.participantRight}>
                                <AppText
                                  style={[
                                    styles.participantAmount,
                                    isSettled && styles.participantAmountSettled,
                                  ]}
                                >
                                  {isSettled ? '✓ ' : '+'}
                                  {sym}{formatMoney(friend.amount, '', { showCurrency: false })}
                                </AppText>

                                {!isSettled ? (
                                  <View style={styles.participantActionsRow}>
                                    <TouchableOpacity
                                      style={styles.participantWhatsAppBtn}
                                      activeOpacity={0.7}
                                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                      onPress={() =>
                                        sendWhatsAppReminder(friend.name, friend.amount, bill.title)
                                      }
                                    >
                                      <MessageSquare size={13} color="#A9DFBF" />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                      style={styles.participantSettleBtn}
                                      activeOpacity={0.8}
                                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                      onPress={() =>
                                        handleOpenSettle({
                                          tx: bill.tx,
                                          friendId: friend.id,
                                          borrower: friend.name,
                                          amount: friend.amount,
                                          note: `${bill.title} (Split Share)`,
                                          type: 'split',
                                        })
                                      }
                                    >
                                      <Check size={12} color="#0F1015" strokeWidth={3} />
                                      <AppText style={styles.participantSettleBtnText}>
                                        Settle
                                      </AppText>
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <View style={styles.settledBadgePill}>
                                    <AppText style={styles.settledBadgePillText}>Paid</AppText>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>

                      {/* Footer Summary of Bill Card */}
                      <View style={styles.splitGroupFooter}>
                        <View style={styles.splitFooterLeft}>
                          <AppText style={styles.splitFooterLabel}>STILL PENDING</AppText>
                          <AppText style={styles.splitFooterAmount}>
                            +{sym}{formatMoney(bill.pendingAmount, '', { showCurrency: false })}
                          </AppText>
                        </View>

                        {bill.totalCount > 1 && bill.pendingAmount > 0 && (
                          <TouchableOpacity
                            style={styles.settleAllBillBtn}
                            activeOpacity={0.8}
                            onPress={() => {
                              handleOpenSettle({
                                tx: bill.tx,
                                borrower: `${bill.friends.filter((f) => !f.settled).map((f) => f.name).join(', ')}`,
                                amount: bill.pendingAmount,
                                note: bill.title,
                                type: 'split',
                              });
                            }}
                          >
                            <CheckCircle2 size={12} color="#0F1015" strokeWidth={2.5} />
                            <AppText style={styles.settleAllBillBtnText}>Settle Remaining</AppText>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: DIRECT LOANS (1-on-1 Borrow & Lend)
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'loans' && (
          <View style={styles.sectionWrap}>
            {/* Section: Money Lent */}
            <View style={styles.subSectionHeaderRow}>
              <View style={styles.subSectionTitleRow}>
                <ArrowDownLeft size={13} color="#A9DFBF" />
                <AppText style={styles.subSectionHeading}>
                  MONEY YOU LENT ({filteredLentList.length})
                </AppText>
              </View>
              <AppText style={styles.subSectionSub}>Direct loans to collect</AppText>
            </View>

            {filteredLentList.length === 0 ? (
              <View style={styles.emptySubCard}>
                <AppText style={styles.emptySubCardText}>No direct loans lent out</AppText>
              </View>
            ) : (
              <View style={styles.listCard}>
                {filteredLentList.map((item, idx) => {
                  const isLast = idx === filteredLentList.length - 1;
                  const formattedDate = formatLocalDate(item.date);

                  return (
                    <View
                      key={item.id}
                      style={[styles.dueRow, !isLast && styles.dueRowDivider]}
                    >
                      <View
                        style={[
                          styles.dueIconSquare,
                          { backgroundColor: 'rgba(169, 223, 191, 0.1)' },
                        ]}
                      >
                        <ArrowDownLeft size={15} color="#A9DFBF" />
                      </View>

                      <View style={styles.dueInfoCol}>
                        <AppText style={styles.duePersonName} numberOfLines={1}>
                          {item.person}
                        </AppText>
                        <AppText style={styles.dueSubtitle} numberOfLines={1}>
                          {item.title} • {formattedDate}
                        </AppText>
                      </View>

                      <View style={styles.dueRightCol}>
                        <AppText style={styles.dueAmountGreen}>
                          +{sym}{formatMoney(item.amount, '', { showCurrency: false })}
                        </AppText>
                        <View style={styles.dueButtonsRow}>
                          <TouchableOpacity
                            style={styles.dueWhatsAppIconBtn}
                            activeOpacity={0.7}
                            onPress={() =>
                              sendWhatsAppReminder(item.person, item.amount, item.title)
                            }
                          >
                            <MessageSquare size={11} color="#A9DFBF" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.dueSettleBtn}
                            activeOpacity={0.8}
                            onPress={() => {
                              handleOpenSettle({
                                tx: item.tx,
                                borrower: item.person,
                                amount: item.amount,
                                note: item.title,
                                type: 'lent',
                              });
                            }}
                          >
                            <Check size={10} color="#0F1015" strokeWidth={3} />
                            <AppText style={styles.dueSettleBtnText}>Settle</AppText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Section: Money Borrowed */}
            <View style={[styles.subSectionHeaderRow, { marginTop: 18 }]}>
              <View style={styles.subSectionTitleRow}>
                <ArrowUpRight size={13} color="#F4CD89" />
                <AppText style={styles.subSectionHeading}>
                  MONEY YOU BORROWED ({filteredBorrowList.length})
                </AppText>
              </View>
              <AppText style={styles.subSectionSub}>Debts you need to repay</AppText>
            </View>

            {filteredBorrowList.length === 0 ? (
              <View style={styles.emptySubCard}>
                <AppText style={styles.emptySubCardText}>No active debts to repay</AppText>
              </View>
            ) : (
              <View style={styles.listCard}>
                {filteredBorrowList.map((item, idx) => {
                  const isLast = idx === filteredBorrowList.length - 1;
                  const formattedDate = formatLocalDate(item.date);

                  return (
                    <View
                      key={item.id}
                      style={[styles.dueRow, !isLast && styles.dueRowDivider]}
                    >
                      <View
                        style={[
                          styles.dueIconSquare,
                          { backgroundColor: 'rgba(244, 205, 137, 0.1)' },
                        ]}
                      >
                        <ArrowUpRight size={15} color="#F4CD89" />
                      </View>

                      <View style={styles.dueInfoCol}>
                        <AppText style={styles.duePersonName} numberOfLines={1}>
                          {item.person}
                        </AppText>
                        <AppText style={styles.dueSubtitle} numberOfLines={1}>
                          {item.title} • {formattedDate}
                        </AppText>
                      </View>

                      <View style={styles.dueRightCol}>
                        <AppText style={styles.dueAmountAmber}>
                          -{sym}{formatMoney(item.amount, '', { showCurrency: false })}
                        </AppText>
                        <TouchableOpacity
                          style={styles.duePayBtn}
                          activeOpacity={0.8}
                          onPress={() =>
                            handleOpenSettle({
                              tx: item.tx,
                              borrower: item.person,
                              amount: item.amount,
                              note: item.title,
                              type: 'borrow',
                            })
                          }
                        >
                          <Check size={10} color="#0F1015" strokeWidth={3} />
                          <AppText style={styles.duePayBtnText}>Repay</AppText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: BY FRIEND (Consolidated Person Summary)
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'friends' && (
          <View style={styles.sectionWrap}>
            {filteredFriendSummaries.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Users size={20} color="#A9DFBF" />
                </View>
                <AppText style={styles.emptyTitle}>No Friend Dues</AppText>
                <AppText style={styles.emptySub}>
                  You are all squared up with all friends.
                </AppText>
              </View>
            ) : (
              <View style={styles.cardsStack}>
                {filteredFriendSummaries.map((friend) => {
                  const isOwed = friend.netBalance > 0;
                  const isOwing = friend.netBalance < 0;
                  const absNet = Math.abs(friend.netBalance);
                  const totalItems = friend.splitItems.length + friend.loanItems.length;

                  return (
                    <View key={friend.name} style={styles.friendSummaryCard}>
                      <View style={styles.friendSummaryHeader}>
                        <View style={styles.avatarBox}>
                          <AppText style={styles.avatarText}>
                            {friend.name.slice(0, 2).toUpperCase()}
                          </AppText>
                        </View>

                        <View style={styles.friendCenterCol}>
                          <AppText style={styles.friendName} numberOfLines={1}>
                            {friend.name}
                          </AppText>
                          <AppText style={styles.friendSubtext} numberOfLines={1}>
                            {totalItems} active due{totalItems !== 1 ? 's' : ''} ({friend.splitItems.length} split, {friend.loanItems.length} loan)
                          </AppText>
                        </View>

                        <View style={styles.friendRightCol}>
                          <AppText
                            style={
                              isOwed
                                ? styles.friendAmountGreen
                                : isOwing
                                ? styles.friendAmountAmber
                                : styles.friendAmountNeutral
                            }
                          >
                            {isOwed ? `+${sym}` : isOwing ? `-${sym}` : sym}
                            {formatMoney(absNet, '', { showCurrency: false })}
                          </AppText>
                          <View
                            style={[
                              styles.friendBadge,
                              {
                                backgroundColor: isOwed
                                  ? 'rgba(169, 223, 191, 0.1)'
                                  : isOwing
                                  ? 'rgba(244, 205, 137, 0.1)'
                                  : 'rgba(255, 255, 255, 0.05)',
                              },
                            ]}
                          >
                            <AppText
                              style={[
                                styles.friendBadgeText,
                                { color: isOwed ? '#A9DFBF' : isOwing ? '#F4CD89' : '#8E919D' },
                              ]}
                            >
                              {isOwed ? 'OWES YOU' : isOwing ? 'YOU OWE' : 'EVEN'}
                            </AppText>
                          </View>
                        </View>
                      </View>

                      {/* Items mini-stack */}
                      <View style={styles.friendMiniItems}>
                        {friend.splitItems.map((item, i) => (
                          <View key={`s_${i}`} style={styles.friendMiniRow}>
                            <View style={styles.friendMiniLeft}>
                              <Receipt size={11} color="#FF9D66" />
                              <AppText style={styles.friendMiniTitle} numberOfLines={1}>
                                {item.title} (Split)
                              </AppText>
                            </View>
                            <AppText style={styles.friendMiniAmountGreen}>
                              +{sym}{formatMoney(item.amount, '', { showCurrency: false })}
                            </AppText>
                          </View>
                        ))}

                        {friend.loanItems.map((item, i) => (
                          <View key={`l_${i}`} style={styles.friendMiniRow}>
                            <View style={styles.friendMiniLeft}>
                              {item.kind === 'borrow' ? (
                                <ArrowUpRight size={11} color="#F4CD89" />
                              ) : (
                                <ArrowDownLeft size={11} color="#A9DFBF" />
                              )}
                              <AppText style={styles.friendMiniTitle} numberOfLines={1}>
                                {item.title} ({item.kind === 'borrow' ? 'Borrowed' : 'Lent'})
                              </AppText>
                            </View>
                            <AppText
                              style={
                                item.kind === 'borrow'
                                  ? styles.friendMiniAmountAmber
                                  : styles.friendMiniAmountGreen
                              }
                            >
                              {item.kind === 'borrow' ? `-${sym}` : `+${sym}`}
                              {formatMoney(item.amount, '', { showCurrency: false })}
                            </AppText>
                          </View>
                        ))}
                      </View>

                      {/* WhatsApp Reminder Bar */}
                      <TouchableOpacity
                        style={styles.friendWhatsAppBar}
                        activeOpacity={0.75}
                        onPress={() => {
                          const itemsSummary = [
                            ...friend.splitItems.map((s) => s.title),
                            ...friend.loanItems.map((l) => l.title),
                          ].join(', ');
                          sendWhatsAppReminder(friend.name, friend.netBalance, itemsSummary);
                        }}
                      >
                        <MessageSquare size={12} color="#A9DFBF" />
                        <AppText style={styles.friendWhatsAppText}>
                          Send Statement on WhatsApp
                        </AppText>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 4: HISTORY (Settled Items)
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <View style={styles.sectionWrap}>
            {filteredHistoryList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <History size={20} color="#7E8394" />
                </View>
                <AppText style={styles.emptyTitle}>No History Yet</AppText>
                <AppText style={styles.emptySub}>
                  Completed settlements and split repayments will appear here.
                </AppText>
              </View>
            ) : (
              <View style={styles.listCard}>
                {filteredHistoryList.map((item, idx) => {
                  const isLast = idx === filteredHistoryList.length - 1;
                  const formattedDate = formatLocalDate(item.date);

                  return (
                    <View
                      key={item.id}
                      style={[styles.dueRow, !isLast && styles.dueRowDivider]}
                    >
                      <View
                        style={[
                          styles.dueIconSquare,
                          { backgroundColor: 'rgba(169, 223, 191, 0.1)' },
                        ]}
                      >
                        <CheckCircle2 size={15} color="#A9DFBF" />
                      </View>

                      <View style={styles.dueInfoCol}>
                        <AppText style={styles.duePersonName} numberOfLines={1}>
                          {item.person}
                        </AppText>
                        <AppText style={styles.dueSubtitle} numberOfLines={1}>
                          {item.title} • {formattedDate}
                        </AppText>
                      </View>

                      <View style={styles.dueRightCol}>
                        <AppText style={styles.historyAmountText}>
                          ✓ {sym}{formatMoney(item.amount, '', { showCurrency: false })}
                        </AppText>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── SETTLEMENT BOTTOM SHEET MODAL ── */}
      <Modal
        visible={settlingItem !== null}
        transparent
        statusBarTranslucent={true}
        animationType="slide"
        onRequestClose={() => setSettlingItem(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSettlingItem(null)}
          />
          <View style={[styles.settleSheetCard, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
            <View style={styles.sheetGrabber} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderTitleRow}>
                <View
                  style={[
                    styles.sheetHeaderIconCircle,
                    {
                      backgroundColor:
                        settlingItem?.type === 'borrow'
                          ? 'rgba(244, 205, 137, 0.15)'
                          : 'rgba(169, 223, 191, 0.15)',
                    },
                  ]}
                >
                  <Check
                    size={13}
                    color={
                      settlingItem?.type === 'borrow' ? '#F4CD89' : expenseColors.accentGreen
                    }
                    strokeWidth={3}
                  />
                </View>
                <AppText style={styles.sheetTitle}>
                  {settlingItem?.type === 'borrow'
                    ? 'REPAY DEBT'
                    : settlingItem?.type === 'split'
                    ? 'COLLECT SPLIT SHARE'
                    : 'COLLECT LENT LOAN'}
                </AppText>
              </View>
              <TouchableOpacity
                onPress={() => setSettlingItem(null)}
                style={styles.sheetCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={15} color="#8E919D" />
              </TouchableOpacity>
            </View>

            {settlingItem && (
              <>
                <View style={styles.sheetWhoBox}>
                  <View style={styles.sheetWhoAvatar}>
                    <User size={15} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.sheetWhoLabel}>
                      {settlingItem.type === 'borrow' ? 'Repaying to' : 'Receiving from'}
                    </AppText>
                    <AppText style={styles.sheetWhoName}>{settlingItem.borrower}</AppText>
                    {settlingItem.note && (
                      <AppText style={styles.sheetWhoNote} numberOfLines={1}>
                        For: {settlingItem.note}
                      </AppText>
                    )}
                  </View>
                </View>

                <View style={styles.amountHeroContainer}>
                  <AppText style={styles.amountHeroLabel}>AMOUNT</AppText>
                  <AppText style={styles.amountHeroText}>
                    {sym}{formatMoney(settlingItem.amount, '', { showCurrency: false })}
                  </AppText>
                </View>

                <View style={styles.accountSection}>
                  <AppText style={styles.accountSectionLabel}>
                    {settlingItem.type === 'borrow'
                      ? 'DEDUCT FROM ACCOUNT'
                      : 'DEPOSIT INTO ACCOUNT'}
                  </AppText>
                  <NativeLiquidMenu
                    title={
                      settlingItem.type === 'borrow'
                        ? 'Select Payment Account'
                        : 'Select Deposit Account'
                    }
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

                <TouchableOpacity
                  style={styles.confirmDepositBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (settlingItem) {
                      if (settlingItem.friendId) {
                        settleFriendShare(
                          settlingItem.tx.id,
                          settlingItem.friendId,
                          settleAccountId
                        );
                      } else {
                        settleTransaction(settlingItem.tx.id, settleAccountId);
                      }
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                        () => {}
                      );
                      setSettlingItem(null);
                    }
                  }}
                >
                  <Check size={15} color="#0F1015" strokeWidth={3} />
                  <AppText style={styles.confirmDepositBtnText}>
                    {settlingItem.type === 'borrow' ? 'Confirm Repayment' : 'Confirm & Deposit'}
                  </AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sheetWhatsAppBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (settlingItem) {
                      const net =
                        settlingItem.type === 'borrow' ? -settlingItem.amount : settlingItem.amount;
                      sendWhatsAppReminder(settlingItem.borrower, net, settlingItem.note);
                    }
                  }}
                >
                  <MessageSquare size={13} color="#A9DFBF" />
                  <AppText style={styles.sheetWhatsAppBtnText}>Send Note on WhatsApp</AppText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── SPLIT DETAILS MODAL ── */}
      {selectedSplitTx && (
        <SplitDetailsModal
          visible={selectedSplitTx !== null}
          transaction={selectedSplitTx}
          onClose={() => setSelectedSplitTx(null)}
        />
      )}

      {/* ── ADD MODAL ── */}
      {showAddModal && (
        <AddTransactionModal
          visible={showAddModal}
          initialTab={addModalTab}
          onClose={() => setShowAddModal(false)}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#1C1E26',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleThe: {
    fontSize: 15,
    fontWeight: '800',
    color: '#7E8394',
    letterSpacing: 0.8,
  },
  titleMain: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
  },
  headerAddBtnText: {
    color: '#FF9D66',
    fontSize: 12,
    fontWeight: '800',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
  },

  // ── Hero Summary Card ──
  heroCard: {
    backgroundColor: '#161822',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  heroIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardLabel: {
    color: '#8E919D',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  heroAmountGreen: {
    color: '#A9DFBF',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
  },
  heroAmountAmber: {
    color: '#F4CD89',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
  },
  heroAmountNeutral: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },
  heroDualGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroDualCol: {
    flex: 1,
  },
  heroDualDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginHorizontal: 12,
  },
  dualHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  dualColLabel: {
    color: '#7E8394',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  dualColAmountGreen: {
    color: '#A9DFBF',
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 2,
  },
  dualColAmountAmber: {
    color: '#F4CD89',
    fontSize: 16,
    fontWeight: '800',
    marginVertical: 2,
  },
  dualColSub: {
    color: '#656A7B',
    fontSize: 10.5,
    fontWeight: '600',
  },

  // ── Search Bar ──
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161822',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    padding: 0,
  },

  // ── Segmented Tabs ──
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#161822',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 3,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 9,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  tabItemText: {
    color: '#7E8394',
    fontSize: 10.5,
    fontWeight: '700',
  },
  tabItemTextActive: {
    color: '#0F1015',
    fontWeight: '800',
  },

  sectionWrap: {
    paddingHorizontal: 16,
  },
  cardsStack: {
    gap: 12,
  },

  // ── 🧾 GROUP SPLIT BILL CARD (Apple Visualizer) ──
  splitGroupCard: {
    backgroundColor: '#161822',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
  },
  splitGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  splitIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#202330',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  splitHeaderInfo: {
    flex: 1,
    marginRight: 6,
  },
  splitBillTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  splitBillMeta: {
    color: '#7E8394',
    fontSize: 10.5,
    marginTop: 2,
    fontWeight: '500',
  },
  splitDetailsPill: {
    backgroundColor: 'rgba(255, 157, 102, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.2)',
  },
  splitDetailsPillText: {
    color: '#FF9D66',
    fontSize: 10.5,
    fontWeight: '700',
  },

  // Progress Bar
  progressContainer: {
    marginBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    padding: 8,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  progressLabel: {
    color: '#6D7180',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressValue: {
    color: '#D1D4DE',
    fontSize: 10,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#A9DFBF',
    borderRadius: 2,
  },

  // Participants Box
  participantsBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  participantRowSettled: {
    opacity: 0.6,
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  participantAvatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#252838',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatarSettled: {
    backgroundColor: 'rgba(169, 223, 191, 0.12)',
  },
  participantInitials: {
    color: '#D1D4DE',
    fontSize: 10,
    fontWeight: '800',
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  participantNameSettled: {
    color: '#8E919D',
    textDecorationLine: 'line-through',
  },
  participantRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  participantAmount: {
    color: '#A9DFBF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  participantAmountSettled: {
    color: '#656A7B',
  },
  participantActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  participantWhatsAppBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1E212D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantSettleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 32,
  },
  participantSettleBtnText: {
    color: '#0F1015',
    fontSize: 10.5,
    fontWeight: '800',
  },
  settledBadgePill: {
    backgroundColor: 'rgba(169, 223, 191, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  settledBadgePillText: {
    color: '#A9DFBF',
    fontSize: 9,
    fontWeight: '800',
  },

  // Split Card Footer
  splitGroupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
  },
  splitFooterLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  splitFooterLabel: {
    color: '#7E8394',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  splitFooterAmount: {
    color: '#A9DFBF',
    fontSize: 14,
    fontWeight: '900',
  },
  settleAllBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 7,
  },
  settleAllBillBtnText: {
    color: '#0F1015',
    fontSize: 10.5,
    fontWeight: '800',
  },

  // ── 🤝 DIRECT LOANS VIEW ──
  subSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  subSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  subSectionHeading: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  subSectionSub: {
    color: '#5B6070',
    fontSize: 10,
    fontWeight: '600',
  },
  emptySubCard: {
    backgroundColor: '#161822',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 6,
  },
  emptySubCardText: {
    color: '#656A7B',
    fontSize: 11.5,
    fontWeight: '600',
  },

  // ── 👥 BY FRIEND VIEW ──
  friendSummaryCard: {
    backgroundColor: '#161822',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 14,
  },
  friendSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#202330',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D1D4DE',
  },
  friendCenterCol: {
    flex: 1,
    marginRight: 8,
  },
  friendName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  friendSubtext: {
    color: '#7E8394',
    fontSize: 10.5,
    marginTop: 2,
    fontWeight: '500',
  },
  friendRightCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  friendAmountGreen: {
    color: '#A9DFBF',
    fontSize: 15,
    fontWeight: '900',
  },
  friendAmountAmber: {
    color: '#F4CD89',
    fontSize: 15,
    fontWeight: '900',
  },
  friendAmountNeutral: {
    color: '#8E919D',
    fontSize: 15,
    fontWeight: '800',
  },
  friendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  friendBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  friendMiniItems: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  friendMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  friendMiniLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  friendMiniTitle: {
    color: '#D1D4DE',
    fontSize: 11.5,
    fontWeight: '600',
  },
  friendMiniAmountGreen: {
    color: '#A9DFBF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  friendMiniAmountAmber: {
    color: '#F4CD89',
    fontSize: 11.5,
    fontWeight: '800',
  },
  friendWhatsAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  friendWhatsAppText: {
    color: '#A9DFBF',
    fontSize: 11.5,
    fontWeight: '700',
  },

  // ── Common Rows for Direct Loans & History ──
  listCard: {
    backgroundColor: '#161822',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dueRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  dueIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  dueInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  duePersonName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  dueSubtitle: {
    color: '#7E8394',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  dueRightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  dueAmountGreen: {
    color: '#A9DFBF',
    fontSize: 14,
    fontWeight: '900',
  },
  dueAmountAmber: {
    color: '#F4CD89',
    fontSize: 14,
    fontWeight: '900',
  },
  dueButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dueWhatsAppIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#1E212D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueSettleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dueSettleBtnText: {
    color: '#0F1015',
    fontSize: 10,
    fontWeight: '800',
  },
  duePayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  duePayBtnText: {
    color: '#0F1015',
    fontSize: 10,
    fontWeight: '800',
  },

  // ── History View ──
  historyAmountText: {
    color: '#A9DFBF',
    fontSize: 13,
    fontWeight: '800',
  },

  // ── Empty State ──
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    backgroundColor: '#161822',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(169, 223, 191, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    color: '#7E8394',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },

  // ── Settlement Bottom Sheet Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  settleSheetCard: {
    width: '100%',
    backgroundColor: '#161822',
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
    marginBottom: 14,
  },
  sheetHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetHeaderIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 8,
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
    backgroundColor: '#1E212B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetWhoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E212B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sheetWhoAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#252838',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetWhoLabel: {
    color: '#7E8394',
    fontSize: 10.5,
    fontWeight: '600',
  },
  sheetWhoName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  sheetWhoNote: {
    color: '#8E919D',
    fontSize: 11,
    marginTop: 1,
  },
  amountHeroContainer: {
    backgroundColor: '#1E212B',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  amountHeroLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  amountHeroText: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  accountSection: {
    marginBottom: 14,
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
    backgroundColor: '#1E212B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 48,
    marginTop: 4,
  },
  confirmDepositBtnText: {
    color: '#0F1015',
    fontSize: 14,
    fontWeight: '800',
  },
  sheetWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(169, 223, 191, 0.08)',
    borderRadius: 14,
    height: 44,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(169, 223, 191, 0.2)',
  },
  sheetWhatsAppBtnText: {
    color: '#A9DFBF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
