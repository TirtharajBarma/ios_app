import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  X,
  Banknote,
  CreditCard,
  Wallet,
  Info,
  Edit3,
  Archive,
  Trash2,
  ChevronRight,
} from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseAccount } from '@/types/expense';

interface EditAccountModalProps {
  visible: boolean;
  account: ExpenseAccount | null; // null = Add Account mode
  onClose: () => void;
}

type AccountType = 'savings' | 'credit' | 'wallet' | 'cash';

export const EditAccountModal: React.FC<EditAccountModalProps> = ({
  visible,
  account,
  onClose,
}) => {
  const { addAccount, updateAccount, deleteAccount, archiveAccount, transactions, currencySymbol } = useExpenseStore();
  const sym = currencySymbol || '₹';

  const [name, setName] = useState<string>('');
  const [type, setType] = useState<AccountType>('savings');
  const [balance, setBalance] = useState<string>('0');
  const [dueAmount, setDueAmount] = useState<string>('0');
  const [showBalanceInput, setShowBalanceInput] = useState<boolean>(false);

  const isEditMode = account !== null;

  useEffect(() => {
    if (account) {
      setName(account.name);
      setType(account.type || 'savings');
      setBalance(account.balance.toString());
      setDueAmount((account.dueAmount || 0).toString());
    } else {
      setName('');
      setType('savings');
      setBalance('0');
      setDueAmount('0');
    }
    setShowBalanceInput(false);
  }, [account, visible]);

  // Number of transactions linked to this account
  const linkedTxCount = account
    ? transactions.filter(t => t.accountId === account.id).length
    : 0;

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter an account name.');
      return;
    }

    const numBalance = parseFloat(balance) || 0;
    const numDue = parseFloat(dueAmount) || 0;

    if (isEditMode && account) {
      updateAccount(account.id, {
        name: name.trim(),
        type,
        balance: numBalance,
        dueAmount: numDue > 0 ? numDue : undefined,
        statusType: numDue > 0 ? 'due' : 'positive',
      });
    } else {
      addAccount({
        name: name.trim(),
        type,
        balance: numBalance,
        dueAmount: numDue > 0 ? numDue : undefined,
        statusType: numDue > 0 ? 'due' : 'positive',
      });
    }

    onClose();
  };

  const handleArchive = () => {
    if (!account) return;
    Alert.alert(
      'Archive Account',
      `Are you sure you want to archive "${account.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'default',
          onPress: () => {
            archiveAccount(account.id);
            onClose();
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!account) return;
    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete "${account.name}"? Linked transactions will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteAccount(account.id);
            onClose();
          },
        },
      ]
    );
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={22} color="#A0A5B5" />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>
            {isEditMode ? 'EDIT ACCOUNT' : 'ADD ACCOUNT'}
          </AppText>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 220 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* ACCOUNT NAME */}
          <View style={styles.section}>
            <AppText style={styles.label}>ACCOUNT NAME</AppText>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. HDFC, Slice, SBI"
              placeholderTextColor="#555866"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* ACCOUNT TYPE */}
          <View style={styles.section}>
            <AppText style={styles.label}>ACCOUNT TYPE</AppText>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[
                  styles.typePill,
                  type === 'savings' && styles.typePillSelected,
                ]}
                onPress={() => setType('savings')}
              >
                <Banknote
                  size={15}
                  color={type === 'savings' ? '#0F1015' : '#8E919D'}
                />
                <AppText
                  style={[
                    styles.typePillText,
                    type === 'savings' && styles.typePillTextSelected,
                  ]}
                >
                  SAVINGS
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typePill,
                  type === 'credit' && styles.typePillSelected,
                ]}
                onPress={() => setType('credit')}
              >
                <CreditCard
                  size={15}
                  color={type === 'credit' ? '#0F1015' : '#8E919D'}
                />
                <AppText
                  style={[
                    styles.typePillText,
                    type === 'credit' && styles.typePillTextSelected,
                  ]}
                >
                  CREDIT
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typePill,
                  type === 'wallet' && styles.typePillSelected,
                ]}
                onPress={() => setType('wallet')}
              >
                <Wallet
                  size={15}
                  color={type === 'wallet' ? '#0F1015' : '#8E919D'}
                />
                <AppText
                  style={[
                    styles.typePillText,
                    type === 'wallet' && styles.typePillTextSelected,
                  ]}
                >
                  WALLET
                </AppText>
              </TouchableOpacity>
            </View>
          </View>

          {/* INFO BANNER */}
          <View style={styles.infoBanner}>
            <Info size={16} color="#8E919D" />
            <AppText style={styles.infoText}>
              {linkedTxCount} transaction{linkedTxCount !== 1 ? 's' : ''} linked to this account.
            </AppText>
          </View>

          {/* ADJUST OPENING BALANCE CARD */}
          <TouchableOpacity
            style={styles.balanceCard}
            onPress={() => setShowBalanceInput(!showBalanceInput)}
            activeOpacity={0.75}
          >
            <View style={styles.balanceIconBox}>
              <Edit3 size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.balanceCardTitle}>
                Adjust Opening Balance
              </AppText>
              <AppText style={styles.balanceCardSub}>
                Currently {sym}{parseFloat(balance || '0').toLocaleString('en-IN')}
                {parseFloat(dueAmount || '0') > 0 ? ` (Due: ${sym}${parseFloat(dueAmount).toLocaleString('en-IN')})` : ''}
              </AppText>
            </View>
            <ChevronRight size={18} color="#8E919D" />
          </TouchableOpacity>

          {/* Balance / Due Input Fields when expanded */}
          {showBalanceInput && (
            <View style={styles.balanceInputBlock}>
              <View style={styles.section}>
                <AppText style={styles.label}>BALANCE AMOUNT ({sym})</AppText>
                <TextInput
                  style={styles.textInput}
                  placeholder="0"
                  placeholderTextColor="#555866"
                  keyboardType="numeric"
                  value={balance}
                  onChangeText={setBalance}
                />
              </View>

              {type === 'credit' && (
                <View style={styles.section}>
                  <AppText style={styles.label}>DUE AMOUNT ({sym})</AppText>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    placeholderTextColor="#555866"
                    keyboardType="numeric"
                    value={dueAmount}
                    onChangeText={setDueAmount}
                  />
                </View>
              )}
            </View>
          )}

          {/* ARCHIVE / DELETE BUTTONS (EDIT MODE ONLY) */}
          {isEditMode && (
            <View style={styles.actionButtonsStack}>
              <TouchableOpacity
                style={styles.archiveBtn}
                onPress={handleArchive}
                activeOpacity={0.75}
              >
                <Archive size={16} color="#A0A5B5" />
                <AppText style={styles.archiveBtnText}>Archive Account</AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                activeOpacity={0.75}
              >
                <Trash2 size={16} color="#FF6B6B" />
                <AppText style={styles.deleteBtnText}>Delete Account</AppText>
              </TouchableOpacity>
            </View>
          )}

          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <AppText style={styles.saveBtnText}>
              {isEditMode ? 'Save Changes' : 'Create Account'}
            </AppText>
          </TouchableOpacity>
        </ScrollView>
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
  section: {
    gap: 6,
  },
  label: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: '#1A1D27',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    color: '#FFFFFF',
    fontSize: 15,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1A1D27',
    paddingVertical: 12,
    borderRadius: 14,
  },
  typePillSelected: {
    backgroundColor: expenseColors.accentPeach,
  },
  typePillText: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '700',
  },
  typePillTextSelected: {
    color: '#0F1015',
    fontWeight: '800',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16171E',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  infoText: {
    color: '#8E919D',
    fontSize: 12,
    flex: 1,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D27',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  balanceIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#262A38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  balanceCardSub: {
    color: expenseColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  balanceInputBlock: {
    backgroundColor: '#16171E',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionButtonsStack: {
    gap: 10,
    marginTop: 8,
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A1D27',
    height: 48,
    borderRadius: 12,
  },
  archiveBtnText: {
    color: '#A0A5B5',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#27191C',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.15)',
  },
  deleteBtnText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: expenseColors.accentPeach,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveBtnText: {
    color: '#0F1015',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
