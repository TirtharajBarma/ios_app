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
  const { accounts, currencySymbol } = useExpenseStore();
  const sym = currencySymbol || '₹';

  const renderAccountIcon = (name: string) => {
    const upper = name.toUpperCase();
    if (upper.includes('WALLET')) {
      return <Wallet size={16} color={expenseColors.textSubtle} strokeWidth={2} />;
    }
    if (upper.includes('AXIS') || upper.includes('SLICE')) {
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
          const isPositive = acc.statusType === 'positive';
          const isDue = acc.statusType === 'due';
          const isNoChange = acc.statusType === 'no_change';

          const formattedBalance = acc.balance.toLocaleString('en-IN');
          const formattedDue = acc.dueAmount ? acc.dueAmount.toLocaleString('en-IN') : '0';
          const formattedChange = Math.abs(acc.monthlyChange).toLocaleString('en-IN');

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
                  {renderAccountIcon(acc.name)}
                </View>
                <View style={styles.textContainer}>
                  <AppText style={styles.accountName} numberOfLines={1}>
                    {acc.name.toUpperCase()}
                  </AppText>
                  <AppText style={styles.txnSubtitle} numberOfLines={1}>
                    {acc.txnCountThisMonth} txns this month
                  </AppText>
                </View>
              </View>

              {/* Right side balance & change status */}
              <View style={styles.rightContent}>
                {isDue ? (
                  <>
                    <AppText style={styles.dueBalanceText}>
                      Due: {`${sym}${formattedDue}`}
                    </AppText>
                    <View style={styles.duePill}>
                      <AppText style={styles.duePillText}>
                        ↘ -{`${sym}${formattedChange}`}
                      </AppText>
                    </View>
                  </>
                ) : isPositive ? (
                  <>
                    <AppText style={styles.positiveBalanceText}>
                      {`${sym}${formattedBalance}`}
                    </AppText>
                    <View style={styles.positivePill}>
                      <AppText style={styles.positivePillText}>
                        ↗ +{`${sym}${formattedChange}`}
                      </AppText>
                    </View>
                  </>
                ) : (
                  <>
                    <AppText style={styles.neutralBalanceText}>
                      {`${sym}${formattedBalance}`}
                    </AppText>
                    <AppText style={styles.noChangeText}>No change</AppText>
                  </>
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
