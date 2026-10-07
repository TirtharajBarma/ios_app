-- =====================================================================
-- Migration: Security Hardening & Vulnerability Remediation (2026-10-06)
--
-- Remediates findings:
--   1. N1: Enables Row-Level Security on share_groups, share_group_members,
--      and shared_subscriptions with membership-scoped SELECT policies.
--      Revokes direct INSERT/UPDATE/DELETE from anon and authenticated.
--   2. #1: Hardens app_devices by dropping the permissive "true" policy,
--      revoking direct table access from anon, dropping device_name,
--      securing views with security_invoker, and channeling telemetry
--      through a dedicated SECURITY DEFINER RPC.
--   3. #5: Generates cryptographically secure 6-character group join codes
--      using pgcrypto gen_random_bytes(6) with uniform distribution;
--      adds attempt rate-limiting on join_group; tracks removed members
--      so they cannot rejoin; enforces publisher/owner authorization on
--      shared subscription updates and deletes; adds input length checks;
--      adds rotate_group_code RPC.
--   4. #6: Sets explicit `search_path = public, pg_temp` on every
--      SECURITY DEFINER function to eliminate search-path injection.
--
-- Idempotent and safely re-runnable in Supabase SQL editor.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ── 1. Row-Level Security on Shared-Group Tables ─────────────────────

alter table public.share_groups enable row level security;
alter table public.share_group_members enable row level security;
alter table public.shared_subscriptions enable row level security;

-- Drop previous policies if existing to avoid duplication
drop policy if exists "Members can view their own groups" on public.share_groups;
drop policy if exists "Members can view members of their groups" on public.share_group_members;
drop policy if exists "Group members can view shared subscriptions" on public.shared_subscriptions;
drop policy if exists "Allow anonymous device upsert" on public.app_devices;

-- SELECT policies: allow only verified group members to read rows
create policy "Members can view their own groups"
  on public.share_groups for select
  using (
    exists (
      select 1 from public.share_group_members m
      where m.group_id = share_groups.id
        and m.user_id = auth.uid()
    )
  );

create policy "Members can view members of their groups"
  on public.share_group_members for select
  using (
    exists (
      select 1 from public.share_group_members m
      where m.group_id = share_group_members.group_id
        and m.user_id = auth.uid()
    )
  );

-- Group members can read subscriptions (essential for Supabase Realtime)
create policy "Group members can view shared subscriptions"
  on public.shared_subscriptions for select
  using (
    exists (
      select 1 from public.share_group_members m
      where m.group_id = shared_subscriptions.group_id
        and m.user_id = auth.uid()
    )
  );

-- Revoke direct table mutations: all writes must pass through RPC functions
revoke insert, update, delete on public.share_groups from anon, authenticated;
revoke insert, update, delete on public.share_group_members from anon, authenticated;
revoke insert, update, delete on public.shared_subscriptions from anon, authenticated;

-- Ensure Realtime publication includes shared_subscriptions
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shared_subscriptions'
  ) then
    alter publication supabase_realtime add table public.shared_subscriptions;
  end if;
exception
  when others then null;
end $$;

-- ── 2. Table for tracking removed members (Prevent rejoin) ───────────

