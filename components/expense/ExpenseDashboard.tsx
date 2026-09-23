import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ExpenseTabType>('home');

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

        {/* Money Flow Card */}
        <MoneyFlowCard />

        {/* Budget Card with Donut Chart */}
        <BudgetCard />

        {/* Accounts Section */}
        <AccountsSection onAccountPress={handleAccountPress} />
      </ScrollView>

      {/* Fixed Bottom Navigation */}
      <FixedBottomNav
        activeTab={activeTab}
        onTabPress={(tab) => setActiveTab(tab)}
      />

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
});
