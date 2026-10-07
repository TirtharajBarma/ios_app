-- Migration: App Devices Telemetry with IST (Indian Standard Time) Support
-- Table for tracking anonymous app devices, builds, and updates

create table if not exists public.app_devices (
  device_id text primary key,
  device_name text,
  brand text,
  model_name text,
  os_name text,
  os_version text,
  app_version text,
  update_hash text,
  channel text default 'preview',
  timezone text default 'Asia/Kolkata',
  total_launches integer default 1,
  last_active_at timestamptz default (now() at time zone 'utc'),
  created_at timestamptz default (now() at time zone 'utc')
);

-- Enable RLS
alter table public.app_devices enable row level security;

-- Allow anonymous upserts from mobile devices
drop policy if exists "Allow anonymous device upsert" on public.app_devices;
create policy "Allow anonymous device upsert"
  on public.app_devices for all
  using (true)
  with check (true);

-- Helpful View for Supabase Dashboard showing timestamps directly in IST
create or replace view public.v_app_devices_ist as
select
  device_id,
  device_name,
  brand,
  model_name,
  os_name,
  os_version,
  app_version,
  update_hash,
  channel,
  total_launches,
  to_char(last_active_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') || ' IST' as last_active_ist,
  to_char(created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') || ' IST' as registered_at_ist
from public.app_devices
order by last_active_at desc;
