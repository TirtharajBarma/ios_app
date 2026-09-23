-- =====================================================================
-- Share Groups — allow devices to share flagged subscriptions across any
-- number of private groups (Family, YouTube, Roommates, Office, ...).
--
-- Security model: the client signs in ANONYMOUSLY (Supabase anonymous
-- auth). All access goes through SECURITY DEFINER RPC functions below,
-- which check `auth.uid()` membership — anon keys can never read or write
-- another group's rows directly.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ── Tables ───────────────────────────────────────────────────────────

create table if not exists share_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default 'My Shared Group',
  owner_id uuid not null,
  created_at timestamptz not null default now()
);

-- Composite PK so one user can belong to many groups at once.
create table if not exists share_group_members (
  user_id uuid not null,
  group_id uuid not null references share_groups(id) on delete cascade,
  user_name text not null default 'Someone',
  joined_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

-- One row per shared subscription, keyed by (local sub id, group id) so
-- the same subscription can be shared into several groups. `id` mirrors
-- the local SQLite sub id so syncs are natural upserts.
create table if not exists shared_subscriptions (
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

-- Reserved for the future instant-push upgrade (device_id -> push token).
create table if not exists devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_token text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_subs_group on shared_subscriptions(group_id);
create index if not exists idx_members_group on share_group_members(group_id);

-- ── Join-code generator (friendly, no ambiguous chars) ───────────────

create or replace function generate_group_code() returns text
language plpgsql
security definer
as $$
declare
  result text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from share_groups where code = result);
  end loop;
  return result;
end $$;

-- ── RPC: create a group (creator becomes owner + first member) ───────

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

-- ── RPC: join a group by code (max 10 members, multi-group allowed) ──

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

-- ── RPC: leave a group (owner leaving does not destroy the group) ────

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

-- ── RPC: owner removes a member from a specific group ─────────────────

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

-- ── RPC: rename group (owner only, group-scoped) ─────────────────────

create or replace function rename_group(p_group_id uuid, p_name text) returns void
language plpgsql
security definer
as $$
begin
  update share_groups
  set name = coalesce(nullif(trim(p_name), ''), name)
  where id = p_group_id and owner_id = auth.uid();
end $$;

-- ── RPC: refresh this user's display name in every group they belong to ──

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

-- ── RPC: read every group the current user belongs to ─────────────────

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

-- Back-compat: single-group helper returning the user's first group.

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

-- ── RPC: read all shared subscriptions of my group(s) ────────────────

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

-- ── RPC: upsert one shared subscription into its chosen group ─────────

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

-- ── RPC: delete one shared subscription (member of the group) ────────

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

-- ── Grants ───────────────────────────────────────────────────────────

grant execute on function
  create_group(text, text),
  join_group(text, text),
  leave_group(uuid),
  remove_member(uuid, uuid),
  rename_group(uuid, text),
  update_my_name(text),
  get_groups(),
  get_group(),
  get_shared_subscriptions(),
  upsert_shared_subscription(jsonb),
  delete_shared_subscription(text, uuid),
  generate_group_code()
to anon, authenticated;