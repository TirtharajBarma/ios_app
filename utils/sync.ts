import AsyncStorage from "@/utils/storage";
import * as db from "@/database/database";
import type { NewSubscriptionInput, Subscription } from "@/types/subscription";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  deleteSharedSubscriptionRemote,
  fetchSharedSubscriptions,
  getCurrentUserId,
  isSupabaseConfigured,
  subscribeToSharedChanges,
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

const REMOTE_IDS_KEY = "@expense_shared_remote_ids_v2";

// Tombstones for shared subscriptions deleted while offline. Deletes that
// can't reach the server are queued here and flushed on the next successful
// sync — otherwise a pull would happily re-create a locally-deleted row.
const PENDING_DELETE_KEY = "@expense_shared_pending_deletes_v1";

interface PendingDelete {
  id: string;
  groupId: string;
}

async function readPendingDeletes(): Promise<PendingDelete[]> {
  try {
    const raw: unknown = JSON.parse((await AsyncStorage.getItem(PENDING_DELETE_KEY)) || "[]");
    return Array.isArray(raw) ? (raw as PendingDelete[]) : [];
  } catch {
    return [];
  }
}

async function addPendingDelete(id: string, groupId: string): Promise<void> {
  try {
    const pending = await readPendingDeletes();
    if (pending.some((p) => p.id === id && p.groupId === groupId)) return;
    await AsyncStorage.setItem(PENDING_DELETE_KEY, JSON.stringify([...pending, { id, groupId }]));
  } catch (e) {
    console.warn("Shared: failed to queue pending delete", e);
  }
}

