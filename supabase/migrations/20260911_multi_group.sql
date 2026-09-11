-- =====================================================================
-- Migration: Multi-group support (2026-09-11)
--
-- Single-group MVP -> any number of private groups per user.
--   * share_group_members gets a composite primary key (user_id, group_id)
--     so one user can belong to Family, YouTube, Roommates, ... at once.
--   * RPCs become group-scoped. Shared subscriptions are pushed into the
--     specific group chosen in the form (p_sub->>'groupId'), never forced
--     into a single group.
--   * Owner leaving no longer deletes the group; the group is removed only
--     when its last member leaves.
--
-- Idempotent enough to be re-run from the Supabase SQL editor on a database
-- that already has the single-group schema.
-- =====================================================================

-- ── 1. Actions that may create jump-backs for RPC signatures ──────────
-- (Function drops/recreates below replace previous definitions.)

-- 1a. Drop dependent RPCs BEFORE rebuilding the tables. Postgres refuses to
-- drop a table that a function depends on (e.g. get_shared_subscriptions()
-- returns setof shared_subscriptions); the functions are re-created at the
-- end of this script. Both old (single-group) and new signatures are dropped
-- so the script is re-runnable after a partial run.
drop function if exists create_group(text, text);
drop function if exists join_group(text, text);
drop function if exists leave_group();
drop function if exists leave_group(uuid);
drop function if exists remove_member(uuid);
drop function if exists remove_member(uuid, uuid);
drop function if exists rename_group(text);
drop function if exists rename_group(uuid, text);
drop function if exists get_groups();
drop function if exists get_group();
drop function if exists get_shared_subscriptions();
drop function if exists upsert_shared_subscription(jsonb);
drop function if exists delete_shared_subscription(text);
drop function if exists delete_shared_subscription(text, uuid);

-- ── 2. Rebuild membership table with composite PK ─────────────────────
-- A plain ALTER would fail on the existing single-column primary key, so
-- rebuild the table and carry existing rows over.

create table if not exists share_group_members_new (
  user_id uuid not null,
  group_id uuid not null references share_groups(id) on delete cascade,
  user_name text not null default 'Someone',
  joined_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

insert into share_group_members_new (user_id, group_id, user_name, joined_at)
select user_id, group_id, user_name, joined_at
from share_group_members
on conflict (user_id, group_id) do nothing;

drop table share_group_members;
alter table share_group_members_new rename to share_group_members;

create index if not exists idx_members_group on share_group_members(group_id);

-- ── 2b. Rebuild shared_subscriptions with a composite key ─────────────
-- A subscription is identified by (local sub id, group id): the same local
-- subscription id may exist in several groups. This also lets the upsert
-- below conflict-match on (id, group_id).

create table if not exists shared_subscriptions_new (
  id text not null,
  group_id uuid not null references share_groups(id) on delete cascade,
  publisher_user_id uuid,
  publisher_name text not null default 'Someone',
  name text not null,
  price real not null default 0,
  currency text not null default 'USD',
  billing_cycle text,
  next_billing_date text not null,
  category text,
  brand_color text,
  logo_icon text,
  is_trial boolean not null default false,
  trial_end_date text,
  split_enabled boolean not null default false,
  split_type text,
  split_value real,
  is_paused boolean not null default false,
  notes text,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, group_id)
);

insert into shared_subscriptions_new (
  id, group_id, publisher_user_id, publisher_name,
  name, price, currency, billing_cycle, next_billing_date, category,
  brand_color, logo_icon, is_trial, trial_end_date,
  split_enabled, split_type, split_value, is_paused, notes, website,
  created_at, updated_at
)
select
  id, group_id, publisher_user_id, publisher_name,
  name, price, currency, billing_cycle, next_billing_date, category,
  brand_color, logo_icon, is_trial, trial_end_date,
  split_enabled, split_type, split_value, is_paused, notes, website,
  created_at, updated_at
from shared_subscriptions
on conflict (id, group_id) do nothing;

drop table shared_subscriptions;
alter table shared_subscriptions_new rename to shared_subscriptions;

create index if not exists idx_subs_group on shared_subscriptions(group_id);

-- ── 3. Create a group (creator becomes owner + first member) ──────────
-- No longer rejects users who are already in other groups.

create or replace function create_group(p_name text, p_user_name text) returns jsonb
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
  g share_groups;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  insert into share_groups (code, name, owner_id)
  values (generate_group_code(), coalesce(nullif(trim(p_name), ''), 'My Shared Group'), uid)
  returning * into g;

  insert into share_group_members (user_id, group_id, user_name)
  values (uid, g.id, coalesce(nullif(trim(p_user_name), ''), 'Owner'));

  return jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'code', g.code,
    'ownerId', g.owner_id,
    'role', 'owner'
  );
end $$;

-- ── 4. Join a group by code (max 10 members, multi-group allowed) ─────

create or replace function join_group(p_code text, p_user_name text) returns jsonb
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
  g share_groups;
  full_count uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  select * into g from share_groups where code = upper(trim(p_code));
  if g.id is null then raise exception 'Invalid group code'; end if;

  if exists (select 1 from share_group_members where user_id = uid and group_id = g.id) then
    raise exception 'You are already in this group';
  end if;

  -- Enforce the `up to 10 people` limit server-side per group.
  select user_id into full_count
  from share_group_members where group_id = g.id limit 1 offset 9;
  if full_count is not null then raise exception 'This group is full (max 10 people)'; end if;

  insert into share_group_members (user_id, group_id, user_name)
  values (uid, g.id, coalesce(nullif(trim(p_user_name), ''), 'Member'));

  return jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'code', null,
    'ownerId', g.owner_id,
    'role', 'member'
  );
