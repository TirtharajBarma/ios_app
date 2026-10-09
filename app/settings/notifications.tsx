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
  Sun,
  Moon,
  CreditCard,
  Calendar,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Bell,
  AlertCircle,
  ExternalLink,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AppText, NativeLiquidMenu } from '@/components/ui';
import type { MenuAction } from '@/components/ui';
import { useSettingsStore, NotificationTiming } from '@/store/useSettingsStore';
import { useSubscriptionStore } from '@/store/useSubscriptionStore';
import { expenseColors } from '@/constants/expenseColors';
import {
  requestNotificationPermissions,
  checkNotificationPermissions,
  rescheduleAllAppNotifications,
  cancelAllReminders,
  isNotificationsAvailable,
  sendTestNotification,
} from '@/utils/notifications';

const TIMING_OPTIONS: { label: string; value: NotificationTiming; days: number }[] = [
  { label: '1 Day Before', value: '1day', days: 1 },
  { label: '3 Days Before', value: '3days', days: 3 },
  { label: '1 Week Before', value: '1week', days: 7 },
];

const AFTERNOON_TIME_PRESETS = [
  { label: '1:00 PM', hour: 13, minute: 0 },
  { label: '2:00 PM', hour: 14, minute: 0 },
  { label: '3:00 PM', hour: 15, minute: 0 },
];

