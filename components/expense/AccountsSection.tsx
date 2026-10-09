import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useExpenseStore, monthKeyToYearMonth } from '@/store/useExpenseStore';
import { useShallow } from 'zustand/react/shallow';
import { ExpenseAccount } from '@/types/expense';
import { expenseColors } from '@/constants/expenseColors';
import { getCreditCardDueStatus } from '@/utils/creditCard';
import * as Haptics from 'expo-haptics';
import { AccountIcon } from './AccountIcon';

interface AccountsSectionProps {
  onAccountPress?: (account: ExpenseAccount) => void;
}

function SpringAccountCard({
  acc,
  formatAmount,
  isCurrentMonth = true,
  onPress,
}: {
  acc: ExpenseAccount;
  formatAmount: (val: number) => string;
  isCurrentMonth?: boolean;
  onPress?: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  const isCredit = acc.type === 'credit';
  const hasDue = isCredit && (acc.dueAmount || 0) > 0;
  const typeLabel =
    acc.type === 'credit'
      ? 'Credit Card'
      : acc.type === 'wallet'
      ? 'Wallet'
      : 'Savings';
  const txLabel = `${acc.txnCountThisMonth} txn${acc.txnCountThisMonth !== 1 ? 's' : ''}`;
  const dueStatus = isCredit && isCurrentMonth
    ? getCreditCardDueStatus(acc.dueDay, acc.billingDay, acc.dueAmount || 0)
    : null;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.accountCard}
        activeOpacity={0.88}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress?.();
        }}
      >
        {/* Left side icon & info */}
        <View style={styles.leftContent}>
          <AccountIcon
            name={acc.name}
            type={acc.type || 'savings'}
            size={17}
            containerSize={38}
            borderRadius={12}
          />
          <View style={styles.textContainer}>
            <View style={styles.nameRow}>
              <AppText style={[styles.accountName, { flexShrink: 1 }]} numberOfLines={1}>
                {acc.name.toUpperCase()}
              </AppText>
              {dueStatus?.hasDueInfo && (
                <View
                  style={[
                    styles.dueBadge,
                    { flexShrink: 0 },
                    dueStatus.status === 'paid'
                      ? styles.dueBadgePaid
                      : dueStatus.isUrgent
                      ? styles.dueBadgeUrgent
                      : styles.dueBadgeUpcoming,
                  ]}
                >
                  <AppText
                    style={[
                      styles.dueBadgeText,
                      dueStatus.status === 'paid'
                        ? styles.dueBadgePaidText
                        : dueStatus.isUrgent
                        ? styles.dueBadgeUrgentText
                        : styles.dueBadgeUpcomingText,
                    ]}
                  >
                    {dueStatus.badgeLabel}
                  </AppText>
                </View>
              )}
            </View>
            <AppText style={styles.txnSubtitle} numberOfLines={1}>
              {typeLabel} • {txLabel}
            </AppText>
          </View>
        </View>

        {/* Right side clean balance */}
        <View style={styles.rightContent}>
          <View style={styles.balanceCol}>
            {isCredit ? (
              hasDue ? (
                <AppText
                  style={styles.dueBalanceText}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                >
                  Due: {formatAmount(acc.dueAmount || 0)}
                </AppText>
              ) : (
                <AppText style={styles.noDueText}>No Due</AppText>
              )
            ) : (
              <AppText
                style={styles.positiveBalanceText}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {formatAmount(acc.balance)}
              </AppText>
            )}
          </View>

          <ChevronRight size={15} color={expenseColors.textMuted} style={styles.chevron} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export const AccountsSection: React.FC<AccountsSectionProps> = ({ onAccountPress }) => {
  const { accounts, currencySymbol, formatAmount, selectedMonth } = useExpenseStore(
    useShallow((s) => ({
      accounts: s.accounts,
      currencySymbol: s.currencySymbol,
      formatAmount: s.formatAmount,
      selectedMonth: s.selectedMonth,
    }))
  );

  const now = new Date();
  const { year: selYear, month: selMonth } = monthKeyToYearMonth(selectedMonth);
  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth();

  const activeAccounts = accounts.filter((acc) => !acc.isArchived);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <AppText style={styles.sectionTitle}>ACCOUNTS</AppText>

      {/* Account Cards */}
      <View style={styles.cardsStack}>
        {activeAccounts.map((acc) => (
          <SpringAccountCard
            key={acc.id}
            acc={acc}
            formatAmount={formatAmount}
            isCurrentMonth={isCurrentMonth}
            onPress={() => onAccountPress?.(acc)}
          />
        ))}
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
    minWidth: 0,
    marginRight: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1E2028',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textContainer: {
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  dueBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dueBadgeUpcoming: {
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
  },
  dueBadgeUrgent: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
  },
  dueBadgePaid: {
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
  },
  dueBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dueBadgeUpcomingText: {
    color: expenseColors.accentPeach,
  },
  dueBadgeUrgentText: {
    color: '#FF6B6B',
  },
  dueBadgePaidText: {
    color: expenseColors.accentGreen,
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
    gap: 8,
    flexShrink: 0,
  },
  balanceCol: {
    alignItems: 'flex-end',
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
    marginLeft: 0,
    opacity: 0.6,
  },
});