create table if not exists public.share_group_removed_members (
  group_id uuid not null references public.share_groups(id) on delete cascade,
  user_id uuid not null,
  removed_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.share_group_removed_members enable row level security;
revoke all on public.share_group_removed_members from anon, authenticated;

-- ── 3. Table for Join Attempt Rate Limiting ───────────────────────────

create table if not exists public.group_join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_join_attempts_uid_time
  on public.group_join_attempts (user_id, attempted_at desc);

alter table public.group_join_attempts enable row level security;
revoke all on public.group_join_attempts from anon, authenticated;

-- ── 4. App Devices & Telemetry Hardening ──────────────────────────────

-- Ensure all app_devices columns exist safely
create table if not exists public.app_devices (
  device_id text primary key
);

alter table public.app_devices
  add column if not exists brand text,
  add column if not exists model_name text,
  add column if not exists os_name text,
  add column if not exists os_version text,
  add column if not exists app_version text,
  add column if not exists update_hash text,
  add column if not exists channel text default 'preview',
  add column if not exists timezone text default 'Asia/Kolkata',
  add column if not exists total_launches integer default 1,
  add column if not exists last_active_at timestamptz default now(),
  add column if not exists created_at timestamptz default now();

-- Drop personal device_name column if present
alter table public.app_devices drop column if exists device_name;

-- Ensure RLS is active and revoke direct access from anon/authenticated
alter table public.app_devices enable row level security;
revoke all on public.app_devices from anon, authenticated;

-- Recreate view with security_invoker = true
drop view if exists public.v_app_devices_ist;
create or replace view public.v_app_devices_ist with (security_invoker = true) as
select
  device_id,
  brand,
  model_name,
  os_name,
  os_version,
  app_version,
  update_hash,
  channel,
  total_launches,
  to_char(coalesce(last_active_at, now()) at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') || ' IST' as last_active_ist,
  to_char(coalesce(created_at, now()) at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') || ' IST' as registered_at_ist
from public.app_devices
order by last_active_at desc nulls last;

-- ── 5. Cryptographically Secure Code Generator ────────────────────────

create or replace function public.generate_group_code() returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 symbols
  bytes bytea;
  b int;
begin
  loop
    result := '';
    bytes := gen_random_bytes(6);
    for i in 0..5 loop
      b := get_byte(bytes, i);
      -- Modulo 32 on 256 has zero bias (256 is an exact multiple of 32)
      result := result || substr(alphabet, 1 + (b % 32), 1);
    end loop;
    exit when not exists (select 1 from public.share_groups where code = result);
  end loop;
  return result;
end $$;

-- ── 6. Group RPCs with search_path and Input Validation ───────────────

-- Create Group
create or replace function public.create_group(p_name text, p_user_name text) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  g public.share_groups;
  clean_name text;
  clean_user text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  clean_name := coalesce(nullif(substr(trim(p_name), 1, 60), ''), 'My Shared Group');
  clean_user := coalesce(nullif(substr(trim(p_user_name), 1, 50), ''), 'Owner');

  insert into public.share_groups (code, name, owner_id)
  values (public.generate_group_code(), clean_name, uid)
  returning * into g;

  insert into public.share_group_members (user_id, group_id, user_name)
  values (uid, g.id, clean_user);

  return jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'code', g.code,
    'ownerId', g.owner_id,
    'role', 'owner'
  );
end $$;

-- Join Group (Rate limited, format validated, checks removed members)
create or replace function public.join_group(p_code text, p_user_name text) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  g public.share_groups;
  full_count uuid;
  recent_attempts int;
  clean_code text;
  clean_user text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  -- Rate limit: max 5 join attempts per 10 minutes per user
  select count(*) into recent_attempts
  from public.group_join_attempts
  where user_id = uid
    and attempted_at > (now() - interval '10 minutes');

  if recent_attempts >= 5 then
    raise exception 'Too many join attempts. Please wait a few minutes before trying again.';
  end if;

  -- Record attempt
  insert into public.group_join_attempts (user_id) values (uid);

  clean_code := upper(trim(p_code));
  if clean_code is null or length(clean_code) != 6 or not (clean_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$') then
    raise exception 'Invalid group code format';
  end if;

  clean_user := coalesce(nullif(substr(trim(p_user_name), 1, 50), ''), 'Member');

  select * into g from public.share_groups where code = clean_code;
  if g.id is null then raise exception 'Invalid group code'; end if;

  if exists (select 1 from public.share_group_members where user_id = uid and group_id = g.id) then
    raise exception 'You are already in this group';
  end if;

  if exists (select 1 from public.share_group_removed_members where group_id = g.id and user_id = uid) then
    raise exception 'You have been removed from this group and cannot rejoin';
  end if;

  -- Enforce max 10 members limit
  select user_id into full_count
  from public.share_group_members where group_id = g.id limit 1 offset 9;
  if full_count is not null then raise exception 'This group is full (max 10 people)'; end if;

  insert into public.share_group_members (user_id, group_id, user_name)
  values (uid, g.id, clean_user);

  -- Clean up successful user's recent attempts
  delete from public.group_join_attempts where user_id = uid;

  return jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'code', null,
    'ownerId', g.owner_id,
    'role', 'member'
  );
end $$;

-- Leave Group
create or replace function public.leave_group(p_group_id uuid) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  delete from public.share_group_members where user_id = uid and group_id = p_group_id;

  -- If the group has no members left, clean it up.
  delete from public.share_groups g
  where g.id = p_group_id
    and not exists (select 1 from public.share_group_members m where m.group_id = g.id);
end $$;

-- Remove Member (Owner only, records removed member)
create or replace function public.remove_member(p_group_id uuid, p_user_id uuid) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.share_groups where id = p_group_id and owner_id = uid) then
    raise exception 'Only the group owner can remove members';
  end if;
  if p_user_id = uid then raise exception 'The owner cannot remove themselves'; end if;

  delete from public.share_group_members where group_id = p_group_id and user_id = p_user_id;

  -- Prevent member from rejoining using the same code
  insert into public.share_group_removed_members (group_id, user_id)
  values (p_group_id, p_user_id)
  on conflict do nothing;
end $$;

-- Rotate Group Join Code (Owner only)
create or replace function public.rotate_group_code(p_group_id uuid) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  new_code text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.share_groups where id = p_group_id and owner_id = uid) then
    raise exception 'Only the group owner can rotate the join code';
  end if;

  new_code := public.generate_group_code();
  update public.share_groups set code = new_code where id = p_group_id and owner_id = uid;
  return new_code;
