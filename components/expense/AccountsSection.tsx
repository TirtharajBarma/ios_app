import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { ExpenseAccount } from '@/types/expense';
import { expenseColors } from '@/constants/expenseColors';
import { AccountIcon } from './AccountIcon';

interface AccountsSectionProps {
  onAccountPress?: (account: ExpenseAccount) => void;
}

export const AccountsSection: React.FC<AccountsSectionProps> = ({ onAccountPress }) => {
  const { accounts, currencySymbol, formatAmount } = useExpenseStore();
  const sym = currencySymbol || '₹';

  const getAccountTypeLabel = (acc: ExpenseAccount) => {
    if (acc.type === 'credit') return 'Credit Card';
    if (acc.type === 'wallet') return 'Wallet';
    return 'Savings';
  };

  const activeAccounts = accounts.filter((acc) => !acc.isArchived);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <AppText style={styles.sectionTitle}>ACCOUNTS</AppText>

      {/* Account Cards */}
      <View style={styles.cardsStack}>
        {activeAccounts.map((acc) => {
          const isCredit = acc.type === 'credit';
          const hasDue = isCredit && (acc.dueAmount || 0) > 0;
          const typeLabel = getAccountTypeLabel(acc);
          const txLabel = `${acc.txnCountThisMonth} txn${acc.txnCountThisMonth !== 1 ? 's' : ''}`;

          return (
            <TouchableOpacity
              key={acc.id}
              style={styles.accountCard}
              activeOpacity={0.7}
              onPress={() => onAccountPress?.(acc)}
            >
              {/* Left side icon & info */}
              <View style={styles.leftContent}>
                <AccountIcon type={acc.type || 'savings'} size={17} containerSize={38} borderRadius={12} />
                <View style={styles.textContainer}>
                  <AppText style={styles.accountName} numberOfLines={1}>
                    {acc.name.toUpperCase()}
                  </AppText>
                  <AppText style={styles.txnSubtitle} numberOfLines={1}>
                    {typeLabel} • {txLabel}
                  </AppText>
                </View>
              </View>

              {/* Right side clean balance */}
              <View style={styles.rightContent}>
                {isCredit ? (
                  hasDue ? (
                    <AppText style={styles.dueBalanceText}>
                      Due: {formatAmount(acc.dueAmount || 0)}
                    </AppText>
                  ) : (
                    <AppText style={styles.noDueText}>
                      No Due
                    </AppText>
                  )
                ) : (
                  <AppText style={styles.positiveBalanceText}>
                    {formatAmount(acc.balance)}
                  </AppText>
                )}
                <ChevronRight size={15} color={expenseColors.textMuted} style={styles.chevron} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  cardsStack: {
    gap: 8,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: expenseColors.bgCard,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1E2028',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  accountName: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  txnSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  positiveBalanceText: {
    color: expenseColors.textPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  dueBalanceText: {
    color: '#FF6B6B',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  noDueText: {
    color: expenseColors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 2,
    opacity: 0.6,
  },
});
