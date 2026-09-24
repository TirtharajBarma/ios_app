import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import {
  X,
  Calendar as CalendarIcon,
  Wallet,
  CreditCard,
  Banknote,
  ArrowRight,
  Users,
  Tag,
  ChevronDown,
  Check,
  HandCoins,
  AlertCircle,
  Plus,
  Zap,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText, NativeLiquidMenu } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { expenseColors } from '@/constants/expenseColors';
import { CategoryIcon, getCategoryBgColor } from './CategoryIcon';
import { DatePickerModal } from './DatePickerModal';
import { EditAccountModal } from './EditAccountModal';
import { format } from 'date-fns';
import { ExpenseAccount, QuickExpensePreset } from '@/types/expense';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabMode = 'expense' | 'income' | 'transfer' | 'debt';
type DebtType = 'lend' | 'borrow';
type BillingCycle = 'monthly' | 'yearly';

const SUGGESTED_TAGS = ['🌴 Goa Trip', '🎉 Night Out', '💍 Wedding', '☕ Work Lunch', '🚗 Road Trip'];

const VENDOR_CATEGORY_MAP: Record<string, string> = {
  // Food & Dining
  swiggy: 'cat_food',
  zomato: 'cat_food',
  starbucks: 'cat_food',
  mcdonald: 'cat_food',
  kfc: 'cat_food',
  dominos: 'cat_food',
  burger: 'cat_food',
  pizza: 'cat_food',
  chai: 'cat_food',
  tea: 'cat_food',
  coffee: 'cat_food',
  cafe: 'cat_food',
  lunch: 'cat_food',
  dinner: 'cat_food',
  breakfast: 'cat_food',
  restaurant: 'cat_food',
  subway: 'cat_food',
  biryani: 'cat_food',

  // Cigarettes & Tobacco
  cig: 'cat_cig',
  cigarette: 'cat_cig',
  smoke: 'cat_cig',
  tobacco: 'cat_cig',
  pan: 'cat_cig',
  goldflake: 'cat_cig',
  marlboro: 'cat_cig',
  advance: 'cat_cig',

  // Transport & Travel
  uber: 'cat_trans',
  ola: 'cat_trans',
  rapido: 'cat_trans',
  metro: 'cat_trans',
  auto: 'cat_trans',
  cab: 'cat_trans',
  petrol: 'cat_trans',
  fuel: 'cat_trans',
  diesel: 'cat_trans',
  flight: 'cat_trans',
  indigo: 'cat_trans',
  irctc: 'cat_trans',
  train: 'cat_trans',
  toll: 'cat_trans',
  parking: 'cat_trans',

  // Shopping
  amazon: 'cat_shop',
  flipkart: 'cat_shop',
  myntra: 'cat_shop',
  blinkit: 'cat_shop',
  zepto: 'cat_shop',
  instamart: 'cat_shop',
  zara: 'cat_shop',
  hm: 'cat_shop',
  grocery: 'cat_shop',
  groceries: 'cat_shop',
  supermarket: 'cat_shop',

  // Entertainment
  netflix: 'cat_ent',
  spotify: 'cat_ent',
  prime: 'cat_ent',
  hotstar: 'cat_ent',
  youtube: 'cat_ent',
  movie: 'cat_ent',
  cinema: 'cat_ent',
  pvr: 'cat_ent',
  inox: 'cat_ent',
  game: 'cat_ent',
  steam: 'cat_ent',
  playstation: 'cat_ent',

  // Health & Medical
  pharmacy: 'cat_health',
  medicine: 'cat_health',
  apollo: 'cat_health',
  hospital: 'cat_health',
  doctor: 'cat_health',
  gym: 'cat_health',
  cult: 'cat_health',
  meds: 'cat_health',

  // Utilities
  electricity: 'cat_util',
  wifi: 'cat_util',
  broadband: 'cat_util',
  jio: 'cat_util',
  airtel: 'cat_util',
  recharge: 'cat_util',
  water: 'cat_util',
  gas: 'cat_util',
  rent: 'cat_util',
};

const getAccountIcon = (name: string) => {
  const n = (name || '').toLowerCase();
  if (n.includes('card') || n.includes('myzone') || n.includes('neo') || n.includes('credit')) {
    return <CreditCard size={14} color="#FFFFFF" />;
  }
  if (n.includes('wallet') || n.includes('pay') || n.includes('slice')) {
    return <Wallet size={14} color="#FFFFFF" />;
  }
  if (n.includes('cash')) {
    return <Banknote size={14} color="#FFFFFF" />;
  }
  return <Banknote size={14} color="#FFFFFF" />;
};

const getCategorySfSymbol = (catId: string, name?: string): string => {
  const n = (name || '').toLowerCase();
  const id = (catId || '').toLowerCase();
  if (id.includes('food') || n.includes('food') || n.includes('dining') || n.includes('eat') || n.includes('coffee')) return 'fork.knife';
  if (id.includes('shop') || n.includes('shop') || n.includes('store') || n.includes('buy')) return 'bag.fill';
  if (id.includes('trans') || id.includes('travel') || n.includes('travel') || n.includes('uber') || n.includes('fuel')) return 'car.fill';
  if (id.includes('cig') || n.includes('smoke') || n.includes('tobacco')) return 'flame.fill';
  if (id.includes('health') || n.includes('med') || n.includes('doctor') || n.includes('gym')) return 'cross.case.fill';
  if (id.includes('util') || n.includes('bill') || n.includes('power') || n.includes('wifi')) return 'bolt.fill';
  if (id.includes('ent') || n.includes('movie') || n.includes('game') || n.includes('music')) return 'tv.fill';
  if (id.includes('edu') || n.includes('course') || n.includes('book')) return 'book.fill';
  if (id.includes('inv') || n.includes('stock') || n.includes('crypto')) return 'chart.line.uptrend.xyaxis';
  if (id.includes('sal') || n.includes('salary') || n.includes('pay')) return 'banknote.fill';
  if (id.includes('free') || n.includes('work') || n.includes('client')) return 'laptopcomputer';
  if (id.includes('groc') || n.includes('grocery') || n.includes('market')) return 'cart.fill';
  if (id.includes('rent') || n.includes('home') || n.includes('house')) return 'house.fill';
  return 'tag.fill';
};

