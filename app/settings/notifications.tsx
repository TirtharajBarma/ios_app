import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
  Linking,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Check,
  Bell,
  BellOff,
  Sun,
  Moon,
  CreditCard,
  Calendar,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/ui';
import { useSettingsStore, NotificationTiming } from '@/store/useSettingsStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { expenseColors } from '@/constants/expenseColors';
import {
  requestNotificationPermissions,
  checkNotificationPermissions,
  rescheduleAllAppNotifications,
  cancelAllReminders,
  isNotificationsAvailable,
} from '@/utils/notifications';

const TIMING_OPTIONS: { label: string; sublabel: string; value: NotificationTiming; days: number }[] = [
  { label: '1 Day Before', sublabel: 'Delivered 24 hours prior to billing', value: '1day', days: 1 },
  { label: '3 Days Before', sublabel: 'Early reminder 3 days before renewal', value: '3days', days: 3 },
  { label: '1 Week Before', sublabel: 'Advance notice 7 days before charge', value: '1week', days: 7 },
];

const AFTERNOON_TIME_PRESETS = [
  { label: '1:00 PM', hour: 13, minute: 0 },
  { label: '1:30 PM', hour: 13, minute: 30 },
  { label: '2:00 PM', hour: 14, minute: 0, tag: 'Default' },
  { label: '2:30 PM', hour: 14, minute: 30 },
  { label: '3:00 PM', hour: 15, minute: 0 },
];

const NIGHT_TIME_PRESETS = [
  { label: '8:30 PM', hour: 20, minute: 30 },
  { label: '9:00 PM', hour: 21, minute: 0 },
  { label: '9:30 PM', hour: 21, minute: 30, tag: 'Default' },
  { label: '10:00 PM', hour: 22, minute: 0 },
  { label: '10:30 PM', hour: 22, minute: 30 },
];

