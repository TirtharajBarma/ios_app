import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import type { ShareGroup, ShareMember } from "@/types/shared";

/**
 * Thin, lazy Supabase client wrapper used by the shared-group feature.
 *
 * Each user may belong to several private groups at once. A subscription is
 * pushed into exactly one group (the one chosen in the add/edit form) and is
 * identified on the server by (id, group_id).
 *
 * The feature is fully OPT-IN: when the two env vars are missing (or the
 * user has never set up a group), every function here no-ops safely and the
 * rest of the app is untouched (personal data stays 100% local).
 */

const extra = Constants.expoConfig?.extra ?? {};
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || (extra as any).supabaseUrl || "";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || (extra as any).supabaseAnonKey || "";

let client: SupabaseClient | null | undefined;
let sessionLoadPromise: Promise<boolean> | null = null;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    client = null;
    return client;
  }
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

/** True when Supabase has been configured via env vars. */
export function isSupabaseConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

/** Log the device into Supabase anonymously (silent, no UI). */
async function ensureSession(): Promise<SupabaseClient | null> {
  const supabase = getClient();
  if (!supabase) return null;
  if (sessionLoadPromise) return (await sessionLoadPromise) ? supabase : null;

  sessionLoadPromise = (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return true;
      const { error } = await supabase.auth.signInAnonymously();
      return !error;
    } catch (e) {
      console.warn("Supabase: anonymous session failed", e);
      return false;
    }
  })();

  const ok = await sessionLoadPromise;
  return ok ? supabase : null;
}

function rpcError(message: string): never {
  throw new Error(message);
}

// ── Group lifecycle ───────────────────────────────────────────────────

export async function createShareGroup(name: string, userName: string): Promise<ShareGroup> {
  const supabase = await ensureSession();
  if (!supabase) rpcError("Sync is not configured");
  const { data, error } = await supabase.rpc("create_group", {
    p_name: name,
    p_user_name: userName,
  });
  if (error) rpcError(error.message);
  return mapGroupResult(data);
}

export async function joinShareGroup(
  code: string,
  userName: string,
): Promise<ShareGroup> {
  const supabase = await ensureSession();
  if (!supabase) rpcError("Sync is not configured");
  const { data, error } = await supabase.rpc("join_group", {
    p_code: code,
    p_user_name: userName,
  });
  if (error) rpcError(error.message);
  return mapGroupResult(data);
}

export async function leaveShareGroup(groupId: string): Promise<void> {
  const supabase = await ensureSession();
  if (!supabase) return;
  const { error } = await supabase.rpc("leave_group", { p_group_id: groupId });
  if (error) rpcError(error.message);
}

export async function removeShareMember(groupId: string, userId: string): Promise<void> {
  const supabase = await ensureSession();
  if (!supabase) return;
  const { error } = await supabase.rpc("remove_member", {
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) rpcError(error.message);
}

export async function renameShareGroup(groupId: string, name: string): Promise<void> {
  const supabase = await ensureSession();
  if (!supabase) return;
  const { error } = await supabase.rpc("rename_group", {
    p_group_id: groupId,
    p_name: name,
  });
  if (error) rpcError(error.message);
}

export interface GroupInfo extends ShareGroup {
  members: ShareMember[];
  sharedCount: number;
}

function mapGroupResult(data: unknown): ShareGroup {
  const d = data as Record<string, unknown>;
  if (!d || typeof d !== "object" || !d.id) rpcError("Invalid group response");
  return {
    id: String(d.id),
    name: String(d.name ?? "My Shared Group"),
    code: d.code ? String(d.code) : null,
    role: d.role === "member" ? "member" : "owner",
    ownerUserId: d.ownerId ? String(d.ownerId) : null,
  };
}

/** Fetch every group the current user belongs to (+ members + shared count). */
export async function fetchShareGroups(): Promise<GroupInfo[]> {
  const supabase = await ensureSession();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_groups");
  if (error || !data) return [];
  const groups = data as (Record<string, unknown> & { members?: ShareMember[] })[];
  return groups.map((d) => ({
    ...mapGroupResult(d),
    members: Array.isArray(d.members) ? d.members : [],
    sharedCount: Number(d.sharedCount ?? 0),
  }));
}

/** Back-compat: first group, or null when the user is in none. */
export async function fetchShareGroup(): Promise<GroupInfo | null> {
  const groups = await fetchShareGroups();
  return groups[0] ?? null;
}

// ── Shared subscriptions ──────────────────────────────────────────────

export interface SharedRow {
  id: string;
  group_id: string;
  name: string;
  price: number;
  currency: string;
  billing_cycle: string | null;
  next_billing_date: string;
  category: string | null;
  brand_color: string | null;
  logo_icon: string | null;
  is_trial: boolean;
  trial_end_date: string | null;
  split_enabled: boolean;
  split_type: string | null;
  split_value: number | null;
  is_paused: boolean;
  notes: string | null;
  website: string | null;
  publisher_name: string;
  updated_at: string;
}

/** Fetch every shared subscription belonging to the current user's groups. */
export async function fetchSharedSubscriptions(): Promise<SharedRow[]> {
  const supabase = await ensureSession();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_shared_subscriptions");
  if (error || !data) return [];
  return data as SharedRow[];
}

/** Wrapper type used to push a developer-friendly payload into upsert RPC. */
export type UpsertPayload = {
  id: string;
  groupId: string | null;
  publisherName: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: string | null;
  nextBillingDate: string;
  category: string;
  brandColor: string;
  logoIcon: string | null;
  isTrial: boolean;
  trialEndDate: string | null;
  splitEnabled: boolean;
  splitType: string | null;
  splitValue: number | null;
  isPaused: boolean;
  notes: string | null;
  website: string | null;
};

export async function upsertSharedSubscription(payload: UpsertPayload): Promise<void> {
  const supabase = await ensureSession();
  if (!supabase) return;
  const { error } = await supabase.rpc("upsert_shared_subscription", { p_sub: payload });
  if (error) {
    // Non-fatal; the next sync pass will repair the drift.
    console.warn("Supabase: upsert shared sub failed", error.message);
  }
}

export async function deleteSharedSubscriptionRemote(id: string, groupId: string): Promise<void> {
  const supabase = await ensureSession();
  if (!supabase) return;
  const { error } = await supabase.rpc("delete_shared_subscription", {
    p_id: id,
    p_group_id: groupId,
  });
  if (error) console.warn("Supabase: delete shared sub failed", error.message);
}