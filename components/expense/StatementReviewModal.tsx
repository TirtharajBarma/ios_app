import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  TextInput,
  Animated,
  useWindowDimensions,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  CheckSquare,
  Square,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Tag,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Wallet,
  CreditCard,
  Banknote,
  Target,
  Plus,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { CategoryIcon } from './CategoryIcon';
import { AccountIcon } from './AccountIcon';
import { NormalizedStatementResult, StagedStatementTxn } from '@/utils/statementNormalizer';
import { ExpenseAccount } from '@/types/expense';

export interface OpeningBalancesData {
  balances: Record<string, number>;
  types: Record<string, 'savings' | 'credit' | 'wallet'>;
  newAccounts?: Array<{ name: string; type: 'savings' | 'credit' | 'wallet'; balance: number }>;
}

interface StatementReviewModalProps {
  visible: boolean;
  onClose: () => void;
  result: NormalizedStatementResult | null;
  onConfirmImport: (
    selectedTxs: StagedStatementTxn[],
    targetAccountId?: string,
    openingBalances?: OpeningBalancesData,
    budget?: number
  ) => void;
}

const BUDGET_PRESETS = [15000, 25000, 35000, 50000, 75000, 100000];

export const StatementReviewModal: React.FC<StatementReviewModalProps> = ({
  visible,
  onClose,
  result,
  onConfirmImport,
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const {
    categories,
    accounts,
    currencySymbol,
    saveLearnedMerchantRule,
    monthlyBudget,
  } = useExpenseStore();
  const sym = currencySymbol || '₹';

  // ── Step Navigation State (0: Transactions -> 1: Opening Balances -> 2: Budget) ──
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2>(0);
  const slideAnimX = useRef(new Animated.Value(0)).current;

  // ── Step 0: Staged Transactions State ──
  const [stagedList, setStagedList] = useState<StagedStatementTxn[]>([]);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [defaultTargetAccount, setDefaultTargetAccount] = useState<string>(accounts[0]?.id || '');
  const [activeCategoryPickerTxnId, setActiveCategoryPickerTxnId] = useState<string | null>(null);

  // ── Step 1: Opening Balances State ──
  const [balanceInputs, setBalanceInputs] = useState<Record<string, string>>({});
  const [accountTypes, setAccountTypes] = useState<Record<string, 'savings' | 'credit' | 'wallet'>>({});
  const [isAddingNewAcc, setIsAddingNewAcc] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'savings' | 'credit' | 'wallet'>('savings');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [addedCustomAccounts, setAddedCustomAccounts] = useState<
    Array<{ name: string; type: 'savings' | 'credit' | 'wallet'; balance: number }>
  >([]);

  // ── Step 2: Budget State ──
  const [budgetInput, setBudgetInput] = useState<string>(
    monthlyBudget > 0 ? monthlyBudget.toString() : '35000'
  );

  const headerTitle = useMemo(() => {
    if (!result?.bankName) return 'STATEMENT IMPORT';
    const name = result.bankName.toUpperCase().trim();
    return name.endsWith('STATEMENT') ? name : `${name} STATEMENT`;
  }, [result?.bankName]);

  // Reset / initialize state whenever modal opens or result changes
  useEffect(() => {
    if (visible && result) {
      setCurrentStep(0);
      slideAnimX.setValue(0);

      if (result.transactions) {
        setStagedList(result.transactions);
      }
      if (accounts.length > 0) {
        setDefaultTargetAccount(accounts[0].id);
      }

      // Initialize opening balance maps for existing & detected accounts
      const initialMap: Record<string, string> = {};
      const initialTypes: Record<string, 'savings' | 'credit' | 'wallet'> = {};

      accounts.forEach((acc) => {
        initialMap[acc.id] = acc.balance > 0 ? acc.balance.toString() : '';
        initialTypes[acc.id] =
          (acc.type as 'savings' | 'credit' | 'wallet') ||
          (acc.statusType === 'due' ? 'credit' : 'savings');
      });

      // Also pre-seed for detected accounts from PDF if not in accounts
      if (result.accountsDetected) {
        result.accountsDetected.forEach((detectedName) => {
          const isCredit = /credit\s*card|creditcard|credit\s*line/i.test(detectedName);
          const isWallet = /wallet|paytm|phonepe|gpay|amazon\s*pay/i.test(detectedName);
          initialTypes[detectedName] = isCredit ? 'credit' : isWallet ? 'wallet' : 'savings';
          initialMap[detectedName] = '0';
        });
      }

      setBalanceInputs(initialMap);
      setAccountTypes(initialTypes);
      setIsAddingNewAcc(false);
      setNewAccName('');
      setNewAccBalance('');
      setAddedCustomAccounts([]);
    }
  }, [visible, result, accounts]);

  const goToStep = (step: 0 | 1 | 2) => {
    Keyboard.dismiss();
    Haptics.selectionAsync().catch(() => {});
    Animated.spring(slideAnimX, {
      toValue: -step * screenWidth,
      damping: 24,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
    setCurrentStep(step);
  };

  // ── Detected accounts tabs ──
  const accountTabs = useMemo(() => {
    if (!result) return ['All'];
    const accs = result.accountsDetected;
    if (accs.length <= 1) return ['All'];
    return ['All', ...accs];
  }, [result]);

  // ── Filtered transactions for Step 0 ──
  const filteredTxs = useMemo(() => {
    return stagedList.filter((tx) => {
      if (selectedAccountFilter !== 'All' && tx.accountName !== selectedAccountFilter) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const cat = categories.find((c) => c.id === tx.categoryId);
        const matchNote = tx.narration.toLowerCase().includes(q);
        const matchCat = cat?.name.toLowerCase().includes(q);
        const matchAmt = tx.amount.toString().includes(q);
        if (!matchNote && !matchCat && !matchAmt) return false;
      }
      return true;
    });
  }, [stagedList, selectedAccountFilter, searchQuery, categories]);

  // ── Selected totals ──
  const selectedCount = useMemo(() => stagedList.filter((t) => t.selected).length, [stagedList]);
  const selectedDebits = useMemo(
    () =>
      stagedList
        .filter((t) => t.selected && (t.type === 'expense' || t.type === 'transfer' || t.type === 'debt_lend'))
        .reduce((sum, t) => sum + t.amount, 0),
    [stagedList]
  );
  const selectedCredits = useMemo(
    () =>
      stagedList
        .filter((t) => t.selected && (t.type === 'income' || t.type === 'debt_borrow'))
        .reduce((sum, t) => sum + t.amount, 0),
    [stagedList]
  );

  const toggleSelect = (id: string) => {
    Haptics.selectionAsync();
    setStagedList((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const toggleSelectAll = () => {
    Haptics.selectionAsync();
    const allSelected = filteredTxs.every((t) => t.selected);
    const targetIds = new Set(filteredTxs.map((t) => t.id));
    setStagedList((prev) =>
      prev.map((t) => (targetIds.has(t.id) ? { ...t, selected: !allSelected } : t))
    );
  };

  const setTxCategory = (txnId: string, catId: string) => {
    Haptics.selectionAsync();
    setStagedList((prev) =>
      prev.map((t) => {
        if (t.id !== txnId) return t;
        saveLearnedMerchantRule(t.narration, catId);
        return {
          ...t,
          categoryId: catId,
          categoryConfidence: 'high',
        };
      })
    );
    setActiveCategoryPickerTxnId(null);
  };

  // ── Step 1 Account Management Helpers ──
  // Do NOT show CASH / PRIMARY if it was not actually detected in the imported PDF.
  // Only display accounts actually found in the statement, plus accounts the user explicitly created/used.
  const step1AccountsList = useMemo(() => {
    const list: Array<{
      key: string;
      name: string;
      isExisting: boolean;
      existingId?: string;
    }> = [];

    const detectedNames = (result?.accountsDetected || []).map((d) => d.trim().toLowerCase());
    const txAccountNames = stagedList.map((t) => (t.accountName || '').trim().toLowerCase());

    // 1. Existing accounts in store — filter out empty unconfigured default placeholders
    accounts.forEach((acc) => {
      const accNameLower = acc.name.trim().toLowerCase();
      const isDetectedInPdf =
        detectedNames.includes(accNameLower) ||
        txAccountNames.includes(accNameLower) ||
        (result?.bankName && accNameLower.includes(result.bankName.toLowerCase()));

      const isDefaultPlaceholder =
        (acc.id === 'acc_primary' ||
          acc.id === 'acc_default' ||
          accNameLower === 'cash / primary' ||
          accNameLower === 'primary account' ||
          accNameLower === 'cash') &&
        acc.balance === 0 &&
        (!acc.txnCountThisMonth || acc.txnCountThisMonth === 0);

      if (isDetectedInPdf || !isDefaultPlaceholder) {
        list.push({
          key: acc.id,
          name: acc.name,
          isExisting: true,
          existingId: acc.id,
        });
      }
    });

    // 2. Discovered accounts from PDF that aren't already in the list
    if (result?.accountsDetected) {
      result.accountsDetected.forEach((detectedName) => {
        const trimmed = detectedName.trim();
        if (
          trimmed &&
          trimmed !== 'Primary Account' &&
          trimmed !== 'Default Account' &&
          !list.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())
        ) {
          list.push({
            key: trimmed,
            name: trimmed,
            isExisting: false,
          });
        }
      });
    }

    return list;
  }, [accounts, result, stagedList]);

  const handleAddNewAccountStep1 = () => {
    if (!newAccName.trim()) return;
    Haptics.selectionAsync().catch(() => {});
    const numBal = parseFloat(newAccBalance.trim().replace(/,/g, '')) || 0;
    setAddedCustomAccounts((prev) => [
      ...prev,
      { name: newAccName.trim(), type: newAccType, balance: numBal },
    ]);
    setNewAccName('');
    setNewAccBalance('');
    setNewAccType('savings');
    setIsAddingNewAcc(false);
  };

  // ── Final Finish Handler ──
  const handleFinalFinish = (skipBudget = false) => {
    const toImport = stagedList.filter((t) => t.selected);
    if (toImport.length === 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Prepare opening balances for existing and detected accounts
    const parsedBalances: Record<string, number> = {};
    Object.entries(balanceInputs).forEach(([accKey, strVal]) => {
      if (strVal && strVal.trim().length > 0) {
        const num = parseFloat(strVal.trim().replace(/,/g, ''));
        if (!isNaN(num) && num >= 0) {
          parsedBalances[accKey] = num;
        }
      }
    });

    const openingBalancesData: OpeningBalancesData = {
      balances: parsedBalances,
      types: accountTypes,
      newAccounts: addedCustomAccounts,
    };

    const cleanBudget = budgetInput.trim().replace(/,/g, '');
    const parsedBudget = cleanBudget === '' ? 0 : parseFloat(cleanBudget);
    const budgetNum = skipBudget ? undefined : isNaN(parsedBudget) ? 0 : Math.max(0, parsedBudget);

    onConfirmImport(toImport, defaultTargetAccount, openingBalancesData, budgetNum);
  };

  const renderIcon = (type: 'savings' | 'credit' | 'wallet') => {
    if (type === 'credit') return <CreditCard size={17} color="#FF9D66" />;
    if (type === 'wallet') return <Wallet size={17} color="#60A5FA" />;
    return <Banknote size={17} color={expenseColors.accentGreen} />;
  };

  if (!result) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        {/* iOS Drag Handle */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Statement Title Row (Statement name centered, X at top right, Back at top left if step > 0) */}
        <View style={styles.headerTopRow}>
          {currentStep > 0 ? (
            <TouchableOpacity
              style={styles.navBackBtn}
              onPress={() => goToStep((currentStep - 1) as 0 | 1)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ChevronLeft size={18} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
          ) : (
            <View style={styles.navBackPlaceholder} />
          )}

          <AppText style={styles.statementTitleText} numberOfLines={1}>
            {headerTitle}
          </AppText>

          <TouchableOpacity
            style={styles.closeBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => {
              Keyboard.dismiss();
              Haptics.selectionAsync();
              onClose();
            }}
          >
            <X size={16} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* Step Navigation Row: 3 tabs on ONE clean row directly BELOW statement name */}
        <View style={styles.stepTabsContainer}>
          {[
            { label: '1. TXNS', step: 0 },
            { label: '2. BALANCES', step: 1 },
            { label: '3. BUDGET', step: 2 },
          ].map((item) => {
            const isActive = currentStep === item.step;
            const isPast = currentStep > item.step;
            return (
              <TouchableOpacity
                key={item.step}
                activeOpacity={0.8}
                disabled={item.step > currentStep}
                onPress={() => goToStep(item.step as 0 | 1 | 2)}
                style={[
                  styles.stepTabItem,
                  isActive && styles.stepTabItemActive,
                  isPast && styles.stepTabItemPast,
                ]}
              >
                <AppText
                  style={[
                    styles.stepTabText,
                    isActive && styles.stepTabTextActive,
                    isPast && styles.stepTabTextPast,
                  ]}
                >
                  {item.label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Horizontal Animated Wizard Container (Width: 3 x screenWidth) */}
        <Animated.View
          style={[
            styles.horizontalTrack,
            {
              width: screenWidth * 3,
              transform: [{ translateX: slideAnimX }],
            },
          ]}
        >
          {/* ════════════════════════════════════════════════════════════════
              STEP 0: TRANSACTIONS REVIEW & CATEGORIZATION
             ════════════════════════════════════════════════════════════════ */}
          <View style={[styles.stepPage, { width: screenWidth }]}>
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {/* Summary Metric Card */}
              <View style={styles.summaryCard}>
                <View style={styles.metricRow}>
                  {/* Debits / Outflow */}
                  <View style={styles.metricCol}>
                    <AppText style={styles.metricLabel}>OUTFLOW</AppText>
                    <AppText style={[styles.metricValue, { color: '#FF9D66' }]}>
                      -{sym}{selectedDebits.toLocaleString('en-IN')}
                    </AppText>
                  </View>

                  <View style={styles.metricDivider} />

                  {/* Credits / Inflow */}
                  <View style={styles.metricCol}>
                    <AppText style={styles.metricLabel}>INFLOW</AppText>
                    <AppText style={[styles.metricValue, { color: '#70D6BC' }]}>
                      +{sym}{selectedCredits.toLocaleString('en-IN')}
                    </AppText>
                  </View>

                  <View style={styles.metricDivider} />

                  {/* Net Flow */}
                  <View style={styles.metricCol}>
                    <AppText style={styles.metricLabel}>NET FLOW</AppText>
                    <AppText
                      style={[
                        styles.metricValue,
                        {
                          color:
                            selectedCredits - selectedDebits >= 0
                              ? '#70D6BC'
                              : '#FFFFFF',
                        },
                      ]}
                    >
                      {selectedCredits - selectedDebits >= 0 ? '+' : '-'}
                      {sym}
                      {Math.abs(selectedCredits - selectedDebits).toLocaleString('en-IN')}
                    </AppText>
                  </View>
                </View>

                {/* Reconciliation Status Pill */}
                <View
                  style={[
                    styles.reconciliationPill,
                    result.reconciliation.isReconciled
                      ? styles.reconciledSuccess
                      : styles.reconciledWarning,
                  ]}
                >
                  {result.reconciliation.isReconciled ? (
                    <>
                      <ShieldCheck size={13} color="#70D6BC" strokeWidth={2.2} />
                      <AppText style={styles.reconciledSuccessText}>
                        Mathematical Balance Reconciled ({stagedList.length} Transactions)
                      </AppText>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={13} color="#FFB84D" strokeWidth={2.2} />
                      <AppText style={styles.reconciledWarningText}>
                        Balance verified ({sym}{result.reconciliation.reconciledDiff.toFixed(2)} diff)
                      </AppText>
                    </>
                  )}
                </View>
              </View>

              {/* Account Filter Tabs (If multi-account statement) */}
              {accountTabs.length > 1 ? (
                <View style={styles.accountTabsContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.accountTabsScroll}
                  >
                    {accountTabs.map((tab) => {
                      const isSelected = selectedAccountFilter === tab;
                      const count =
                        tab === 'All'
                          ? stagedList.length
                          : stagedList.filter((t) => t.accountName === tab).length;
                      return (
                        <TouchableOpacity
                          key={tab}
                          style={[styles.accountTabPill, isSelected && styles.accountTabPillActive]}
                          onPress={() => {
                            Keyboard.dismiss();
                            Haptics.selectionAsync();
                            setSelectedAccountFilter(tab);
                          }}
                        >
                          <AppText
                            style={[
                              styles.accountTabPillText,
                              isSelected && styles.accountTabPillTextActive,
                            ]}
                          >
                            {tab} ({count})
                          </AppText>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* Search & Select All Bar */}
              <View style={styles.searchActionBar}>
                <View style={styles.searchBar}>
                  <Search size={14} color="#8E919D" strokeWidth={2.2} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search narration, category, amount..."
                    placeholderTextColor="#696C75"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                </View>

                <TouchableOpacity
                  style={styles.selectAllBtn}
                  onPress={toggleSelectAll}
                  activeOpacity={0.7}
                >
                  {filteredTxs.every((t) => t.selected) ? (
                    <CheckSquare size={16} color="#FF9D66" strokeWidth={2.2} />
                  ) : (
                    <Square size={16} color="#8E919D" strokeWidth={2.2} />
                  )}
                  <AppText style={styles.selectAllBtnText}>
                    {filteredTxs.every((t) => t.selected) ? 'Deselect All' : 'Select All'}
                  </AppText>
                </TouchableOpacity>
              </View>

              {/* Transactions List */}
              <View style={styles.txListContainer}>
                {filteredTxs.map((tx) => {
                  const cat = categories.find((c) => c.id === tx.categoryId) || categories[0];
                  const isDebit = tx.type === 'expense' || tx.type === 'debt_lend';

                  return (
                    <View key={tx.id} style={styles.txItemWrapper}>
                      <TouchableOpacity
                        style={[
                          styles.txItemRow,
                          !tx.selected && styles.txItemRowDeselected,
                          tx.isDuplicate && styles.txItemRowDuplicate,
                        ]}
                        activeOpacity={0.75}
                        onPress={() => toggleSelect(tx.id)}
                      >
                        {/* Checkbox */}
                        <View style={styles.checkboxWrapper}>
                          {tx.selected ? (
                            <CheckSquare size={18} color="#FF9D66" strokeWidth={2.2} />
                          ) : (
                            <Square size={18} color="#696C75" strokeWidth={2} />
                          )}
                        </View>

                        {/* Category Icon with 1-Tap Category Picker */}
                        <TouchableOpacity
                          style={[styles.catIconCircle, { backgroundColor: `${cat.color}20` }]}
                          onPress={() =>
                            setActiveCategoryPickerTxnId(
                              activeCategoryPickerTxnId === tx.id ? null : tx.id
                            )
                          }
                        >
                          <CategoryIcon iconName={cat.iconName} size={15} color={cat.color} />
                        </TouchableOpacity>

                        {/* Middle Details */}
                        <View style={styles.txMiddle}>
                          <View style={styles.txNoteRow}>
                            <AppText style={styles.txNarration} numberOfLines={1}>
                              {tx.narration}
                            </AppText>
                            {tx.isDuplicate && (
                              <View style={styles.duplicateTag}>
                                <AppText style={styles.duplicateTagText}>DUPLICATE</AppText>
                              </View>
                            )}
                          </View>

                          <View style={styles.txSubRow}>
                            <AppText style={styles.txDateText}>{tx.date}</AppText>
                            <AppText style={styles.txDotText}>•</AppText>
                            <AppText style={styles.txAccountText} numberOfLines={1}>
                              {tx.accountName}
                            </AppText>
                            <AppText style={styles.txDotText}>•</AppText>
                            <TouchableOpacity
                              style={[
                                styles.interactiveCatPill,
                                {
                                  backgroundColor: `${cat.color}18`,
                                  borderColor: `${cat.color}35`,
                                },
                              ]}
                              onPress={() =>
                                setActiveCategoryPickerTxnId(
                                  activeCategoryPickerTxnId === tx.id ? null : tx.id
                                )
                              }
                            >
                              <AppText style={[styles.interactiveCatText, { color: cat.color }]}>
                                {cat.name}
                              </AppText>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Right Amount */}
                        <View style={styles.txRight}>
                          <AppText
                            style={[
                              styles.txAmount,
                              {
                                color: isDebit
                                  ? '#FFFFFF'
                                  : '#70D6BC',
                              },
                            ]}
                          >
                            {isDebit ? '-' : '+'}
                            {sym}
                            {tx.amount.toLocaleString('en-IN')}
                          </AppText>
                        </View>
                      </TouchableOpacity>

                      {/* Inline Category Quick Picker */}
                      {activeCategoryPickerTxnId === tx.id && (
                        <View style={styles.inlineCatPicker}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.inlineCatPickerScroll}
                          >
                            {categories.map((c) => (
                              <TouchableOpacity
                                key={c.id}
                                style={[
                                  styles.inlineCatChip,
                                  c.id === tx.categoryId && styles.inlineCatChipActive,
                                ]}
                                onPress={() => setTxCategory(tx.id, c.id)}
                              >
                                <CategoryIcon iconName={c.iconName} size={12} color={c.color} />
                                <AppText style={[styles.inlineCatText, { color: c.color }]}>
                                  {c.name}
                                </AppText>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Step 0 Footer Action Button (Pinned to Bottom Safe Area) */}
            <View style={[styles.bottomFooter, { paddingBottom: insets.bottom > 0 ? Math.min(insets.bottom, 18) : 14 }]}>
              <TouchableOpacity
                style={[styles.importCtaBtn, selectedCount === 0 && styles.importCtaBtnDisabled]}
                disabled={selectedCount === 0}
                activeOpacity={0.85}
                onPress={() => goToStep(1)}
              >
                <AppText style={styles.importCtaText}>
                  Next: Set Opening Balances ({selectedCount} Selected)
                </AppText>
                <ArrowRight size={15} color="#0F1015" strokeWidth={2.6} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ════════════════════════════════════════════════════════════════
              STEP 1: SET OPENING BALANCES & ACCOUNT TYPES
             ════════════════════════════════════════════════════════════════ */}
          <View style={[styles.stepPage, { width: screenWidth }]}>
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {/* Guidance Notice */}
              <View style={styles.infoCard}>
                <Building2 size={16} color="#FF9D66" strokeWidth={2.2} />
                <AppText style={styles.infoText}>
                  Set each account's starting balance and type so your total net worth and credit dues remain 100% accurate.
                </AppText>
              </View>

              {/* Accounts List (Only accounts found in PDF or real user accounts) */}
              <View style={styles.accountsStack}>
                {step1AccountsList.map((item) => {
                  const currentType = accountTypes[item.key] || 'savings';
                  const isCredit = currentType === 'credit';
                  const inputVal = balanceInputs[item.key] ?? '0';
                  const startingNum = parseFloat(inputVal.trim().replace(/,/g, '')) || 0;

                  // Statement transactions linked to this account
                  const linkedTxs = stagedList.filter(
                    (t) => t.selected && (t.accountName === item.name || t.accountId === item.key)
                  );
                  const linkedTxCount = linkedTxs.length;
                  const expenseSum = linkedTxs
                    .filter((t) => t.type === 'expense' || t.type === 'transfer' || t.type === 'debt_lend')
                    .reduce((sum, t) => sum + t.amount, 0);
                  const incomeSum = linkedTxs
                    .filter((t) => t.type === 'income' || t.type === 'debt_borrow')
                    .reduce((sum, t) => sum + t.amount, 0);
                  const netFlow = incomeSum - expenseSum;

                  // Projected Final Balance / Due
                  const projectedFinalDue = Math.max(0, startingNum + expenseSum - incomeSum);
                  const projectedFinalBalance = startingNum + netFlow;

                  return (
                    <View key={item.key} style={styles.accountCard}>
                      {/* Card Header */}
                      <View style={styles.accountCardTop}>
                        <AccountIcon type={currentType} size={16} containerSize={34} borderRadius={10} />
                        <View style={styles.accountTextCol}>
                          <AppText style={styles.accountName} numberOfLines={1}>
                            {item.name.toUpperCase()}
                          </AppText>
                          <AppText style={styles.accountTypeLabel}>
                            {isCredit
                              ? 'Credit Card • Tracked Dues'
                              : currentType === 'wallet'
                              ? 'Digital Wallet'
                              : 'Bank Account'}
                          </AppText>
                        </View>
                        {!item.isExisting && (
                          <View style={styles.discoveredBadge}>
                            <AppText style={styles.discoveredBadgeText}>FOUND IN PDF</AppText>
                          </View>
                        )}
                      </View>

                      {/* Segmented Account Type Selector */}
                      <View style={styles.typeSelectorContainer}>
                        <TouchableOpacity
                          style={[
                            styles.typeSegmentBtn,
                            currentType === 'savings' && styles.typeSegmentBtnActive,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => {
                            Keyboard.dismiss();
                            Haptics.selectionAsync();
                            setAccountTypes((prev) => ({ ...prev, [item.key]: 'savings' }));
                          }}
                        >
                          <AppText
                            style={[
                              styles.typeSegmentText,
                              currentType === 'savings' && styles.typeSegmentTextActive,
                            ]}
                          >
                            BANK
                          </AppText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.typeSegmentBtn,
                            currentType === 'credit' && styles.typeSegmentBtnActive,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => {
                            Keyboard.dismiss();
                            Haptics.selectionAsync();
                            setAccountTypes((prev) => ({ ...prev, [item.key]: 'credit' }));
                          }}
                        >
                          <AppText
                            style={[
                              styles.typeSegmentText,
                              currentType === 'credit' && styles.typeSegmentTextActive,
                            ]}
                          >
                            CREDIT CARD
                          </AppText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.typeSegmentBtn,
                            currentType === 'wallet' && styles.typeSegmentBtnActive,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => {
                            Keyboard.dismiss();
                            Haptics.selectionAsync();
                            setAccountTypes((prev) => ({ ...prev, [item.key]: 'wallet' }));
                          }}
                        >
                          <AppText
                            style={[
                              styles.typeSegmentText,
                              currentType === 'wallet' && styles.typeSegmentTextActive,
                            ]}
                          >
                            WALLET
                          </AppText>
                        </TouchableOpacity>
                      </View>

                      {/* Statement Activity Summary Pill */}
                      {linkedTxCount > 0 && (
                        <View style={styles.statementActivityBar}>
                          <Sparkles size={13} color="#70D6BC" strokeWidth={2.2} />
                          <AppText style={styles.statementActivityText} numberOfLines={1}>
                            Statement activity: {linkedTxCount} {linkedTxCount === 1 ? 'txn' : 'txns'} (
                            {isCredit
                              ? `+${sym}${expenseSum.toLocaleString('en-IN')} spending`
                              : `${netFlow >= 0 ? '+' : '-'}${sym}${Math.abs(netFlow).toLocaleString('en-IN')} net flow`}
                            )
                          </AppText>
                        </View>
                      )}

                      {/* Starting / Prior Balance Input */}
                      <View style={styles.balanceInputContainer}>
                        <View style={styles.balanceInputLabelRow}>
                          <AppText style={styles.balanceInputLabel}>
                            {isCredit
                              ? 'PRIOR UNPAID DUE (BEFORE STATEMENT)'
                              : 'PRIOR OPENING BALANCE (BEFORE STATEMENT)'}
                          </AppText>
                          {startingNum !== 0 && (
                            <TouchableOpacity
                              onPress={() => {
                                Keyboard.dismiss();
                                Haptics.selectionAsync();
                                setBalanceInputs((prev) => ({ ...prev, [item.key]: '0' }));
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <AppText style={styles.resetToZeroText}>Reset to 0</AppText>
                            </TouchableOpacity>
                          )}
                        </View>

                        <View style={styles.balanceInputBox}>
                          <AppText style={styles.currencyPrefix}>{sym}</AppText>
                          <TextInput
                            style={styles.balanceTextInput}
                            placeholder="0"
                            placeholderTextColor="#696C75"
                            keyboardType="numeric"
                            value={inputVal === '0' ? '' : inputVal}
                            returnKeyType="done"
                            onSubmitEditing={() => Keyboard.dismiss()}
                            onChangeText={(text) =>
                              setBalanceInputs((prev) => ({ ...prev, [item.key]: text }))
                            }
                          />
                        </View>
                      </View>

                      {/* Live Calculated Balance Card */}
                      <View style={styles.liveFormulaCard}>
                        <View style={styles.liveFormulaHeader}>
                          <AppText style={styles.liveFormulaTitle}>LIVE RESULT IN APP</AppText>
                        </View>

                        <View style={styles.liveFormulaRow}>
                          <AppText style={styles.liveFormulaEquation} numberOfLines={1}>
                            {isCredit
                              ? `Prior (${sym}${startingNum.toLocaleString('en-IN')}) + Spending (${sym}${expenseSum.toLocaleString('en-IN')})`
                              : `Starting (${sym}${startingNum.toLocaleString('en-IN')}) + Flow (${netFlow >= 0 ? '+' : '-'}${sym}${Math.abs(netFlow).toLocaleString('en-IN')})`}
                          </AppText>

                          <View style={[styles.liveFormulaPill, isCredit && styles.liveFormulaPillDue]}>
                            <AppText style={[styles.liveFormulaPillText, isCredit && styles.liveFormulaPillTextDue]}>
                              {isCredit
                                ? `Due: ${sym}${projectedFinalDue.toLocaleString('en-IN')}`
                                : `Balance: ${sym}${projectedFinalBalance.toLocaleString('en-IN')}`}
                            </AppText>
                          </View>
                        </View>

                        {startingNum > 0 && linkedTxCount > 0 && (
                          <AppText style={styles.liveFormulaHint}>
                            💡 Includes both your entered prior balance and imported statement transactions.
                          </AppText>
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* Newly Added Custom Accounts Preview */}
                {addedCustomAccounts.map((cAcc, idx) => (
                  <View key={idx} style={styles.accountCard}>
                    <View style={styles.accountCardTop}>
                      <AccountIcon type={cAcc.type} size={16} containerSize={34} borderRadius={10} />
                      <View style={styles.accountTextCol}>
                        <AppText style={styles.accountName}>{cAcc.name.toUpperCase()}</AppText>
                        <AppText style={styles.accountTypeLabel}>
                          {cAcc.type === 'credit' ? 'Credit Card' : 'Bank Account'} • {sym}
                          {cAcc.balance.toLocaleString('en-IN')}
                        </AppText>
                      </View>
                    </View>
                  </View>
                ))}

                {/* Inline Add Missing Account */}
                {isAddingNewAcc ? (
                  <View style={styles.addAccountCard}>
                    <AppText style={styles.addAccountHeader}>ADD ANOTHER ACCOUNT</AppText>
                    <TextInput
                      style={styles.newAccountInput}
                      placeholder="e.g. HDFC Salary, SBI, Cash"
                      placeholderTextColor="#696C75"
                      value={newAccName}
                      onChangeText={setNewAccName}
                      returnKeyType="next"
                    />

                    <View style={styles.typeSelectorContainer}>
                      <TouchableOpacity
                        style={[
                          styles.typeSegmentBtn,
                          newAccType === 'savings' && styles.typeSegmentBtnActive,
                        ]}
                        onPress={() => {
                          Keyboard.dismiss();
                          setNewAccType('savings');
                        }}
                      >
                        <AppText
                          style={[
                            styles.typeSegmentText,
                            newAccType === 'savings' && styles.typeSegmentTextActive,
                          ]}
                        >
                          BANK
                        </AppText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.typeSegmentBtn,
                          newAccType === 'credit' && styles.typeSegmentBtnActive,
                        ]}
                        onPress={() => {
                          Keyboard.dismiss();
                          setNewAccType('credit');
                        }}
                      >
                        <AppText
                          style={[
                            styles.typeSegmentText,
                            newAccType === 'credit' && styles.typeSegmentTextActive,
                          ]}
                        >
                          CREDIT CARD
                        </AppText>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.balanceInputBox}>
                      <AppText style={styles.currencyPrefix}>{sym}</AppText>
                      <TextInput
                        style={styles.balanceTextInput}
                        placeholder="0"
                        placeholderTextColor="#696C75"
                        keyboardType="numeric"
                        value={newAccBalance}
                        onChangeText={setNewAccBalance}
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                      />
                    </View>

                    <View style={styles.addAccountActionsRow}>
                      <TouchableOpacity
                        style={styles.cancelAddBtn}
                        onPress={() => {
                          Keyboard.dismiss();
                          setIsAddingNewAcc(false);
                        }}
                      >
                        <AppText style={styles.cancelAddBtnText}>Cancel</AppText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.confirmAddBtn}
                        onPress={handleAddNewAccountStep1}
                      >
                        <AppText style={styles.confirmAddBtnText}>Add Account</AppText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addMissingAccountBtn}
                    activeOpacity={0.75}
                    onPress={() => {
                      Keyboard.dismiss();
                      Haptics.selectionAsync();
                      setIsAddingNewAcc(true);
                    }}
                  >
                    <Plus size={15} color="#FF9D66" strokeWidth={2.4} />
                    <AppText style={styles.addMissingAccountText}>+ Add Another Account</AppText>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            {/* Step 1 Footer Action Buttons (Pinned to Bottom Safe Area) */}
            <View style={[styles.bottomFooterDual, { paddingBottom: insets.bottom > 0 ? Math.min(insets.bottom, 18) : 14 }]}>
              <TouchableOpacity
                style={styles.skipBtn}
                activeOpacity={0.7}
                onPress={() => goToStep(2)}
              >
                <AppText style={styles.skipBtnText}>Skip Balances</AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryNextBtn}
                activeOpacity={0.85}
                onPress={() => goToStep(2)}
              >
                <AppText style={styles.importCtaText}>Next: Set Budget</AppText>
                <ArrowRight size={15} color="#0F1015" strokeWidth={2.6} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ════════════════════════════════════════════════════════════════
              STEP 2: MONTHLY SPENDING BUDGET GOAL
             ════════════════════════════════════════════════════════════════ */}
          <View style={[styles.stepPage, { width: screenWidth }]}>
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {/* Header Title Block */}
              <View style={styles.budgetHeaderBlock}>
                <View style={styles.targetIconCircle}>
                  <Target size={26} color="#FF9D66" strokeWidth={2.2} />
                </View>
                <AppText style={styles.budgetMainHeadline}>MONTHLY SPENDING BUDGET</AppText>
                <AppText style={styles.budgetSubHeadline}>
                  Set a monthly spending runway limit to receive live warnings as you approach your threshold.
                </AppText>
              </View>

              {/* Budget Hero Input Card */}
              <View style={styles.budgetCardHero}>
                <AppText style={styles.budgetHeroLabel}>TARGET MONTHLY LIMIT</AppText>
                <View style={styles.budgetHeroInputRow}>
                  <AppText style={styles.budgetHeroCurrency}>{sym}</AppText>
                  <TextInput
                    style={styles.budgetHeroInput}
                    placeholder="35000"
                    placeholderTextColor="#696C75"
                    keyboardType="numeric"
                    value={budgetInput}
                    onChangeText={setBudgetInput}
                    returnKeyType="done"
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                </View>
              </View>

              {/* Quick Preset Chips */}
              <View style={styles.budgetPresetsBlock}>
                <AppText style={styles.presetsLabel}>OR CHOOSE A QUICK PRESET</AppText>
                <View style={styles.presetsGrid}>
                  {BUDGET_PRESETS.map((amt) => {
                    const isSelected = budgetInput.trim() === amt.toString();
                    return (
                      <TouchableOpacity
                        key={amt}
                        style={[styles.presetChip, isSelected && styles.presetChipActive]}
                        activeOpacity={0.75}
                        onPress={() => {
                          Keyboard.dismiss();
                          Haptics.selectionAsync();
                          setBudgetInput(amt.toString());
                        }}
                      >
                        <AppText
                          style={[
                            styles.presetChipText,
                            isSelected && styles.presetChipTextActive,
                          ]}
                        >
                          {sym}{amt.toLocaleString('en-IN')}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Step 2 Footer Action Buttons (Pinned to Bottom Safe Area) */}
            <View style={[styles.bottomFooterDual, { paddingBottom: insets.bottom > 0 ? Math.min(insets.bottom, 18) : 14 }]}>
              <TouchableOpacity
                style={styles.skipBtn}
                activeOpacity={0.7}
                onPress={() => handleFinalFinish(true)}
              >
                <AppText style={styles.skipBtnText}>Skip Budget</AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryFinishBtn}
                activeOpacity={0.85}
                onPress={() => handleFinalFinish(false)}
              >
                <Check size={16} color="#0F1015" strokeWidth={2.8} />
                <AppText style={styles.importCtaText}>Complete Setup</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#0F1015',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  navBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBackPlaceholder: {
    width: 32,
    height: 32,
  },
  statementTitleText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepTabItem: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  stepTabItemActive: {
    backgroundColor: '#FF9D66',
    borderColor: '#FF9D66',
  },
  stepTabItemPast: {
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    borderColor: 'rgba(112, 214, 188, 0.25)',
  },
  stepTabText: {
    color: '#8E919D',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  stepTabTextActive: {
    color: '#0F1015',
    fontWeight: '900',
  },
  stepTabTextPast: {
    color: '#70D6BC',
    fontWeight: '800',
  },
  horizontalTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  stepPage: {
    flex: 1,
    backgroundColor: '#0F1015',
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 88,
  },
  summaryCard: {
    backgroundColor: '#16171E',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 14,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    color: '#8E919D',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 15.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  metricDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  reconciliationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  reconciledSuccess: {
    backgroundColor: 'rgba(112, 214, 188, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(112, 214, 188, 0.2)',
  },
  reconciledWarning: {
    backgroundColor: 'rgba(255, 184, 77, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 77, 0.25)',
  },
  reconciledSuccessText: {
    color: '#70D6BC',
    fontSize: 11,
    fontWeight: '700',
  },
  reconciledWarningText: {
    color: '#FFB84D',
    fontSize: 11,
    fontWeight: '700',
  },
  accountTabsContainer: {
    marginBottom: 12,
  },
  accountTabsScroll: {
    gap: 8,
  },
  accountTabPill: {
    backgroundColor: '#16171E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6.5,
  },
  accountTabPillActive: {
    backgroundColor: '#FF9D66',
    borderColor: '#FF9D66',
  },
  accountTabPillText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '700',
  },
  accountTabPillTextActive: {
    color: '#0F1015',
    fontWeight: '800',
  },
  searchActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16171E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    padding: 0,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  selectAllBtnText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '700',
  },
  txListContainer: {
    gap: 8,
  },
  txItemWrapper: {},
  txItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16171E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
  },
  txItemRowDeselected: {
    opacity: 0.35,
  },
  txItemRowDuplicate: {
    borderColor: 'rgba(255, 157, 102, 0.3)',
  },
  checkboxWrapper: {
    marginRight: 10,
  },
  catIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  txMiddle: {
    flex: 1,
    marginRight: 8,
  },
  txNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  txNarration: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  duplicateTag: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  duplicateTagText: {
    color: '#FF9D66',
    fontSize: 8.5,
    fontWeight: '800',
  },
  txSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  txDateText: {
    color: '#8E919D',
    fontSize: 10,
    fontWeight: '600',
  },
  txDotText: {
    color: '#696C75',
    fontSize: 10,
  },
  txAccountText: {
    color: '#8E919D',
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 90,
  },
  interactiveCatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  interactiveCatText: {
    fontSize: 9,
    fontWeight: '800',
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  inlineCatPicker: {
    backgroundColor: '#12131A',
    borderRadius: 12,
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  inlineCatPickerScroll: {
    gap: 8,
  },
  inlineCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  inlineCatChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  inlineCatText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // ── Pinned Bottom Footers ──
  bottomFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F1015',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  bottomFooterDual: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F1015',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  importCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF9D66',
    borderRadius: 14,
    height: 48,
  },
  importCtaBtnDisabled: {
    opacity: 0.45,
  },
  importCtaText: {
    color: '#0F1015',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  skipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  skipBtnText: {
    color: '#8E919D',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryNextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF9D66',
    borderRadius: 14,
    height: 48,
  },
  primaryFinishBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#70D6BC',
    borderRadius: 14,
    height: 48,
  },

  // ── Step 1 & 2 Specific Styles ──
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#16171E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.2)',
    padding: 12,
    marginBottom: 14,
  },
  infoText: {
    color: '#A2A5B0',
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
  accountsStack: {
    gap: 12,
  },
  accountCard: {
    backgroundColor: '#16171E',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 10,
  },
  accountCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTextCol: {
    flex: 1,
  },
  accountName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  discoveredBadge: {
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
  },
  discoveredBadgeText: {
    color: '#FF9D66',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  accountTypeLabel: {
    color: '#8E919D',
    fontSize: 11,
    marginTop: 1,
  },
  typeSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F1017',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 4,
  },
  typeSegmentBtn: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeSegmentBtnActive: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    borderColor: '#FF9D66',
  },
  typeSegmentText: {
    color: '#8E919D',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  typeSegmentTextActive: {
    color: '#FF9D66',
    fontWeight: '800',
  },
  statementActivityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(112, 214, 188, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(112, 214, 188, 0.2)',
  },
  statementActivityText: {
    color: '#70D6BC',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  balanceInputContainer: {
    backgroundColor: '#0F1017',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  balanceInputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  balanceInputLabel: {
    color: '#8E919D',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  balanceInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currencyPrefix: {
    color: '#FF9D66',
    fontSize: 16,
    fontWeight: '800',
  },
  balanceTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    padding: 0,
  },
  resetToZeroText: {
    color: '#FF9D66',
    fontSize: 10,
    fontWeight: '800',
  },
  liveFormulaCard: {
    backgroundColor: '#0F1017',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  liveFormulaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveFormulaTitle: {
    color: '#696C75',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  liveFormulaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  liveFormulaEquation: {
    color: '#C4C7D4',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  liveFormulaPill: {
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(112, 214, 188, 0.25)',
  },
  liveFormulaPillDue: {
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    borderColor: 'rgba(255, 157, 102, 0.3)',
  },
  liveFormulaPillText: {
    color: '#70D6BC',
    fontSize: 11.5,
    fontWeight: '800',
  },
  liveFormulaPillTextDue: {
    color: '#FF9D66',
  },
  liveFormulaHint: {
    color: '#8E919D',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  addMissingAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 157, 102, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 157, 102, 0.35)',
    paddingVertical: 12,
    marginTop: 4,
  },
  addMissingAccountText: {
    color: '#FF9D66',
    fontSize: 12,
    fontWeight: '800',
  },
  addAccountCard: {
    backgroundColor: '#16171E',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FF9D66',
    padding: 14,
    gap: 10,
  },
  addAccountHeader: {
    color: '#FF9D66',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  newAccountInput: {
    backgroundColor: '#0F1017',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  addAccountActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelAddBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
  },
  cancelAddBtnText: {
    color: '#8E919D',
    fontSize: 11.5,
    fontWeight: '700',
  },
  confirmAddBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#FF9D66',
    borderRadius: 10,
  },
  confirmAddBtnText: {
    color: '#0F1015',
    fontSize: 11.5,
    fontWeight: '900',
  },

  // ── Step 2 Budget Styles ──
  budgetHeaderBlock: {
    alignItems: 'center',
    marginVertical: 14,
    paddingHorizontal: 16,
  },
  targetIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  budgetMainHeadline: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginBottom: 6,
    textAlign: 'center',
  },
  budgetSubHeadline: {
    color: '#8E919D',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 320,
  },
  budgetCardHero: {
    backgroundColor: '#16171E',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  budgetHeroLabel: {
    color: '#8E919D',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  budgetHeroInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetHeroCurrency: {
    color: '#FF9D66',
    fontSize: 32,
    fontWeight: '900',
    marginRight: 4,
  },
  budgetHeroInput: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
    minWidth: 120,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  budgetPresetsBlock: {
    gap: 10,
  },
  presetsLabel: {
    color: '#8E919D',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    flexGrow: 1,
    minWidth: '28%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16171E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  presetChipActive: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    borderColor: '#FF9D66',
    borderWidth: 1.5,
  },
  presetChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  presetChipTextActive: {
    color: '#FF9D66',
    fontWeight: '900',
  },
});