end $$;

-- Rename Group (Owner only)
create or replace function public.rename_group(p_group_id uuid, p_name text) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clean_name text;
begin
  clean_name := coalesce(nullif(substr(trim(p_name), 1, 60), ''), 'My Shared Group');
  update public.share_groups
  set name = clean_name
  where id = p_group_id and owner_id = auth.uid();
end $$;

-- Update Display Name
create or replace function public.update_my_name(p_user_name text) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  clean_user text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  clean_user := coalesce(nullif(substr(trim(p_user_name), 1, 50), ''), 'Someone');

  update public.share_group_members
  set user_name = clean_user
  where user_id = uid;
end $$;

-- Get Groups
create or replace function public.get_groups() returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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
      from public.share_group_members m2
      where m2.group_id = sg.id
    ),
    'sharedCount', (select count(*) from public.shared_subscriptions s where s.group_id = sg.id)
  ) order by sg.created_at asc), '[]'::jsonb) into result
  from public.share_groups sg
  join public.share_group_members m on m.group_id = sg.id
  where m.user_id = uid;

  return result;
end $$;

-- Back-compat Get Group (First group)
create or replace function public.get_group() returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  groups jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  groups := (select public.get_groups());
  if jsonb_array_length(groups) = 0 then
    return null;
  end if;
  return groups->0;
end $$;

-- Get Shared Subscriptions
create or replace function public.get_shared_subscriptions() returns setof public.shared_subscriptions
language sql
security definer
set search_path = public, pg_temp
as $$
  select s.*
  from public.shared_subscriptions s
  join public.share_group_members m on m.group_id = s.group_id
  where m.user_id = auth.uid()
  order by s.next_billing_date asc;
$$;

