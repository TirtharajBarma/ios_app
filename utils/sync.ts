import AsyncStorage from "@/utils/storage";
import * as db from "@/database/database";
import type { NewSubscriptionInput, Subscription } from "@/types/subscription";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  deleteSharedSubscriptionRemote,
  fetchSharedSubscriptions,
  isSupabaseConfigured,
  upsertSharedSubscription,
  type SharedRow,
  type UpsertPayload,
} from "@/api/supabase";
import {
  notifySharedChange,
  scheduleReminder,
  cancelReminder,
  requestNotificationPermissions,
} from "@/utils/notifications";

const REMOTE_IDS_KEY = "@subo_shared_remote_ids_v2";

/** Converts a server row into a full local Subscription (shared copies). */
export function rowToSubscription(row: SharedRow): Subscription {
  const rawCycle = row.billing_cycle || "monthly";
  return {
    id: row.id,
    name: row.name,
    color: row.brand_color || "#007AFF",
    price: row.price ?? 0,
    currency: row.currency || "USD",
    billingCycle: (rawCycle.startsWith("custom:") ? "custom" : rawCycle.toLowerCase()) as Subscription["billingCycle"],
    rawBillingCycle: rawCycle,
    nextBillingDate: row.next_billing_date,
    category: (row.category?.toLowerCase() || "other") as Subscription["category"],
    reminderEnabled: true,
    reminderDays: 1,
    isTrial: !!row.is_trial,
    trialEndDate: row.trial_end_date || undefined,
    splitEnabled: !!row.split_enabled,
    splitType: (row.split_type as "people" | "percentage" | "share" | undefined) ?? undefined,
    splitValue: row.split_value ?? undefined,
    isPaused: !!row.is_paused,
    note: row.notes || undefined,
    website: row.website || undefined,
    logoIcon: row.logo_icon || undefined,
    isShared: true,
    sharedGroupId: row.group_id || undefined,
    createdAt: row.updated_at,
    updatedAt: row.updated_at,
  };
}

/** Converts a local Subscription into the server upsert payload. */
export function subscriptionToPayload(sub: Subscription): UpsertPayload {
  const { userName, shareGroups } = useSettingsStore.getState();
  return {
    id: sub.id,
    groupId: sub.sharedGroupId || shareGroups[0]?.id || null,
    publisherName: userName || "Someone",
    name: sub.name,
    price: sub.price,
    currency: sub.currency,
    billingCycle: sub.rawBillingCycle || sub.billingCycle || "monthly",
    nextBillingDate: sub.nextBillingDate,
    category: sub.category,
    brandColor: sub.color,
    logoIcon: sub.logoIcon || null,
    isTrial: !!sub.isTrial,
    trialEndDate: sub.trialEndDate || null,
    splitEnabled: !!sub.splitEnabled,
    splitType: sub.splitType || null,
    splitValue: sub.splitValue ?? null,
    isPaused: !!sub.isPaused,
    notes: sub.note || null,
    website: sub.website || null,
  };
}

function toInput(sub: Subscription): NewSubscriptionInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = sub;
  return rest;
}

/**
 * Push a single subscription to the group server.
 * Called right after the local add/update/remove so remote copies stay fresh.
 *
 * `sub` present + `isShared` → upsert into sub.sharedGroupId (or first group).
 * `sub` present + not shared → delete its remote copy.
 * `sub` null → no-op (no id/group to act on).
 */
export async function pushSharedSubscription(sub: Subscription | null): Promise<void> {
  const groups = useSettingsStore.getState().shareGroups;
  if (!groups.length || !isSupabaseConfigured()) return;
  try {
    if (!sub) return;
    const groupId = sub.sharedGroupId || groups[0].id;
    if (!groupId) return;
    if (!sub.isShared) {
      await deleteSharedSubscriptionRemote(sub.id, groupId);
      return;
    }
    await upsertSharedSubscription(subscriptionToPayload(sub));
  } catch (e) {
    console.warn("Shared: push failed (will retry on next sync)", e);
  }
}

/**
 * One-way pull: reconcile the server's shared subscriptions with the local
 * database. Newer remote rows win; rows missing from the server that were
 * previously known are treated as deleted. Local-only shared rows that were
 * never pushed (created offline) are pushed up.
 *
 * Returns the number of applied changes (for UI feedback).
 */
