-- =====================================================================
-- Migration: RLS membership helper + group/telemetry fixes (2026-10-11)
-- NOT APPLIED to any project. Review, then run manually.
--
--   1. is_group_member(gid): SECURITY DEFINER helper so RLS policies no
--      longer self-reference share_group_members (recursion / hidden rows).
--   2. join_group: failed attempts now RETURN {"error": "..."} instead of
--      raising, so the group_join_attempts row survives (a raise rolls it
--      back and the rate limiter never counted failures).
--   3. price / split_value -> numeric(14,2) (real loses cents on large values).
--   4. leave_group: ownership transfers to the longest-standing member.
--   5. record_device_telemetry requires an authenticated session.
--   6. generate_group_code is internal only: execute revoked from clients.
--
-- Idempotent and safely re-runnable.
-- =====================================================================

-- ── 1. Membership helper + policies ───────────────────────────────────

create or replace function public.is_group_member(gid uuid) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.share_group_members m
    where m.group_id = gid and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to anon, authenticated;

drop policy if exists "Members can view their own groups" on public.share_groups;
create policy "Members can view their own groups"
  on public.share_groups for select
  using (public.is_group_member(id));

drop policy if exists "Members can view members of their groups" on public.share_group_members;
create policy "Members can view members of their groups"
  on public.share_group_members for select
  using (public.is_group_member(group_id));

drop policy if exists "Group members can view shared subscriptions" on public.shared_subscriptions;
create policy "Group members can view shared subscriptions"
  on public.shared_subscriptions for select
  using (public.is_group_member(group_id));

-- ── 3. Money columns ──────────────────────────────────────────────────

alter table public.shared_subscriptions
  alter column price type numeric(14,2) using round(price::numeric, 2),
  alter column split_value type numeric(14,2) using round(split_value::numeric, 2);

-- ── 2. join_group: persist failed attempts ────────────────────────────

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

  select count(*) into recent_attempts
  from public.group_join_attempts
  where user_id = uid
    and attempted_at > (now() - interval '10 minutes');

  if recent_attempts >= 5 then
    return jsonb_build_object('error', 'Too many join attempts. Please wait a few minutes before trying again.');
  end if;

  -- Recorded before any validation; returning (not raising) keeps this row.
  insert into public.group_join_attempts (user_id) values (uid);

  clean_code := upper(trim(p_code));
  if clean_code is null or length(clean_code) != 6 or not (clean_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$') then
    return jsonb_build_object('error', 'Invalid group code format');
  end if;

  clean_user := coalesce(nullif(substr(trim(p_user_name), 1, 50), ''), 'Member');

  select * into g from public.share_groups where code = clean_code;
  if g.id is null then return jsonb_build_object('error', 'Invalid group code'); end if;

  if exists (select 1 from public.share_group_members where user_id = uid and group_id = g.id) then
    return jsonb_build_object('error', 'You are already in this group');
  end if;

  if exists (select 1 from public.share_group_removed_members where group_id = g.id and user_id = uid) then
    return jsonb_build_object('error', 'You have been removed from this group and cannot rejoin');
  end if;

  select user_id into full_count
  from public.share_group_members where group_id = g.id limit 1 offset 9;
  if full_count is not null then return jsonb_build_object('error', 'This group is full (max 10 people)'); end if;

  insert into public.share_group_members (user_id, group_id, user_name)
  values (uid, g.id, clean_user);

  delete from public.group_join_attempts where user_id = uid;

  return jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'code', null,
    'ownerId', g.owner_id,
    'role', 'member'
  );
end $$;

-- ── 4. leave_group: transfer ownership instead of orphaning the group ─

create or replace function public.leave_group(p_group_id uuid) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  next_owner uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  delete from public.share_group_members where user_id = uid and group_id = p_group_id;

  -- If the owner left, hand the group to the longest-standing remaining member.
  if exists (select 1 from public.share_groups where id = p_group_id and owner_id = uid) then
    select user_id into next_owner
    from public.share_group_members
    where group_id = p_group_id
    order by joined_at asc
    limit 1;
    if next_owner is not null then
      update public.share_groups set owner_id = next_owner where id = p_group_id;
    end if;
  end if;

  delete from public.share_groups g
  where g.id = p_group_id
    and not exists (select 1 from public.share_group_members m where m.group_id = g.id);
end $$;

-- ── numeric-safe upsert (same logic as before, ::numeric casts) ──────

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
    round(greatest(0, coalesce((p_sub->>'price')::numeric, 0)), 2),
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
    round((p_sub->>'splitValue')::numeric, 2),
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

-- ── 5. Telemetry requires a session ───────────────────────────────────

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
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  clean_id := trim(p_device_id);
  if clean_id is null or length(clean_id) < 6 or length(clean_id) > 64 then
    raise exception 'Invalid device_id';
  end if;

  insert into public.app_devices (
    device_id, brand, model_name, os_name, os_version, app_version,
    update_hash, channel, timezone, total_launches, last_active_at
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

-- ── 6. Internal-only code generator ───────────────────────────────────

revoke execute on function public.generate_group_code() from public, anon, authenticated;
