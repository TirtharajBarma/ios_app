import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Keyboard,
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
  Briefcase,
  Laptop,
  TrendingUp,
  Gift,
  Home,
  RefreshCw,
  Coins,
  Shield,
  PiggyBank,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MenuAction } from '@expo/ui/community/menu';
import { AppText, NativeLiquidMenu } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import * as db from '@/database/database';
import { expenseColors } from '@/constants/expenseColors';
import { CategoryIcon, getCategoryBgColor } from './CategoryIcon';
import { DatePickerModal } from './DatePickerModal';
import { EditAccountModal } from './EditAccountModal';
import { format } from 'date-fns';
import { ExpenseAccount, ExpenseCategory, ExpenseTransaction, QuickExpensePreset, SavingsVault } from '@/types/expense';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
  initialTransaction?: ExpenseTransaction | null;
}

type TabMode = 'expense' | 'income' | 'transfer' | 'debt';
type DebtType = 'lend' | 'borrow';
type BillingCycle = 'monthly' | 'yearly';

const SUGGESTED_TAGS = ['🌴 Goa Trip', '🎉 Night Out', '💍 Wedding', '☕ Work Lunch', '🚗 Road Trip'];

export const INCOME_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat_salary', name: 'Salary', emoji: '💼', color: '#8CD9C8', iconName: 'Briefcase' },
  { id: 'cat_freelance', name: 'Freelance', emoji: '💻', color: '#9DC6EB', iconName: 'Laptop' },
  { id: 'cat_invest', name: 'Investments', emoji: '📈', color: '#F4CD89', iconName: 'TrendingUp' },
  { id: 'cat_bonus', name: 'Bonus', emoji: '🎁', color: '#F2AEC4', iconName: 'Gift' },
  { id: 'cat_rental', name: 'Rental', emoji: '🏠', color: '#C4A7E7', iconName: 'Home' },
  { id: 'cat_refund', name: 'Refund', emoji: '🔄', color: '#82D0D8', iconName: 'RefreshCw' },
  { id: 'cat_other_inc', name: 'Other Income', emoji: '💰', color: '#A8B8E8', iconName: 'Coins' },
];

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
  movie: 'cat_ent',
  cinema: 'cat_ent',
  pvr: 'cat_ent',
  inox: 'cat_ent',
  game: 'cat_ent',
  steam: 'cat_ent',
  playstation: 'cat_ent',

  // Subscriptions & Streaming
  netflix: 'cat_subs',
  spotify: 'cat_subs',
  prime: 'cat_subs',
  hotstar: 'cat_subs',
  youtube: 'cat_subs',
  apple: 'cat_subs',
  icloud: 'cat_subs',
  google: 'cat_subs',
  github: 'cat_subs',
  openai: 'cat_subs',
  chatgpt: 'cat_subs',

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
  initialTransaction,
}) => {
  const {
    categories,
    accounts,
    savingsVaults,
    eventFolders,
    addEventFolder,
    addTransaction,
    updateTransaction,
    depositToVault,
    addSavingsVault,
    currencySymbol,
    quickPresets,
    addQuickPreset,
    deleteQuickPreset,
    transactions,
    learnedMerchantRules,
    saveLearnedMerchantRule,
  } = useExpenseStore();
  const sym = currencySymbol || '₹';
  const { subscriptions, addSubscription, updateSubscription } = useSubscriptionStore();

  const [tabMode, setTabMode] = useState<TabMode>('expense');
  const [debtType, setDebtType] = useState<DebtType>('lend');
  const [amount, setAmount] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [goalAllocationAmount, setGoalAllocationAmount] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>(
    accounts[1]?.id || accounts[0]?.id || 'acc_slice'
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [txDate, setTxDate] = useState<Date>(new Date());
  const [note, setNote] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [customTagInput, setCustomTagInput] = useState<string>('');

  // Multi-Friend Split in Expense Mode
  const [isSplitEnabled, setIsSplitEnabled] = useState<boolean>(false);
  const [yourShare, setYourShare] = useState<string>('');
  const [splitFriends, setSplitFriends] = useState<Array<{ id: string; name: string; amount: string }>>([
    { id: 'f_1', name: '', amount: '' },
  ]);

  // Debt Person Name
  const [debtPerson, setDebtPerson] = useState<string>('');

  // Subscription toggle & fields
  const [isSubscription, setIsSubscription] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [nextBillDate, setNextBillDate] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  });

  // Goal creation sheet & multi-goal allocation
  const [goalAllocations, setGoalAllocations] = useState<Record<string, string>>({});
  const [showNewGoalSheet, setShowNewGoalSheet] = useState<boolean>(false);
  const [inlineGoalName, setInlineGoalName] = useState<string>('');
  const [inlineGoalTarget, setInlineGoalTarget] = useState<string>('');
  const [inlineGoalEmoji, setInlineGoalEmoji] = useState<string>('🛡️');
  const [inlineGoalColor, setInlineGoalColor] = useState<string>('#8CD9C8');

  // Event Folder creation sheet
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFolderEmoji, setNewFolderEmoji] = useState<string>('🌴');

  // Quick Preset creation modal
  const [showAddPresetModal, setShowAddPresetModal] = useState<boolean>(false);
  const [newPresetLabel, setNewPresetLabel] = useState<string>('');
  const [newPresetEmoji, setNewPresetEmoji] = useState<string>('⚡');
  const [newPresetAmount, setNewPresetAmount] = useState<string>('');
  const [newPresetCatId, setNewPresetCatId] = useState<string>(categories[0]?.id || 'cat_shop');

  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);

  // Date Pickers
  const [showTxDatePicker, setShowTxDatePicker] = useState<boolean>(false);
  const [showNextBillDatePicker, setShowNextBillDatePicker] = useState<boolean>(false);

  // Reset or populate fields whenever the modal is opened / initialTransaction changes
  useEffect(() => {
    if (visible) {
      if (initialTransaction) {
        const tx = initialTransaction;
        if (tx.type === 'income') {
          setTabMode('income');
        } else if (tx.type === 'transfer') {
          setTabMode('transfer');
        } else if (tx.type === 'debt_lend') {
          setTabMode('debt');
          setDebtType('lend');
        } else if (tx.type === 'debt_borrow') {
          setTabMode('debt');
          setDebtType('borrow');
        } else {
          setTabMode('expense');
        }

        const isIncomeTx = tx.type === 'income';
        setAmount(tx.amount.toString());
        setMerchant(tx.note || '');
        setSelectedAccountId(tx.accountId || '');
        setToAccountId(tx.toAccountId || accounts[1]?.id || accounts[0]?.id || 'acc_slice');
        setSelectedCategoryId(
          tx.categoryId && (isIncomeTx ? INCOME_CATEGORIES.some((c) => c.id === tx.categoryId) : categories.some((c) => c.id === tx.categoryId))
            ? tx.categoryId
            : isIncomeTx
            ? 'cat_salary'
            : ''
        );
        setSelectedFolderId(tx.folderId || '');
        setSelectedTag(tx.tag || '');
        setCustomTagInput('');
        setDebtPerson(tx.borrowerOrLender || '');

        if (tx.date) {
          const parsed = new Date(tx.date);
          setTxDate(isNaN(parsed.getTime()) ? new Date() : parsed);
        } else {
          setTxDate(new Date());
        }

        if (tx.split) {
          setIsSplitEnabled(true);
          setYourShare(tx.split.yourShare.toString());
          if (tx.split.friends && tx.split.friends.length > 0) {
            setSplitFriends(tx.split.friends.map(f => ({ id: f.id, name: f.name, amount: f.amount.toString() })));
          } else {
            setSplitFriends([{ id: `f_${Date.now()}`, name: tx.split.friendNames || '', amount: tx.split.friendsShare.toString() }]);
          }
        } else {
          setIsSplitEnabled(false);
          setYourShare('');
          setSplitFriends([{ id: `f_${Date.now()}`, name: '', amount: '' }]);
        }

        if (tx.subscriptionId || tx.categoryId === 'cat_subs') {
          setIsSubscription(true);
        } else {
          setIsSubscription(false);
        }
      } else {
        setTabMode('expense');
        setDebtType('lend');
        setAmount('');
        setMerchant('');
        setSelectedAccountId('');
        setSelectedGoalId('');
        setGoalAllocationAmount('');
        setGoalAllocations({});
        setSelectedFolderId('');
        setSelectedCategoryId('');
        setTxDate(new Date());
        setToAccountId(accounts[1]?.id || accounts[0]?.id || 'acc_slice');
        setBillingCycle('monthly');
        const nextBill = new Date();
        nextBill.setMonth(nextBill.getMonth() + 1);
        setNextBillDate(nextBill);
        setNote('');
        setSelectedTag('');
        setCustomTagInput('');
        setIsSplitEnabled(false);
        setYourShare('');
        setSplitFriends([{ id: `f_${Date.now()}`, name: '', amount: '' }]);
        setDebtPerson('');
        setIsSubscription(false);
      }
    }
  }, [visible, initialTransaction]);

  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  const handleInputFocus = (offset: number) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: offset, animated: true });
    }, 120);
  };

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Auto-calculate friend share
  const numAmount = parseFloat(amount) || 0;
  const numYourShare = parseFloat(yourShare) || (numAmount > 0 ? Math.round(numAmount / 2) : 0);
  const totalFriendsEntered = splitFriends.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
  const friendsShare = totalFriendsEntered > 0 ? totalFriendsEntered : Math.max(0, numAmount - numYourShare);

  const handleAmountChange = (text: string) => {
    setAmount(text);
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed > 0 && isSplitEnabled && !yourShare) {
      setYourShare(Math.round(parsed / 2).toString());
    }
  };

  const handleSplitRemainingEqually = () => {
    if (numAmount <= 0) return;
    const remainingForFriends = Math.max(0, numAmount - (parseFloat(yourShare) || 0));
    const activeFriends = splitFriends.length;
    if (activeFriends === 0) return;
    const perFriend = (remainingForFriends / activeFriends).toFixed(0);
    setSplitFriends(splitFriends.map((f) => ({ ...f, amount: perFriend })));
    Haptics.selectionAsync().catch(() => {});
  };

  const handleAddSplitFriend = () => {
    setSplitFriends([...splitFriends, { id: `f_${Date.now()}_${Math.random().toString(36).substr(2, 3)}`, name: '', amount: '' }]);
    Haptics.selectionAsync().catch(() => {});
  };

  const handleRemoveSplitFriend = (id: string) => {
    if (splitFriends.length <= 1) return;
    setSplitFriends(splitFriends.filter((f) => f.id !== id));
    Haptics.selectionAsync().catch(() => {});
  };

  // Dynamic Historical Amount Chips: based on typed merchant or selected category
  const frequentAmounts = useMemo(() => {
    if (tabMode !== 'expense' && tabMode !== 'income') return [];
    const cleanMerchant = merchant.trim().toLowerCase();

    // 1. If merchant is typed (>= 2 chars), search past transactions matching this merchant
    if (cleanMerchant.length >= 2) {
      const matchingTxs = transactions.filter(
        (t) => t.type === tabMode && (t.note || '').toLowerCase().includes(cleanMerchant) && t.amount > 0
      );
      if (matchingTxs.length > 0) {
        const freqMap: Record<number, number> = {};
        matchingTxs.forEach((t) => {
          const val = Math.round(t.amount);
          freqMap[val] = (freqMap[val] || 0) + 1;
        });
        return Object.entries(freqMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([amt]) => Number(amt));
      }
    }

    // 2. If category is selected, find top amounts in this category
    if (selectedCategoryId) {
      const matchingCatTxs = transactions.filter(
        (t) => t.type === tabMode && t.categoryId === selectedCategoryId && t.amount > 0
      );
      if (matchingCatTxs.length >= 2) {
        const freqMap: Record<number, number> = {};
        matchingCatTxs.forEach((t) => {
          const val = Math.round(t.amount);
          freqMap[val] = (freqMap[val] || 0) + 1;
        });
        return Object.entries(freqMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([amt]) => Number(amt));
      }
    }

    return [];
  }, [transactions, tabMode, merchant, selectedCategoryId]);

  const handleMerchantChange = (text: string) => {
    setMerchant(text);
    if (tabMode === 'expense') {
      const lower = text.toLowerCase().trim();
      if (!lower) return;

      // 1. Check learned merchant rules from store
      if (learnedMerchantRules && learnedMerchantRules[lower]) {
        const learnedCatId = learnedMerchantRules[lower];
        if (categories.some((c) => c.id === learnedCatId)) {
          setSelectedCategoryId(learnedCatId);
          return;
        }
      }

      // 2. Check predefined vendor map
      for (const [key, catId] of Object.entries(VENDOR_CATEGORY_MAP)) {
        if (lower.includes(key)) {
          if (categories.some((c) => c.id === catId)) {
            setSelectedCategoryId(catId);
            if (catId === 'cat_subs') {
              setIsSubscription(true);
            }
            return;
          }
        }
      }

      // 3. Fuzzy search history in past transactions
      if (lower.length >= 3) {
        const pastMatch = transactions.find(
          (t) => t.type === 'expense' && (t.note || '').toLowerCase().includes(lower) && t.categoryId
        );
        if (pastMatch && pastMatch.categoryId && categories.some((c) => c.id === pastMatch.categoryId)) {
          setSelectedCategoryId(pastMatch.categoryId);
          if (pastMatch.accountId && accounts.some((a) => a.id === pastMatch.accountId) && !selectedAccountId) {
            setSelectedAccountId(pastMatch.accountId);
          }
        }
      }
    }
  };

  const handleApplyPreset = (preset: QuickExpensePreset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setAmount(preset.amount.toString());
    setSelectedCategoryId(preset.categoryId);
    if (preset.categoryId === 'cat_subs') {
      setIsSubscription(true);
    }
    if (preset.accountId && accounts.some((a) => a.id === preset.accountId)) {
      setSelectedAccountId(preset.accountId);
    }
    setMerchant(preset.note || preset.label);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      Alert.alert('Invalid Name', 'Please enter a folder name.');
      return;
    }
    const created = addEventFolder({
      name: newFolderName.trim(),
      emoji: newFolderEmoji || '📁',
    });
    setSelectedFolderId(created.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setShowNewFolderModal(false);
    setNewFolderName('');
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

  const handleSave = async () => {
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

    const selectedFolderObj = eventFolders.find((f) => f.id === selectedFolderId);
    const finalTag = selectedFolderObj?.name || (customTagInput.trim() ? customTagInput.trim() : selectedTag);
    const finalNote = merchant.trim() ? `${merchant.trim()}${note.trim() ? ` - ${note.trim()}` : ''}` : note.trim();

    if (tabMode === 'transfer') {
      if (initialTransaction) {
        updateTransaction(initialTransaction.id, {
          amount: numAmount,
          type: 'transfer',
          categoryId: 'cat_fin',
          accountId: selectedAccountId,
          toAccountId: toAccountId,
          date: format(txDate, 'yyyy-MM-dd'),
          note: finalNote || 'Account Transfer',
          tag: finalTag || undefined,
        });
      } else {
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
      }
    } else if (tabMode === 'debt') {
      if (initialTransaction) {
        updateTransaction(initialTransaction.id, {
          amount: numAmount,
          type: debtType === 'lend' ? 'debt_lend' : 'debt_borrow',
          categoryId: 'cat_fin',
          accountId: selectedAccountId,
          date: format(txDate, 'yyyy-MM-dd'),
          borrowerOrLender: debtPerson.trim() || undefined,
          note: finalNote || (debtType === 'lend' ? `Lent to ${debtPerson || 'Friend'}` : `Borrowed from ${debtPerson || 'Friend'}`),
          tag: finalTag || undefined,
        });
      } else {
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
      }
    } else if (tabMode === 'expense') {
      const isSubscriptionExpense =
        selectedCategoryId === 'cat_subs' ||
        selectedCatObj?.name?.toLowerCase().includes('subscript') ||
        isSubscription;

      let linkedSubscriptionId: string | undefined = initialTransaction?.subscriptionId;

      if (isSubscriptionExpense) {
        const trimmedName = merchant.trim() || selectedCatObj?.name || 'Subscription';
        const matchedSub = subscriptions.find(
          (s) => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );

        if (matchedSub) {
          linkedSubscriptionId = matchedSub.id;
          await updateSubscription(matchedSub.id, {
            price: numAmount,
            paymentMethod: fromAccObj?.name || matchedSub.paymentMethod,
            billingCycle: matchedSub.billingCycle || billingCycle,
            nextBillingDate: format(nextBillDate, 'yyyy-MM-dd'),
          }).catch(() => {});

          await db.createTransaction({
            id: `${matchedSub.id}-tx-${Date.now()}`,
            subscriptionId: matchedSub.id,
            amount: numAmount,
            currency: matchedSub.currency || 'INR',
            date: format(txDate, 'yyyy-MM-dd'),
          }).catch(() => {});
        } else if (!initialTransaction) {
          const cat = categories.find((c) => c.id === selectedCategoryId);
          const newSub = await addSubscription({
            name: trimmedName,
            price: numAmount,
            currency: 'INR' as any,
            billingCycle: billingCycle,
            category: (cat?.name as any) || 'Other',
            paymentMethod: fromAccObj?.name || 'Default',
            color: cat?.color || '#FF9D66',
            nextBillingDate: format(nextBillDate, 'yyyy-MM-dd'),
            reminderEnabled: false,
            reminderDays: 1,
            isTrial: false,
          });
          linkedSubscriptionId = newSub.id;

          await db.createTransaction({
            id: `${newSub.id}-tx-${Date.now()}`,
            subscriptionId: newSub.id,
            amount: numAmount,
            currency: 'INR',
            date: format(txDate, 'yyyy-MM-dd'),
          }).catch(() => {});
        }
      }

      if (isSplitEnabled) {
        const mappedFriends = splitFriends
          .filter((f) => f.name.trim() && (parseFloat(f.amount) || 0) > 0)
          .map((f) => ({
            id: f.id,
            name: f.name.trim(),
            amount: parseFloat(f.amount) || 0,
            settled: false,
          }));

        const friendNamesStr = mappedFriends.map((f) => f.name).join(', ') || 'Friends';
        const totalFriendsSum = mappedFriends.reduce((sum, f) => sum + f.amount, 0);

        const splitData = {
          totalPaid: numAmount,
          yourShare: numYourShare,
          friendsShare: totalFriendsSum > 0 ? totalFriendsSum : friendsShare,
          friendNames: friendNamesStr,
          friends: mappedFriends.length > 0 ? mappedFriends : undefined,
          settled: false,
        };

        if (initialTransaction) {
          updateTransaction(initialTransaction.id, {
            amount: numAmount,
            type: 'expense',
            categoryId: selectedCategoryId,
            accountId: selectedAccountId,
            folderId: selectedFolderId || undefined,
            folderName: selectedFolderObj?.name || undefined,
            date: format(txDate, 'yyyy-MM-dd'),
            note: finalNote || `Split with ${friendNamesStr}`,
            tag: finalTag || undefined,
            split: splitData,
            subscriptionId: linkedSubscriptionId,
          });
        } else {
          addTransaction({
            amount: numAmount,
            type: 'expense',
            categoryId: selectedCategoryId,
            accountId: selectedAccountId,
            folderId: selectedFolderId || undefined,
            folderName: selectedFolderObj?.name || undefined,
            date: format(txDate, 'yyyy-MM-dd'),
            note: finalNote || `Split with ${friendNamesStr}`,
            tag: finalTag || undefined,
            split: splitData,
            subscriptionId: linkedSubscriptionId,
          });
        }
      } else {
        if (initialTransaction) {
          updateTransaction(initialTransaction.id, {
            amount: numAmount,
            type: 'expense',
            categoryId: selectedCategoryId,
            accountId: selectedAccountId,
            folderId: selectedFolderId || undefined,
            folderName: selectedFolderObj?.name || undefined,
            date: format(txDate, 'yyyy-MM-dd'),
            note: finalNote || undefined,
            tag: finalTag || undefined,
            split: undefined,
            subscriptionId: linkedSubscriptionId,
          });
        } else {
          addTransaction({
            amount: numAmount,
            type: 'expense',
            categoryId: selectedCategoryId,
            accountId: selectedAccountId,
            folderId: selectedFolderId || undefined,
            folderName: selectedFolderObj?.name || undefined,
            date: format(txDate, 'yyyy-MM-dd'),
            note: finalNote || undefined,
            tag: finalTag || undefined,
            subscriptionId: linkedSubscriptionId,
          });
        }
      }
    } else if (tabMode === 'income') {
      const finalIncomeCatId =
        selectedCategoryId && INCOME_CATEGORIES.some((c) => c.id === selectedCategoryId)
          ? selectedCategoryId
          : 'cat_salary';

      const effectiveAccId = selectedAccountId || accounts[0]?.id || 'acc_primary';

      if (initialTransaction) {
        updateTransaction(initialTransaction.id, {
          amount: numAmount,
          type: 'income',
          categoryId: finalIncomeCatId,
          accountId: effectiveAccId,
          date: format(txDate, 'yyyy-MM-dd'),
          note: finalNote || 'Salary',
          tag: finalTag || undefined,
        });
      } else {
        addTransaction({
          amount: numAmount,
          type: 'income',
          categoryId: finalIncomeCatId,
          accountId: effectiveAccId,
          date: format(txDate, 'yyyy-MM-dd'),
          note: finalNote || 'Salary',
          tag: finalTag || undefined,
        });

        // 1. Process multi-goal split allocations
        const activeAllocations = Object.entries(goalAllocations).filter(([id, amtStr]) => {
          const amt = parseFloat(amtStr);
          return !isNaN(amt) && amt > 0 && savingsVaults.some((v) => v.id === id);
        });

        if (activeAllocations.length > 0) {
          activeAllocations.forEach(([vaultId, amtStr]) => {
            const allocAmt = parseFloat(amtStr);
            depositToVault(vaultId, Math.min(allocAmt, numAmount), effectiveAccId);
          });
        } else if (selectedGoalId) {
          const alloc = parseFloat(goalAllocationAmount) || numAmount;
          depositToVault(selectedGoalId, Math.min(alloc, numAmount), effectiveAccId);
        }
      }
    }

    if (merchant.trim() && selectedCategoryId && tabMode === 'expense' && saveLearnedMerchantRule) {
      saveLearnedMerchantRule(merchant.trim().toLowerCase(), selectedCategoryId);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  const activeCategories = tabMode === 'income' ? INCOME_CATEGORIES : categories;
  const selectedCatObj = activeCategories.find((c) => c.id === selectedCategoryId) || null;
  const fromAccObj = accounts.find((a) => a.id === selectedAccountId) || null;
  const toAccObj = accounts.find((a) => a.id === toAccountId) || accounts[1] || accounts[0];
  const isCreditCardPayment = toAccObj?.statusType === 'due' || toAccObj?.type === 'credit';

  // Keep primary root menu compact (<= 6 items) so iOS UIKit always presents the popover DOWNWARDS
  const topCategoryIds = ['cat_food', 'cat_shop', 'cat_trans', 'cat_cig', 'cat_subs', 'cat_util'];
  const primaryCategories = categories.filter((c) =>
    topCategoryIds.includes(c.id) || c.id === selectedCategoryId
  );
  const otherCategories = categories.filter((c) =>
    !primaryCategories.some((p) => p.id === c.id)
  );

  const categoryActions = tabMode === 'income'
    ? INCOME_CATEGORIES.map((cat) => ({
        id: cat.id,
        title: cat.name,
        image: (cat.id === 'cat_salary'
          ? 'briefcase.fill'
          : cat.id === 'cat_freelance'
          ? 'laptopcomputer'
          : cat.id === 'cat_invest'
          ? 'chart.line.uptrend.xyaxis'
          : cat.id === 'cat_bonus'
          ? 'gift.fill'
          : cat.id === 'cat_rental'
          ? 'house.fill'
          : 'banknote.fill') as any,
        state: (selectedCategoryId === cat.id ? 'on' : 'off') as 'on' | 'off',
      }))
    : [
        ...primaryCategories.map((cat) => ({
          id: cat.id,
          title: cat.name,
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
                  title: cat.name,
                  image: getCategorySfSymbol(cat.id, cat.name) as any,
                  state: (selectedCategoryId === cat.id ? 'on' : 'off') as 'on' | 'off',
                })),
              },
            ]
          : []),
      ];

  const accountActions: MenuAction[] = [
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

  const fromAccountActions: MenuAction[] = [
    ...accounts.map((acc) => ({
      id: acc.id,
      title: `${acc.name} (${acc.statusType === 'due' ? `Due: ${sym}${acc.dueAmount || 0}` : `Bal: ${sym}${acc.balance}`})`,
      image: getAccountSfSymbol(acc.name) as any,
      state: (selectedAccountId === acc.id ? 'on' : 'off') as 'on' | 'off',
      attributes: toAccountId === acc.id ? { disabled: true } : undefined,
    })),
    {
      id: '__ADD_ACCOUNT__',
      title: 'Add New Account...',
      image: 'plus.circle' as any,
    },
  ];

  const toAccountActions: MenuAction[] = [
    ...accounts.map((acc) => ({
      id: acc.id,
      title: `${acc.name} (${acc.statusType === 'due' ? `Due: ${sym}${acc.dueAmount || 0}` : `Bal: ${sym}${acc.balance}`})`,
      image: getAccountSfSymbol(acc.name) as any,
      state: (toAccountId === acc.id ? 'on' : 'off') as 'on' | 'off',
      attributes: selectedAccountId === acc.id ? { disabled: true } : undefined,
    })),
    {
      id: '__ADD_ACCOUNT__',
      title: 'Add New Account...',
      image: 'plus.circle' as any,
    },
  ];

  const sortedFolders = useMemo(
    () => [...(eventFolders || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [eventFolders]
  );
  const selectedFolderObj = eventFolders.find((f) => f.id === selectedFolderId);

  const folderActions: MenuAction[] = [
    { id: '', title: 'None (Regular Daily Expense)', image: 'folder' as any },
    ...sortedFolders.map((f) => ({
      id: f.id,
      title: `${f.emoji ? `${f.emoji} ` : ''}${f.name}`,
      image: 'folder.fill' as any,
      state: (selectedFolderId === f.id ? 'on' : 'off') as 'on' | 'off',
    })),
    { id: '__NEW_FOLDER__', title: '+ Create New Event Folder...', image: 'plus.circle.fill' as any },
  ];

  const goalActions: MenuAction[] = [
    { id: '', title: 'None (Keep 100% in Bank Account)', image: 'xmark.circle' as any },
    ...savingsVaults.map((vault) => ({
      id: vault.id,
      title: `${vault.emoji} ${vault.name} • Saved: ${sym}${vault.currentAmount.toLocaleString('en-IN')} / ${sym}${vault.targetAmount.toLocaleString('en-IN')}`,
      image: 'shield.fill' as any,
      state: (selectedGoalId === vault.id ? 'on' : 'off') as 'on' | 'off',
    })),
    { id: '__CREATE_GOAL__', title: '+ Create New Goal...', image: 'plus.circle.fill' as any },
  ];

  const modeThemeColor = expenseColors.accentPeach;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
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
          <AppText style={styles.headerTitle}>{initialTransaction ? 'Edit Transaction' : 'New Transaction'}</AppText>
          <TouchableOpacity onPress={handleSave} style={styles.headerDoneBtn} activeOpacity={0.7}>
            <AppText style={styles.headerDoneText}>{initialTransaction ? 'Update' : 'Save'}</AppText>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Platform.OS === 'ios' ? 60 : 30 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bounces={true}
          overScrollMode="never"
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
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setTabMode('income');
                if (!selectedCategoryId || !INCOME_CATEGORIES.some((c) => c.id === selectedCategoryId)) {
                  setSelectedCategoryId('cat_salary');
                }
              }}
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

          {/* INTERACTIVE TRANSFER HERO CARD (With Liquid Dropdowns & Arrow) */}
          {tabMode === 'transfer' && (
            <View style={styles.transferHeroCard}>
              <View style={styles.transferHeroHeader}>
                <AppText style={styles.transferHeroTitle}>ACCOUNT TRANSFER</AppText>
                <AppText style={styles.transferHeroSubtitle}>Select source and destination accounts</AppText>
              </View>

              <View style={styles.transferDropdownRow}>
                {/* FROM ACCOUNT */}
                <NativeLiquidMenu
                  title="Debit Account (From)"
                  actions={fromAccountActions}
                  onSelect={(accId) => {
                    if (accId === '__ADD_ACCOUNT__') {
                      setShowAddAccountModal(true);
                    } else {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedAccountId(accId);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  <View style={styles.transferSelectBox}>
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
                  </View>
                </NativeLiquidMenu>

                {/* ARROW */}
                <View style={styles.transferArrowWrap}>
                  <ArrowRight size={20} color="#9DC6EB" />
                </View>

                {/* TO ACCOUNT */}
                <NativeLiquidMenu
                  title="Credit Account (To)"
                  actions={toAccountActions}
                  onSelect={(accId) => {
                    if (accId === '__ADD_ACCOUNT__') {
                      setShowAddAccountModal(true);
                    } else {
                      Haptics.selectionAsync().catch(() => {});
                      setToAccountId(accId);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  <View
                    style={[
                      styles.transferSelectBox,
                      isCreditCardPayment && styles.creditCardSelectBox,
                    ]}
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
                  </View>
                </NativeLiquidMenu>
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
                onFocus={() => handleInputFocus(80)}
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
                onFocus={() => handleInputFocus(100)}
              />

              {/* Seamless Contextual Amount Suggestions */}
              {frequentAmounts.length > 0 && (
                <View style={styles.frequentAmountsWrapper}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.frequentAmountsScroll}
                  >
                    <AppText style={styles.frequentAmountsLabel}>Frequent:</AppText>
                    {frequentAmounts.map((amt) => {
                      const isSelected = amount === amt.toString();
                      return (
                        <TouchableOpacity
                          key={amt}
                          style={[
                            styles.frequentAmountChip,
                            isSelected && styles.frequentAmountChipSelected,
                          ]}
                          activeOpacity={0.75}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            handleAmountChange(amt.toString());
                          }}
                        >
                          <AppText
                            style={[
                              styles.frequentAmountChipText,
                              isSelected && styles.frequentAmountChipTextSelected,
                            ]}
                          >
                            {sym}{amt.toLocaleString('en-IN')}
                          </AppText>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
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
                    if (tabMode === 'expense') {
                      const isSubCat = catId === 'cat_subs' || (categories.find(c => c.id === catId)?.name?.toLowerCase().includes('subscript') ?? false);
                      setIsSubscription(isSubCat);
                    }
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
                        {selectedCatObj ? selectedCatObj.name.toUpperCase() : 'Select'}
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

          {/* ── EVENT / TRIP FOLDER SELECTOR (Only in Expense Mode, Hidden in Debt Mode) ── */}
          {tabMode === 'expense' && (
            <View style={styles.section}>
              <AppText style={styles.label}>EVENT / TRIP FOLDER (OPTIONAL)</AppText>
              <NativeLiquidMenu
                title="Event / Trip Folder"
                actions={folderActions}
                onSelect={(folderId) => {
                  if (folderId === '__NEW_FOLDER__') {
                    setShowNewFolderModal(true);
                  } else {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedFolderId(folderId);
                  }
                }}
                style={{ width: '100%' }}
              >
                <View style={styles.dropdownTrigger}>
                  <View style={styles.dropdownTriggerLeft}>
                    <AppText style={styles.dropdownTriggerValue} numberOfLines={1}>
                      {selectedFolderObj
                        ? `${selectedFolderObj.emoji ? `${selectedFolderObj.emoji} ` : ''}${selectedFolderObj.name}`
                        : 'None (Regular Daily Expense)'}
                    </AppText>
                  </View>
                  <ChevronDown size={15} color="#7E8394" />
                </View>
              </NativeLiquidMenu>
            </View>
          )}

          {/* ── MULTI-FRIEND SPLIT BILL (Expense Mode) ── */}
          {tabMode === 'expense' && (
            <View style={styles.splitBillContainer}>
              <View style={styles.splitToggleRow}>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.splitToggleTitle}>SPLIT WITH FRIENDS</AppText>
                  <AppText style={styles.splitToggleSubtitle}>
                    I paid full bill, record friends' shares
                  </AppText>
                </View>
                <Switch
                  value={isSplitEnabled}
                  onValueChange={(val) => {
                    setIsSplitEnabled(val);
                    if (val && !yourShare && numAmount > 0) {
                      setYourShare(Math.round(numAmount / 2).toString());
                    }
                  }}
                  trackColor={{ false: '#2B2E3D', true: expenseColors.accentPeach }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {isSplitEnabled && (
                <View style={styles.splitBody}>
                  {/* Your Share Row */}
                  <View style={styles.splitShareRow}>
                    <AppText style={styles.splitShareLabel}>MY SHARE ({sym})</AppText>
                    <TextInput
                      style={styles.splitShareInput}
                      placeholder="0"
                      placeholderTextColor="#555866"
                      keyboardType="numeric"
                      value={yourShare}
                      onChangeText={setYourShare}
                      onFocus={() => handleInputFocus(480)}
                    />
                  </View>

                  <View style={styles.splitFriendsHeader}>
                    <AppText style={styles.splitFriendsLabel}>FRIENDS BREAKDOWN</AppText>
                    <TouchableOpacity onPress={handleSplitRemainingEqually} style={styles.splitEquallyBtn}>
                      <Zap size={11} color="#FF9D66" />
                      <AppText style={styles.splitEquallyText}>Split Remaining Equally</AppText>
                    </TouchableOpacity>
                  </View>

                  {/* Friends List */}
                  {splitFriends.map((friend, idx) => (
                    <View key={friend.id} style={styles.splitFriendRow}>
                      <TextInput
                        style={styles.splitFriendNameInput}
                        placeholder={`Friend ${idx + 1} Name`}
                        placeholderTextColor="#555866"
                        value={friend.name}
                        onChangeText={(t) => {
                          setSplitFriends(splitFriends.map((f) => f.id === friend.id ? { ...f, name: t } : f));
                        }}
                        onFocus={() => handleInputFocus(550 + idx * 65)}
                      />
                      <View style={styles.splitFriendAmtWrap}>
                        <AppText style={styles.splitFriendAmtSym}>{sym}</AppText>
                        <TextInput
                          style={styles.splitFriendAmtInput}
                          placeholder="0"
                          placeholderTextColor="#555866"
                          keyboardType="numeric"
                          value={friend.amount}
                          onChangeText={(t) => {
                            setSplitFriends(splitFriends.map((f) => f.id === friend.id ? { ...f, amount: t } : f));
                          }}
                          onFocus={() => handleInputFocus(550 + idx * 65)}
                        />
                      </View>
                      {splitFriends.length > 1 && (
                        <TouchableOpacity
                          onPress={() => handleRemoveSplitFriend(friend.id)}
                          style={styles.splitFriendRemoveBtn}
                        >
                          <X size={14} color="#FF725E" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  {/* Add Friend Button */}
                  <TouchableOpacity
                    style={styles.addFriendRowBtn}
                    onPress={handleAddSplitFriend}
                    activeOpacity={0.7}
                  >
                    <Plus size={13} color="#FF9D66" strokeWidth={2.5} />
                    <AppText style={styles.addFriendRowBtnText}>Add Another Friend</AppText>
                  </TouchableOpacity>

                  {/* Split Summary Pill */}
                  <View style={styles.splitSummaryBox}>
                    <AppText style={styles.splitSummaryText}>
                      Total: {sym}{numAmount.toLocaleString('en-IN')}  •  My Share: {sym}{numYourShare.toLocaleString('en-IN')}  •  Friends: {sym}{friendsShare.toLocaleString('en-IN')}
                    </AppText>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ALLOCATE TO SAVINGS GOALS (For Income Mode - Pay Yourself First) */}
          {tabMode === 'income' && (
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <AppText style={styles.label}>SAVINGS GOALS</AppText>
                <TouchableOpacity
                  style={styles.inlineAddGoalBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setShowNewGoalSheet(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Plus size={12} color="#FF9D66" />
                  <AppText style={styles.inlineAddGoalBtnText}>New Goal</AppText>
                </TouchableOpacity>
              </View>

              {savingsVaults.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyGoalPromptCard}
                  onPress={() => setShowNewGoalSheet(true)}
                  activeOpacity={0.75}
                >
                  <Sparkles size={16} color="#FF9D66" />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.emptyGoalTitle}>Create your first Savings Goal</AppText>
                    <AppText style={styles.emptyGoalSub}>e.g. 🚨 Emergency Fund or ✈️ Travel Savings</AppText>
                  </View>
                  <Plus size={16} color="#FF9D66" />
                </TouchableOpacity>
              ) : (
                <View style={styles.goalAllocationsContainer}>
                  {savingsVaults.map((vault) => {
                    const isAllocated = goalAllocations[vault.id] !== undefined;
                    const allocatedVal = goalAllocations[vault.id] || '';

                    return (
                      <View key={vault.id} style={[styles.goalAllocCard, isAllocated && styles.goalAllocCardActive]}>
                        <TouchableOpacity
                          style={styles.goalAllocHeaderRow}
                          activeOpacity={0.7}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setGoalAllocations((prev) => {
                              const next = { ...prev };
                              if (next[vault.id] !== undefined) {
                                delete next[vault.id];
                              } else {
                                const suggested = numAmount > 0 ? Math.round(numAmount * 0.1).toString() : '1000';
                                next[vault.id] = suggested;
                                handleInputFocus(220);
                              }
                              return next;
                            });
                          }}
                        >
                          <View style={styles.goalAllocLeft}>
                            <View style={[styles.goalCheckbox, isAllocated && styles.goalCheckboxActive]}>
                              {isAllocated && <Check size={12} color="#0D0E12" strokeWidth={3} />}
                            </View>
                            <AppText style={styles.goalAllocEmoji}>{vault.emoji}</AppText>
                            <View>
                              <AppText style={styles.goalAllocName}>{vault.name}</AppText>
                              <AppText style={styles.goalAllocMeta}>
                                Saved: {sym}{vault.currentAmount.toLocaleString('en-IN')} / {sym}{vault.targetAmount.toLocaleString('en-IN')}
                              </AppText>
                            </View>
                          </View>
                          <AppText style={[styles.goalAllocStatus, isAllocated && { color: '#70D6BC' }]}>
                            {isAllocated ? 'Allocating' : 'Untouched'}
                          </AppText>
                        </TouchableOpacity>

                        {isAllocated && (
                          <View style={styles.goalAllocInputSection}>
                            <View style={styles.goalInputRow}>
                              <AppText style={styles.goalInputPrefix}>{sym}</AppText>
                              <TextInput
                                style={styles.goalAmountInput}
                                placeholder="0"
                                placeholderTextColor="#555866"
                                keyboardType="numeric"
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                                value={allocatedVal}
                                onFocus={() => {
                                  handleInputFocus(220);
                                }}
                                onChangeText={(t) => {
                                  setGoalAllocations((prev) => ({
                                    ...prev,
                                    [vault.id]: t,
                                  }));
                                }}
                              />
                            </View>
                            {/* Quick % chips */}
                            {numAmount > 0 && (
                              <View style={styles.goalQuickPercentRow}>
                                {[
                                  { label: '10%', val: Math.round(numAmount * 0.1) },
                                  { label: '20%', val: Math.round(numAmount * 0.2) },
                                  { label: '30%', val: Math.round(numAmount * 0.3) },
                                  { label: '50%', val: Math.round(numAmount * 0.5) },
                                ].map((chip) => (
                                  <TouchableOpacity
                                    key={chip.label}
                                    style={styles.goalQuickPercentChip}
                                    onPress={() => {
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                      setGoalAllocations((prev) => ({
                                        ...prev,
                                        [vault.id]: chip.val.toString(),
                                      }));
                                    }}
                                  >
                                    <AppText style={styles.goalQuickPercentText}>{chip.label}</AppText>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Multi-Goal Split Summary */}
                  {numAmount > 0 && (
                    <View style={styles.goalSplitSummaryBox}>
                      <View style={styles.goalSummaryLine}>
                        <AppText style={styles.goalSummaryLabel}>Total Goals Allocation:</AppText>
                        <AppText style={styles.goalSummaryValGreen}>
                          {sym}
                          {Object.entries(goalAllocations)
                            .reduce((sum, [, amtStr]) => sum + (parseFloat(amtStr) || 0), 0)
                            .toLocaleString('en-IN')}
                        </AppText>
                      </View>
                      <View style={styles.goalSummaryLine}>
                        <AppText style={styles.goalSummaryLabel}>Spendable Cash in Bank:</AppText>
                        <AppText style={styles.goalSummaryValWhite}>
                          {sym}
                          {Math.max(
                            0,
                            numAmount -
                              Object.entries(goalAllocations).reduce(
                                (sum, [, amtStr]) => sum + (parseFloat(amtStr) || 0),
                                0
                              )
                          ).toLocaleString('en-IN')}
                        </AppText>
                      </View>
                    </View>
                  )}
                </View>
              )}
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
              onFocus={() => handleInputFocus(180)}
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
                      {c.name}
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

        {/* Inline Create Goal Sheet Modal */}
        <Modal
          visible={showNewGoalSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNewGoalSheet(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'flex-end' }}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowNewGoalSheet(false)}
            />
            <View
              style={{
                backgroundColor: '#1A1D23',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 20,
                paddingBottom: Platform.OS === 'ios' ? 36 : 24,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  alignSelf: 'center',
                  marginBottom: 16,
                }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <AppText style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>
                  Create Savings Goal
                </AppText>
                <TouchableOpacity
                  onPress={() => setShowNewGoalSheet(false)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: '#202330',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={16} color="#A0A5B5" />
                </TouchableOpacity>
              </View>

              <View style={{ marginBottom: 14, gap: 6 }}>
                <AppText
                  style={{
                    color: '#7E8394',
                    fontSize: 11,
                    lineHeight: 15,
                    fontWeight: '700',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                  }}
                >
                  GOAL NAME
                </AppText>
                <TextInput
                  style={{
                    backgroundColor: '#202330',
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    height: 48,
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: '600',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                  placeholder="e.g. Emergency Fund, Goa Trip, MacBook"
                  placeholderTextColor="#555866"
                  value={inlineGoalName}
                  onChangeText={setInlineGoalName}
                />
              </View>

              <View style={{ marginBottom: 16, gap: 6 }}>
                <AppText
                  style={{
                    color: '#7E8394',
                    fontSize: 11,
                    lineHeight: 15,
                    fontWeight: '700',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                  }}
                >
                  TARGET AMOUNT ({sym})
                </AppText>
                <TextInput
                  style={{
                    backgroundColor: '#202330',
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    height: 48,
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: '600',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                  placeholder="e.g. 50000"
                  placeholderTextColor="#555866"
                  keyboardType="numeric"
                  value={inlineGoalTarget}
                  onChangeText={setInlineGoalTarget}
                />
              </View>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: '#FF9D66',
                  paddingVertical: 14,
                  borderRadius: 16,
                }}
                onPress={() => {
                  const target = parseFloat(inlineGoalTarget);
                  if (!inlineGoalName.trim() || isNaN(target) || target <= 0) {
                    Alert.alert('Invalid Goal', 'Please enter a goal name and target amount.');
                    return;
                  }
                  addSavingsVault({
                    name: inlineGoalName.trim(),
                    emoji: inlineGoalEmoji,
                    targetAmount: target,
                    color: inlineGoalColor,
                  });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  setShowNewGoalSheet(false);
                  setInlineGoalName('');
                  setInlineGoalTarget('');
                }}
                activeOpacity={0.85}
              >
                <Sparkles size={16} color="#0D0E12" />
                <AppText style={{ color: '#0D0E12', fontSize: 14, fontWeight: '800' }}>
                  Save Goal
                </AppText>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Inline Create Event Folder Sheet Modal */}
        <Modal
          visible={showNewFolderModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNewFolderModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'flex-end' }}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowNewFolderModal(false)}
            />
            <View
              style={{
                backgroundColor: '#1A1D23',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 20,
                paddingBottom: Platform.OS === 'ios' ? 36 : 24,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  alignSelf: 'center',
                  marginBottom: 16,
                }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <AppText style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>
                  Create Event / Trip Folder
                </AppText>
                <TouchableOpacity
                  onPress={() => setShowNewFolderModal(false)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: '#202330',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={16} color="#A0A5B5" />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <View style={{ width: 64 }}>
                  <AppText
                    style={{
                      color: '#656A7B',
                      fontSize: 10,
                      fontWeight: '800',
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    EMOJI
                  </AppText>
                  <TextInput
                    style={{
                      backgroundColor: '#101114',
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      color: '#FFFFFF',
                      fontSize: 18,
                      textAlign: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.06)',
                    }}
                    value={newFolderEmoji}
                    onChangeText={setNewFolderEmoji}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText
                    style={{
                      color: '#656A7B',
                      fontSize: 10,
                      fontWeight: '800',
                      letterSpacing: 1,
                      marginBottom: 6,
                    }}
                  >
                    FOLDER / TRIP NAME
                  </AppText>
                  <TextInput
                    style={{
                      backgroundColor: '#101114',
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      color: '#FFFFFF',
                      fontSize: 13,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.06)',
                    }}
                    placeholder="e.g. Goa Trip, Birthday Bash, Hackathon"
                    placeholderTextColor="#555866"
                    value={newFolderName}
                    onChangeText={setNewFolderName}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: '#FF9D66',
                  paddingVertical: 14,
                  borderRadius: 16,
                }}
                onPress={() => {
                  if (!newFolderName.trim()) {
                    Alert.alert('Invalid Folder', 'Please enter a folder name.');
                    return;
                  }
                  const folder = addEventFolder({ name: newFolderName.trim(), emoji: newFolderEmoji.trim() || '📁' });
                  setSelectedFolderId(folder.id);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                  setNewFolderEmoji('🌴');
                }}
                activeOpacity={0.85}
              >
                <Sparkles size={16} color="#0D0E12" />
                <AppText style={{ color: '#0D0E12', fontSize: 14, fontWeight: '800' }}>
                  Create & Select Folder
                </AppText>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#1A1D23',
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
    paddingVertical: 4,
    minHeight: 52,
  },
  heroCurrency: {
    color: '#FF9D66',
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    marginRight: 6,
    includeFontPadding: false,
    textAlignVertical: 'center',
    paddingTop: 2,
  },
  heroAmountInput: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '800',
    minWidth: 80,
    textAlign: 'left',
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  frequentAmountsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    width: '100%',
  },
  frequentAmountsLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 6,
  },
  frequentAmountsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  frequentAmountChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  frequentAmountChipSelected: {
    backgroundColor: 'rgba(255, 157, 102, 0.18)',
    borderColor: '#FF9D66',
  },
  frequentAmountChipText: {
    color: '#A0A5B5',
    fontSize: 11,
    fontWeight: '700',
  },
  frequentAmountChipTextSelected: {
    color: '#FF9D66',
    fontWeight: '800',
  },

  // ── Transfer Hero Card ──
  transferHeroCard: {
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#1A1D23',
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
  splitBillContainer: {
    backgroundColor: '#1A1D23',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  splitToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitToggleCard: {
    backgroundColor: '#1A1D23',
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
  splitBody: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
    gap: 12,
  },
  splitShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#232633',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  splitShareLabel: {
    color: '#FF9D66',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  splitShareInput: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    minWidth: 80,
    textAlign: 'right',
    paddingVertical: 0,
  },
  splitFriendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  splitFriendsLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  splitEquallyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  splitEquallyText: {
    color: '#FF9D66',
    fontSize: 10,
    fontWeight: '700',
  },
  splitFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  splitFriendNameInput: {
    flex: 1,
    backgroundColor: '#232633',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  splitFriendAmtWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232633',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: 100,
  },
  splitFriendAmtSym: {
    color: expenseColors.accentGreen,
    fontSize: 12,
    fontWeight: '800',
    marginRight: 4,
  },
  splitFriendAmtInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 0,
    textAlign: 'right',
  },
  splitFriendRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 114, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFriendRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 157, 102, 0.4)',
    backgroundColor: 'rgba(255, 157, 102, 0.05)',
  },
  addFriendRowBtnText: {
    color: '#FF9D66',
    fontSize: 11,
    fontWeight: '700',
  },
  splitSummaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  splitSummaryText: {
    color: '#A0A5B5',
    fontSize: 10,
    fontWeight: '600',
  },

  // ── Date & Tags ──
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#1A1D23',
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
    backgroundColor: '#1A1D23',
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
    borderColor: expenseColors.accentPeach,
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

  // ── Multi-Goal Split Allocation Styles ──
  inlineAddGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
  },
  inlineAddGoalBtnText: {
    color: '#FF9D66',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyGoalPromptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1D23',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 157, 102, 0.35)',
  },
  emptyGoalTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  emptyGoalSub: {
    color: '#7E8394',
    fontSize: 11,
  },
  goalAllocationsContainer: {
    gap: 8,
  },
  goalAllocCard: {
    backgroundColor: '#1A1D23',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  goalAllocCardActive: {
    borderColor: 'rgba(112, 214, 188, 0.4)',
    backgroundColor: '#1E232B',
  },
  goalAllocHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalAllocLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  goalCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCheckboxActive: {
    backgroundColor: '#70D6BC',
    borderColor: '#70D6BC',
  },
  goalAllocEmoji: {
    fontSize: 18,
  },
  goalAllocName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  goalAllocMeta: {
    color: '#7E8394',
    fontSize: 10,
    marginTop: 1,
  },
  goalAllocStatus: {
    color: '#656A7B',
    fontSize: 11,
    fontWeight: '600',
  },
  goalAllocInputSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101114',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  goalInputPrefix: {
    color: '#70D6BC',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
  goalAmountInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 8,
  },
  goalQuickPercentRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  goalQuickPercentChip: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  goalQuickPercentText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
  },
  goalSplitSummaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
    marginTop: 4,
  },
  goalSummaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalSummaryLabel: {
    color: '#7E8394',
    fontSize: 11,
    fontWeight: '600',
  },
  goalSummaryValGreen: {
    color: '#70D6BC',
    fontSize: 12,
    fontWeight: '800',
  },
  goalSummaryValWhite: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
