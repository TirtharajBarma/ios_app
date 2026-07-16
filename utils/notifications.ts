import { Platform } from "react-native";
import { parseISO, differenceInSeconds } from "date-fns";
import type { Subscription } from "@/types/subscription";

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

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!isNotificationsAvailable || !Notifications) return false;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
        name: "Subscription Reminders",
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

export async function scheduleReminder(sub: Subscription): Promise<void> {
  if (!isNotificationsAvailable || !Notifications) return;
  if (!sub.reminderEnabled) return;
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
  await cancelAllReminders();
  for (const sub of subscriptions) {
    await scheduleReminder(sub);
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