const OPEN_SETTINGS_URL = Platform.OS === 'ios' ? 'app-settings:' : 'package:com.anonymous.subscription';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    notificationsEnabled,
    setNotificationsEnabled,
    notificationTiming,
    setNotificationTiming,
    dailyExpenseReminderEnabled,
    setDailyExpenseReminderEnabled,
    afternoonReminderEnabled,
    setAfternoonReminderEnabled,
    afternoonReminderTime,
    setAfternoonReminderTime,
    nightReminderEnabled,
    setNightReminderEnabled,
    nightReminderTime,
    setNightReminderTime,
    billDueReminderEnabled,
    setBillDueReminderEnabled,
    subscriptionReminderEnabled,
    setSubscriptionReminderEnabled,
  } = useSettingsStore();

  const [hasSystemPermission, setHasSystemPermission] = useState(true);

  // Synchronize state with iOS Notification Center status
  useEffect(() => {
    async function syncSystemPermission() {
      if (!isNotificationsAvailable) return;
      const granted = await checkNotificationPermissions();
      setHasSystemPermission(granted);
    }

    syncSystemPermission();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncSystemPermission();
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, [notificationsEnabled]);

  // Master Toggle
  const handleMasterToggle = async (val: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    if (val) {
      const granted = await requestNotificationPermissions();
      setHasSystemPermission(granted);
      if (!granted) {
        Alert.alert(
          'Notifications Permission Required',
          'Please enable notifications in iOS Settings to receive scheduled daily spend check-ins and due date alerts.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openURL(OPEN_SETTINGS_URL) },
          ]
        );
        return;
      }
      await setNotificationsEnabled(true);
      await rescheduleAllAppNotifications();
    } else {
      await setNotificationsEnabled(false);
      await cancelAllReminders();
    }
  };

  const handleToggleDailyExpense = async (val: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    await setDailyExpenseReminderEnabled(val);
    await rescheduleAllAppNotifications();
  };

  const handleToggleAfternoon = async (val: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    await setAfternoonReminderEnabled(val);
    await rescheduleAllAppNotifications();
  };

  const handleSelectAfternoonTime = async (time: { hour: number; minute: number }) => {
    Haptics.selectionAsync().catch(() => {});
    await setAfternoonReminderTime(time);
    await rescheduleAllAppNotifications();
  };

  const handleToggleNight = async (val: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    await setNightReminderEnabled(val);
    await rescheduleAllAppNotifications();
  };

  const handleSelectNightTime = async (time: { hour: number; minute: number }) => {
    Haptics.selectionAsync().catch(() => {});
    await setNightReminderTime(time);
    await rescheduleAllAppNotifications();
  };

  const handleToggleBillDue = async (val: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    await setBillDueReminderEnabled(val);
    await rescheduleAllAppNotifications();
  };

  const handleToggleSubscriptions = async (val: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    await setSubscriptionReminderEnabled(val);
    await rescheduleAllAppNotifications();
  };

  const handleTimingChange = async (timing: NotificationTiming) => {
    Haptics.selectionAsync().catch(() => {});
    await setNotificationTiming(timing);
    if (!notificationsEnabled) return;

    const prevOption = TIMING_OPTIONS.find((o) => o.value === notificationTiming);
    const prevDays = prevOption?.days ?? 1;
    const daysOption = TIMING_OPTIONS.find((o) => o.value === timing);
    const daysAhead = daysOption?.days ?? 1;

    await useSubscriptionStore.getState().updateReminderDaysForDefaultTiming(prevDays, daysAhead);
    await rescheduleAllAppNotifications();
  };

  const handleSendTestNotification = async () => {
    if (!isNotificationsAvailable) {
      Alert.alert('Notifications', 'Notification module is mocked in the current simulator.');
      return;
    }
    const granted = await checkNotificationPermissions();
    if (!granted) {
      Alert.alert('Permission Required', 'Please enable notification permissions in iOS Settings first.');
      return;
    }
    try {
      const expoNotifications = require('expo-notifications');
      await expoNotifications.scheduleNotificationAsync({
        content: {
          title: '☀️ Afternoon Expense Check-in',
          body: 'Had lunch or coffee today? Take 5 seconds to log your transactions!',
          sound: true,
        },
        trigger: null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Alert.alert('Error', 'Could not dispatch test notification.');
    }
  };

  const isMasterActive = notificationsEnabled && hasSystemPermission;

  // Format active time strings
  const afternoonTimeStr = useMemo(() => {
    const p = AFTERNOON_TIME_PRESETS.find(
      (x) => x.hour === afternoonReminderTime.hour && x.minute === afternoonReminderTime.minute
    );
    return p ? p.label : `${afternoonReminderTime.hour}:${afternoonReminderTime.minute < 10 ? '0' : ''}${afternoonReminderTime.minute}`;
  }, [afternoonReminderTime]);

  const nightTimeStr = useMemo(() => {
    const p = NIGHT_TIME_PRESETS.find(
      (x) => x.hour === nightReminderTime.hour && x.minute === nightReminderTime.minute
    );
    return p ? p.label : `${nightReminderTime.hour}:${nightReminderTime.minute < 10 ? '0' : ''}${nightReminderTime.minute}`;
  }, [nightReminderTime]);

  return (
    <View style={styles.screenContainer}>
      {/* Top Safe Area Background */}
      <View style={{ height: insets.top, backgroundColor: expenseColors.bgPrimary }} />

      {/* ── TOP NAVIGATION BAR ── */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          style={styles.headerBackBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <AppText style={styles.titleThe}>SYSTEM </AppText>
          <AppText style={styles.titleMain}>NOTIFICATIONS</AppText>
        </View>

        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 40 },
        ]}
      >
        {/* ── SYSTEM PERMISSION WARNING BANNER (When iOS settings disabled) ── */}
        {!hasSystemPermission && (
          <View style={styles.permissionWarningCard}>
            <View style={styles.warningIconCircle}>
              <AlertCircle size={20} color={expenseColors.accentPeach} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText style={styles.warningCardTitle}>iOS Permissions Disabled</AppText>
              <AppText style={styles.warningCardDesc}>
                Device notifications are turned off in Settings. Enable them to receive daily spend check-ins & bill due alerts.
              </AppText>
              <TouchableOpacity
                style={styles.warningActionBtn}
                activeOpacity={0.8}
                onPress={() => Linking.openURL(OPEN_SETTINGS_URL)}
              >
                <AppText style={styles.warningActionText}>Open iOS Settings</AppText>
                <ExternalLink size={12} color={expenseColors.accentPeach} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── MASTER HERO CARD ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.heroIconCircle,
                {
                  backgroundColor: isMasterActive
                    ? 'rgba(248, 177, 149, 0.16)'
                    : 'rgba(255, 255, 255, 0.05)',
                },
              ]}
            >
              {isMasterActive ? (
                <Bell size={22} color={expenseColors.accentPeach} />
              ) : (
                <BellOff size={22} color="#6C7080" />
              )}
            </View>

            <View
              style={[
                styles.liveStatusBadge,
                isMasterActive ? styles.liveStatusBadgeActive : styles.liveStatusBadgeInactive,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isMasterActive ? expenseColors.accentGreen : '#7E8394' },
                ]}
              />
              <AppText
                style={[
                  styles.statusBadgeText,
                  { color: isMasterActive ? expenseColors.accentGreen : '#8E919D' },
                ]}
              >
                {isMasterActive ? 'ACTIVE & SYNCED' : 'PAUSED'}
              </AppText>
            </View>
          </View>

          <AppText style={styles.heroTitle}>Smart Spend Reminders</AppText>
          <AppText style={styles.heroSubtitle}>
            Automated alerts for daily expense logging, credit card payment deadlines, and recurring subscriptions.
          </AppText>

          <View style={styles.heroDivider} />

          <View style={styles.heroToggleRow}>
            <View style={{ flex: 1 }}>
              <AppText style={styles.heroToggleLabel}>Allow Reminders</AppText>
              <AppText style={styles.heroToggleSub}>Master toggle for all background alerts</AppText>
            </View>
            <Switch
              value={isMasterActive}
              onValueChange={handleMasterToggle}
              trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
              thumbColor={Platform.OS === 'android' ? (isMasterActive ? '#FFFFFF' : '#8E8E93') : undefined}
              ios_backgroundColor="#282B37"
            />
          </View>
        </View>

        {isMasterActive && (
          <>
            {/* ══════════════════════════════════════════════
                SECTION 1: DAILY LOGGING AUTOMATION
            ══════════════════════════════════════════════ */}
            <View style={styles.sectionHeaderWrap}>
              <AppText style={styles.sectionCategoryHeader}>DAILY LOGGING AUTOMATION</AppText>
            </View>

            <View style={styles.groupedInsetCard}>
              {/* MASTER DAILY TOGGLE (TOP LEVEL) */}
              <View style={styles.masterPromptRow}>
                <View style={styles.iconRowLeft}>
                  <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(244, 205, 137, 0.15)' }]}>
                    <Clock size={17} color="#F4CD89" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.groupedRowTitle}>DAILY LOGGING PROMPTS</AppText>
                    <AppText style={styles.settingSubValue} numberOfLines={1}>
                      Scheduled daily check-ins to record transactions
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={dailyExpenseReminderEnabled}
                  onValueChange={handleToggleDailyExpense}
                  trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
                  ios_backgroundColor="#282B37"
                />
              </View>

              {/* NESTED SUB-ITEMS CONTAINER (CLEAR HIERARCHICAL INDENTATION) */}
              {dailyExpenseReminderEnabled && (
                <View style={styles.nestedSubCardsContainer}>
                  {/* SUB-ITEM 1: ☀️ Afternoon Check-in */}
                  <View style={styles.subSessionCard}>
                    <View style={styles.subSessionTopRow}>
                      <View style={styles.subSessionTitleLeft}>
                        <View style={styles.sessionMiniSquircleSun}>
                          <Sun size={14} color="#FF9D66" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <AppText style={styles.subSessionTitle}>Afternoon Check-in</AppText>
                            {afternoonReminderEnabled && (
                              <View style={styles.sessionTimeBadge}>
                                <AppText style={styles.sessionTimeBadgeText}>{afternoonTimeStr}</AppText>
                              </View>
                            )}
                          </View>
                          <AppText style={styles.subSessionDesc}>
                            Log lunch, coffee, snacks & midday purchases
                          </AppText>
                        </View>
                      </View>
                      <Switch
                        value={afternoonReminderEnabled}
                        onValueChange={handleToggleAfternoon}
                        trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
                        ios_backgroundColor="#282B37"
                      />
                    </View>

                    {afternoonReminderEnabled && (
                      <View style={styles.subSessionChipsWrap}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.timePillsScroll}
                        >
                          {AFTERNOON_TIME_PRESETS.map((p) => {
                            const isSelected =
                              afternoonReminderTime.hour === p.hour &&
                              afternoonReminderTime.minute === p.minute;
                            return (
                              <TouchableOpacity
                                key={p.label}
                                style={[styles.timePill, isSelected && styles.timePillActive]}
                                activeOpacity={0.75}
                                onPress={() => handleSelectAfternoonTime({ hour: p.hour, minute: p.minute })}
                              >
                                <AppText style={[styles.timePillText, isSelected && styles.timePillTextActive]}>
                                  {p.label}
                                </AppText>
                                {p.tag && (
                                  <View style={[styles.miniTag, isSelected && styles.miniTagActive]}>
                                    <AppText style={[styles.miniTagText, isSelected && styles.miniTagTextActive]}>
                                      {p.tag}
                                    </AppText>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* SUB-ITEM 2: 🌙 Night Summary */}
                  <View style={styles.subSessionCard}>
                    <View style={styles.subSessionTopRow}>
                      <View style={styles.subSessionTitleLeft}>
                        <View style={styles.sessionMiniSquircleMoon}>
                          <Moon size={14} color="#C4A7E7" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <AppText style={styles.subSessionTitle}>Night Spending Summary</AppText>
                            {nightReminderEnabled && (
                              <View style={styles.sessionTimeBadge}>
                                <AppText style={styles.sessionTimeBadgeText}>{nightTimeStr}</AppText>
                              </View>
                            )}
                          </View>
                          <AppText style={styles.subSessionDesc}>
                            Review total day spend & reconcile accounts before sleep
                          </AppText>
                        </View>
                      </View>
                      <Switch
                        value={nightReminderEnabled}
                        onValueChange={handleToggleNight}
                        trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
                        ios_backgroundColor="#282B37"
                      />
                    </View>

                    {nightReminderEnabled && (
                      <View style={styles.subSessionChipsWrap}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.timePillsScroll}
                        >
                          {NIGHT_TIME_PRESETS.map((p) => {
                            const isSelected =
                              nightReminderTime.hour === p.hour &&
                              nightReminderTime.minute === p.minute;
                            return (
                              <TouchableOpacity
                                key={p.label}
                                style={[styles.timePill, isSelected && styles.timePillActive]}
                                activeOpacity={0.75}
                                onPress={() => handleSelectNightTime({ hour: p.hour, minute: p.minute })}
                              >
                                <AppText style={[styles.timePillText, isSelected && styles.timePillTextActive]}>
                                  {p.label}
                                </AppText>
                                {p.tag && (
                                  <View style={[styles.miniTag, isSelected && styles.miniTagActive]}>
                                    <AppText style={[styles.miniTagText, isSelected && styles.miniTagTextActive]}>
                                      {p.tag}
                                    </AppText>
                                  </View>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* ══════════════════════════════════════════════
                SECTION 2: BILLS & RECURRING CHARGES
            ══════════════════════════════════════════════ */}
            <View style={styles.sectionHeaderWrap}>
              <AppText style={styles.sectionCategoryHeader}>BILLS & SUBSCRIPTIONS</AppText>
            </View>

            <View style={styles.groupedInsetCard}>
              {/* Credit Card Bill Due Dates */}
              <View style={styles.groupedRowItem}>
                <View style={styles.iconRowLeft}>
                  <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(157, 198, 235, 0.15)' }]}>
                    <CreditCard size={16} color="#9DC6EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.groupedRowTitle}>CREDIT CARD BILL DUES</AppText>
                    <AppText style={styles.settingSubValue} numberOfLines={1}>
                      Alerts 3 days before payment due date
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={billDueReminderEnabled}
                  onValueChange={handleToggleBillDue}
                  trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
                  ios_backgroundColor="#282B37"
                />
              </View>

              <View style={styles.groupedRowDivider} />

              {/* Subscription Renewal Alerts */}
              <View style={styles.groupedRowItem}>
                <View style={styles.iconRowLeft}>
                  <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(140, 217, 200, 0.15)' }]}>
                    <Calendar size={16} color="#8CD9C8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.groupedRowTitle}>SUBSCRIPTION RENEWALS</AppText>
                    <AppText style={styles.settingSubValue} numberOfLines={1}>
                      Notify before free trials & monthly renewals charge
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={subscriptionReminderEnabled}
                  onValueChange={handleToggleSubscriptions}
                  trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
                  ios_backgroundColor="#282B37"
                />
              </View>

              {subscriptionReminderEnabled && (
                <View style={styles.nestedSubCardsContainer}>
                  <View style={styles.subTimingCard}>
                    <AppText style={styles.subTimingHeading}>RENEWAL ALERT TIMING</AppText>
                    {TIMING_OPTIONS.map((opt, index) => {
                      const isSelected = notificationTiming === opt.value;
                      const isLast = index === TIMING_OPTIONS.length - 1;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          activeOpacity={0.7}
                          onPress={() => handleTimingChange(opt.value)}
                          style={[styles.timingRow, !isLast && styles.timingRowDivider]}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <AppText style={styles.timingOptionLabel}>{opt.label}</AppText>
                            <AppText style={styles.timingOptionSub}>{opt.sublabel}</AppText>
                          </View>
                          {isSelected ? (
                            <View style={styles.timingCheckCircle}>
                              <Check size={12} color="#0D0E12" strokeWidth={3.5} />
                            </View>
                          ) : (
                            <View style={styles.timingUncheckCircle} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* ══════════════════════════════════════════════
                SECTION 3: DIAGNOSTICS & TEST
            ══════════════════════════════════════════════ */}
            <View style={styles.sectionHeaderWrap}>
              <AppText style={styles.sectionCategoryHeader}>DIAGNOSTICS & TEST</AppText>
            </View>

            <TouchableOpacity
              style={styles.testActionCard}
              activeOpacity={0.75}
              onPress={handleSendTestNotification}
            >
              <View style={styles.iconRowLeft}>
                <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(248, 177, 149, 0.16)' }]}>
                  <Sparkles size={16} color={expenseColors.accentPeach} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.groupedRowTitle}>SEND TEST NOTIFICATION</AppText>
                  <AppText style={styles.settingSubValue}>
                    Test banner presentation, alert sounds & vibrations
                  </AppText>
                </View>
              </View>
              <ChevronRight size={18} color={expenseColors.textSubtle} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: expenseColors.bgPrimary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: expenseColors.bgPrimary,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E212B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleThe: {
    color: '#8E919D',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  titleMain: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  headerRightSpacer: {
    width: 38,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  permissionWarningCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(248, 177, 149, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 177, 149, 0.3)',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  warningIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(248, 177, 149, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCardTitle: {
    color: expenseColors.accentPeach,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  warningCardDesc: {
    color: '#C7C8CF',
    fontSize: 12,
    lineHeight: 17,
  },
  warningActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(248, 177, 149, 0.18)',
    borderRadius: 10,
    marginTop: 6,
  },
  warningActionText: {
    color: expenseColors.accentPeach,
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    marginBottom: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  liveStatusBadgeActive: {
    backgroundColor: 'rgba(112, 214, 188, 0.12)',
    borderColor: 'rgba(112, 214, 188, 0.25)',
  },
  liveStatusBadgeInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: expenseColors.textSubtle,
    fontSize: 13,
    lineHeight: 18,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 14,
  },
  heroToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroToggleLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  heroToggleSub: {
    color: expenseColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeaderWrap: {
    paddingHorizontal: 4,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionCategoryHeader: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  groupedInsetCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    marginBottom: 18,
    overflow: 'hidden',
  },
  masterPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  nestedSubCardsContainer: {
    backgroundColor: '#15171D',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    gap: 10,
  },
  subSessionCard: {
    backgroundColor: '#1E212A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 14,
  },
  subSessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subSessionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  sessionMiniSquircleSun: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 157, 102, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  sessionMiniSquircleMoon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(196, 167, 231, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  subSessionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sessionTimeBadge: {
    backgroundColor: 'rgba(248, 177, 149, 0.16)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sessionTimeBadgeText: {
    color: expenseColors.accentPeach,
    fontSize: 10,
    fontWeight: '800',
  },
  subSessionDesc: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  subSessionChipsWrap: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  groupedRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  iconRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  tileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedRowTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  settingSubValue: {
    color: expenseColors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
  },
  groupedRowDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 64,
  },
  timePillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: '#262934',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  timePillActive: {
    backgroundColor: 'rgba(248, 177, 149, 0.16)',
    borderColor: expenseColors.accentPeach,
  },
  timePillText: {
    color: '#A2A5B0',
    fontSize: 11,
    fontWeight: '700',
  },
  timePillTextActive: {
    color: expenseColors.accentPeach,
    fontWeight: '800',
  },
  miniTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  miniTagActive: {
    backgroundColor: 'rgba(248, 177, 149, 0.25)',
  },
  miniTagText: {
    color: '#7E8394',
    fontSize: 9,
    fontWeight: '700',
  },
  miniTagTextActive: {
    color: expenseColors.accentPeach,
  },
  subTimingCard: {
    backgroundColor: '#1E212A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 14,
  },
  subTimingHeading: {
    color: expenseColors.textSubtle,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  timingRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  timingOptionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  timingOptionSub: {
    color: expenseColors.textSubtle,
    fontSize: 11,
    lineHeight: 15,
  },
  timingCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: expenseColors.accentPeach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timingUncheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#4A4D59',
  },
  testActionCard: {
    backgroundColor: expenseColors.bgCard,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: expenseColors.borderCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
});