end $$;

-- ── 5. Leave a group (owner leaving no longer destroys the group) ─────

create or replace function leave_group(p_group_id uuid) returns void
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  delete from share_group_members where user_id = uid and group_id = p_group_id;

  -- If the group has no members left, clean it up.
  delete from share_groups g
  where g.id = p_group_id
    and not exists (select 1 from share_group_members m where m.group_id = g.id);
end $$;

-- ── 6. Owner removes a member from a specific group ───────────────────

create or replace function remove_member(p_group_id uuid, p_user_id uuid) returns void
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from share_groups where id = p_group_id and owner_id = uid) then
    raise exception 'Only the group owner can remove members';
  end if;
  if p_user_id = uid then raise exception 'The owner cannot remove themselves'; end if;

  delete from share_group_members where group_id = p_group_id and user_id = p_user_id;
end $$;

-- ── 7. Rename a group (owner only, group-scoped) ──────────────────────

create or replace function rename_group(p_group_id uuid, p_name text) returns void
language plpgsql
security definer
as $$
begin
  update share_groups
  set name = coalesce(nullif(trim(p_name), ''), name)
  where id = p_group_id and owner_id = auth.uid();
end $$;

-- ── 8. Read every group the current user belongs to ───────────────────
-- Returns an array: [{ id, name, code?, ownerId, role, members[], sharedCount }]

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

-- Back-compat: single-group helper that returns the user's first group.

create or replace function get_group() returns jsonb
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
  groups jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  groups := (select get_groups());
  if jsonb_array_length(groups) = 0 then
    return null;
  end if;
  return groups->0;
end $$;

-- ── 9. Read all shared subscriptions across every group of the user ───

create or replace function get_shared_subscriptions() returns setof shared_subscriptions
language sql
security definer
as $$
  select s.*
  from shared_subscriptions s
  join share_group_members m on m.group_id = s.group_id
  where m.user_id = auth.uid()
  order by s.next_billing_date asc;
$$;

-- ── 10. Upsert one shared subscription into its chosen group ──────────

create or replace function upsert_shared_subscription(p_sub jsonb) returns void
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
  g uuid;
  existing text := null;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  g := nullif(p_sub->>'groupId', '')::uuid;
  if g is null then raise exception 'A group is required to share a subscription'; end if;

  if not exists (select 1 from share_group_members where user_id = uid and group_id = g) then
    raise exception 'You are not a member of this group';
  end if;

  select publisher_name into existing
  from shared_subscriptions
  where id = p_sub->>'id' and group_id = g;

  insert into shared_subscriptions (
    id, group_id, publisher_user_id, publisher_name,
    name, price, currency, billing_cycle, next_billing_date, category,
    brand_color, logo_icon, is_trial, trial_end_date,
    split_enabled, split_type, split_value, is_paused, notes, website,
    updated_at
  ) values (
    p_sub->>'id', g, uid, coalesce(existing, p_sub->>'publisherName'),
    p_sub->>'name', (p_sub->>'price')::real, p_sub->>'currency', p_sub->>'billingCycle',
    p_sub->>'nextBillingDate', p_sub->>'category', p_sub->>'brandColor',
    nullif(p_sub->>'logoIcon', ''), (p_sub->>'isTrial')::boolean,
    nullif(p_sub->>'trialEndDate', ''),
    (p_sub->>'splitEnabled')::boolean, nullif(p_sub->>'splitType', ''), (p_sub->>'splitValue')::real,
    (p_sub->>'isPaused')::boolean, nullif(p_sub->>'notes', ''), nullif(p_sub->>'website', ''),
    now()
  )
  on conflict (id, group_id) do update set
    name = excluded.name,
    price = excluded.price,
    currency = excluded.currency,
    billing_cycle = excluded.billing_cycle,
    next_billing_date = excluded.next_billing_date,
    category = excluded.category,
    brand_color = excluded.brand_color,
    logo_icon = excluded.logo_icon,
    is_trial = excluded.is_trial,
    trial_end_date = excluded.trial_end_date,
    split_enabled = excluded.split_enabled,
    split_type = excluded.split_type,
    split_value = excluded.split_value,
    is_paused = excluded.is_paused,
    notes = excluded.notes,
    website = excluded.website,
    updated_at = now();
end $$;

-- ── 11. Delete one shared subscription (must be a member of its group) ──

create or replace function delete_shared_subscription(p_id text, p_group_id uuid) returns void
language plpgsql
security definer
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not exists (select 1 from share_group_members where user_id = uid and group_id = p_group_id) then
    raise exception 'You are not a member of this group';
  end if;

  delete from shared_subscriptions s
  where s.id = p_id and s.group_id = p_group_id;
end $$;

-- ── 12. Grants ────────────────────────────────────────────────────────

grant execute on function
  create_group(text, text),
  join_group(text, text),
  leave_group(uuid),
  remove_member(uuid, uuid),
  rename_group(uuid, text),
  get_groups(),
  get_group(),
  get_shared_subscriptions(),
  upsert_shared_subscription(jsonb),
  delete_shared_subscription(text, uuid),
  generate_group_code()
to anon, authenticated;