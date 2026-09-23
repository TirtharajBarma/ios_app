-- =====================================================================
-- Migration: Correct member names (2026-09-12)
--
-- Two fixes:
--   1. Members used to see the `user_name` snapshot captured at create/join
--      time. If a member changed their display name afterwards, everyone's
--      view went stale. This adds `update_my_name(p_user_name)` so a member
--      can refresh their name in every group they belong to, and the app
--      calls it whenever the personalization name changes.
--   2. `get_groups` now flags the calling user's own membership with a `me`
--      boolean per member row, letting the client render the local display
--      name for "this device" instead of the server snapshot (no hardcoded
--      "Me"/"You" labels anywhere).
--
-- Re-runnable from the Supabase SQL editor on an existing database.
-- =====================================================================

-- ── 1. update_my_name: refresh this user's display name in all groups ──

create or replace function update_my_name(p_user_name text) returns void
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  update share_group_members
  set user_name = coalesce(nullif(trim(p_user_name), ''), user_name)
  where user_id = uid;
end $$;

-- ── 2. get_groups: expose a `me` flag per member row ──────────────────
-- Careful: get_groups depends on nothing that blocks a DROP, so we can use
-- the plain replace above. Recreate with the extra `me` field.

create or replace function get_groups() returns jsonb
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
  result jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sg.id,
    'name', sg.name,
    'code', case when sg.owner_id = uid then sg.code else null end,
    'ownerId', sg.owner_id,
    'role', case when sg.owner_id = uid then 'owner' else 'member' end,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'userId', m2.user_id,
        'userName', m2.user_name,
        'isOwner', m2.user_id = sg.owner_id,
        'me', m2.user_id = uid,
        'joinedAt', m2.joined_at
      ) order by m2.joined_at asc), '[]'::jsonb)
      from share_group_members m2
      where m2.group_id = sg.id
    ),
    'sharedCount', (select count(*) from shared_subscriptions s where s.group_id = sg.id)
  ) order by sg.created_at asc), '[]'::jsonb) into result
  from share_groups sg
  join share_group_members m on m.group_id = sg.id
  where m.user_id = uid;

  return result;
end $$;

-- ── 3. Grants ────────────────────────────────────────────────────────

grant execute on function update_my_name(text) to anon, authenticated;