import React, { useState } from 'react';
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
} from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { expenseColors } from '@/constants/expenseColors';
import { CategoryIcon, getCategoryBgColor } from './CategoryIcon';
import { DatePickerModal } from './DatePickerModal';
import { EditAccountModal } from './EditAccountModal';
import { format } from 'date-fns';
import { ExpenseAccount } from '@/types/expense';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabMode = 'expense' | 'income' | 'transfer' | 'debt';
type DebtType = 'lend' | 'borrow';
type BillingCycle = 'monthly' | 'yearly';

const SUGGESTED_TAGS = ['🌴 Goa Trip', '🎉 Night Out', '💍 Wedding', '☕ Work Lunch', '🚗 Road Trip'];

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  visible,
  onClose,
}) => {
  const { categories, accounts, addTransaction } = useExpenseStore();
  const { addSubscription } = useSubscriptionStore();

  const [tabMode, setTabMode] = useState<TabMode>('expense');
  const [debtType, setDebtType] = useState<DebtType>('lend');
  const [amount, setAmount] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || 'acc_hdfc'
  );
  const [toAccountId, setToAccountId] = useState<string>(
    accounts[1]?.id || accounts[0]?.id || 'acc_slice'
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    categories[0]?.id || 'cat_shop'
  );
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

  // Account Dropdown Picker Modal
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
    } else {
      // Income
      addTransaction({
        amount: numAmount,
        type: 'income',
        categoryId: selectedCategoryId,
        accountId: selectedAccountId,
        date: format(txDate, 'yyyy-MM-dd'),
        note: finalNote || undefined,
        tag: finalTag || undefined,
      });
    }

    // If subscription toggle is ON, also add to Subscription Store
    if (isSubscription && tabMode === 'expense') {
      const selectedCat = categories.find((c) => c.id === selectedCategoryId);
      addSubscription({
        name: merchant.trim() || selectedCat?.name || 'Subscription',
        price: numAmount,
        currency: 'INR',
        billingCycle: billingCycle === 'monthly' ? 'monthly' : 'yearly',
        startDate: format(txDate, 'yyyy-MM-dd'),
        nextBillingDate: format(nextBillDate, 'yyyy-MM-dd'),
        color: selectedCat?.color || expenseColors.accentPeach,
        category: 'other',
        reminderEnabled: true,
        reminderDays: 1,
        isTrial: false,
      }).catch(() => {});
    }

    // Reset & Close
    setAmount('');
    setMerchant('');
    setNote('');
    setSelectedTag('');
    setCustomTagInput('');
    setIsSplitEnabled(false);
    setYourShare('');
    setFriendNames('');
    setDebtPerson('');
    setIsSubscription(false);
    onClose();
  };

  const getAccountIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('axis') || lower.includes('credit') || lower.includes('card') || lower.includes('slice')) {
      return <CreditCard size={14} color="#FFFFFF" />;
    }
    if (lower.includes('wallet') || lower.includes('pay')) {
      return <Wallet size={14} color="#FFFFFF" />;
    }
    return <Banknote size={14} color="#FFFFFF" />;
  };

  const fromAccObj = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const toAccObj = accounts.find((a) => a.id === toAccountId) || accounts[1] || accounts[0];
  const isCreditCardPayment = toAccObj?.statusType === 'due' || toAccObj?.type === 'credit';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={22} color="#A0A5B5" />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>ADD TRANSACTION</AppText>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 220 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* Segmented Type Control: 4 Clean Modes */}
          <View style={styles.typeSegment}>
            <TouchableOpacity
              style={[
                styles.typeBtn,
                tabMode === 'expense' && styles.typeBtnExpenseActive,
              ]}
              onPress={() => setTabMode('expense')}
            >
              <AppText
                style={[
                  styles.typeBtnText,
                  tabMode === 'expense' && styles.typeBtnTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                EXPENSE
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBtn,
                tabMode === 'income' && styles.typeBtnIncomeActive,
              ]}
              onPress={() => setTabMode('income')}
            >
              <AppText
                style={[
                  styles.typeBtnText,
                  tabMode === 'income' && styles.typeBtnTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                INCOME
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBtn,
                tabMode === 'transfer' && styles.typeBtnTransferActive,
              ]}
              onPress={() => setTabMode('transfer')}
            >
              <AppText
                style={[
                  styles.typeBtnText,
                  tabMode === 'transfer' && styles.typeBtnTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                TRANSFER
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBtn,
                tabMode === 'debt' && styles.typeBtnDebtActive,
              ]}
              onPress={() => setTabMode('debt')}
            >
              <AppText
                style={[
                  styles.typeBtnText,
                  tabMode === 'debt' && styles.typeBtnTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
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
                  debtType === 'lend' && styles.debtSubBtnLendActive,
                ]}
                onPress={() => setDebtType('lend')}
              >
                <HandCoins size={14} color={debtType === 'lend' ? '#FFFFFF' : '#A0A5B5'} />
                <AppText
                  style={[
                    styles.debtSubBtnText,
                    debtType === 'lend' && styles.debtSubBtnTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  I LENT (THEY OWE)
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.debtSubBtn,
                  debtType === 'borrow' && styles.debtSubBtnBorrowActive,
                ]}
                onPress={() => setDebtType('borrow')}
              >
                <Banknote size={14} color={debtType === 'borrow' ? '#FFFFFF' : '#A0A5B5'} />
                <AppText
                  style={[
                    styles.debtSubBtnText,
                    debtType === 'borrow' && styles.debtSubBtnTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  I BORROWED (I OWE)
                </AppText>
              </TouchableOpacity>
            </View>
          )}

          {/* INTERACTIVE TRANSFER HERO CARD (With Dropdowns & Left-to-Right Arrow) */}
          {tabMode === 'transfer' && (
            <View style={styles.transferHeroCard}>
              <View style={styles.transferHeroHeader}>
                <AppText style={styles.transferHeroTitle}>ACCOUNT TRANSFER</AppText>
                <AppText style={styles.transferHeroSubtitle}>Tap an account to change</AppText>
              </View>

              <View style={styles.transferDropdownRow}>
                {/* FROM ACCOUNT DROPDOWN BUTTON */}
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

                {/* LEFT TO RIGHT ARROW */}
                <View style={styles.transferArrowWrap}>
                  <ArrowRight size={20} color={expenseColors.accentPeach} />
                </View>

                {/* TO ACCOUNT DROPDOWN BUTTON */}
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
                    ? `💳 Pays credit card bill of ${toAccObj?.name}, reducing its due amount without inflating your monthly expense budget.`
                    : `💸 Moves funds from ${fromAccObj?.name} directly into ${toAccObj?.name}.`}
                </AppText>
              </View>
            </View>
          )}

          {/* AMOUNT INPUT */}
          <View style={styles.section}>
            <AppText style={styles.label}>
              {tabMode === 'expense' && isSplitEnabled
                ? 'TOTAL BILL PAID'
                : tabMode === 'debt'
                ? 'AMOUNT LENT / BORROWED'
                : 'AMOUNT'}
            </AppText>
            <View style={styles.amountInputRow}>
              <AppText style={styles.currencySymbol}>₹</AppText>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#555866"
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

          {/* MERCHANT / DESCRIPTION */}
          {tabMode !== 'debt' && (
            <View style={styles.section}>
              <AppText style={styles.label}>
                {tabMode === 'transfer' ? 'TRANSFER REASON (OPTIONAL)' : 'MERCHANT / DESCRIPTION'}
              </AppText>
              <TextInput
                style={styles.textInput}
                placeholder={
                  tabMode === 'transfer'
                    ? 'e.g. Credit Card Bill, Wallet Top-up'
                    : 'e.g. Swiggy, Amazon, Vishal Mega Mart'
                }
                placeholderTextColor="#555866"
                value={merchant}
                onChangeText={setMerchant}
              />
            </View>
          )}

          {/* ACCOUNT SELECTION (For Expense, Income, Debt) */}
          {tabMode !== 'transfer' && (
            <View style={styles.section}>
              <AppText style={styles.label}>
                {tabMode === 'income'
                  ? 'RECEIVING ACCOUNT'
                  : tabMode === 'debt' && debtType === 'borrow'
                  ? 'RECEIVED IN ACCOUNT'
                  : 'PAID FROM ACCOUNT'}
              </AppText>
              {accounts.length === 0 ? (
                <View style={styles.noAccountWarningCard}>
                  <AlertCircle size={18} color={expenseColors.accentPeach} />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.noAccountWarningTitle}>Account Required</AppText>
                    <AppText style={styles.noAccountWarningSub}>
                      You need at least one account (Bank, Card, or Cash) to record this transaction.
                    </AppText>
                  </View>
                  <TouchableOpacity
                    style={styles.addAccountWarningBtn}
                    onPress={() => setShowAddAccountModal(true)}
                    activeOpacity={0.8}
                  >
                    <Plus size={14} color="#0F1015" />
                    <AppText style={styles.addAccountWarningBtnText}>Add</AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.accountRow}
                >
                  {accounts.map((acc) => {
                    const selected = selectedAccountId === acc.id;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => setSelectedAccountId(acc.id)}
                        style={[
                          styles.accountPill,
                          selected && styles.accountPillSelected,
                        ]}
                      >
                        {getAccountIcon(acc.name)}
                        <AppText
                          style={[
                            styles.accountPillText,
                            selected && styles.accountPillTextSelected,
                          ]}
                        >
                          {acc.name.toUpperCase()}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={styles.addAccountQuickPill}
                    onPress={() => setShowAddAccountModal(true)}
                    activeOpacity={0.8}
                  >
                    <Plus size={13} color={expenseColors.accentPeach} />
                    <AppText style={styles.addAccountQuickPillText}>NEW</AppText>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          )}

          {/* GROUP SPLIT TOGGLE INSIDE EXPENSE MODE */}
          {tabMode === 'expense' && (
            <View style={styles.splitToggleCard}>
              <View style={styles.splitToggleHeaderRow}>
                <View style={styles.splitToggleInfo}>
                  <View style={styles.splitIconWrap}>
                    <Users size={16} color={expenseColors.accentPeach} />
                  </View>
                  <View>
                    <AppText style={styles.splitToggleTitle}>Split with Friends?</AppText>
                    <AppText style={styles.splitToggleSubtitle}>
                      Split total bill & track friends' share
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={isSplitEnabled}
                  onValueChange={(val) => {
                    setIsSplitEnabled(val);
                    if (val && numAmount > 0 && !yourShare) {
                      setYourShare(Math.round(numAmount / 2).toString());
                    }
                  }}
                  trackColor={{
                    false: '#2B2E3D',
                    true: expenseColors.accentPeach,
                  }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {isSplitEnabled && (
                <View style={styles.splitExpandedContainer}>
                  <View style={styles.splitRow}>
                    <View style={styles.splitCol}>
                      <AppText style={styles.splitSubLabel}>YOUR EXPENSE</AppText>
                      <View style={styles.splitInputRow}>
                        <AppText style={styles.splitCurrency}>₹</AppText>
                        <TextInput
                          style={styles.splitInput}
                          placeholder="0"
                          placeholderTextColor="#555866"
                          keyboardType="numeric"
                          value={yourShare}
                          onChangeText={setYourShare}
                        />
                      </View>
                    </View>

                    <View style={styles.splitCol}>
                      <AppText style={styles.splitSubLabel}>FRIENDS OWE YOU</AppText>
                      <View style={styles.splitFixedRow}>
                        <AppText style={styles.splitFriendsAmount}>
                          ₹{friendsShare.toLocaleString('en-IN')}
                        </AppText>
                      </View>
                    </View>
                  </View>

                  <View style={{ marginTop: 10 }}>
                    <AppText style={styles.splitSubLabel}>FRIENDS INVOLVED</AppText>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Rahul, Sneha, Amit"
                      placeholderTextColor="#555866"
                      value={friendNames}
                      onChangeText={setFriendNames}
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* DATE */}
          <View style={[styles.section, { alignItems: 'center' }]}>
            <AppText style={styles.label}>TRANSACTION DATE</AppText>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowTxDatePicker(true)}
            >
              <CalendarIcon size={16} color="#A0A5B5" />
              <AppText style={styles.dateBtnText}>
                {format(txDate, 'dd MMM yyyy')}
              </AppText>
            </TouchableOpacity>
          </View>

          {/* CATEGORY (For Expense & Income) */}
          {(tabMode === 'expense' || tabMode === 'income') && (
            <View style={styles.section}>
              <AppText style={styles.label}>CATEGORY</AppText>
              <View style={styles.categoryGrid}>
                {categories.map((cat) => {
                  const selected = selectedCategoryId === cat.id;
                  const catBg = selected
                    ? getCategoryBgColor(cat.color, '35')
                    : getCategoryBgColor(cat.color, '14');
                  const catBorder = selected ? cat.color : getCategoryBgColor(cat.color, '38');

                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategoryId(cat.id)}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: catBg,
                          borderColor: catBorder,
                          borderWidth: selected ? 1.5 : 1,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <CategoryIcon
                        category={cat}
                        size={14}
                        color={cat.color}
                        strokeWidth={2}
                        fill={selected}
                      />
                      <AppText
                        style={[
                          styles.categoryPillText,
                          {
                            color: selected ? '#FFFFFF' : '#E0E3EB',
                            fontWeight: selected ? '800' : '600',
                          },
                        ]}
                      >
                        {cat.name.toUpperCase()}{cat.emoji ? ` ${cat.emoji}` : ''}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

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
            <AppText style={styles.label}>NOTES (OPTIONAL)</AppText>
            <TextInput
              style={styles.textInput}
              placeholder="Add extra notes..."
              placeholderTextColor="#555866"
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* SUBSCRIPTION TOGGLE SECTION (For Expense Mode) */}
          {tabMode === 'expense' && (
            <View style={styles.subscriptionCard}>
              <View style={styles.subHeaderRow}>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.subTitle}>SUBSCRIPTION</AppText>
                  <AppText style={styles.subSubtitle}>
                    Mark as a recurring charge
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
                  {/* Billing Cycle */}
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

                  {/* Next Bill Date */}
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

          {/* Bottom Save Button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <AppText style={styles.saveBtnText}>Save Transaction</AppText>
          </TouchableOpacity>
        </ScrollView>

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
                          <View style={[styles.pickerIconCircle, isCurrent && { backgroundColor: expenseColors.accentPeach }]}>
                            {getAccountIcon(acc.name)}
                          </View>
                          <View>
                            <AppText style={[styles.pickerAccountName, isOpposite && { color: '#555866' }]}>
                              {acc.name.toUpperCase()}
                            </AppText>
                            <AppText style={styles.pickerAccountType}>
                              {acc.statusType === 'due' ? `Due: ₹${acc.dueAmount || 0}` : `Bal: ₹${acc.balance}`}
                            </AppText>
                          </View>
                        </View>

                        {isCurrent && <Check size={18} color={expenseColors.accentPeach} />}
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
    backgroundColor: '#0F1015',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  typeSegment: {
    flexDirection: 'row',
    backgroundColor: '#1A1D27',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  typeBtnExpenseActive: {
    backgroundColor: expenseColors.accentRed,
  },
  typeBtnIncomeActive: {
    backgroundColor: expenseColors.accentGreen,
  },
  typeBtnTransferActive: {
    backgroundColor: expenseColors.accentBlue,
  },
  typeBtnDebtActive: {
    backgroundColor: expenseColors.accentPeach,
  },
  typeBtnText: {
    color: '#8E919D',
    fontSize: 9.8,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  typeBtnTextActive: {
    color: '#0F1015',
    fontWeight: '800',
  },
  debtSegment: {
    flexDirection: 'row',
    backgroundColor: '#161922',
    borderRadius: 12,
    padding: 4,
    gap: 6,
  },
  debtSubBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  debtSubBtnLendActive: {
    backgroundColor: expenseColors.accentGreen,
  },
  debtSubBtnBorrowActive: {
    backgroundColor: expenseColors.accentRed,
  },
  debtSubBtnText: {
    color: '#8E919D',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  debtSubBtnTextActive: {
    color: '#0F1015',
    fontWeight: '800',
  },
  transferHeroCard: {
    backgroundColor: '#161A29',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.25)',
    gap: 12,
  },
  transferHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transferHeroTitle: {
    color: '#4A90E2',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  transferHeroSubtitle: {
    color: '#8E919D',
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
    backgroundColor: '#1E2336',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  creditCardSelectBox: {
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  transferBoxLabel: {
    color: '#8E919D',
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
    backgroundColor: 'rgba(74, 144, 226, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferHeroFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  transferExplainText: {
    color: '#A0A5B5',
    fontSize: 11,
    lineHeight: 16,
  },
  section: {
    gap: 6,
  },
  label: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D27',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 60,
  },
  currencySymbol: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#1A1D27',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    color: '#FFFFFF',
    fontSize: 15,
  },
  accountRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1D27',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  accountPillSelected: {
    backgroundColor: expenseColors.accentPeach,
  },
  accountPillText: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '700',
  },
  accountPillTextSelected: {
    color: '#0F1015',
    fontWeight: '800',
  },
  splitToggleCard: {
    backgroundColor: '#191624',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(155, 81, 224, 0.25)',
    gap: 12,
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
    flex: 1,
  },
  splitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(155, 81, 224, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitToggleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  splitToggleSubtitle: {
    color: '#8E919D',
    fontSize: 11,
  },
  splitExpandedContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
    gap: 10,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  splitCol: {
    flex: 1,
    gap: 6,
  },
  splitSubLabel: {
    color: '#A0A5B5',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  splitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#221D32',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  splitCurrency: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
  },
  splitInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  splitFixedRow: {
    justifyContent: 'center',
    backgroundColor: '#221D32',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  splitFriendsAmount: {
    color: '#2ECC71',
    fontSize: 16,
    fontWeight: '700',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1D27',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    backgroundColor: '#1A1D27',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryPillText: {
    color: '#8E919D',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  tagScrollRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  tagChip: {
    backgroundColor: '#1A1D27',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tagChipActive: {
    backgroundColor: 'rgba(235, 178, 154, 0.2)',
    borderColor: expenseColors.accentPeach,
  },
  tagChipText: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '600',
  },
  tagChipTextActive: {
    color: expenseColors.accentPeach,
    fontWeight: '700',
  },
  subscriptionCard: {
    backgroundColor: '#16171E',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  subSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  subFieldsStack: {
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  subFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subFieldLabel: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cycleSegment: {
    flexDirection: 'row',
    backgroundColor: '#1F222E',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  cycleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cycleBtnActive: {
    backgroundColor: '#2E3242',
  },
  cycleBtnText: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '600',
  },
  cycleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  nextDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1F222E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  nextDateBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: expenseColors.accentPeach,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#0F1015',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  pickerModalContent: {
    backgroundColor: '#1A1D27',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 14,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerModalTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pickerAccountList: {
    gap: 8,
  },
  pickerAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#222533',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerAccountItemCurrent: {
    borderColor: expenseColors.accentPeach,
    backgroundColor: 'rgba(235, 178, 154, 0.1)',
  },
  pickerAccountItemDisabled: {
    opacity: 0.4,
    backgroundColor: '#181A22',
  },
  pickerAccountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAccountName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pickerAccountType: {
    color: '#8E919D',
    fontSize: 11,
    marginTop: 2,
  },
  pickerOppositeNotice: {
    color: '#8E919D',
    fontSize: 10,
    fontStyle: 'italic',
  },
  noAccountWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(235, 178, 154, 0.12)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(235, 178, 154, 0.3)',
    gap: 10,
  },
  noAccountWarningTitle: {
    color: expenseColors.accentPeach,
    fontSize: 12,
    fontWeight: '800',
  },
  noAccountWarningSub: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  addAccountWarningBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: expenseColors.accentPeach,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addAccountWarningBtnText: {
    color: '#0F1015',
    fontSize: 12,
    fontWeight: '800',
  },
  addAccountQuickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1C1E28',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(235, 178, 154, 0.4)',
    borderStyle: 'dashed',
  },
  addAccountQuickPillText: {
    color: expenseColors.accentPeach,
    fontSize: 11,
    fontWeight: '800',
  },
});

