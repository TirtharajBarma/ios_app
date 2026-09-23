/**
 * Shared-group types.
 *
 * A "share group" links up to 10 devices so a subscription flagged as shared
 * on one phone appears (and is remembered) on all the others. The backend is
 * Supabase; only the flagged subset of data ever leaves the device.
 */

/** Role of the current device inside a share group. */
export type ShareRole = "owner" | "member";

/** Local, persisted share-group state (mirrors the owner/member view). */
export interface ShareGroup {
  id: string;
  name: string;
  code: string | null; // only the owner sees the join code
  role: ShareRole;
  ownerUserId: string | null;
}

/** A member row coming from the server. */
export interface ShareMember {
  userId: string;
  userName: string;
  isOwner: boolean;
  joinedAt: string;
  /** True when this row is the current device's own membership. */
  me?: boolean;
}

/**
 * The lightweight projection of a Subscription that is pushed to Supabase.
 * Local-only fields (logoImageUri, logoUrl favicons, per-device reminder
 * offsets) are intentionally excluded.
 */
export interface SharedSubscriptionRow {
  id: string;
  groupId?: string;
  publisherUserId: string | null;
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
  updatedAt: string;
}

/** What changed during a sync pass (used to notify other devices). */
export type SharedChangeType = "added" | "updated" | "removed";

export interface SharedChange {
  type: SharedChangeType;
  subName: string;
  publisherName: string;
}
