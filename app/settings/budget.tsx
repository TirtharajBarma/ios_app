import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Hash,
  Star,
  ShoppingBag,
  Tv,
  Heart,
  Banknote,
  Car,
  Zap,
  MoreHorizontal,
  UtensilsCrossed,
  Check,
  Plus,
  Minus,
  RotateCcw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { expenseColors } from '@/constants/expenseColors';
import { useExpenseStore } from '@/store/useExpenseStore';
import { CategoryIcon, getCategoryBgColor } from '@/components/expense/CategoryIcon';

export default function MonthlyBudgetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    monthlyBudget,
    currencySymbol,
    categories,
    categoryBudgets,
    setMonthlyBudget,
    setAllCategoryBudgets,
  } = useExpenseStore();

  const [activeTab, setActiveTab] = useState<'overall' | 'category'>('overall');
  const [budgetInput, setBudgetInput] = useState(monthlyBudget.toString());
  const [isKeypadModalVisible, setIsKeypadModalVisible] = useState(false);

  // Local state for category budgets so user can edit and save
  const [localCategoryBudgets, setLocalCategoryBudgets] = useState<Record<string, number>>(
    categoryBudgets || { cat_cig: 3000 }
  );

  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.id !== 'cat_income');
  }, [categories]);

  const allocatedAmount = useMemo(() => {
    return Object.values(localCategoryBudgets).reduce((sum, val) => sum + (val || 0), 0);
  }, [localCategoryBudgets]);

  const numericMonthlyBudget = parseFloat(budgetInput) || 0;
  const remainingAmount = numericMonthlyBudget - allocatedAmount;
  const allocatedRatio = numericMonthlyBudget > 0 ? Math.min(Math.max(allocatedAmount / numericMonthlyBudget, 0), 1) : 0;

  const activeCategoryCount = useMemo(() => {
    return Object.values(localCategoryBudgets).filter((v) => v > 0).length;
  }, [localCategoryBudgets]);

  const handleQuickPreset = (amount: number) => {
    Haptics.selectionAsync();
    setBudgetInput(amount.toString());
  };

  const handleCategoryAmountChange = (catId: string, amount: number) => {
    Haptics.selectionAsync();
    setLocalCategoryBudgets((prev) => ({
      ...prev,
      [catId]: Math.max(0, amount),
    }));
  };

  const handleAdjustCategory = (catId: string, delta: number) => {
    Haptics.selectionAsync();
    const current = localCategoryBudgets[catId] || 0;
    const next = Math.max(0, current + delta);
    setLocalCategoryBudgets((prev) => ({
      ...prev,
      [catId]: next,
    }));
  };

  const handleSaveAll = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const finalBudget = Math.max(0, parseFloat(budgetInput) || monthlyBudget);
    setMonthlyBudget(finalBudget);
    setAllCategoryBudgets(localCategoryBudgets);
    router.back();
  };

  const renderCategoryIcon = (iconName?: string, catId?: string, catColor?: string) => {
    return (
      <CategoryIcon
        iconName={iconName}
        catId={catId}
        color={catColor}
        size={18}
        strokeWidth={2}
        fill={true}
      />
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top Header Row matching reference */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <AppText style={styles.counterText}>
          {activeCategoryCount} of {expenseCategories.length} set
        </AppText>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 220 },
          ]}
        >
        {/* Title & Subtitle */}
        <View style={styles.titleSection}>
          <AppText style={styles.mainTitle}>
            Set up a monthly{'\n'}budget goal
          </AppText>
          <AppText style={styles.mainSubtitle}>
            Total budget is {currencySymbol}{numericMonthlyBudget.toLocaleString('en-IN')}
          </AppText>
        </View>

        {/* Segmented Control Toggle: OVERALL | BY CATEGORY */}
        <View style={styles.segmentedContainer}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'overall' && styles.segmentBtnActive,
            ]}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('overall');
            }}
          >
            <AppText
              style={[
                styles.segmentText,
                activeTab === 'overall' && styles.segmentTextActive,
              ]}
            >
              OVERALL
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'category' && styles.segmentBtnActive,
            ]}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('category');
            }}
          >
            <AppText
              style={[
                styles.segmentText,
                activeTab === 'category' && styles.segmentTextActive,
              ]}
            >
              BY CATEGORY
            </AppText>
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════════════════
            TAB 1: OVERALL BUDGET VIEW (IMAGE COPY 5)
        ══════════════════════════════════════════════ */}
        {activeTab === 'overall' && (
          <View style={styles.tabContent}>
            {/* Card 1: MONTHLY LIMIT */}
            <View style={styles.card}>
              <AppText style={styles.cardHeading}>MONTHLY LIMIT</AppText>

              <View style={styles.amountInputRow}>
                <View style={styles.amountDisplayLeft}>
                  <AppText style={styles.symbolPrefix}>{currencySymbol}</AppText>
                  <TextInput
                    value={budgetInput}
                    onChangeText={setBudgetInput}
                    keyboardType="numeric"
                    style={styles.largeAmountInput}
                    selectionColor={expenseColors.accentPeach}
                  />
                </View>

                {/* Keypad button */}
                <TouchableOpacity
                  style={styles.keypadBtn}
                  activeOpacity={0.8}
                  onPress={() => setIsKeypadModalVisible(true)}
                >
                  <Hash size={20} color={expenseColors.accentPeach} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {/* Quick Preset Chips */}
              <View style={styles.presetsRow}>
                {[10000, 25000, 50000, 100000].map((amt) => {
                  const label = amt >= 100000 ? `${currencySymbol}1.0L` : `${currencySymbol}${amt / 1000}.0K`;
                  const isSelected = numericMonthlyBudget === amt;
                  return (
                    <TouchableOpacity
                      key={amt}
                      style={[styles.presetChip, isSelected && styles.presetChipActive]}
                      activeOpacity={0.7}
                      onPress={() => handleQuickPreset(amt)}
                    >
                      <AppText
                        style={[
                          styles.presetChipText,
                          isSelected && styles.presetChipTextActive,
                        ]}
                      >
                        {label}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <AppText style={styles.helperText}>
                Your total spending limit across all categories.
              </AppText>
            </View>

            {/* Card 2: SUMMARY */}
            <View style={styles.card}>
              <AppText style={styles.cardHeading}>SUMMARY</AppText>

              <View style={styles.summaryItem}>
                <AppText style={styles.summaryLabel}>Overall budget</AppText>
                <AppText style={styles.summaryValue}>
                  {currencySymbol}{numericMonthlyBudget.toLocaleString('en-IN')}
                </AppText>
              </View>

              <View style={styles.summaryItem}>
                <AppText style={styles.summaryLabel}>Allocated to categories</AppText>
                <AppText style={styles.summaryValue}>
                  {currencySymbol}{allocatedAmount.toLocaleString('en-IN')}
                </AppText>
              </View>

              <View style={styles.summaryItem}>
                <AppText style={styles.summaryLabel}>Remaining</AppText>
                <AppText style={[styles.summaryValue, styles.remainingGreen]}>
                  {currencySymbol}{remainingAmount.toLocaleString('en-IN')}
                </AppText>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(allocatedRatio * 100, 2)}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════
            TAB 2: BY CATEGORY BUDGET VIEW
        ══════════════════════════════════════════════ */}
        {activeTab === 'category' && (
          <View style={styles.tabContent}>
            {/* Allocation Status Header */}
            <View style={styles.allocationStatusCard}>
              <View style={styles.allocationStatusRow}>
                <View>
                  <AppText style={styles.allocationLabel}>Unallocated</AppText>
                  <AppText
                    style={[
                      styles.allocationAmount,
                      remainingAmount < 0 ? styles.remainingRed : styles.remainingGreen,
                    ]}
                  >
                    {currencySymbol}{remainingAmount.toLocaleString('en-IN')}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText style={styles.allocationLabel}>Total Cap</AppText>
                  <AppText style={styles.allocationAmount}>
                    {currencySymbol}{numericMonthlyBudget.toLocaleString('en-IN')}
                  </AppText>
                </View>
              </View>
            </View>

            {/* Category Custom Budget List */}
            <View style={styles.categoryBudgetsStack}>
              {expenseCategories.map((cat) => {
                const currentBudget = localCategoryBudgets[cat.id] || 0;
                return (
                  <View key={cat.id} style={styles.categoryBudgetCard}>
                    <View style={styles.catBudgetTop}>
                      <View style={styles.catInfoLeft}>
                        <View
                          style={[
                            styles.catIconBox,
                            { backgroundColor: `${cat.color}28` },
                          ]}
                        >
                          {renderCategoryIcon(cat.iconName, cat.id, cat.color)}
                        </View>
                        <View>
                          <AppText style={styles.catNameText}>
                            {cat.name.toUpperCase()} {cat.emoji || ''}
                          </AppText>
                          <AppText style={styles.catSubText}>
                            {currentBudget > 0
                              ? `${currencySymbol}${currentBudget.toLocaleString('en-IN')} budget`
                              : 'No budget set'}
                          </AppText>
                        </View>
                      </View>

                      {/* Stepper & Direct Editable Numeric Input */}
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          activeOpacity={0.7}
                          onPress={() => handleAdjustCategory(cat.id, -100)}
                        >
                          <Minus size={14} color="#FFFFFF" />
                        </TouchableOpacity>

                        <View style={styles.stepperInputWrapper}>
                          <AppText style={styles.stepperCurrencyPrefix}>{currencySymbol}</AppText>
                          <TextInput
                            style={styles.stepperTextInput}
                            value={currentBudget === 0 ? '' : currentBudget.toString()}
                            placeholder="0"
                            placeholderTextColor="#5A5E6D"
                            keyboardType="number-pad"
                            onChangeText={(text) => {
                              const clean = text.replace(/[^0-9]/g, '');
                              const val = clean ? parseInt(clean, 10) : 0;
                              handleCategoryAmountChange(cat.id, val);
                            }}
                          />
                        </View>

                        <TouchableOpacity
                          style={styles.stepperBtn}
                          activeOpacity={0.7}
                          onPress={() => handleAdjustCategory(cat.id, 100)}
                        >
                          <Plus size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Quick increment chips */}
                    <View style={styles.catChipsRow}>
                      {[500, 1000, 2000, 5000].map((amt) => (
                        <TouchableOpacity
                          key={amt}
                          style={styles.catSmallChip}
                          onPress={() => handleAdjustCategory(cat.id, amt)}
                          activeOpacity={0.7}
                        >
                          <AppText style={styles.catSmallChipText}>
                            +{currencySymbol}{amt >= 1000 ? `${amt / 1000}k` : amt}
                          </AppText>
                        </TouchableOpacity>
                      ))}

                      {currentBudget > 0 && (
                        <TouchableOpacity
                          style={styles.catResetChip}
                          onPress={() => handleCategoryAmountChange(cat.id, 0)}
                          activeOpacity={0.7}
                        >
                          <RotateCcw size={11} color={expenseColors.textMuted} />
                          <AppText style={styles.catResetText}>Reset</AppText>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Save Button Fixed at Bottom */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={styles.saveBtn}
          activeOpacity={0.85}
          onPress={handleSaveAll}
        >
          <AppText style={styles.saveBtnText}>Save Budget Goal</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F1015',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  counterText: {
    color: expenseColors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  titleSection: {
    marginBottom: 20,
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  mainSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },

  // Segmented Control Pill
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#22242F',
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  segmentBtnActive: {
    backgroundColor: expenseColors.accentPeach,
  },
  segmentText: {
    color: expenseColors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.0,
  },
  segmentTextActive: {
    color: '#0F1015',
  },

  tabContent: {
    gap: 14,
  },
  card: {
    backgroundColor: '#16171E',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardHeading: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },

  // Amount input
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  amountDisplayLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flex: 1,
  },
  symbolPrefix: {
    color: expenseColors.textSubtle,
    fontSize: 24,
    fontWeight: '700',
  },
  largeAmountInput: {
    color: '#FFFFFF',
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -0.5,
    flex: 1,
    padding: 0,
  },
  keypadBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#22242F',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Presets Row
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#22242F',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipActive: {
    backgroundColor: 'rgba(255, 157, 102, 0.2)',
    borderWidth: 1,
    borderColor: expenseColors.accentPeach,
  },
  presetChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  presetChipTextActive: {
    color: expenseColors.accentPeach,
  },
  helperText: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },

  // Summary Card
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    color: expenseColors.textSubtle,
    fontSize: 13,
    fontWeight: '500',
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  remainingGreen: {
    color: expenseColors.accentGreen,
  },
  remainingRed: {
    color: expenseColors.accentRed,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#22242F',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: expenseColors.accentPeach,
    borderRadius: 3,
  },

  // By Category View
  allocationStatusCard: {
    backgroundColor: '#16171E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  allocationStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allocationLabel: {
    color: expenseColors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  allocationAmount: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  categoryBudgetsStack: {
    gap: 10,
  },
  categoryBudgetCard: {
    backgroundColor: '#16171E',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    gap: 10,
  },
  catBudgetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  catIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catNameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  catSubText: {
    color: expenseColors.textMuted,
    fontSize: 11,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22242F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22242F',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 76,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepperCurrencyPrefix: {
    color: expenseColors.accentPeach,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 2,
  },
  stepperTextInput: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 44,
    padding: 0,
  },
  catChipsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  catSmallChip: {
    backgroundColor: '#22242F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  catSmallChipText: {
    color: '#E0E0E0',
    fontSize: 10,
    fontWeight: '600',
  },
  catResetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  catResetText: {
    color: expenseColors.textMuted,
    fontSize: 10,
  },

  // Bottom Save Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F1015',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  saveBtn: {
    height: 50,
    backgroundColor: expenseColors.accentPeach,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#0F1015',
    fontSize: 15,
    fontWeight: '700',
  },
});
