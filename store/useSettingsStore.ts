import { create } from "zustand";
import AsyncStorage from "@/utils/storage";
import type { ShareGroup } from "@/types/shared";
import { isSupabaseConfigured, updateMyName } from "@/api/supabase";

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

  // Custom Categories
  customCategories: string[];
  addCustomCategory: (cat: string) => Promise<void>;

  // Shared Groups (supabase) — a user can belong to several at once.
  shareGroups: ShareGroup[];
  setShareGroups: (groups: ShareGroup[]) => Promise<void>;
  /** Back-compat: first group, or null. Callers that need multi-group should read `shareGroups`. */
  shareGroup: ShareGroup | null;
  setShareGroup: (group: ShareGroup | null) => Promise<void>;

  // Load from storage
  loadSettings: () => Promise<void>;
}

const STORAGE_KEY = "@subo_settings_v3";

async function save(patch: Record<string, unknown>) {
  try {
    const current = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = current ? JSON.parse(current) : {};
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, ...patch }));
  } catch (e) {
    console.warn("Failed to save setting:", e);
  }
}

/** Best-effort: keep every group's member list showing the latest display name. */
async function saveNameToServer(userName: string) {
  if (!userName.trim() || !isSupabaseConfigured()) return;
  try {
    await updateMyName(userName);
  } catch (e) {
    // Transient (offline) — group members fall back to the stored snapshot
    // and the name is re-sent on joins / app start.
    console.warn("Failed to push display name to groups:", e);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  userName: "",
  userTagline: "",
  currencyCode: "INR",
  appearance: "system",
  notificationsEnabled: true,
  notificationTiming: "1day",
  faceIdEnabled: false,
  analyticsEnabled: false,
  crashReportsEnabled: true,
  customCategories: [],
  shareGroups: [],
  shareGroup: null,

  setUserName: async (userName) => { set({ userName }); await save({ userName }); await saveNameToServer(userName); },
  setUserTagline: async (userTagline) => { set({ userTagline }); await save({ userTagline }); },
  setCurrencyCode: async (currencyCode) => { set({ currencyCode }); await save({ currencyCode }); },
  setAppearance: async (appearance) => { set({ appearance }); await save({ appearance }); },
  setNotificationsEnabled: async (notificationsEnabled) => { set({ notificationsEnabled }); await save({ notificationsEnabled }); },
  setNotificationTiming: async (notificationTiming) => { set({ notificationTiming }); await save({ notificationTiming }); },
  setFaceIdEnabled: async (faceIdEnabled) => { set({ faceIdEnabled }); await save({ faceIdEnabled }); },
  setAnalyticsEnabled: async (analyticsEnabled) => { set({ analyticsEnabled }); await save({ analyticsEnabled }); },
  setCrashReportsEnabled: async (crashReportsEnabled) => { set({ crashReportsEnabled }); await save({ crashReportsEnabled }); },

  addCustomCategory: async (category) => {
    const trimmed = category.trim();
    if (!trimmed) return;
    const current = get().customCategories || [];
    const alreadyExists = current.some((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (alreadyExists) return;
    const updated = [...current, trimmed];
    set({ customCategories: updated });
    await save({ customCategories: updated });
  },

  setShareGroups: async (groups) => {
    const shareGroups = groups ?? [];
    set({ shareGroups, shareGroup: shareGroups[0] ?? null });
    await save({ shareGroups });
  },

  setShareGroup: async (group) => {
    const shareGroups = group ? [group] : [];
    set({ shareGroups, shareGroup: group });
    await save({ shareGroups });
  },

  loadSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const p = JSON.parse(stored);
        const shareGroups = Array.isArray(p.shareGroups)
          ? p.shareGroups
          : p.shareGroup
            ? [p.shareGroup] // v2 single-group → v3 array migration
            : [];
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
          customCategories: p.customCategories ?? [],
          shareGroups,
          shareGroup: shareGroups[0] ?? null,
        });
      } else {
        // First run (or pre-v3): honor a legacy single-group entry if present.
        const legacy = await AsyncStorage.getItem("@subo_settings_v2");
        if (legacy) {
          const p = JSON.parse(legacy);
          const shareGroups = p.shareGroup ? [p.shareGroup] : [];
          if (shareGroups.length > 0) {
            set({ shareGroups, shareGroup: shareGroups[0] });
            await save({ shareGroups });
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load settings:", e);
    }
  },
}));