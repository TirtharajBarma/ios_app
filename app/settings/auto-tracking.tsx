import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Smartphone,
  Zap,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Building2,
  ExternalLink,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText, NativeLiquidMenu } from '@/components/ui';
import type { MenuAction } from '@/components/ui';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useExpenseStore } from '@/store/useExpenseStore';
import { expenseColors } from '@/constants/expenseColors';
import {
  checkAutoTrackPermissions,
  openAutoTrackPermissionSettings,
  simulateIncomingFinancialMessage,
  drainPendingNativeTransactions,
} from '@/services/expense/autoTrackService';

export default function AutoTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    autoTrackSmsEnabled,
    setAutoTrackSmsEnabled,
    autoTrackAutoApprove,
    setAutoTrackAutoApprove,
    autoTrackDefaultAccountId,
    setAutoTrackDefaultAccountId,
  } = useSettingsStore();

  const { accounts, currencySymbol } = useExpenseStore();

  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const isAndroid = Platform.OS === 'android';

  const syncPermission = async () => {
    const status = await checkAutoTrackPermissions();
    setHasPermission(status.isGranted);
  };

  useEffect(() => {
    syncPermission();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncPermission();
        drainPendingNativeTransactions();
      }
    });

    return () => sub.remove();
  }, []);

  const handleToggleAutoTrack = async (val: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    if (val && isAndroid && !hasPermission) {
      await openAutoTrackPermissionSettings();
    }
    await setAutoTrackSmsEnabled(val);
  };

  const handleToggleAutoApprove = async (val: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    await setAutoTrackAutoApprove(val);
  };

  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === autoTrackDefaultAccountId) || accounts[0];
  }, [accounts, autoTrackDefaultAccountId]);

  const selectedAccountName = selectedAccount?.name || 'Default Account';

  const accountMenuActions: MenuAction[] = useMemo(() => {
    return accounts.map((acc) => {
      const isSelected =
        acc.id === autoTrackDefaultAccountId ||
        (!autoTrackDefaultAccountId && acc.id === accounts[0]?.id);
      return {
        id: acc.id,
        title: acc.name,
        subLabel: `${currencySymbol}${acc.balance.toLocaleString('en-IN')}`,
        state: isSelected ? 'on' : 'off',
      };
    });
  }, [accounts, autoTrackDefaultAccountId, currencySymbol]);

  const handleSelectAccount = (accId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setAutoTrackDefaultAccountId(accId);
  };

  const handleSimulateTest = async () => {
    Haptics.selectionAsync().catch(() => {});
    const sampleText =
      'HDFC Bank: Rs 450.00 debited from a/c **1234 on 08-OCT-26 to STARBUCKS. Avail Bal: Rs 14,200.';
    const res = await simulateIncomingFinancialMessage(sampleText, 'HDFC Bank');
    if (res) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Transaction Parsed',
        `Extracted: ${res.currency} ${res.amount.toFixed(2)} at ${res.merchant || 'Unknown'}\n\nCheck your Ledger tab to review and verify this transaction.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('Parser Test', 'Sample alert could not be parsed.');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={22} color={expenseColors.accentPeach} />
        </TouchableOpacity>

        <AppText style={styles.headerTitle}>Auto Tracking</AppText>

        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 40 },
        ]}
      >
        {/* ── SECTION 1: TRANSACTION TRACKING ── */}
        <View style={styles.sectionHeaderWrap}>
          <AppText style={styles.sectionHeader}>TRANSACTION DETECTION</AppText>
        </View>

        <View style={styles.groupedInsetCard}>
          {/* Master Auto-Track Row */}
          <View style={styles.groupedRowItem}>
            <View style={styles.iconRowLeft}>
              <View style={styles.iconSquare}>
                <Smartphone size={17} color={expenseColors.accentPeach} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <AppText style={styles.rowTitle}>Auto-Track SMS</AppText>
                <AppText style={styles.rowSubtitle}>
                  Detect debit & credit alerts from bank SMS
                </AppText>
              </View>
            </View>
            <Switch
              value={autoTrackSmsEnabled}
              onValueChange={handleToggleAutoTrack}
              trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
              thumbColor={Platform.OS === 'android' ? (autoTrackSmsEnabled ? '#FFFFFF' : '#8E8E93') : undefined}
              ios_backgroundColor="#282B37"
            />
          </View>

          {autoTrackSmsEnabled && (
            <>
              <View style={styles.divider} />

              {/* Auto-Approve Row */}
              <View style={styles.groupedRowItem}>
                <View style={styles.iconRowLeft}>
                  <View style={styles.iconSquare}>
                    <Zap size={17} color={expenseColors.accentPeach} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <AppText style={styles.rowTitle}>Auto-Approve to Ledger</AppText>
                    <AppText style={styles.rowSubtitle}>
                      Add verified expenses directly without manual review
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={autoTrackAutoApprove}
                  onValueChange={handleToggleAutoApprove}
                  trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
                  thumbColor={Platform.OS === 'android' ? (autoTrackAutoApprove ? '#FFFFFF' : '#8E8E93') : undefined}
                  ios_backgroundColor="#282B37"
                />
              </View>

              <View style={styles.divider} />

              {/* Default Account Dropdown Row */}
              <View style={styles.groupedRowItem}>
                <View style={styles.iconRowLeft}>
                  <View style={styles.iconSquare}>
                    <Building2 size={17} color={expenseColors.accentPeach} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <AppText style={styles.rowTitle}>Default Account</AppText>
                    <AppText style={styles.rowSubtitle}>
                      Fallback account for parsed charges
                    </AppText>
                  </View>
                </View>

                <NativeLiquidMenu
                  title="Default Account"
                  actions={accountMenuActions}
                  onSelect={handleSelectAccount}
                  style={{ alignSelf: 'flex-end' }}
                >
                  <View style={styles.dropdownPill}>
                    <AppText style={styles.dropdownPillText} numberOfLines={1}>
                      {selectedAccountName}
                    </AppText>
                    <ChevronDown size={13} color={expenseColors.accentPeach} />
                  </View>
                </NativeLiquidMenu>
              </View>
            </>
          )}
        </View>

        {/* Section 1 Footnote */}
        <View style={styles.sectionFooterWrap}>
          <AppText style={styles.sectionFooterText}>
            Bank SMS alerts are parsed 100% on your device using local pattern recognition. OTPs and personal messages are discarded. Financial data never leaves your phone.
          </AppText>
        </View>

        {/* ── SECTION 2: PLATFORM CAPABILITY ── */}
        {isAndroid ? (
          <>
            <View style={styles.sectionHeaderWrap}>
              <AppText style={styles.sectionHeader}>SYSTEM PERMISSIONS</AppText>
            </View>

            <View style={styles.groupedInsetCard}>
              <TouchableOpacity
                style={styles.groupedRowItem}
                activeOpacity={0.7}
                onPress={openAutoTrackPermissionSettings}
              >
                <View style={styles.iconRowLeft}>
                  <View style={styles.iconSquare}>
                    <ShieldCheck size={17} color={expenseColors.accentPeach} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <AppText style={styles.rowTitle}>SMS Permission</AppText>
                    <AppText style={styles.rowSubtitle}>
                      {hasPermission
                        ? 'Granted · Background listener active'
                        : 'Required to read incoming financial SMS'}
                    </AppText>
                  </View>
                </View>

                {hasPermission ? (
                  <View style={styles.statusPillActive}>
                    <AppText style={styles.statusPillActiveText}>Active</AppText>
                  </View>
                ) : (
                  <View style={styles.actionPillBtn}>
                    <AppText style={styles.actionPillBtnText}>Enable</AppText>
                    <ExternalLink size={11} color={expenseColors.accentPeach} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.sectionHeaderWrap}>
              <AppText style={styles.sectionHeader}>IOS COMPATIBILITY</AppText>
            </View>

            <View style={styles.groupedInsetCard}>
              <TouchableOpacity
                style={styles.groupedRowItem}
                activeOpacity={0.7}
                onPress={() => router.push('/settings/shortcut-setup')}
              >
                <View style={styles.iconRowLeft}>
                  <View style={styles.iconSquare}>
                    <ShieldCheck size={17} color={expenseColors.accentPeach} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <AppText style={styles.rowTitle}>iOS Siri Shortcut</AppText>
                    <AppText style={styles.rowSubtitle}>
                      Apple sandboxes SMS from apps. Use Monevo Shortcut to log expenses instantly.
                    </AppText>
                  </View>
                </View>
                <ChevronRight size={18} color={expenseColors.textSubtle} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── SECTION 3: TESTING & SIMULATION ── */}
        <View style={styles.sectionHeaderWrap}>
          <AppText style={styles.sectionHeader}>TESTING</AppText>
        </View>

        <View style={styles.groupedInsetCard}>
          <TouchableOpacity
            style={styles.groupedRowItem}
            activeOpacity={0.7}
            onPress={handleSimulateTest}
          >
            <View style={styles.iconRowLeft}>
              <View style={styles.iconSquare}>
                <Sparkles size={17} color={expenseColors.accentPeach} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <AppText style={styles.rowTitle}>Simulate Bank Alert</AppText>
                <AppText style={styles.rowSubtitle}>
                  Dispatch a sample ₹450 Starbucks SMS to test local parsing
                </AppText>
              </View>
            </View>
            <ChevronRight size={18} color={expenseColors.textSubtle} />
          </TouchableOpacity>
        </View>

        {/* ── FOOTER CAPTION ── */}
        <View style={styles.footerNoteWrap}>
          <AppText style={styles.footerNoteText}>
            Monevo On-Device Engine • Zero Cloud Telemetry • Private & Secure
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: expenseColors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: expenseColors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerRightSpacer: {
    width: 36,
  },
  scrollContent: {
    paddingTop: 8,
  },
  sectionHeaderWrap: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 7,
  },
  sectionHeader: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  groupedInsetCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    overflow: 'hidden',
  },
  groupedRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  iconRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconSquare: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    color: expenseColors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  rowSubtitle: {
    color: expenseColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 60,
  },
  dropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 157, 102, 0.12)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 102, 0.25)',
    alignSelf: 'flex-end',
    maxWidth: 160,
  },
  dropdownPillText: {
    color: expenseColors.accentPeach,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 120,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 157, 102, 0.15)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 157, 102, 0.3)',
  },
  actionPillBtnText: {
    color: expenseColors.accentPeach,
    fontSize: 12,
    fontWeight: '700',
  },
  statusPillActive: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 0.8,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  statusPillActiveText: {
    color: '#34C759',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionFooterWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionFooterText: {
    color: '#636366',
    fontSize: 12,
    lineHeight: 17,
  },
  footerNoteWrap: {
    marginTop: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  footerNoteText: {
    color: '#48484A',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
