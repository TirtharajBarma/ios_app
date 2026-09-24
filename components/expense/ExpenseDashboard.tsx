import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Plus,
  X,
  Wallet,
  PieChart,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import { ExpenseHeader } from './ExpenseHeader';
import { MonthSummary } from './MonthSummary';
import { MoneyFlowCard } from './MoneyFlowCard';
import { BudgetCard } from './BudgetCard';
import { AccountsSection } from './AccountsSection';
import { FixedBottomNav, ExpenseTabType } from './FixedBottomNav';
import { AddTransactionModal } from './AddTransactionModal';
import { AccountsListModal } from './AccountsListModal';
import { EditAccountModal } from './EditAccountModal';
import { ExpenseAccount } from '@/types/expense';

export const ExpenseDashboard: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { transactions, accounts, monthlyBudget, currencySymbol } = useExpenseStore();
  const [dismissOnboarding, setDismissOnboarding] = useState<boolean>(false);

  const [showAddTxModal, setShowAddTxModal] = useState<boolean>(false);
  const [showAccountsModal, setShowAccountsModal] = useState<boolean>(false);
  const [selectedAccountForEdit, setSelectedAccountForEdit] = useState<ExpenseAccount | null>(null);
  const [showEditAccountModal, setShowEditAccountModal] = useState<boolean>(false);

  const handleAddPress = () => {
    setShowAddTxModal(true);
  };

  const handleFilterPress = () => {
    setShowAccountsModal(true);
  };

  const handleAccountPress = (acc: ExpenseAccount) => {
    setSelectedAccountForEdit(acc);
    setShowEditAccountModal(true);
  };

  const handleCategorySelect = (_catId: string) => {
    // Tapping category in arc inspects category spend only, does not open Add Transaction modal
  };

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0F1015" translucent />

      {/* Top Safe Area Background Fill */}
      <View style={{ height: insets.top, backgroundColor: '#0F1015', zIndex: 10 }} />

      {/* Main Vertically Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 4,
            paddingBottom: insets.bottom + 80,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <ExpenseHeader
          onAddPress={handleAddPress}
          onFilterPress={handleFilterPress}
        />

        {/* Month Summary & Quick Category Actions */}
        <MonthSummary onCategorySelect={handleCategorySelect} />

        {/* First-Time User Onboarding Guide Checklist */}
        {transactions.length === 0 && !dismissOnboarding && (
          <View style={styles.onboardingCard}>
            <View style={styles.onboardingHeader}>
              <View style={styles.onboardingBadge}>
                <Sparkles size={13} color="#FF9D66" />
                <AppText style={styles.onboardingBadgeText}>GETTING STARTED</AppText>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setDismissOnboarding(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color={expenseColors.textMuted} />
              </TouchableOpacity>
            </View>

            <AppText style={styles.onboardingTitle}>
              Welcome! Let's set up your ledger
            </AppText>
            <AppText style={styles.onboardingSub}>
              Follow these simple steps to start tracking your wealth local-first:
            </AppText>

            <View style={styles.stepsContainer}>
              {/* Step 1: Accounts */}
              <View style={styles.stepRow}>
                <View style={[styles.stepIconWrap, accounts.length > 0 && styles.stepIconWrapDone]}>
                  {accounts.length > 0 ? (
                    <CheckCircle2 size={16} color={expenseColors.accentGreen} />
                  ) : (
                    <Wallet size={16} color={expenseColors.accentPeach} />
                  )}
                </View>
                <View style={styles.stepTextCol}>
                  <View style={styles.stepTitleRow}>
                    <AppText style={styles.stepTitle}>1. Payment Accounts</AppText>
                    {accounts.length > 0 ? (
                      <View style={styles.stepDoneBadge}>
                        <AppText style={styles.stepDoneText}>{accounts.length} active</AppText>
                      </View>
                    ) : (
                      <View style={styles.stepReqBadge}>
                        <AppText style={styles.stepReqText}>Required first</AppText>
                      </View>
                    )}
                  </View>
                  <AppText style={styles.stepDesc}>
                    {accounts.length > 0
                      ? 'Payment accounts ready. Transactions can now be linked.'
                      : 'Every transaction requires a funding account (Bank, Cash, or Card). Add your primary account.'}
                  </AppText>
                  {accounts.length === 0 && (
                    <TouchableOpacity
                      style={styles.stepActionBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setSelectedAccountForEdit(null);
                        setShowEditAccountModal(true);
                      }}
                    >
                      <Plus size={13} color="#0F1015" strokeWidth={2.5} />
                      <AppText style={styles.stepActionBtnText}>Add First Account</AppText>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.stepDivider} />

              {/* Step 2: Budget */}
              <View style={styles.stepRow}>
                <View style={[styles.stepIconWrap, styles.stepIconWrapDone]}>
                  <PieChart size={16} color={expenseColors.accentBlue} />
                </View>
                <View style={styles.stepTextCol}>
                  <View style={styles.stepTitleRow}>
                    <AppText style={styles.stepTitle}>2. Monthly Budget Goal</AppText>
                    <View style={styles.stepDoneBadge}>
                      <AppText style={styles.stepDoneText}>{currencySymbol}{monthlyBudget.toLocaleString('en-IN')}</AppText>
                    </View>
                  </View>
                  <AppText style={styles.stepDesc}>
                    Overall spending limit. You can adjust limits by category anytime.
                  </AppText>
                  <TouchableOpacity
                    style={styles.stepActionOutlineBtn}
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      router.push('/settings/budget');
                    }}
                  >
                    <AppText style={styles.stepActionOutlineBtnText}>Customize Budget</AppText>
                    <ArrowRight size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stepDivider} />

              {/* Step 3: First Transaction */}
              <View style={styles.stepRow}>
                <View style={styles.stepIconWrap}>
                  <Circle size={16} color={expenseColors.textMuted} />
                </View>
                <View style={styles.stepTextCol}>
                  <View style={styles.stepTitleRow}>
                    <AppText style={styles.stepTitle}>3. Record Expenses</AppText>
                  </View>
                  <AppText style={styles.stepDesc}>
                    Log manually with splits and notes, or import your bank statements via CSV.
                  </AppText>
                  <View style={styles.stepButtonsRow}>
                    <TouchableOpacity
                      style={styles.stepActionBtn}
                      activeOpacity={0.8}
                      onPress={handleAddPress}
                    >
                      <Plus size={13} color="#0F1015" strokeWidth={2.5} />
                      <AppText style={styles.stepActionBtnText}>Log Expense</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stepActionOutlineBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        router.push('/(tabs)/import');
                      }}
                    >
                      <FileSpreadsheet size={13} color="#FFFFFF" />
                      <AppText style={styles.stepActionOutlineBtnText}>Import CSV</AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Money Flow Card */}
        <MoneyFlowCard />

        {/* Budget Card with Donut Chart */}
        <BudgetCard />

        {/* Accounts Section */}
        <AccountsSection onAccountPress={handleAccountPress} />
      </ScrollView>

      {/* Fixed Bottom Navigation */}
      <FixedBottomNav activeTab="home" />

      {/* Add Transaction Modal */}
      <AddTransactionModal
        visible={showAddTxModal}
        onClose={() => setShowAddTxModal(false)}
      />

      {/* Accounts Listing Modal */}
      <AccountsListModal
        visible={showAccountsModal}
        onClose={() => setShowAccountsModal(false)}
      />

      {/* Edit Account Modal (When tapped from AccountsSection) */}
      <EditAccountModal
        visible={showEditAccountModal}
        account={selectedAccountForEdit}
        onClose={() => setShowEditAccountModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#0F1015',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  onboardingCard: {
    backgroundColor: '#16171E',
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.22)',
  },
  onboardingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  onboardingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  onboardingBadgeText: {
    color: '#FF9D66',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  onboardingTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  onboardingSub: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  stepsContainer: {
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepIconWrapDone: {
    backgroundColor: 'rgba(92, 228, 154, 0.1)',
  },
  stepTextCol: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  stepDesc: {
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8,
  },
  stepDoneBadge: {
    backgroundColor: 'rgba(92, 228, 154, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stepDoneText: {
    color: '#5CE49A',
    fontSize: 10,
    fontWeight: '700',
  },
  stepReqBadge: {
    backgroundColor: 'rgba(255, 91, 91, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stepReqText: {
    color: '#FF5B5B',
    fontSize: 10,
    fontWeight: '700',
  },
  stepActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FF9D66',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  stepActionBtnText: {
    color: '#0F1015',
    fontSize: 11,
    fontWeight: '800',
  },
  stepActionOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepActionOutlineBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  stepButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
