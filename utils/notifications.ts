import { Platform } from "react-native";
import { parseISO, differenceInSeconds } from "date-fns";
import type { Subscription } from "@/types/subscription";
import type { ExpenseAccount } from "@/types/expense";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { useExpenseStore } from "@/store/useExpenseStore";

// Safely require expo-notifications inside a try/catch block to prevent crash when module is not compiled/linked yet
let Notifications: any = null;
let isNotificationsAvailable = false;

try {
  Notifications = require("expo-notifications");
  if (Notifications && Notifications.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    isNotificationsAvailable = true;
  }
} catch (e) {
  isNotificationsAvailable = false;
  console.warn("Notifications native module is not available in the current binary. Reminders will be mocked.");
}

const REMINDER_CHANNEL = "subscription-reminders";
const EXPENSE_CHANNEL = "expense-reminders";

/** Titles for shared-subscription change alerts. */
export type SharedChangeKind = "added" | "updated" | "removed";

/**
 * Fire an immediate local notification when a shared subscription changed
 * on another device. Used instead of server push in the MVP — community
 * members see the alert as soon as they open the app.
 */
export async function notifySharedChange(kind: SharedChangeKind, subName: string, publisher: string): Promise<void> {
  if (!isNotificationsAvailable || !Notifications) return;
  const globalEnabled = useSettingsStore.getState().notificationsEnabled;
  if (!globalEnabled) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: kind === "added"
          ? `${publisher} shared ${subName}`
          : kind === "updated"
            ? `${subName} was updated`
            : `${subName} was removed`,
        body: kind === "added"
          ? `${subName} is now visible in your shared group.`
          : kind === "updated"
            ? `${subName} was updated by ${publisher}.`
            : `${publisher} removed ${subName} from the group.`,
        sound: true,
      },
      trigger: null, // null = deliver immediately
    });
  } catch (error) {
    console.warn(`Notifications: Failed to notify shared change (${subName})`, error);
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!isNotificationsAvailable || !Notifications) return false;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
        name: "Subscription Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
      await Notifications.setNotificationChannelAsync(EXPENSE_CHANNEL, {
        name: "Daily Expense Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;

    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return status === "granted";
  } catch (error) {
    console.warn("Notifications: Failed to request permissions", error);
    return false;
  }
}

export async function checkNotificationPermissions(): Promise<boolean> {
  if (!isNotificationsAvailable || !Notifications) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function scheduleDailyReminders(): Promise<void> {
  if (!isNotificationsAvailable || !Notifications) return;
  const settings = useSettingsStore.getState();
  if (!settings.notificationsEnabled || !settings.dailyExpenseReminderEnabled) {
    await cancelDailyReminders();
    return;
  }

  // 1. Afternoon Check-in Reminder
  if (settings.afternoonReminderEnabled) {
    const afternoonId = "daily-afternoon-expense-reminder";
    await Notifications.cancelScheduledNotificationAsync(afternoonId).catch(() => {});
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "☀️ Afternoon Expense Check-in",
          body: "Had lunch or made a quick purchase? Take 5 seconds to log your expenses!",
          sound: true,
        },
        trigger: {
          hour: settings.afternoonReminderTime.hour,
          minute: settings.afternoonReminderTime.minute,
          repeats: true,
        } as any,
        identifier: afternoonId,
      });
    } catch (e) {
      console.warn("Failed to schedule afternoon reminder:", e);
    }
  } else {
    await Notifications.cancelScheduledNotificationAsync("daily-afternoon-expense-reminder").catch(() => {});
  }

  // 2. Night Summary Reminder
  if (settings.nightReminderEnabled) {
    const nightId = "daily-night-expense-reminder";
    await Notifications.cancelScheduledNotificationAsync(nightId).catch(() => {});
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🌙 Daily Spending Wrap-Up",
          body: "Review today's transactions and keep your accounts and budgets in check!",
          sound: true,
        },
        trigger: {
          hour: settings.nightReminderTime.hour,
          minute: settings.nightReminderTime.minute,
          repeats: true,
        } as any,
        identifier: nightId,
      });
    } catch (e) {
      console.warn("Failed to schedule night reminder:", e);
    }
  } else {
    await Notifications.cancelScheduledNotificationAsync("daily-night-expense-reminder").catch(() => {});
  }
}

export async function cancelDailyReminders(): Promise<void> {
  if (!isNotificationsAvailable || !Notifications) return;
  await Notifications.cancelScheduledNotificationAsync("daily-afternoon-expense-reminder").catch(() => {});
  await Notifications.cancelScheduledNotificationAsync("daily-night-expense-reminder").catch(() => {});
}