const getAccountSfSymbol = (name: string): string => {
  const n = (name || '').toLowerCase();
  if (n.includes('card') || n.includes('credit') || n.includes('myzone') || n.includes('neo')) return 'creditcard.fill';
  if (n.includes('wallet') || n.includes('slice') || n.includes('pay')) return 'wallet.pass.fill';
  if (n.includes('cash')) return 'banknote.fill';
  return 'building.columns.fill';
};

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    categories,
    accounts,
    addTransaction,
    currencySymbol,
    quickPresets,
    addQuickPreset,
    deleteQuickPreset,
  } = useExpenseStore();
  const sym = currencySymbol || '₹';
  const { addSubscription } = useSubscriptionStore();

  const [tabMode, setTabMode] = useState<TabMode>('expense');
  const [debtType, setDebtType] = useState<DebtType>('lend');
  const [amount, setAmount] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>(
    accounts[1]?.id || accounts[0]?.id || 'acc_slice'
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [txDate, setTxDate] = useState<Date>(new Date(2026, 8, 23)); // Sep 23, 2026 default
  const [note, setNote] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [customTagInput, setCustomTagInput] = useState<string>('');

  // Group Split inside Expense Mode
  const [isSplitEnabled, setIsSplitEnabled] = useState<boolean>(false);
  const [yourShare, setYourShare] = useState<string>('');
  const [friendNames, setFriendNames] = useState<string>('');

  // Debt Person Name
  const [debtPerson, setDebtPerson] = useState<string>('');

  // Subscription toggle & fields
  const [isSubscription, setIsSubscription] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [nextBillDate, setNextBillDate] = useState<Date>(() => {
    const d = new Date(2026, 8, 23);
    d.setMonth(d.getMonth() + 1);
    return d;
  });

  // Quick Preset creation modal
  const [showAddPresetModal, setShowAddPresetModal] = useState<boolean>(false);
  const [newPresetLabel, setNewPresetLabel] = useState<string>('');
  const [newPresetEmoji, setNewPresetEmoji] = useState<string>('⚡');
  const [newPresetAmount, setNewPresetAmount] = useState<string>('');
  const [newPresetCatId, setNewPresetCatId] = useState<string>(categories[0]?.id || 'cat_shop');

  // Account Dropdown Picker Modal (Transfer mode)
  const [accountPickerSide, setAccountPickerSide] = useState<'from' | 'to' | null>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);

  // Date Pickers
  const [showTxDatePicker, setShowTxDatePicker] = useState<boolean>(false);
  const [showNextBillDatePicker, setShowNextBillDatePicker] = useState<boolean>(false);

  // Auto-calculate friend share
  const numAmount = parseFloat(amount) || 0;
  const numYourShare = parseFloat(yourShare) || (numAmount > 0 ? Math.round(numAmount / 2) : 0);
  const friendsShare = Math.max(0, numAmount - numYourShare);

  const handleAmountChange = (text: string) => {
    setAmount(text);
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed > 0 && isSplitEnabled && !yourShare) {
      setYourShare(Math.round(parsed / 2).toString());
    }
  };

  const handleMerchantChange = (text: string) => {
    setMerchant(text);
    if (tabMode === 'expense') {
      const lower = text.toLowerCase().trim();
      for (const [key, catId] of Object.entries(VENDOR_CATEGORY_MAP)) {
        if (lower.includes(key)) {
          if (categories.some((c) => c.id === catId)) {
            setSelectedCategoryId(catId);
            break;
          }
        }
      }
    }
  };

  const handleApplyPreset = (preset: QuickExpensePreset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setAmount(preset.amount.toString());
    setSelectedCategoryId(preset.categoryId);
    if (preset.accountId && accounts.some((a) => a.id === preset.accountId)) {
      setSelectedAccountId(preset.accountId);
    }
    setMerchant(preset.note || preset.label);
  };

  const handleCreatePreset = () => {
    const amt = parseFloat(newPresetAmount);
    if (!newPresetLabel.trim() || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Preset', 'Please enter a valid label and amount.');
      return;
    }
    addQuickPreset({
      label: newPresetLabel.trim(),
      emoji: newPresetEmoji.trim() || '⚡',
      amount: amt,
      categoryId: newPresetCatId,
      note: newPresetLabel.trim(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setShowAddPresetModal(false);
    setNewPresetLabel('');
    setNewPresetAmount('');
  };

  const handleSave = () => {
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    if (accounts.length === 0) {
      Alert.alert(
        'Account Required',
        'You must have at least one account (Bank, Credit Card, or Cash) to record transactions.',
        [
          { text: 'Add Account', onPress: () => setShowAddAccountModal(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (tabMode === 'transfer' && accounts.length < 2) {
      Alert.alert(
        'Two Accounts Required',
        'Transferring money requires at least two accounts. Please add another account.',
        [
          { text: 'Add Account', onPress: () => setShowAddAccountModal(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (tabMode === 'transfer' && selectedAccountId === toAccountId) {
      Alert.alert('Transfer Error', 'Please select two different accounts for the transfer.');
      return;
    }

    const finalTag = customTagInput.trim() ? customTagInput.trim() : selectedTag;
    const finalNote = merchant.trim() ? `${merchant.trim()}${note.trim() ? ` - ${note.trim()}` : ''}` : note.trim();

    if (tabMode === 'transfer') {
      addTransaction({
        amount: numAmount,
        type: 'transfer',
        categoryId: 'cat_fin',
        accountId: selectedAccountId,
        toAccountId: toAccountId,
        date: format(txDate, 'yyyy-MM-dd'),
        note: finalNote || 'Account Transfer',
        tag: finalTag || undefined,
      });
    } else if (tabMode === 'debt') {
      addTransaction({
        amount: numAmount,
        type: debtType === 'lend' ? 'debt_lend' : 'debt_borrow',
        categoryId: 'cat_fin',
        accountId: selectedAccountId,
        date: format(txDate, 'yyyy-MM-dd'),
        borrowerOrLender: debtPerson.trim() || undefined,
        note: finalNote || (debtType === 'lend' ? `Lent to ${debtPerson || 'Friend'}` : `Borrowed from ${debtPerson || 'Friend'}`),
        tag: finalTag || undefined,
      });
    } else if (tabMode === 'expense') {
      if (isSplitEnabled) {
        addTransaction({
          amount: numAmount,
          type: 'expense',
          categoryId: selectedCategoryId,
          accountId: selectedAccountId,
          date: format(txDate, 'yyyy-MM-dd'),
          note: finalNote || `Split bill with ${friendNames || 'friends'}`,
          tag: finalTag || undefined,
          split: {
            totalPaid: numAmount,
            yourShare: numYourShare,
            friendsShare: friendsShare,
            friendNames: friendNames.trim() || undefined,
            settled: false,
          },
        });
      } else {
        addTransaction({
          amount: numAmount,
          type: 'expense',
          categoryId: selectedCategoryId,
          accountId: selectedAccountId,
          date: format(txDate, 'yyyy-MM-dd'),
          note: finalNote || undefined,
          tag: finalTag || undefined,
        });
      }

      if (isSubscription) {
        const cat = categories.find((c) => c.id === selectedCategoryId);
        addSubscription({
          name: merchant.trim() || cat?.name || 'Subscription',
          price: numAmount,
          currency: 'INR' as any,
          billingCycle: billingCycle,
          category: (cat?.name as any) || 'Other',
          paymentMethod: accounts.find((a) => a.id === selectedAccountId)?.name || 'Default',
          color: cat?.color || '#FF6B6B',
          nextBillingDate: format(nextBillDate, 'yyyy-MM-dd'),
          reminderEnabled: false,
          reminderDays: 1,
          isTrial: false,
        });
      }
    } else if (tabMode === 'income') {
      addTransaction({
        amount: numAmount,
        type: 'income',
        categoryId: selectedCategoryId,
        accountId: selectedAccountId,
        date: format(txDate, 'yyyy-MM-dd'),
        note: finalNote || 'Income',
        tag: finalTag || undefined,
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  const selectedCatObj = categories.find((c) => c.id === selectedCategoryId) || null;
  const fromAccObj = accounts.find((a) => a.id === selectedAccountId) || null;
  const toAccObj = accounts.find((a) => a.id === toAccountId) || accounts[1] || accounts[0];
  const isCreditCardPayment = toAccObj?.statusType === 'due' || toAccObj?.type === 'credit';

  // Keep primary root menu compact (<= 6 items) so iOS UIKit always presents the popover DOWNWARDS
  const topCategoryIds = ['cat_food', 'cat_shop', 'cat_trans', 'cat_cig', 'cat_util'];
  const primaryCategories = categories.filter((c) =>
    topCategoryIds.includes(c.id) || c.id === selectedCategoryId
  );
  const otherCategories = categories.filter((c) =>
    !primaryCategories.some((p) => p.id === c.id)
  );

  const categoryActions = [
    ...primaryCategories.map((cat) => ({
      id: cat.id,
      title: `${cat.name}${cat.emoji ? ` ${cat.emoji}` : ''}`,
      image: getCategorySfSymbol(cat.id, cat.name) as any,
      state: (selectedCategoryId === cat.id ? 'on' : 'off') as 'on' | 'off',
    })),
    ...(otherCategories.length > 0
      ? [
          {
            id: '__MORE_CATEGORIES__',
            title: 'More Categories...',
            image: 'ellipsis.circle' as any,
            subactions: otherCategories.map((cat) => ({
              id: cat.id,
              title: `${cat.name}${cat.emoji ? ` ${cat.emoji}` : ''}`,
              image: getCategorySfSymbol(cat.id, cat.name) as any,
              state: (selectedCategoryId === cat.id ? 'on' : 'off') as 'on' | 'off',
            })),
          },
        ]
      : []),
  ];

  const accountActions = [
    ...accounts.map((acc) => ({
      id: acc.id,
      title: `${acc.name} (${acc.statusType === 'due' ? `Due: ${sym}${acc.dueAmount || 0}` : `Bal: ${sym}${acc.balance}`})`,
      image: getAccountSfSymbol(acc.name) as any,
      state: (selectedAccountId === acc.id ? 'on' : 'off') as 'on' | 'off',
    })),
    {
      id: '__ADD_ACCOUNT__',
      title: 'Add New Account...',
      image: 'plus.circle' as any,
    },
  ];

  const modeThemeColor = expenseColors.accentPeach; // Consistent warm peach aesthetic across all modes

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        style={styles.container}
      >
        {/* iOS Drag Handle */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={18} color="#A0A5B5" />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>New Transaction</AppText>
          <TouchableOpacity onPress={handleSave} style={styles.headerDoneBtn} activeOpacity={0.7}>
            <AppText style={styles.headerDoneText}>Save</AppText>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Segmented Type Control: 4 Clean Modes with Unified Peach Highlight */}
          <View style={styles.typeSegment}>
            <TouchableOpacity
              style={[styles.typeBtn, tabMode === 'expense' && styles.typeBtnActive]}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setTabMode('expense'); }}
            >
              <AppText style={[styles.typeBtnText, tabMode === 'expense' && styles.typeBtnTextActive]}>
                EXPENSE
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeBtn, tabMode === 'income' && styles.typeBtnActive]}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setTabMode('income'); }}
            >
              <AppText style={[styles.typeBtnText, tabMode === 'income' && styles.typeBtnTextActive]}>
                INCOME
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeBtn, tabMode === 'transfer' && styles.typeBtnActive]}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setTabMode('transfer'); }}
            >
              <AppText style={[styles.typeBtnText, tabMode === 'transfer' && styles.typeBtnTextActive]}>
                TRANSFER
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeBtn, tabMode === 'debt' && styles.typeBtnActive]}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setTabMode('debt'); }}
            >
              <AppText style={[styles.typeBtnText, tabMode === 'debt' && styles.typeBtnTextActive]}>
                LEND/BORROW
              </AppText>
            </TouchableOpacity>
          </View>

          {/* DEBT SUB-SEGMENT (Lend vs Borrow) */}
          {tabMode === 'debt' && (
            <View style={styles.debtSegment}>
              <TouchableOpacity
                style={[
                  styles.debtSubBtn,
                  debtType === 'lend' && styles.debtSubBtnActive,
                ]}
                onPress={() => setDebtType('lend')}
              >
                <HandCoins size={14} color={debtType === 'lend' ? '#0D0E12' : '#A0A5B5'} />
                <AppText
                  style={[
                    styles.debtSubBtnText,
                    debtType === 'lend' && styles.debtSubBtnTextActive,
                  ]}
                >
                  I LENT (THEY OWE)
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.debtSubBtn,
                  debtType === 'borrow' && styles.debtSubBtnActive,
                ]}
                onPress={() => setDebtType('borrow')}
              >
                <Banknote size={14} color={debtType === 'borrow' ? '#0D0E12' : '#A0A5B5'} />
                <AppText
                  style={[
                    styles.debtSubBtnText,
                    debtType === 'borrow' && styles.debtSubBtnTextActive,
                  ]}
                >
                  I BORROWED (I OWE)
                </AppText>
              </TouchableOpacity>
            </View>
          )}

          {/* QUICK-SELECT FREQUENT EXPENSES (Only shown when user has saved presets) */}
          {tabMode === 'expense' && quickPresets && quickPresets.length > 0 && (
            <View style={styles.presetSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetScroll}
              >
                {quickPresets.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    style={styles.presetChip}
                    activeOpacity={0.75}
                    onPress={() => handleApplyPreset(preset)}
                  >
                    <AppText style={styles.presetEmoji}>{preset.emoji || '⚡'}</AppText>
                    <View>
                      <AppText style={styles.presetLabel} numberOfLines={1}>
                        {preset.label}
                      </AppText>
                      <AppText style={styles.presetAmt}>
                        {sym}{preset.amount.toLocaleString('en-IN')}
                      </AppText>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* INTERACTIVE TRANSFER HERO CARD (With Dropdowns & Arrow) */}
          {tabMode === 'transfer' && (
            <View style={styles.transferHeroCard}>
              <View style={styles.transferHeroHeader}>
                <AppText style={styles.transferHeroTitle}>ACCOUNT TRANSFER</AppText>
                <AppText style={styles.transferHeroSubtitle}>Tap an account to change</AppText>
              </View>

              <View style={styles.transferDropdownRow}>
                {/* FROM ACCOUNT */}
                <TouchableOpacity
                  style={styles.transferSelectBox}
                  activeOpacity={0.8}
                  onPress={() => setAccountPickerSide('from')}
                >
                  <AppText style={styles.transferBoxLabel}>FROM (DEBIT)</AppText>
                  <View style={styles.transferBoxContent}>
                    <View style={styles.transferBoxIconWrap}>
                      {getAccountIcon(fromAccObj?.name || '')}
                    </View>
                    <AppText style={styles.transferBoxAccountName} numberOfLines={1}>
                      {fromAccObj?.name.toUpperCase()}
                    </AppText>
                    <ChevronDown size={14} color="#A0A5B5" />
                  </View>
                </TouchableOpacity>

                {/* ARROW */}
                <View style={styles.transferArrowWrap}>
                  <ArrowRight size={20} color="#3B82F6" />
                </View>

                {/* TO ACCOUNT */}
                <TouchableOpacity
                  style={[
                    styles.transferSelectBox,
                    isCreditCardPayment && styles.creditCardSelectBox,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setAccountPickerSide('to')}
                >
                  <AppText style={styles.transferBoxLabel}>TO (CREDIT)</AppText>
                  <View style={styles.transferBoxContent}>
                    <View style={styles.transferBoxIconWrap}>
                      {getAccountIcon(toAccObj?.name || '')}
                    </View>
                    <AppText style={styles.transferBoxAccountName} numberOfLines={1}>
                      {toAccObj?.name.toUpperCase()}
                    </AppText>
                    <ChevronDown size={14} color="#A0A5B5" />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.transferHeroFooter}>
                <AppText style={styles.transferExplainText}>
                  {isCreditCardPayment
                    ? `💳 Pays credit card bill of ${toAccObj?.name}, reducing due balance without inflating monthly expense budget.`
                    : `💸 Moves funds from ${fromAccObj?.name} directly into ${toAccObj?.name}.`}
                </AppText>
              </View>
            </View>
          )}

          {/* HERO AMOUNT INPUT SECTION */}
          <View style={styles.heroAmountCard}>
            <AppText style={styles.heroAmountLabel}>
              {tabMode === 'expense' && isSplitEnabled
                ? 'TOTAL BILL AMOUNT'
                : tabMode === 'debt'
                ? debtType === 'lend' ? 'AMOUNT LENT' : 'AMOUNT BORROWED'
                : tabMode === 'income'
                ? 'INCOME AMOUNT'
                : 'AMOUNT'}
            </AppText>
            <View style={styles.heroAmountRow}>
              <AppText style={styles.heroCurrency}>{sym}</AppText>
              <TextInput
                style={styles.heroAmountInput}
                placeholder="0"
                placeholderTextColor="rgba(255, 255, 255, 0.25)"
                keyboardType="numeric"
                value={amount}
                onChangeText={handleAmountChange}
                autoFocus={false}
              />
            </View>
          </View>

          {/* DEBT PERSON INPUT */}
          {tabMode === 'debt' && (
            <View style={styles.section}>
              <AppText style={styles.label}>
                {debtType === 'lend' ? 'LENT TO (PERSON NAME)' : 'BORROWED FROM (PERSON NAME)'}
              </AppText>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Rahul Sharma, Sneha"
                placeholderTextColor="#555866"
                value={debtPerson}
                onChangeText={setDebtPerson}
              />
            </View>
          )}

          {/* MERCHANT / DESCRIPTION WITH AUTO-CATEGORIZATION */}
          {tabMode !== 'debt' && (
            <View style={styles.section}>
              <View style={styles.labelRowBetween}>
                <AppText style={styles.label}>
                  {tabMode === 'transfer' ? 'TRANSFER NOTE (OPTIONAL)' : 'MERCHANT / DESCRIPTION'}
                </AppText>
                {tabMode === 'expense' && (
                  <View style={styles.aiTagPill}>
                    <Sparkles size={11} color="#FF9D66" />
                    <AppText style={styles.aiTagPillText}>Auto-categorizes</AppText>
                  </View>
                )}
              </View>
              <TextInput
                style={styles.textInput}
                placeholder={
                  tabMode === 'transfer'
                    ? 'e.g. Credit Card Bill, Top-up'
                    : 'e.g. Starbucks, Uber, Blinkit, Rent'
                }
                placeholderTextColor="#555866"
                value={merchant}
                onChangeText={handleMerchantChange}
              />
            </View>
          )}

          {/* ── SIDE-BY-SIDE: CATEGORY & ACCOUNT DROPDOWNS (Apple Native Liquid UI 50% / 50%) ── */}
          {(tabMode === 'expense' || tabMode === 'income') ? (
            <View style={styles.sideBySideRow}>
              {/* Left Column: Category Dropdown */}
              <View style={styles.dropdownColumn}>
                <AppText style={styles.label}>CATEGORY</AppText>
                <NativeLiquidMenu
                  title="Category"
                  actions={categoryActions}
                  onSelect={(catId) => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedCategoryId(catId);
                  }}
                  style={{ width: '100%' }}
                >
                  <View style={styles.dropdownTrigger}>
                    <View style={styles.dropdownTriggerLeft}>
                      {selectedCatObj && (
                        <View
                          style={[
                            styles.dropdownIconCircle,
                            { backgroundColor: getCategoryBgColor(selectedCatObj.color, '25') },
                          ]}
                        >
                          <CategoryIcon
                            category={selectedCatObj}
                            size={14}
                            color={selectedCatObj.color}
                            strokeWidth={2}
                            fill
                          />
                        </View>
                      )}
                      <AppText style={styles.dropdownTriggerValue} numberOfLines={1}>
                        {selectedCatObj ? `${selectedCatObj.name.toUpperCase()}${selectedCatObj.emoji ? ` ${selectedCatObj.emoji}` : ''}` : 'Select'}
                      </AppText>
                    </View>
                    <ChevronDown size={15} color="#7E8394" />
                  </View>
                </NativeLiquidMenu>
              </View>

              {/* Right Column: Account Dropdown */}
              <View style={styles.dropdownColumn}>
                <AppText style={styles.label}>
                  {tabMode === 'income' ? 'RECEIVE IN' : 'PAID FROM'}
                </AppText>
                <NativeLiquidMenu
                  title={tabMode === 'income' ? 'Receive In' : 'Paid From'}
                  actions={accountActions}
                  onSelect={(accId) => {
                    if (accId === '__ADD_ACCOUNT__') {
                      setShowAddAccountModal(true);
                    } else {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedAccountId(accId);
                    }
                  }}
                  style={{ width: '100%' }}
                >
                  <View style={styles.dropdownTrigger}>
                    <View style={styles.dropdownTriggerLeft}>
                      {fromAccObj && (
                        <View style={styles.dropdownIconCircle}>
                          {getAccountIcon(fromAccObj.name)}
                        </View>
                      )}
                      <View style={{ flexShrink: 1 }}>
                        <AppText style={styles.dropdownTriggerValue} numberOfLines={1}>
                          {fromAccObj ? fromAccObj.name.toUpperCase() : 'Select'}
                        </AppText>
                        {fromAccObj && (
                          <AppText style={styles.dropdownTriggerSub} numberOfLines={1}>
                            {fromAccObj.statusType === 'due' ? `Due:${sym}${fromAccObj.dueAmount || 0}` : `Bal:${sym}${fromAccObj.balance}`}
                          </AppText>
                        )}
                      </View>
                    </View>
                    <ChevronDown size={15} color="#7E8394" />
                  </View>
                </NativeLiquidMenu>
              </View>
            </View>
          ) : tabMode === 'debt' ? (
            /* Full Width Dropdown for Debt Account */
            <View style={styles.section}>
              <AppText style={styles.label}>
                {debtType === 'borrow' ? 'RECEIVED IN ACCOUNT' : 'PAID FROM ACCOUNT'}
              </AppText>
              <NativeLiquidMenu
                title={debtType === 'borrow' ? 'Receive In' : 'Paid From'}
                actions={accountActions}
                onSelect={(accId) => {
                  if (accId === '__ADD_ACCOUNT__') {
                    setShowAddAccountModal(true);
                  } else {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedAccountId(accId);
                  }
                }}
                style={{ width: '100%' }}
              >
                <View style={styles.dropdownTrigger}>
                  <View style={styles.dropdownTriggerLeft}>
                    {fromAccObj && (
                      <View style={styles.dropdownIconCircle}>
                        {getAccountIcon(fromAccObj.name)}
                      </View>
                    )}
                    <View style={{ flexShrink: 1 }}>
                      <AppText style={styles.dropdownTriggerValue} numberOfLines={1}>
                        {fromAccObj ? fromAccObj.name.toUpperCase() : 'Select Account'}
                      </AppText>
                      {fromAccObj && (
                        <AppText style={styles.dropdownTriggerSub} numberOfLines={1}>
                          {fromAccObj.statusType === 'due' ? `Due: ${sym}${fromAccObj.dueAmount || 0}` : `Bal: ${sym}${fromAccObj.balance}`}
                        </AppText>
                      )}
                    </View>
                  </View>
                  <ChevronDown size={15} color="#7E8394" />
                </View>
              </NativeLiquidMenu>
            </View>
          ) : null}

          {/* PROMINENT TRANSACTION DATE CARD */}
          <TouchableOpacity
            style={styles.dateCard}
            activeOpacity={0.8}
            onPress={() => setShowTxDatePicker(true)}
          >
            <View style={styles.dateCardLeft}>
              <View style={styles.dateIconWrap}>
                <CalendarIcon size={18} color={expenseColors.accentPeach} />
              </View>
              <View>
                <AppText style={styles.dateCardSub}>TRANSACTION DATE</AppText>
                <AppText style={styles.dateCardMain}>
                  {format(txDate, 'EEEE, dd MMMM yyyy')}
                </AppText>
              </View>
            </View>
            <View style={styles.dateChangeBadge}>
              <AppText style={styles.dateChangeBadgeText}>Change</AppText>
            </View>
          </TouchableOpacity>

          {/* TRIP / EVENT TAG / FOLDER BUNDLE */}
          {tabMode !== 'transfer' && (
            <View style={styles.section}>
              <AppText style={styles.label}>TRIP / EVENT FOLDER (OPTIONAL)</AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagScrollRow}
              >
                {SUGGESTED_TAGS.map((tag) => {
                  const isSelected = selectedTag === tag;
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, isSelected && styles.tagChipActive]}
                      onPress={() => {
                        setSelectedTag(isSelected ? '' : tag);
                        setCustomTagInput('');
                      }}
                    >
                      <AppText style={[styles.tagChipText, isSelected && styles.tagChipTextActive]}>
                        {tag}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TextInput
                style={[styles.textInput, { marginTop: 8 }]}
                placeholder="Or type custom event/trip name..."
                placeholderTextColor="#555866"
                value={customTagInput}
                onChangeText={(text) => {
                  setCustomTagInput(text);
                  setSelectedTag('');
                }}
              />
            </View>
          )}

          {/* NOTES (OPTIONAL) */}
          <View style={styles.section}>
            <AppText style={styles.label}>EXTRA NOTES (OPTIONAL)</AppText>
            <TextInput
              style={styles.textInput}
              placeholder="Add details..."
              placeholderTextColor="#555866"
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* SUBSCRIPTION TOGGLE (For Expense Mode) */}
          {tabMode === 'expense' && (
            <View style={styles.subscriptionCard}>
              <View style={styles.subHeaderRow}>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.subTitle}>RECURRING SUBSCRIPTION</AppText>
                  <AppText style={styles.subSubtitle}>
                    Auto-track renewal dates & cost
                  </AppText>
                </View>
                <Switch
                  value={isSubscription}
                  onValueChange={setIsSubscription}
                  trackColor={{
                    false: '#2B2E3D',
                    true: expenseColors.accentPeach,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {isSubscription && (
                <View style={styles.subFieldsStack}>
                  <View style={styles.subFieldRow}>
                    <AppText style={styles.subFieldLabel}>BILLING CYCLE</AppText>
                    <View style={styles.cycleSegment}>
                      <TouchableOpacity
                        style={[
                          styles.cycleBtn,
                          billingCycle === 'monthly' && styles.cycleBtnActive,
                        ]}
                        onPress={() => {
                          setBillingCycle('monthly');
                          const d = new Date(txDate);
                          d.setMonth(d.getMonth() + 1);
                          setNextBillDate(d);
                        }}
                      >
                        <AppText
                          style={[
                            styles.cycleBtnText,
                            billingCycle === 'monthly' && styles.cycleBtnTextActive,
                          ]}
                        >
                          Monthly
                        </AppText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.cycleBtn,
                          billingCycle === 'yearly' && styles.cycleBtnActive,
                        ]}
                        onPress={() => {
                          setBillingCycle('yearly');
                          const d = new Date(txDate);
                          d.setFullYear(d.getFullYear() + 1);
                          setNextBillDate(d);
                        }}
                      >
                        <AppText
                          style={[
                            styles.cycleBtnText,
                            billingCycle === 'yearly' && styles.cycleBtnTextActive,
                          ]}
                        >
                          Yearly
                        </AppText>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.subFieldRow}>
                    <AppText style={styles.subFieldLabel}>NEXT BILL DATE</AppText>
                    <TouchableOpacity
                      style={styles.nextDateBtn}
                      onPress={() => setShowNextBillDatePicker(true)}
                    >
                      <CalendarIcon size={14} color="#A0A5B5" />
                      <AppText style={styles.nextDateBtnText}>
                        {format(nextBillDate, 'dd MMM yyyy')}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Bottom Action Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: modeThemeColor }]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <AppText style={styles.saveBtnText}>
              {tabMode === 'expense'
                ? 'Save Expense'
                : tabMode === 'income'
                ? 'Save Income'
                : tabMode === 'transfer'
                ? 'Execute Transfer'
                : 'Record Debt'}
            </AppText>
          </TouchableOpacity>
        </ScrollView>

        {/* CREATE QUICK PRESET MODAL */}
        <Modal
          visible={showAddPresetModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddPresetModal(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowAddPresetModal(false)}
          >
            <View style={styles.presetModalCard} onStartShouldSetResponder={() => true}>
              <View style={styles.presetModalHeader}>
                <AppText style={styles.presetModalTitle}>NEW QUICK PRESET</AppText>
                <TouchableOpacity onPress={() => setShowAddPresetModal(false)}>
                  <X size={18} color="#A0A5B5" />
                </TouchableOpacity>
              </View>

              <AppText style={styles.modalFieldLabel}>PRESET LABEL</AppText>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Cigarette Pack, Metro, Chai"
                placeholderTextColor="#555866"
                value={newPresetLabel}
                onChangeText={setNewPresetLabel}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.modalFieldLabel}>EMOJI</AppText>
                  <TextInput
                    style={styles.textInput}
                    placeholder="🚬"
                    placeholderTextColor="#555866"
                    value={newPresetEmoji}
                    onChangeText={setNewPresetEmoji}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <AppText style={styles.modalFieldLabel}>AMOUNT ({sym})</AppText>
                  <TextInput
                    style={styles.textInput}
                    placeholder="122"
                    placeholderTextColor="#555866"
                    keyboardType="numeric"
                    value={newPresetAmount}
                    onChangeText={setNewPresetAmount}
                  />
                </View>
              </View>

              <AppText style={[styles.modalFieldLabel, { marginTop: 12 }]}>CATEGORY</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginVertical: 6 }}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setNewPresetCatId(c.id)}
                    style={[
                      styles.modalCatChip,
                      newPresetCatId === c.id && { borderColor: c.color, backgroundColor: `${c.color}25` },
                    ]}
                  >
                    <AppText style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                      {c.name} {c.emoji || ''}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.presetModalSaveBtn}
                activeOpacity={0.8}
                onPress={handleCreatePreset}
              >
                <AppText style={styles.presetModalSaveBtnText}>Save Quick Preset</AppText>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ACCOUNT PICKER DROPDOWN MODAL FOR TRANSFER */}
        {accountPickerSide !== null && (
          <Modal
            transparent
            visible={true}
            animationType="fade"
            onRequestClose={() => setAccountPickerSide(null)}
          >
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setAccountPickerSide(null)}
            >
              <View style={styles.pickerModalContent} onStartShouldSetResponder={() => true}>
                <View style={styles.pickerModalHeader}>
                  <AppText style={styles.pickerModalTitle}>
                    {accountPickerSide === 'from' ? 'SELECT DEBIT ACCOUNT (FROM)' : 'SELECT CREDIT ACCOUNT (TO)'}
                  </AppText>
                  <TouchableOpacity onPress={() => setAccountPickerSide(null)}>
                    <X size={18} color="#A0A5B5" />
                  </TouchableOpacity>
                </View>

                <View style={styles.pickerAccountList}>
                  {accounts.map((acc) => {
                    const isOpposite = accountPickerSide === 'from'
                      ? toAccountId === acc.id
                      : selectedAccountId === acc.id;
                    const isCurrent = accountPickerSide === 'from'
                      ? selectedAccountId === acc.id
                      : toAccountId === acc.id;

                    return (
                      <TouchableOpacity
                        key={acc.id}
                        disabled={isOpposite}
                        style={[
                          styles.pickerAccountItem,
                          isCurrent && styles.pickerAccountItemCurrent,
                          isOpposite && styles.pickerAccountItemDisabled,
                        ]}
                        onPress={() => {
                          if (accountPickerSide === 'from') {
                            setSelectedAccountId(acc.id);
                          } else {
                            setToAccountId(acc.id);
                          }
                          setAccountPickerSide(null);
                        }}
                      >
                        <View style={styles.pickerAccountLeft}>
                          <View style={[styles.pickerIconCircle, isCurrent && { backgroundColor: '#3B82F6' }]}>
                            {getAccountIcon(acc.name)}
                          </View>
                          <View>
                            <AppText style={[styles.pickerAccountName, isOpposite && { color: '#555866' }]}>
                              {acc.name.toUpperCase()}
                            </AppText>
                            <AppText style={styles.pickerAccountType}>
                              {acc.statusType === 'due' ? `Due: ${sym}${acc.dueAmount || 0}` : `Bal: ${sym}${acc.balance}`}
                            </AppText>
                          </View>
                        </View>

                        {isCurrent && <Check size={18} color="#3B82F6" />}
                        {isOpposite && (
                          <AppText style={styles.pickerOppositeNotice}>
                            Already {accountPickerSide === 'from' ? 'To' : 'From'}
                          </AppText>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Transaction Date Picker Modal */}
        <DatePickerModal
          visible={showTxDatePicker}
          selectedDate={txDate}
          onSelectDate={setTxDate}
          onClose={() => setShowTxDatePicker(false)}
          title="Transaction Date"
        />

        {/* Next Bill Date Picker Modal */}
        <DatePickerModal
          visible={showNextBillDatePicker}
          selectedDate={nextBillDate}
          onSelectDate={setNextBillDate}
          onClose={() => setShowNextBillDatePicker(false)}
          title="Next Billing Date"
        />

        {/* Embedded Add Account Modal */}
        <EditAccountModal
          visible={showAddAccountModal}
          account={null}
          onClose={() => setShowAddAccountModal(false)}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101114',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerDoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerDoneText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },

  // ── Mode Switcher Segment ──
  typeSegment: {
    flexDirection: 'row',
    backgroundColor: '#1A1C24',
    borderRadius: 16,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  typeBtnActive: {
    backgroundColor: '#FF9D66',
  },
  typeBtnText: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  typeBtnTextActive: {
    color: '#101114',
    fontWeight: '800',
  },

  // ── Debt Subsegment ──
  debtSegment: {
    flexDirection: 'row',
    backgroundColor: '#1A1C24',
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  debtSubBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  debtSubBtnActive: {
    backgroundColor: '#FF9D66',
  },
  debtSubBtnText: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '700',
  },
  debtSubBtnTextActive: {
    color: '#101114',
    fontWeight: '800',
  },

  // ── Quick Log Presets Bar ──
  presetSection: {
    backgroundColor: '#1A1C24',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.15)',
  },
  presetScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#232633',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetEmoji: {
    fontSize: 18,
  },
  presetLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  presetAmt: {
    color: '#FF9D66',
    fontSize: 11,
    fontWeight: '800',
  },

  // ── Hero Amount Card ──
  heroAmountCard: {
    backgroundColor: '#1A1C24',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  heroAmountLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  heroCurrency: {
    color: '#FF9D66',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    marginRight: 4,
  },
  heroAmountInput: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '800',
    minWidth: 80,
    textAlign: 'left',
    paddingVertical: 0,
  },

  // ── Transfer Hero Card ──
  transferHeroCard: {
    backgroundColor: '#1A1C24',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
    gap: 12,
  },
  transferHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transferHeroTitle: {
    color: '#FF9D66',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  transferHeroSubtitle: {
    color: '#7E8394',
    fontSize: 11,
  },
  transferDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  transferSelectBox: {
    flex: 1,
    backgroundColor: '#232633',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  creditCardSelectBox: {
    borderColor: 'rgba(231, 76, 60, 0.4)',
  },
  transferBoxLabel: {
    color: '#7E8394',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  transferBoxContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transferBoxIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  transferBoxAccountName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  transferArrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferHeroFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
  },
  transferExplainText: {
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 16,
  },

  // ── Sections & Inputs ──
  section: {
    gap: 8,
  },
  label: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  labelRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiTagPillText: {
    color: '#FF9D66',
    fontSize: 10,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#1A1C24',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },

  // ── Native Side-by-Side Dropdown Controls (Apple Liquid UI) ──
  sideBySideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dropdownColumn: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161822',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    height: 54,
    minHeight: 54,
  },
  dropdownTriggerActive: {
    borderColor: '#FF9D66',
    backgroundColor: '#1C1F2D',
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  dropdownIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownTriggerValue: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dropdownTriggerSub: {
    color: '#7E8394',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 1,
  },
  noAccountWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#211816',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  noAccountWarningTitle: {
    color: '#FF9D66',
    fontSize: 12,
    fontWeight: '800',
  },
  noAccountWarningSub: {
    color: '#A0A5B5',
    fontSize: 11,
    lineHeight: 15,
  },
  addAccountWarningBtn: {
    backgroundColor: '#FF9D66',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addAccountWarningBtnText: {
    color: '#101114',
    fontSize: 11,
    fontWeight: '800',
  },

  // ── Prominent Date Card ──
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1C24',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCardSub: {
    color: '#7E8394',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dateCardMain: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  dateChangeBadge: {
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
  },
  dateChangeBadgeText: {
    color: '#FF9D66',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Split Bill Card ──
  splitToggleCard: {
    backgroundColor: '#1A1C24',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  splitToggleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  splitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitToggleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  splitToggleSubtitle: {
    color: '#7E8394',
    fontSize: 11,
  },
  splitExpandedContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  splitCol: {
    flex: 1,
  },
  splitSubLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  splitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232633',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  splitCurrency: {
    color: '#FF9D66',
    fontSize: 14,
    fontWeight: '800',
    marginRight: 4,
  },
  splitInput: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  splitFixedRow: {
    backgroundColor: '#232633',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  splitFriendsAmount: {
    color: '#2ECC71',
    fontSize: 14,
    fontWeight: '800',
  },

  // ── Date & Tags ──
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1C24',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tagScrollRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#1A1C24',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  tagChipActive: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    borderColor: '#FF9D66',
  },
  tagChipText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '600',
  },
  tagChipTextActive: {
    color: '#FF9D66',
    fontWeight: '800',
  },

  // ── Subscription ──
  subscriptionCard: {
    backgroundColor: '#1A1C24',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  subSubtitle: {
    color: '#7E8394',
    fontSize: 11,
  },
  subFieldsStack: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
    gap: 12,
  },
  subFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subFieldLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
  },
  cycleSegment: {
    flexDirection: 'row',
    backgroundColor: '#232633',
    borderRadius: 10,
    padding: 2,
  },
  cycleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cycleBtnActive: {
    backgroundColor: '#FF9D66',
  },
  cycleBtnText: {
    color: '#7E8394',
    fontSize: 11,
    fontWeight: '700',
  },
  cycleBtnTextActive: {
    color: '#101114',
    fontWeight: '800',
  },
  nextDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#232633',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  nextDateBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Save Button ──
  saveBtn: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveBtnText: {
    color: '#101114',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // ── Modals & Sheets ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  presetModalCard: {
    width: '100%',
    backgroundColor: '#1A1C24',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  presetModalTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalFieldLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  modalCatChip: {
    backgroundColor: '#232633',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetModalSaveBtn: {
    backgroundColor: '#FF9D66',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  presetModalSaveBtnText: {
    color: '#101114',
    fontSize: 13,
    fontWeight: '800',
  },

  pickerModalContent: {
    width: '100%',
    backgroundColor: '#1A1C24',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pickerModalTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  pickerAccountList: {
    gap: 8,
  },
  pickerAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#232633',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  pickerAccountItemCurrent: {
    borderColor: '#3B82F6',
  },
  pickerAccountItemDisabled: {
    opacity: 0.4,
  },
  pickerAccountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAccountName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  pickerAccountType: {
    color: '#7E8394',
    fontSize: 11,
  },
  pickerOppositeNotice: {
    color: '#7E8394',
    fontSize: 10,
    fontStyle: 'italic',
  },
});