export async function syncSharedSubscriptions(): Promise<number> {
  const groups = useSettingsStore.getState().shareGroups;
  if (!groups.length || !isSupabaseConfigured()) return 0;

  let rows: SharedRow[] = [];
  try {
    rows = await fetchSharedSubscriptions();
  } catch (e) {
    console.warn("Shared: fetch failed", e);
    return 0;
  }

  const subscriptions = useSubscriptionStore.getState().subscriptions;
  const localById = new Map(subscriptions.map((s) => [s.id, s]));

  // Remote-id tracking is per group so that leaving one group doesn't clobber
  // the delete-detection state of the other groups the user belongs to.
  const storedRemote: unknown = JSON.parse((await AsyncStorage.getItem(REMOTE_IDS_KEY)) || "{}");
  const rawByGroup = Array.isArray(storedRemote)
    ? { [groups[0]?.id ?? ""]: storedRemote } // legacy array → first group
    : (storedRemote as Record<string, string[]>) ?? {};

  const remoteIdsByGroup = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = remoteIdsByGroup.get(row.group_id) ?? new Set<string>();
    set.add(row.id);
    remoteIdsByGroup.set(row.group_id, set);
  }
  const knownBeforeByGroup = new Map<string, Set<string>>(
    Object.entries(rawByGroup).map(([g, ids]) => [g, new Set(ids)]),
  );

  let applied = 0;
  let needsReminderPermission = false;

  for (const row of rows) {
    const local = localById.get(row.id);

    if (!local) {
      // New shared subscription (someone else published).
      const sub = rowToSubscription(row);
      if ((await db.insertSubscription(sub.id, toInput(sub))) && !sub.isPaused) {
        await scheduleReminder(sub).catch(() => {});
      }
      needsReminderPermission = true;
      applied += 1;
      notifySharedChange("added", row.name, row.publisher_name);
      continue;
    }

    const remoteTime = new Date(row.updated_at).getTime();
    const localTime = new Date(local.updatedAt).getTime();
    if (remoteTime > localTime) {
      // Remote is newer → pull it down.
      const sub = rowToSubscription(row);
      await db.updateSubscription(sub.id, toInput(sub));
      await scheduleReminder(sub).catch(() => {});
      applied += 1;
      notifySharedChange("updated", row.name, row.publisher_name);
    } else if (localTime > remoteTime) {
      // Local is newer (e.g. offline edit) → push it up.
      await upsertSharedSubscription(subscriptionToPayload(local)).catch(() => {});
    }
  }

  // Handle rows that used to exist on the server but are gone now (deleted
  // remotely) and rows that never reached the server (offline creates).
  for (const [id, local] of localById) {
    if (!local.isShared) continue;
    const groupId = local.sharedGroupId ?? "";
    const remoteIds = remoteIdsByGroup.get(groupId);
    if (remoteIds?.has(id)) continue;

    const knownBefore = knownBeforeByGroup.get(groupId)?.has(id) ?? false;
    if (knownBefore) {
      // Known on server before, gone now → remotely deleted.
      await db.deleteSubscription(id);
      await cancelReminder(id).catch(() => {});
      applied += 1;
      notifySharedChange("removed", local.name, "a member");
    } else {
      // Never pushed before → put it on the server.
      await upsertSharedSubscription(subscriptionToPayload(local)).catch(() => {});
    }
  }

  if (needsReminderPermission) {
    requestNotificationPermissions().catch(() => {});
  }

  const nextByGroup: Record<string, string[]> = {};
  for (const [g, set] of remoteIdsByGroup) nextByGroup[g] = [...set];
  await AsyncStorage.setItem(REMOTE_IDS_KEY, JSON.stringify(nextByGroup));
  return applied;
}

/** Forget sync state (used when leaving a group). */
export async function clearSharedSyncState(groupId?: string): Promise<void> {
  try {
    if (!groupId) {
      await AsyncStorage.removeItem(REMOTE_IDS_KEY);
      return;
    }
    const raw: unknown = JSON.parse((await AsyncStorage.getItem(REMOTE_IDS_KEY)) || "{}");
    if (Array.isArray(raw) || typeof raw !== "object" || raw === null) {
      await AsyncStorage.removeItem(REMOTE_IDS_KEY);
      return;
    }
    const byGroup = raw as Record<string, string[]>;
    delete byGroup[groupId];
    await AsyncStorage.setItem(REMOTE_IDS_KEY, JSON.stringify(byGroup));
  } catch (e) {
    console.warn("Shared: failed to clear sync state", e);
  }
}