const NIGHT_TIME_PRESETS = [
  { label: '8:30 PM', hour: 20, minute: 30 },
  { label: '9:30 PM', hour: 21, minute: 30 },
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

  // Synchronize state with OS Notification status
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

    return () => appStateSub.remove();
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
          'Please enable notifications in device Settings to receive scheduled daily spend check-ins and due date alerts.',
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

  const handleToggleAfternoon = async (val: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    await setAfternoonReminderEnabled(val);
    await setDailyExpenseReminderEnabled(val || nightReminderEnabled);
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
    await setDailyExpenseReminderEnabled(val || afternoonReminderEnabled);
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
      Alert.alert('Permission Required', 'Please enable notification permissions in device Settings first.');
      return;
    }
    const ok = await sendTestNotification();
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Notification Dispatched',
        'A test alert was sent. If the banner does not appear immediately, swipe down from the top to check your Notification Shade / Lock Screen.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('Error', 'Could not dispatch test notification. Please check system permissions.');
    }
  };

  const formatTimeLabel = (time: { hour: number; minute: number }) => {
    const match = [...AFTERNOON_TIME_PRESETS, ...NIGHT_TIME_PRESETS].find(
      (p) => p.hour === time.hour && p.minute === time.minute
    );
    if (match) return match.label;
    const h = time.hour;
    const m = time.minute.toString().padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${m} ${period}`;
  };

  const currentTimingLabel = useMemo(() => {
    return TIMING_OPTIONS.find((o) => o.value === notificationTiming)?.label || '1 Day Before';
  }, [notificationTiming]);

  // Liquid Menu Action Sets
  const afternoonMenuActions: MenuAction[] = useMemo(
    () =>
      AFTERNOON_TIME_PRESETS.map((p) => ({
        id: `${p.hour}:${p.minute}`,
        title: p.label,
        state:
          afternoonReminderTime.hour === p.hour && afternoonReminderTime.minute === p.minute
            ? 'on'
            : 'off',
      })),
    [afternoonReminderTime]
  );

  const nightMenuActions: MenuAction[] = useMemo(
    () =>
      NIGHT_TIME_PRESETS.map((p) => ({
        id: `${p.hour}:${p.minute}`,
        title: p.label,
        state:
          nightReminderTime.hour === p.hour && nightReminderTime.minute === p.minute
            ? 'on'
            : 'off',
      })),
    [nightReminderTime]
  );

  const timingMenuActions: MenuAction[] = useMemo(
    () =>
      TIMING_OPTIONS.map((t) => ({
        id: t.value,
        title: t.label,
        state: notificationTiming === t.value ? 'on' : 'off',
      })),
    [notificationTiming]
  );

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

        <AppText style={styles.headerTitle}>Notifications</AppText>

        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 40 },
        ]}
      >
        {/* System Permission Warning Banner if disabled at OS level */}
        {!hasSystemPermission && (
          <TouchableOpacity
            style={styles.warningBanner}
            activeOpacity={0.8}
            onPress={() => Linking.openURL(OPEN_SETTINGS_URL)}
          >
            <AlertCircle size={20} color="#F48B8B" />
            <View style={{ flex: 1 }}>
              <AppText style={styles.warningTitle}>System Alerts Disabled</AppText>
              <AppText style={styles.warningSub}>
                Notifications are disabled in device Settings. Tap to enable.
              </AppText>
            </View>
            <ExternalLink size={16} color="#F48B8B" />
          </TouchableOpacity>
        )}

        {/* ── SECTION 1: MASTER SWITCH ── */}
        <View style={styles.sectionHeaderWrap}>
          <AppText style={styles.sectionHeader}>NOTIFICATIONS</AppText>
        </View>

        <View style={styles.groupedInsetCard}>
          <View style={styles.groupedRowItem}>
            <View style={styles.iconRowLeft}>
              <View style={styles.iconSquare}>
                <Bell size={17} color={expenseColors.accentPeach} />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <AppText style={styles.rowTitle}>Allow Notifications</AppText>
                <AppText style={styles.rowSubtitle}>
                  Receive daily spending check-ins & due date alerts
                </AppText>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleMasterToggle}
              trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
              thumbColor={Platform.OS === 'android' ? (notificationsEnabled ? '#FFFFFF' : '#8E8E93') : undefined}
              ios_backgroundColor="#282B37"
            />
          </View>
        </View>

        <View style={styles.sectionFooterWrap}>
          <AppText style={styles.sectionFooterText}>
            Notifications are scheduled locally on your device based on your timezone. No personal data is sent to external servers.
          </AppText>
        </View>

        {notificationsEnabled && (
          <>
            {/* ── SECTION 2: DAILY REMINDERS ── */}
            <View style={styles.sectionHeaderWrap}>
              <AppText style={styles.sectionHeader}>DAILY REMINDERS</AppText>
            </View>

            <View style={styles.groupedInsetCard}>
              {/* Midday Check-In */}
              <View style={styles.groupedRowItem}>
                <View style={styles.iconRowLeft}>
                  <View style={styles.iconSquare}>
                    <Sun size={17} color={expenseColors.accentPeach} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <AppText style={styles.rowTitle}>Midday Check-In</AppText>
                    <AppText style={styles.rowSubtitle}>
                      Prompt to log lunch, coffee, or morning transit
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={afternoonReminderEnabled}
                  onValueChange={handleToggleAfternoon}
                  trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
                  thumbColor={Platform.OS === 'android' ? (afternoonReminderEnabled ? '#FFFFFF' : '#8E8E93') : undefined}
                  ios_backgroundColor="#282B37"
                />
              </View>

              {afternoonReminderEnabled && (
                <>
                  <View style={styles.subDivider} />
                  <View style={styles.subRowItem}>
                    <AppText style={styles.subRowLabel}>Reminder Time</AppText>
                    <NativeLiquidMenu
                      title="Midday Reminder Time"
                      actions={afternoonMenuActions}
                      onSelect={(id) => {
                        const match = AFTERNOON_TIME_PRESETS.find((p) => `${p.hour}:${p.minute}` === id);
                        if (match) handleSelectAfternoonTime(match);
                      }}
                      style={{ alignSelf: 'flex-end' }}
                    >
                      <View style={styles.dropdownPill}>
                        <AppText style={styles.dropdownPillText}>
                          {formatTimeLabel(afternoonReminderTime)}
                        </AppText>
                        <ChevronDown size={13} color={expenseColors.accentPeach} />
                      </View>
                    </NativeLiquidMenu>
                  </View>
                </>
              )}

              <View style={styles.divider} />

              {/* Evening Summary */}
              <View style={styles.groupedRowItem}>
                <View style={styles.iconRowLeft}>
                  <View style={styles.iconSquare}>
                    <Moon size={17} color={expenseColors.accentPeach} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <AppText style={styles.rowTitle}>Evening Summary</AppText>
                    <AppText style={styles.rowSubtitle}>
                      Review total daily spend before going to bed
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={nightReminderEnabled}
                  onValueChange={handleToggleNight}
                  trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
                  thumbColor={Platform.OS === 'android' ? (nightReminderEnabled ? '#FFFFFF' : '#8E8E93') : undefined}
                  ios_backgroundColor="#282B37"
                />
              </View>

              {nightReminderEnabled && (
                <>
                  <View style={styles.subDivider} />
                  <View style={styles.subRowItem}>
                    <AppText style={styles.subRowLabel}>Reminder Time</AppText>
                    <NativeLiquidMenu
                      title="Evening Reminder Time"
                      actions={nightMenuActions}
                      onSelect={(id) => {
                        const match = NIGHT_TIME_PRESETS.find((p) => `${p.hour}:${p.minute}` === id);
                        if (match) handleSelectNightTime(match);
                      }}
                      style={{ alignSelf: 'flex-end' }}
                    >
                      <View style={styles.dropdownPill}>
                        <AppText style={styles.dropdownPillText}>
                          {formatTimeLabel(nightReminderTime)}
                        </AppText>
                        <ChevronDown size={13} color={expenseColors.accentPeach} />
                      </View>
                    </NativeLiquidMenu>
                  </View>
                </>
              )}
            </View>

            {/* ── SECTION 3: BILLS & SUBSCRIPTIONS ── */}
            <View style={styles.sectionHeaderWrap}>
              <AppText style={styles.sectionHeader}>BILLS & SUBSCRIPTIONS</AppText>
            </View>

            <View style={styles.groupedInsetCard}>
              {/* Credit Card Bill Due */}
              <View style={styles.groupedRowItem}>
                <View style={styles.iconRowLeft}>
                  <View style={styles.iconSquare}>
                    <CreditCard size={17} color={expenseColors.accentPeach} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <AppText style={styles.rowTitle}>Credit Card Due Dates</AppText>
                    <AppText style={styles.rowSubtitle}>
                      Alert 3 days before payment deadline
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={billDueReminderEnabled}
                  onValueChange={handleToggleBillDue}
                  trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
                  thumbColor={Platform.OS === 'android' ? (billDueReminderEnabled ? '#FFFFFF' : '#8E8E93') : undefined}
                  ios_backgroundColor="#282B37"
                />
              </View>

              <View style={styles.divider} />

              {/* Subscription Renewals */}
              <View style={styles.groupedRowItem}>
                <View style={styles.iconRowLeft}>
                  <View style={styles.iconSquare}>
                    <Calendar size={17} color={expenseColors.accentPeach} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <AppText style={styles.rowTitle}>Subscription Renewals</AppText>
                    <AppText style={styles.rowSubtitle}>
                      Advance warning before charges occur
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={subscriptionReminderEnabled}
                  onValueChange={handleToggleSubscriptions}
                  trackColor={{ false: '#282B37', true: expenseColors.accentPeach }}
                  thumbColor={Platform.OS === 'android' ? (subscriptionReminderEnabled ? '#FFFFFF' : '#8E8E93') : undefined}
                  ios_backgroundColor="#282B37"
                />
              </View>

              {subscriptionReminderEnabled && (
                <>
                  <View style={styles.subDivider} />
                  <View style={styles.subRowItem}>
                    <AppText style={styles.subRowLabel}>Alert Timing</AppText>
                    <NativeLiquidMenu
                      title="Subscription Alert Timing"
                      actions={timingMenuActions}
                      onSelect={(id) => handleTimingChange(id as NotificationTiming)}
                      style={{ alignSelf: 'flex-end' }}
                    >
                      <View style={styles.dropdownPill}>
                        <AppText style={styles.dropdownPillText}>{currentTimingLabel}</AppText>
                        <ChevronDown size={13} color={expenseColors.accentPeach} />
                      </View>
                    </NativeLiquidMenu>
                  </View>
                </>
              )}
            </View>

            {/* ── SECTION 4: TESTING & VERIFICATION ── */}
            <View style={styles.sectionHeaderWrap}>
              <AppText style={styles.sectionHeader}>TESTING</AppText>
            </View>

            <View style={styles.groupedInsetCard}>
              <TouchableOpacity
                style={styles.groupedRowItem}
                activeOpacity={0.7}
                onPress={handleSendTestNotification}
              >
                <View style={styles.iconRowLeft}>
                  <View style={styles.iconSquare}>
                    <Sparkles size={17} color={expenseColors.accentPeach} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <AppText style={styles.rowTitle}>Send Test Notification</AppText>
                    <AppText style={styles.rowSubtitle}>
                      Dispatch an immediate alert to verify sound & delivery
                    </AppText>
                  </View>
                </View>
                <ChevronRight size={18} color={expenseColors.textSubtle} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── FOOTER CAPTION ── */}
        <View style={styles.footerNoteWrap}>
          <AppText style={styles.footerNoteText}>
            Local Device Reminders • Timed to Device Clock • 100% Private
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(244, 139, 139, 0.1)',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 139, 139, 0.25)',
  },
  warningTitle: {
    color: expenseColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  warningSub: {
    color: expenseColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
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
  subDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 60,
  },
  subRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    paddingLeft: 60,
  },
  subRowLabel: {
    color: expenseColors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
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