/** Drop a tombstone (e.g. the user re-shared a sub they had un-shared offline). */
async function removePendingDelete(id: string, groupId: string): Promise<void> {
  try {
    const pending = await readPendingDeletes();
    const next = pending.filter((p) => !(p.id === id && p.groupId === groupId));
    if (next.length !== pending.length) await AsyncStorage.setItem(PENDING_DELETE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("Shared: failed to clear pending delete", e);
  }
}

/** Attempt to send queued deletions; drops entries that succeeded. */
export async function flushPendingDeletes(groupId?: string): Promise<void> {
  try {
    const pending = await readPendingDeletes();
    if (!pending.length) return;
    const remaining: PendingDelete[] = [];
    for (const p of pending) {
      if (groupId && p.groupId !== groupId) {
        remaining.push(p);
        continue;
      }
      const ok = await deleteSharedSubscriptionRemote(p.id, p.groupId);
      if (!ok) remaining.push(p);
    }
    await AsyncStorage.setItem(PENDING_DELETE_KEY, JSON.stringify(remaining));
  } catch (e) {
    console.warn("Shared: flush pending deletes failed", e);
  }
}

let syncInFlight = false;
let syncRerun = false;

/** True when the local sub already carries every field the server row holds (stops pull/push ping-pong). */
function sameAsRow(local: Subscription, row: SharedRow): boolean {
  const r = rowToSubscription(row);
  const keys = [
    "name", "price", "currency", "rawBillingCycle", "nextBillingDate", "category", "color",
    "isTrial", "trialEndDate", "splitEnabled", "splitType", "splitValue", "isPaused", "note", "website", "logoIcon",
  ] as const;
  return keys.every((k) => (local[k] ?? null) === (r[k] ?? null));
}

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
    publisherName: userName.trim() || "A member",
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
 * `sub` present + `isShared` → upsert into `sub.sharedGroupId`.
 * `sub` present + not shared  → delete its remote copy (from its previous
 * group, or `prevGroupId` when the row no longer knows which group it was in).
 * `sub` null → no-op.
 *
 * Offline-safe: failed deletes are queued as tombstones and flushed on the
 * next successful sync; failed upserts are repaired by the next sync pass.
 */
export async function pushSharedSubscription(
  sub: Subscription | null,
  prevGroupId?: string | null,
): Promise<void> {
  const groups = useSettingsStore.getState().shareGroups;
  if (!groups.length || !isSupabaseConfigured()) return;
  if (!sub) return;

  // Resolve the target group *only* among groups the user still belongs to,
  // so a stale sharedGroupId can never be pushed/deleted into a lost group.
  const isInGroups = (id?: string | null) => !!id && groups.some((g) => g.id === id);

  try {
    if (!sub.isShared) {
      const deleteFrom = isInGroups(sub.sharedGroupId)
        ? sub.sharedGroupId!
        : isInGroups(prevGroupId)
          ? prevGroupId!
          : groups[0].id;
      const ok = await deleteSharedSubscriptionRemote(sub.id, deleteFrom);
      if (!ok) await addPendingDelete(sub.id, deleteFrom);
      await flushPendingDeletes(deleteFrom).catch(() => {});
      return;
    }

    const groupId = isInGroups(sub.sharedGroupId) ? sub.sharedGroupId! : null;
    if (!groupId) return;

    // Re-sharing something un-shared while offline: the stale tombstone must not delete it again.
    await removePendingDelete(sub.id, groupId);

    const ok = await upsertSharedSubscription(subscriptionToPayload(sub));
    if (!ok) return; // temporary failure → next sync's "never pushed" path repairs it

    // The sub was moved (or first shared) into `groupId`; drop the stale copy
    // that may still live in its previous group.
    if (prevGroupId && prevGroupId !== groupId) {
      await deleteSharedSubscriptionRemote(sub.id, prevGroupId);
    }
    await flushPendingDeletes(groupId).catch(() => {});
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
 *
 * IMPORTANT: when the remote fetch FAILS (offline / server error) this throws
 * instead of pretending the server is empty — callers must not wipe local
 * shared data just because a network request failed.
 */
export async function syncSharedSubscriptions(): Promise<number> {
  const groups = useSettingsStore.getState().shareGroups;
  if (!groups.length || !isSupabaseConfigured()) return 0;
  if (syncInFlight) {
    syncRerun = true; // coalesce: run once more after the current pass instead of dropping this trigger
    return 0;
  }

  syncInFlight = true;
  let total = 0;
  try {
    do {
      syncRerun = false;
      total += await syncOnce();
    } while (syncRerun);
    return total;
  } finally {
    syncInFlight = false;
  }
}

async function syncOnce(): Promise<number> {
  const groups = useSettingsStore.getState().shareGroups;
  {
    // Throws on network/rpc failure (see api/supabase.ts) so we never treat a
    // failed fetch as "everything was deleted".
    const rows = await fetchSharedSubscriptions();

    const pendingDeletes = await readPendingDeletes();
    const pendingKey = (id: string, groupId: string) => `${groupId}:${id}`;
    const pendingSet = new Set(pendingDeletes.map((p) => pendingKey(p.id, p.groupId)));

    const subscriptions = useSubscriptionStore.getState().subscriptions;
    const localById = new Map(subscriptions.map((s) => [s.id, s]));

    // Remote-id tracking is per group so that leaving one group doesn't clobber
    // the delete-detection state of the other groups the user belongs to.
    let storedRemote: unknown = {};
    try {
      storedRemote = JSON.parse((await AsyncStorage.getItem(REMOTE_IDS_KEY)) || "{}");
    } catch {}
    let myId: string | null = null;
    try {
      myId = await getCurrentUserId();
    } catch {}
    const rawByGroup = Array.isArray(storedRemote)
      ? { [groups[0]?.id ?? ""]: storedRemote } // legacy array → first group
      : ((storedRemote as Record<string, string[]>) ?? {});

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
      // A subscription we deleted on this device (while offline) must not be
      // re-created by a pull — the tombstone will be flushed below.
      if (pendingSet.has(pendingKey(row.id, row.group_id))) continue;

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

      // Our own published sub: the local copy is the source of truth, never overwrite it from the echo.
      const mine = !!myId && row.publisher_user_id === myId;
      const remoteTime = new Date(row.updated_at).getTime();
      const localTime = new Date(local.updatedAt).getTime();
      if (remoteTime > localTime && !mine) {
        // Remote is newer → pull it down, keeping device-local fields.
        const sub = rowToSubscription(row);
        const input: Partial<NewSubscriptionInput> = toInput(sub);
        delete input.reminderEnabled;
        delete input.reminderDays;
        delete input.serviceId;
        delete input.brandVariant;
        delete input.logoImageUri;
        // Any logo field in the update rewrites all logo columns; keep the local logo if it has one.
        if (local.serviceId || local.logoImageUri || local.brandVariant) delete input.logoIcon;
        await db.updateSubscription(sub.id, input);
        await scheduleReminder({ ...local, ...input, id: sub.id } as Subscription).catch(() => {});
        applied += 1;
        notifySharedChange("updated", row.name, row.publisher_name);
      } else if (localTime > remoteTime && !sameAsRow(local, row)) {
        // Local is newer (e.g. offline edit) → push it up, but only if we're allowed to edit that row.
        const iOwnGroup = groups.find((g) => g.id === row.group_id)?.ownerUserId === myId;
        if (!row.publisher_user_id || mine || iOwnGroup) {
          await upsertSharedSubscription(subscriptionToPayload(local)).catch(() => {});
        }
      }
    }

    const allRemoteIds = new Set<string>();
    for (const set of remoteIdsByGroup.values()) {
      for (const rId of set) allRemoteIds.add(rId);
    }

    // Handle rows that used to exist on the server but are gone now (deleted
    // remotely) and rows that never reached the server (offline creates).
    for (const [id, local] of localById) {
      if (!local.isShared) continue;
      if (allRemoteIds.has(id)) continue;

      const groupId = local.sharedGroupId ?? "";
      const isKnownBefore = groupId
        ? knownBeforeByGroup.get(groupId)?.has(id) ?? false
        : Array.from(knownBeforeByGroup.values()).some((s) => s.has(id));

      if (groupId && !groups.some((g) => g.id === groupId)) {
        // We left / were removed / the group is gone: keep the user's data as a plain local subscription.
        await db.updateSubscription(id, { isShared: false, sharedGroupId: "" });
        applied += 1;
      } else if (isKnownBefore) {
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

    // Flush deletes that were queued offline now that we have connectivity.
    await flushPendingDeletes().catch(() => {});

    const nextByGroup: Record<string, string[]> = {};
    for (const [g, set] of remoteIdsByGroup) nextByGroup[g] = [...set];
    await AsyncStorage.setItem(REMOTE_IDS_KEY, JSON.stringify(nextByGroup));
    return applied;
  }
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

let realtimeUnsub: (() => void) | null = null;

/** Initialize real-time WebSocket listener for shared subscriptions. */
export function initSharedRealtimeSync(): () => void {
  if (realtimeUnsub) return realtimeUnsub;

  realtimeUnsub = subscribeToSharedChanges(() => {
    syncSharedSubscriptions()
      .then((changed) => {
        if (changed > 0) {
          useSubscriptionStore.getState().refresh();
        }
      })
      .catch((e) => console.warn("Realtime sync failed:", e));
  });

  return () => {
    if (realtimeUnsub) {
      realtimeUnsub();
      realtimeUnsub = null;
    }
  };
}