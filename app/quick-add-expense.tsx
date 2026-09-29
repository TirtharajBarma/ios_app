import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { useExpenseStore, getUserCategories } from '@/store/useExpenseStore';
import { createExpense, localISODate } from '@/services/expense/createExpense';
import { expenseColors } from '@/constants/expenseColors';

type PickerItem = { id: string; name: string };

function ChipRow({
  label,
  items,
  selectedId,
  onSelect,
  emptyLabel,
}: {
  label: string;
  items: PickerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyLabel: string;
}) {
  return (
    <View style={styles.section}>
      <AppText style={styles.label}>{label}</AppText>
      {items.length === 0 ? (
        <AppText style={styles.empty}>{emptyLabel}</AppText>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onSelect(item.id);
                }}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <AppText style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {item.name}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Quick Add Expense screen / modal.
 *
 * Supports standalone opening, deep linking (`subscription://quick-add-expense`),
 * and query parameters (`?amount=100&category=Food`).
 */
export default function QuickAddExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    amount?: string;
    category?: string;
    account?: string;
    note?: string;
  }>();
  const insets = useSafeAreaInsets();
  const accounts = useExpenseStore((s) => s.accounts);
  const categories = useExpenseStore((s) => s.categories);
  const currencySymbol = useExpenseStore((s) => s.currencySymbol);

  const sym = currencySymbol || '₹';
  const expenseCategories = useMemo(
    () => getUserCategories(categories),
    [categories]
  );

  const [amount, setAmount] = useState(params.amount ? String(params.amount) : '');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState(params.note ? String(params.note) : '');
  const [error, setError] = useState<string | null>(null);

  // Match initial category from query parameter if provided
  useEffect(() => {
    if (params.category && expenseCategories.length > 0) {
      const match = expenseCategories.find(
        (c) => c.name.toLowerCase() === params.category?.toLowerCase() || c.id === params.category
      );
      if (match) setCategoryId(match.id);
    }
  }, [params.category, expenseCategories]);

  // Match initial account from query parameter if provided
  useEffect(() => {
    if (params.account && accounts.length > 0) {
      const match = accounts.find(
        (a) => a.name.toLowerCase() === params.account?.toLowerCase() || a.id === params.account
      );
      if (match) setAccountId(match.id);
    }
  }, [params.account, accounts]);

  const effectiveAccountId =
    accountId ?? accounts.find((a) => a.type !== 'credit')?.id ?? accounts[0]?.id ?? null;
  const effectiveCategoryId =
    categoryId ?? expenseCategories.find((c) => c.id === 'cat_food')?.id
      ?? expenseCategories[0]?.id ?? null;

  const handleSave = () => {
    setError(null);

    const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    const result = createExpense({
      amount: parsedAmount,
      categoryId: effectiveCategoryId ?? '',
      accountId: effectiveAccountId ?? '',
      date: localISODate(),
      note: note.trim() || undefined,
    });

    if (!result.ok) {
      setError(result.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
  const canSave = !isNaN(parsedAmount) && parsedAmount > 0 && Boolean(effectiveAccountId) && Boolean(effectiveCategoryId);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: expenseColors.bgPrimary }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 8,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        {/* iOS Modal Grabber */}
        <View style={styles.grabberContainer}>
          <View style={styles.grabber} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <X size={20} color={expenseColors.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
          <AppText style={styles.title}>Quick Add</AppText>
          <View style={styles.iconButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Amount Card */}
          <View style={styles.heroAmountCard}>
            <AppText style={styles.heroAmountLabel}>AMOUNT</AppText>
            <View style={styles.heroAmountRow}>
              <AppText style={styles.heroCurrency}>{sym}</AppText>
              <TextInput
                style={styles.heroAmountInput}
                placeholder="0"
                placeholderTextColor="rgba(255, 255, 255, 0.25)"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>
          </View>

          {/* Account Chips */}
          <ChipRow
            label="ACCOUNT"
            items={accounts.map((a) => ({ id: a.id, name: a.name }))}
            selectedId={effectiveAccountId}
            onSelect={setAccountId}
            emptyLabel="Add an account in Settings first."
          />

          {/* Category Chips */}
          <ChipRow
            label="CATEGORY"
            items={expenseCategories.map((c) => ({ id: c.id, name: c.name }))}
            selectedId={effectiveCategoryId}
            onSelect={setCategoryId}
            emptyLabel="No expense categories yet."
          />

          {/* Note Input */}
          <View style={styles.section}>
            <AppText style={styles.label}>NOTE (OPTIONAL)</AppText>
            <TextInput
              style={styles.textInput}
              placeholder="What was it for?"
              placeholderTextColor="rgba(255, 255, 255, 0.25)"
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
            />
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}
        </ScrollView>

        {/* Save Button */}
        <TouchableOpacity
          activeOpacity={canSave ? 0.85 : 1}
          disabled={!canSave}
          onPress={handleSave}
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        >
          <Check size={20} color="#101114" strokeWidth={2.8} />
          <AppText style={styles.saveButtonText}>Save expense</AppText>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: expenseColors.bgPrimary,
    paddingHorizontal: 20,
  },
  grabberContainer: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 4,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: expenseColors.textPrimary,
  },
  content: {
    paddingBottom: 24,
  },
  heroAmountCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  heroAmountLabel: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  heroCurrency: {
    color: '#FF9D66',
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    marginRight: 6,
    includeFontPadding: false,
  },
  heroAmountInput: {
    color: expenseColors.textPrimary,
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '800',
    minWidth: 80,
    textAlign: 'left',
    paddingVertical: 0,
  },
  section: {
    marginTop: 20,
  },
  label: {
    color: '#7E8394',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  empty: {
    color: expenseColors.textMuted,
    fontSize: 13,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: expenseColors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipSelected: {
    backgroundColor: '#FF9D66',
    borderColor: '#FF9D66',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: expenseColors.textSecondary,
  },
  chipTextSelected: {
    color: '#101114',
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: expenseColors.textPrimary,
  },
  error: {
    marginTop: 16,
    fontSize: 13,
    color: expenseColors.accentRed,
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9D66',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#101114',
    fontSize: 16,
    fontWeight: '800',
  },
});