export async function scheduleCreditCardDueReminders(accounts: ExpenseAccount[]): Promise<void> {
  if (!isNotificationsAvailable || !Notifications) return;
  const settings = useSettingsStore.getState();
  if (!settings.notificationsEnabled || !settings.billDueReminderEnabled) {
    return;
  }

  const creditCards = accounts.filter((a) => a.type === "credit" && a.dueDay);
  const now = new Date();

  for (const card of creditCards) {
    const dueDay = card.dueDay;
    if (!dueDay || dueDay < 1 || dueDay > 31) continue;

    // Calculate upcoming due date for this month or next month
    let targetDate = new Date(now.getFullYear(), now.getMonth(), dueDay, 10, 0, 0, 0);
    if (targetDate.getTime() <= now.getTime()) {
      targetDate = new Date(now.getFullYear(), now.getMonth() + 1, dueDay, 10, 0, 0, 0);
    }

    // Remind 3 days before
    const reminderDate = new Date(targetDate);
    reminderDate.setDate(reminderDate.getDate() - 3);

    const secondsUntil = differenceInSeconds(reminderDate, now);
    if (secondsUntil <= 0) continue;

    const identifier = `card-due-${card.id}`;
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});

    try {
      const balance = card.balance || 0;
      const dueAmountStr = balance < 0 ? ` of ${settings.currencyCode} ${Math.abs(balance).toLocaleString("en-IN")}` : "";

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💳 ${card.name} Bill Due Soon`,
          body: `Your credit card bill payment${dueAmountStr} is due on the ${dueDay}th. Pay on time to avoid interest!`,
          sound: true,
          data: { accountId: card.id },
        },
        trigger: {
          type: "date",
          date: reminderDate,
        } as any,
        identifier,
      });
    } catch (e) {
      console.warn(`Failed to schedule card due reminder for ${card.name}:`, e);
    }
  }
}

export async function scheduleReminder(sub: Subscription): Promise<void> {
  if (!isNotificationsAvailable || !Notifications) return;
  const globalEnabled = useSettingsStore.getState().notificationsEnabled;
  const subEnabled = useSettingsStore.getState().subscriptionReminderEnabled;
  if (!globalEnabled || !subEnabled) return;
  if (!sub.reminderEnabled || sub.isPaused) return;
  if (!sub.nextBillingDate) return;

  try {
    const triggerDate = new Date(sub.nextBillingDate);
    triggerDate.setDate(triggerDate.getDate() - sub.reminderDays);
    triggerDate.setHours(9, 0, 0, 0);

    const now = new Date();
    const secondsUntil = differenceInSeconds(triggerDate, now);
    if (secondsUntil <= 0) return;

    const identifier = `reminder-${sub.id}`;
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${sub.name} renewal${sub.reminderDays === 0 ? " today" : " upcoming"}`,
        body: sub.isTrial
          ? sub.reminderDays === 0
            ? `Your free trial for ${sub.name} ends today.`
            : `Your free trial for ${sub.name} ends in ${sub.reminderDays} day${sub.reminderDays !== 1 ? "s" : ""}.`
          : `Your ${sub.billingCycle} subscription for ${sub.name} renews${sub.reminderDays === 0 ? " today" : ` in ${sub.reminderDays} day${sub.reminderDays !== 1 ? "s" : ""}`}.`,
        data: { subscriptionId: sub.id },
        sound: true,
      },
      trigger: {
        type: "date",
        date: triggerDate,
      } as any,
      identifier,
    });
  } catch (error) {
    console.warn(`Notifications: Failed to schedule reminder for ${sub.name}`, error);
  }
}

export async function cancelReminder(subscriptionId: string): Promise<void> {
  if (!isNotificationsAvailable || !Notifications) return;
  const identifier = `reminder-${subscriptionId}`;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
}

export async function cancelAllReminders(): Promise<void> {
  if (!isNotificationsAvailable || !Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn("Notifications: Failed to cancel all reminders", error);
  }
}

export async function scheduleAllReminders(subscriptions: Subscription[]): Promise<void> {
  if (!isNotificationsAvailable || !Notifications) return;
  for (const sub of subscriptions) {
    await scheduleReminder(sub);
  }
}

export async function rescheduleAllAppNotifications(): Promise<void> {
  if (!isNotificationsAvailable || !Notifications) return;
  const settings = useSettingsStore.getState();
  if (!settings.notificationsEnabled) {
    await cancelAllReminders();
    return;
  }

  // 1. Daily expense check-ins
  await scheduleDailyReminders();

  // 2. Subscription renewals
  if (settings.subscriptionReminderEnabled) {
    const subs = useSubscriptionStore.getState().subscriptions;
    await scheduleAllReminders(subs);
  }

  // 3. Credit Card bill reminders
  if (settings.billDueReminderEnabled) {
    const accounts = useExpenseStore.getState().accounts;
    await scheduleCreditCardDueReminders(accounts);
  }
}

export async function getScheduledReminders(): Promise<any[]> {
  if (!isNotificationsAvailable || !Notifications) return [];
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn("Notifications: Failed to fetch scheduled reminders", error);
    return [];
  }
}

export { isNotificationsAvailable };
