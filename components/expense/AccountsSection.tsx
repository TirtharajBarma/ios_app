import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Banknote, CreditCard, Wallet } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { ExpenseAccount } from '@/types/expense';
import { expenseColors } from '@/constants/expenseColors';

interface AccountsSectionProps {
  onAccountPress?: (account: ExpenseAccount) => void;
}

export const AccountsSection: React.FC<AccountsSectionProps> = ({ onAccountPress }) => {
  const { accounts, currencySymbol, formatAmount } = useExpenseStore();
  const sym = currencySymbol || '₹';

  const renderAccountIcon = (acc: ExpenseAccount) => {
    if (acc.type === 'wallet') {
      return <Wallet size={16} color={expenseColors.textSubtle} strokeWidth={2} />;
    }
    if (acc.type === 'credit') {
      return <CreditCard size={16} color={expenseColors.textSubtle} strokeWidth={2} />;
    }
    return <Banknote size={16} color={expenseColors.textSubtle} strokeWidth={2} />;
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

          const isOutflow = acc.monthlyChange < 0;
          const isInflow = acc.monthlyChange > 0;

          return (
            <TouchableOpacity
              key={acc.id}
              style={styles.accountCard}
              activeOpacity={0.7}
              onPress={() => onAccountPress?.(acc)}
            >
              {/* Left side icon & info */}
              <View style={styles.leftContent}>
                <View style={styles.iconBox}>
                  {renderAccountIcon(acc)}
                </View>
                <View style={styles.textContainer}>
                  <AppText style={styles.accountName} numberOfLines={1}>
                    {acc.name.toUpperCase()}
                  </AppText>
                  <AppText style={styles.txnSubtitle} numberOfLines={1}>
                    {acc.txnCountThisMonth} txn{acc.txnCountThisMonth !== 1 ? 's' : ''} this month
                  </AppText>
                </View>
              </View>

              {/* Right side balance & change status */}
              <View style={styles.rightContent}>
                {isCredit ? (
                  <AppText style={styles.dueBalanceText}>
                    {(acc.dueAmount || 0) > 0 ? `Due: ${formatAmount(acc.dueAmount || 0)}` : `Due: ${sym}0`}
                  </AppText>
                ) : (
                  <AppText style={styles.positiveBalanceText}>
                    {formatAmount(acc.balance)}
                  </AppText>
                )}

                {isOutflow ? (
                  <View style={styles.duePill}>
                    <AppText style={styles.duePillText}>
                      ↘ -{formatAmount(Math.abs(acc.monthlyChange))}
                    </AppText>
                  </View>
                ) : isInflow ? (
                  <View style={styles.positivePill}>
                    <AppText style={styles.positivePillText}>
                      ↗ +{formatAmount(Math.abs(acc.monthlyChange))}
                    </AppText>
                  </View>
                ) : (
                  <AppText style={styles.noChangeText}>No change</AppText>
                )}
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
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: expenseColors.circleBtnBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  accountName: {
    color: expenseColors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  txnSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  rightContent: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  positiveBalanceText: {
    color: expenseColors.textPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    marginBottom: 2,
  },
  dueBalanceText: {
    color: expenseColors.accentRed,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  neutralBalanceText: {
    color: expenseColors.textPrimary,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    marginBottom: 2,
  },
  positivePill: {
    backgroundColor: expenseColors.accentGreenBg,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  positivePillText: {
    color: expenseColors.accentGreen,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  duePill: {
    backgroundColor: expenseColors.accentRedBg,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  duePillText: {
    color: expenseColors.accentRed,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  noChangeText: {
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
});
