import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  X,
  Plus,
  ChevronRight,
  Banknote,
  CreditCard,
  Wallet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { MenuAction } from '@expo/ui/community/menu';
import { AppText, NativeLiquidMenu } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseAccount } from '@/types/expense';
import { EditAccountModal } from './EditAccountModal';

interface AccountsListModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AccountsListModal: React.FC<AccountsListModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    accounts,
    transactions,
    currencySymbol,
    deleteAccount,
    archiveAccount,
  } = useExpenseStore();
  const sym = currencySymbol || '₹';
  const [selectedAccountForEdit, setSelectedAccountForEdit] = useState<ExpenseAccount | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);

  // Active (non-archived) accounts
  const activeAccounts = accounts.filter(a => !a.isArchived);

  const getAccountTxCount = (accountId: string) => {
    return transactions.filter(t => t.accountId === accountId).length;
  };

  const getAccountIcon = (account: ExpenseAccount) => {
    const name = account.name.toLowerCase();
    const type = account.type || 'savings';
    if (type === 'credit' || name.includes('axis') || name.includes('icici') || name.includes('card')) {
      return <CreditCard size={18} color="#A0A5B5" />;
    }
    if (type === 'wallet' || name.includes('wallet') || name.includes('pay')) {
      return <Wallet size={18} color="#A0A5B5" />;
    }
    return <Banknote size={18} color="#A0A5B5" />;
  };

  const handleOpenEdit = (account: ExpenseAccount) => {
    setSelectedAccountForEdit(account);
    setShowEditModal(true);
  };

  const handleOpenAdd = () => {
    setSelectedAccountForEdit(null);
    setShowEditModal(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <X size={22} color="#A0A5B5" />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>ACCOUNTS</AppText>
          <TouchableOpacity onPress={handleOpenAdd} style={styles.addBtn}>
            <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section Header */}
          <AppText style={styles.sectionTitle}>ACTIVE</AppText>

          {/* Accounts List */}
          <View style={styles.listStack}>
            {activeAccounts.map(account => {
              const txCount = getAccountTxCount(account.id) || account.txnCountThisMonth || 0;
              const isDue = account.statusType === 'due' && (account.dueAmount ?? 0) > 0;

              const accountActions: MenuAction[] = [
                {
                  id: 'edit',
                  title: 'Edit Details',
                  image: 'pencil' as any,
                },
                {
                  id: 'archive',
                  title: 'Archive Account',
                  image: 'archivebox.fill' as any,
                },
                {
                  id: 'delete',
                  title: 'Delete Account',
                  image: 'trash.fill' as any,
                  attributes: { destructive: true },
                },
              ];

              return (
                <NativeLiquidMenu
                  key={account.id}
                  title={account.name}
                  actions={accountActions}
                  shouldOpenOnLongPress={true}
                  onSelect={(actionId) => {
                    if (actionId === 'edit') {
                      handleOpenEdit(account);
                    } else if (actionId === 'archive') {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                      archiveAccount(account.id);
                    } else if (actionId === 'delete') {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                      deleteAccount(account.id);
                    }
                  }}
                  style={{ width: '100%' }}
                >
                  <TouchableOpacity
                    style={styles.accountRow}
                    onPress={() => handleOpenEdit(account)}
                    activeOpacity={0.75}
                  >
                    {/* Left Icon */}
                    <View style={styles.iconCircle}>
                      {getAccountIcon(account)}
                    </View>

                    {/* Middle Info */}
                    <View style={styles.infoCol}>
                      <AppText style={styles.accountName}>
                        {account.name}
                      </AppText>
                      {isDue ? (
                        <AppText style={styles.dueText}>
                          Due: {sym}{account.dueAmount?.toLocaleString('en-IN')}
                        </AppText>
                      ) : (
                        <AppText style={styles.balanceText}>
                          {sym}{account.balance.toLocaleString('en-IN')}
                        </AppText>
                      )}
                    </View>

                    {/* Right: Badge + Chevron */}
                    <View style={styles.rightGroup}>
                      <View style={styles.txBadge}>
                        <AppText style={styles.txBadgeText}>
                          {txCount} txns
                        </AppText>
                      </View>
                      <ChevronRight size={18} color="#555866" />
                    </View>
                  </TouchableOpacity>
                </NativeLiquidMenu>
              );
            })}
          </View>
        </ScrollView>

        {/* Edit / Add Account Modal */}
        <EditAccountModal
          visible={showEditModal}
          account={selectedAccountForEdit}
          onClose={() => setShowEditModal(false)}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101114',
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
  headerBtn: {
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
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#232633',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  sectionTitle: {
    color: expenseColors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  listStack: {
    gap: 14,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1C24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
  },
  accountName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  balanceText: {
    color: '#8E919D',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  dueText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  txBadge: {
    backgroundColor: '#1A1C24',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  txBadgeText: {
    color: '#8E919D',
    fontSize: 12,
    fontWeight: '600',
  },
});
