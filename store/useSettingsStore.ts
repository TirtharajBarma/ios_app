import { create } from "zustand";
import AsyncStorage from "@/utils/storage";

export type AppearanceMode = "system" | "light" | "dark";
export type NotificationTiming = "1day" | "3days" | "1week";

interface SettingsState {
  // Personalization
  userName: string;
  userTagline: string;
  setUserName: (name: string) => Promise<void>;
  setUserTagline: (tagline: string) => Promise<void>;

  // Currency (stored as code: "INR", "USD", etc.)
  currencyCode: string;
  setCurrencyCode: (code: string) => Promise<void>;

  // Appearance (pending)
  appearance: AppearanceMode;
  setAppearance: (mode: AppearanceMode) => Promise<void>;

  // Notifications
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  notificationTiming: NotificationTiming;
  setNotificationTiming: (timing: NotificationTiming) => Promise<void>;

  // Privacy
  faceIdEnabled: boolean;
  setFaceIdEnabled: (enabled: boolean) => Promise<void>;
  analyticsEnabled: boolean;
  setAnalyticsEnabled: (enabled: boolean) => Promise<void>;
  crashReportsEnabled: boolean;
  setCrashReportsEnabled: (enabled: boolean) => Promise<void>;

  // Load from storage
  loadSettings: () => Promise<void>;
}

const STORAGE_KEY = "@subo_settings_v2";

async function save(patch: Record<string, unknown>) {
  try {
    const current = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = current ? JSON.parse(current) : {};
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, ...patch }));
  } catch (e) {
    console.warn("Failed to save setting:", e);
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  userName: "",
  userTagline: "",
  currencyCode: "INR",
  appearance: "system",
  notificationsEnabled: true,
  notificationTiming: "1day",
  faceIdEnabled: false,
  analyticsEnabled: false,
  crashReportsEnabled: true,

  setUserName: async (userName) => { set({ userName }); await save({ userName }); },
  setUserTagline: async (userTagline) => { set({ userTagline }); await save({ userTagline }); },
  setCurrencyCode: async (currencyCode) => { set({ currencyCode }); await save({ currencyCode }); },
  setAppearance: async (appearance) => { set({ appearance }); await save({ appearance }); },
  setNotificationsEnabled: async (notificationsEnabled) => { set({ notificationsEnabled }); await save({ notificationsEnabled }); },
  setNotificationTiming: async (notificationTiming) => { set({ notificationTiming }); await save({ notificationTiming }); },
  setFaceIdEnabled: async (faceIdEnabled) => { set({ faceIdEnabled }); await save({ faceIdEnabled }); },
  setAnalyticsEnabled: async (analyticsEnabled) => { set({ analyticsEnabled }); await save({ analyticsEnabled }); },
  setCrashReportsEnabled: async (crashReportsEnabled) => { set({ crashReportsEnabled }); await save({ crashReportsEnabled }); },

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const p = JSON.parse(stored);
        set({
          userName: p.userName ?? "",
          userTagline: p.userTagline ?? "",
          currencyCode: p.currencyCode ?? "INR",
          appearance: p.appearance ?? "system",
          notificationsEnabled: p.notificationsEnabled ?? true,
          notificationTiming: p.notificationTiming ?? "1day",
          faceIdEnabled: p.faceIdEnabled ?? false,
          analyticsEnabled: p.analyticsEnabled ?? false,
          crashReportsEnabled: p.crashReportsEnabled ?? true,
        });
      }
    } catch (e) {
      console.warn("Failed to load settings:", e);
    }
  },
}));
