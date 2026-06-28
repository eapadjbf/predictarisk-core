-- ============================================================================
-- CyberGuard.SYS — Supabase setup
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  first_name        text not null default '',
  last_name         text not null default '',
  email             text not null default '',
  organisation_name text not null default '',
  job_title         text not null default '',
  sector            text not null default '',
  role              text not null default 'user',    -- 'user' | 'admin'
  org_user_count    integer,                          -- optional cached count
  plan              text not null default 'free',     -- 'free' | 'paid'
  status            text not null default 'active',   -- 'active' | 'suspended'
  last_login        timestamptz,
  created_at        timestamptz not null default now()
);

create table if not exists public.analyses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  organisation_name text not null default '',
  sector            text,
  created_at        timestamptz not null default now()
);

create index if not exists analyses_org_idx on public.analyses (organisation_name);
create index if not exists analyses_user_idx on public.analyses (user_id);
create index if not exists profiles_org_idx on public.profiles (organisation_name);

-- ---------------------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER -> bypass RLS where needed)
-- ---------------------------------------------------------------------------

-- True when the current user is an admin. Used by RLS; SECURITY DEFINER avoids
-- recursive policy evaluation on the profiles table.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- True when an organisation still has room on the free plan (< 2 free users).
-- Called from the client BEFORE sign-up for a friendly message. The real
-- enforcement is the trigger below (the client check is bypassable).
create or replace function public.org_has_free_capacity(org text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0) < 2
  from public.profiles
  where organisation_name = org and plan = 'free';
$$;

grant execute on function public.org_has_free_capacity(text) to anon, authenticated;

-- Creates the profile row when a new auth user signs up, reading the metadata
-- passed in supabase.auth.signUp({ options: { data: {...} } }). Enforces the
-- 2-free-user-per-organisation limit. Runs as the table owner (SECURITY
-- DEFINER) so it works even before the user's email is confirmed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org   text := coalesce(new.raw_user_meta_data ->> 'organisation_name', '');
  v_count integer;
begin
  -- New accounts are ALWAYS created as a non-privileged free user. role/plan in
  -- the client-supplied metadata are deliberately ignored, otherwise a crafted
  -- signUp payload could self-assign role='admin' or plan='paid'. Promote admins
  -- and paid plans only via trusted server-side updates (see section 4 / the
  -- admin dashboard, which is gated by is_admin()).
  select count(*) into v_count
  from public.profiles
  where organisation_name = v_org and plan = 'free';

  if v_count >= 2 then
    raise exception 'ORG_FREE_LIMIT_REACHED';
  end if;

  insert into public.profiles (
    id, first_name, last_name, email, organisation_name, job_title, sector, role, plan
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.email,
    v_org,
    coalesce(new.raw_user_meta_data ->> 'job_title', ''),
    coalesce(new.raw_user_meta_data ->> 'sector', ''),
    'user',
    'free'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevents non-admins from escalating their own privilege fields
-- (role / plan / status / organisation_name) via the self-update policy.
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role
       or new.plan is distinct from old.plan
       or new.status is distinct from old.status
       or new.organisation_name is distinct from old.organisation_name then
      raise exception 'Not authorized to modify privileged fields';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_changes_trg on public.profiles;
create trigger guard_profile_changes_trg
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.analyses enable row level security;

-- profiles: a user sees their own row; admins see all.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- profiles: a user updates their own row (privileged fields blocked by trigger);
-- admins update any row.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- profiles: only admins delete profile rows.
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete using (public.is_admin());

-- analyses: a user sees analyses for their own organisation; admins see all.
drop policy if exists analyses_select on public.analyses;
create policy analyses_select on public.analyses
  for select using (
    public.is_admin()
    or organisation_name = (
      select organisation_name from public.profiles where id = auth.uid()
    )
  );

-- analyses: a user inserts rows attributed to themselves AND only for their own
-- organisation (prevents cross-tenant metadata injection).
drop policy if exists analyses_insert on public.analyses;
create policy analyses_insert on public.analyses
  for insert with check (
    user_id = auth.uid()
    and organisation_name = (
      select organisation_name from public.profiles where id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Promote your first admin (edit the email, then run this line)
-- ---------------------------------------------------------------------------
-- update public.profiles set role = 'admin' where email = 'you@example.com';