-- Upsert Shared Subscription (With publisher/owner authorization check & input limits)
create or replace function public.upsert_shared_subscription(p_sub jsonb) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  g uuid;
  existing_publisher uuid;
  existing_name text;
  sub_id text;
  clean_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  g := nullif(p_sub->>'groupId', '')::uuid;
  if g is null then raise exception 'A group is required to share a subscription'; end if;

  if not exists (select 1 from public.share_group_members where user_id = uid and group_id = g) then
    raise exception 'You are not a member of this group';
  end if;

  sub_id := nullif(trim(p_sub->>'id'), '');
  if sub_id is null or length(sub_id) > 64 then
    raise exception 'Invalid subscription ID';
  end if;

  clean_name := substr(trim(coalesce(p_sub->>'name', 'Unnamed')), 1, 100);

  -- Check if already exists and enforce authorization
  select publisher_user_id, publisher_name into existing_publisher, existing_name
  from public.shared_subscriptions
  where id = sub_id and group_id = g;

  if existing_publisher is not null
     and existing_publisher != uid
     and not exists (select 1 from public.share_groups where id = g and owner_id = uid) then
    raise exception 'Only the subscription publisher or group owner can modify this subscription';
  end if;

  insert into public.shared_subscriptions (
    id, group_id, publisher_user_id, publisher_name,
    name, price, currency, billing_cycle, next_billing_date, category,
    brand_color, logo_icon, is_trial, trial_end_date,
    split_enabled, split_type, split_value, is_paused, notes, website,
    updated_at
  ) values (
    sub_id,
    g,
    coalesce(existing_publisher, uid),
    coalesce(existing_name, substr(trim(coalesce(p_sub->>'publisherName', 'Member')), 1, 50)),
    clean_name,
    greatest(0, coalesce((p_sub->>'price')::real, 0)),
    substr(coalesce(p_sub->>'currency', 'USD'), 1, 10),
    substr(coalesce(p_sub->>'billingCycle', 'monthly'), 1, 20),
    coalesce(p_sub->>'nextBillingDate', now()::text),
    substr(nullif(p_sub->>'category', ''), 1, 50),
    substr(nullif(p_sub->>'brandColor', ''), 1, 20),
    substr(nullif(p_sub->>'logoIcon', ''), 1, 50),
    (p_sub->>'isTrial')::boolean,
    nullif(p_sub->>'trialEndDate', ''),
    (p_sub->>'splitEnabled')::boolean,
    substr(nullif(p_sub->>'splitType', ''), 1, 20),
    (p_sub->>'splitValue')::real,
    (p_sub->>'isPaused')::boolean,
    substr(nullif(p_sub->>'notes', ''), 1, 500),
    substr(nullif(p_sub->>'website', ''), 1, 255),
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

-- Delete Shared Subscription (With publisher/owner authorization check)
create or replace function public.delete_shared_subscription(p_id text, p_group_id uuid) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  existing_publisher uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if not exists (select 1 from public.share_group_members where user_id = uid and group_id = p_group_id) then
    raise exception 'You are not a member of this group';
  end if;

  select publisher_user_id into existing_publisher
  from public.shared_subscriptions
  where id = p_id and group_id = p_group_id;

  if existing_publisher is not null
     and existing_publisher != uid
     and not exists (select 1 from public.share_groups where id = p_group_id and owner_id = uid) then
    raise exception 'Only the subscription publisher or group owner can delete this subscription';
  end if;

  delete from public.shared_subscriptions s
  where s.id = p_id and s.group_id = p_group_id;
end $$;

-- Record Device Telemetry (Anonymous diagnostic metric upsert)
create or replace function public.record_device_telemetry(
  p_device_id text,
  p_brand text,
  p_model_name text,
  p_os_name text,
  p_os_version text,
  p_app_version text,
  p_update_hash text,
  p_channel text,
  p_timezone text,
  p_total_launches int
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clean_id text;
begin
  clean_id := trim(p_device_id);
  if clean_id is null or length(clean_id) < 6 or length(clean_id) > 64 then
    raise exception 'Invalid device_id';
  end if;

  insert into public.app_devices (
    device_id,
    brand,
    model_name,
    os_name,
    os_version,
    app_version,
    update_hash,
    channel,
    timezone,
    total_launches,
    last_active_at
  ) values (
    clean_id,
    substr(trim(p_brand), 1, 50),
    substr(trim(p_model_name), 1, 50),
    substr(trim(p_os_name), 1, 30),
    substr(trim(p_os_version), 1, 30),
    substr(trim(p_app_version), 1, 20),
    substr(trim(p_update_hash), 1, 30),
    coalesce(substr(trim(p_channel), 1, 20), 'preview'),
    coalesce(substr(trim(p_timezone), 1, 50), 'Asia/Kolkata'),
    greatest(1, coalesce(p_total_launches, 1)),
    now()
  )
  on conflict (device_id) do update set
    brand = excluded.brand,
    model_name = excluded.model_name,
    os_name = excluded.os_name,
    os_version = excluded.os_version,
    app_version = excluded.app_version,
    update_hash = excluded.update_hash,
    channel = excluded.channel,
    timezone = excluded.timezone,
    total_launches = excluded.total_launches,
    last_active_at = now();
end $$;

-- ── 7. Grants ─────────────────────────────────────────────────────────

grant execute on function
  public.create_group(text, text),
  public.join_group(text, text),
  public.leave_group(uuid),
  public.remove_member(uuid, uuid),
  public.rotate_group_code(uuid),
  public.rename_group(uuid, text),
  public.update_my_name(text),
  public.get_groups(),
  public.get_group(),
  public.get_shared_subscriptions(),
  public.upsert_shared_subscription(jsonb),
  public.delete_shared_subscription(text, uuid),
  public.generate_group_code(),
  public.record_device_telemetry(text, text, text, text, text, text, text, text, text, int)
to anon, authenticated;
