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
} from 'react-native';
import { X, Calendar as CalendarIcon, Wallet, CreditCard, Banknote } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { expenseColors } from '@/constants/expenseColors';
import { CategoryIcon, getCategoryBgColor } from './CategoryIcon';
import { DatePickerModal } from './DatePickerModal';
import { format } from 'date-fns';

interface AddTransactionModalProps {
  visible: boolean;
  onClose: () => void;
}

type TxType = 'expense' | 'income' | 'transfer';
type BillingCycle = 'monthly' | 'yearly';

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  visible,
  onClose,
}) => {
  const { categories, accounts, addTransaction } = useExpenseStore();
  const { addSubscription } = useSubscriptionStore();

  const [txType, setTxType] = useState<TxType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || 'acc_hdfc'
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    categories[0]?.id || 'cat_shop'
  );
  const [txDate, setTxDate] = useState<Date>(new Date(2026, 8, 23)); // Sep 23, 2026 default
  const [note, setNote] = useState<string>('');

  // Subscription toggle & fields
  const [isSubscription, setIsSubscription] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [nextBillDate, setNextBillDate] = useState<Date>(() => {
    const d = new Date(2026, 8, 23);
    d.setMonth(d.getMonth() + 1);
    return d;
  });

  // Date Pickers
  const [showTxDatePicker, setShowTxDatePicker] = useState<boolean>(false);
  const [showNextBillDatePicker, setShowNextBillDatePicker] = useState<boolean>(false);

  const handleSave = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    const finalNote = merchant.trim() ? `${merchant.trim()}${note.trim() ? ` - ${note.trim()}` : ''}` : note.trim();

    // 1. Add to Expense Store
    addTransaction({
      amount: numAmount,
      type: txType === 'income' ? 'income' : 'expense',
      categoryId: selectedCategoryId,
      accountId: selectedAccountId,
      date: format(txDate, 'yyyy-MM-dd'),
      note: finalNote || undefined,
    });

    // 2. If subscription toggle is ON, also add to Subscription Store
    if (isSubscription) {
      const selectedCat = categories.find(c => c.id === selectedCategoryId);
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
    setIsSubscription(false);
    onClose();
  };

  const getAccountIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('axis') || lower.includes('credit') || lower.includes('card')) {
      return <CreditCard size={14} color="#FFFFFF" />;
    }
    if (lower.includes('wallet') || lower.includes('pay')) {
      return <Wallet size={14} color="#FFFFFF" />;
    }
    return <Banknote size={14} color="#FFFFFF" />;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Segmented Type Control */}
          <View style={styles.typeSegment}>
            <TouchableOpacity
              style={[
                styles.typeBtn,
                txType === 'expense' && styles.typeBtnExpenseActive,
              ]}
              onPress={() => setTxType('expense')}
            >
              <AppText
                style={[
                  styles.typeBtnText,
                  txType === 'expense' && styles.typeBtnTextActive,
                ]}
              >
                EXPENSE
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBtn,
                txType === 'income' && styles.typeBtnIncomeActive,
              ]}
              onPress={() => setTxType('income')}
            >
              <AppText
                style={[
                  styles.typeBtnText,
                  txType === 'income' && styles.typeBtnTextActive,
                ]}
              >
                INCOME
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBtn,
                txType === 'transfer' && styles.typeBtnTransferActive,
              ]}
              onPress={() => setTxType('transfer')}
            >
              <AppText
                style={[
                  styles.typeBtnText,
                  txType === 'transfer' && styles.typeBtnTextActive,
                ]}
              >
                TRANSFER
              </AppText>
            </TouchableOpacity>
          </View>

          {/* AMOUNT */}
          <View style={styles.section}>
            <AppText style={styles.label}>AMOUNT</AppText>
            <View style={styles.amountInputRow}>
              <AppText style={styles.currencySymbol}>₹</AppText>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#555866"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                autoFocus={false}
              />
            </View>
          </View>

          {/* MERCHANT / DESCRIPTION */}
          <View style={styles.section}>
            <AppText style={styles.label}>MERCHANT / DESCRIPTION</AppText>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Swiggy, Amazon"
              placeholderTextColor="#555866"
              value={merchant}
              onChangeText={setMerchant}
            />
          </View>

          {/* ACCOUNT */}
          <View style={styles.section}>
            <AppText style={styles.label}>ACCOUNT</AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.accountRow}
            >
              {accounts.map(acc => {
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
            </ScrollView>
          </View>

          {/* DATE */}
          <View style={[styles.section, { alignItems: 'center' }]}>
            <AppText style={styles.label}>DATE</AppText>
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

          {/* CATEGORY */}
          <View style={styles.section}>
            <AppText style={styles.label}>CATEGORY</AppText>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => {
                const selected = selectedCategoryId === cat.id;
                const catBg = selected ? getCategoryBgColor(cat.color, '28') : '#1A1D27';
                const catBorder = selected ? cat.color : 'rgba(255, 255, 255, 0.06)';
                const iconColor = selected ? cat.color : '#8E919D';

                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: catBg,
                        borderColor: catBorder,
                        borderWidth: 1,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <CategoryIcon
                      category={cat}
                      size={14}
                      color={iconColor}
                      strokeWidth={2}
                      fill={selected}
                    />
                    <AppText
                      style={[
                        styles.categoryPillText,
                        selected && { color: cat.color, fontWeight: '800' },
                      ]}
                    >
                      {cat.name.toUpperCase()}{cat.emoji ? ` ${cat.emoji}` : ''}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* NOTES (OPTIONAL) */}
          <View style={styles.section}>
            <AppText style={styles.label}>NOTES (OPTIONAL)</AppText>
            <TextInput
              style={styles.textInput}
              placeholder="Add a note..."
              placeholderTextColor="#555866"
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* SUBSCRIPTION TOGGLE SECTION (image copy 2.png) */}
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

          {/* Bottom Save Button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <AppText style={styles.saveBtnText}>Save Transaction</AppText>
          </TouchableOpacity>
        </ScrollView>

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
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  typeBtnExpenseActive: {
    backgroundColor: '#FF6B6B',
  },
  typeBtnIncomeActive: {
    backgroundColor: '#2ECC71',
  },
  typeBtnTransferActive: {
    backgroundColor: '#4A90E2',
  },
  typeBtnText: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  typeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
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
  categoryPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
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
});
