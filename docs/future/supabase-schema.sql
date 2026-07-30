-- ===== Calm — Supabase schema (Phase 3) =====
-- Copyright (c) 2026 Yonatan Volsky. All rights reserved.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`) after creating
-- a project. Every table is protected by Row-Level Security so a user can only
-- ever read/write their own rows. Calm never stores conversation content — only
-- the user's own settings, presets, focus stats, and integration tokens.

-- -------- profiles (1:1 with auth.users) --------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  is_pro      boolean not null default false,
  plan        text not null default 'free',   -- free | monthly | lifetime
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------- settings (synced UI prefs, one row per user) --------
create table if not exists public.settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- -------- presets (many per user) --------
create table if not exists public.presets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists presets_user_idx on public.presets (user_id);

-- -------- focus_sessions (pomodoro logs, powers the dashboard) --------
create table if not exists public.focus_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null default 'focus',  -- focus | break | long
  minutes       integer not null default 0,
  site          text,                            -- chatgpt | gemini
  completed_at  timestamptz not null default now(),
  meta          jsonb not null default '{}'::jsonb
);
create index if not exists focus_user_time_idx on public.focus_sessions (user_id, completed_at desc);

-- -------- integrations (e.g. Spotify tokens) --------
create table if not exists public.integrations (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  spotify     jsonb,        -- { refresh_token, ... } (Phase 6)
  updated_at  timestamptz not null default now()
);

-- -------- subscriptions (Stripe, Phase 7) --------
create table if not exists public.subscriptions (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  status              text not null default 'inactive',
  stripe_customer_id  text,
  stripe_sub_id       text,
  current_period_end  timestamptz
);

-- ======================= Row-Level Security =======================
alter table public.profiles       enable row level security;
alter table public.settings       enable row level security;
alter table public.presets        enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.integrations   enable row level security;
alter table public.subscriptions  enable row level security;

-- profiles: owner can read/update self (insert handled by the trigger).
create policy "profiles self read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

-- Generic owner policies for the user-owned tables.
create policy "settings owner"  on public.settings       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "presets owner"   on public.presets        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "focus owner"     on public.focus_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "integ owner"     on public.integrations   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- subscriptions: users read their own; writes come from the Stripe webhook
-- (service-role key bypasses RLS), so no user write policy.
create policy "subs self read"  on public.subscriptions  for select using (auth.uid() = user_id);
