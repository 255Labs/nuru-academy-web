-- ============================================================================
-- Migration 001: Core Auth — profiles, player_stats, privilege guard trigger
-- Dependencies: none
-- ============================================================================
-- ============================================================================
-- SAFE FUNCTION DROP BLOCK — run this before the schema if re-running
-- Drops all public functions so CREATE OR REPLACE can change return types.
-- Tables and data are NOT affected.
-- ============================================================================
DO $drop_all_functions$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT proname, pg_get_function_identity_arguments(oid) AS args
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
  LOOP
    BEGIN
      EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname)
              || '(' || r.args || ') CASCADE;';
    EXCEPTION WHEN OTHERS THEN
      NULL; -- ignore if already gone
    END;
  END LOOP;
END
$drop_all_functions$;

-- ============================================================================
-- Nuru AI Academy — Supabase schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`, see
-- PRODUCT_SETUP.md). Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE
-- throughout, but DROP the tables first if you need a clean slate.
--
-- Design notes:
--  - `profiles` holds PRIVATE account fields (email, bio, role, language).
--    RLS restricts it to "you can only see/edit your own row."
--  - `player_stats` holds PUBLIC gamification fields (display name, avatar,
--    xp, coins, gems, level) so the leaderboard can read everyone's stats
--    without ever exposing email addresses or private fields. This split is
--    the standard pattern for Supabase RLS when you need a public
--    leaderboard — see PRODUCT_SETUP.md → "The profiles/player_stats split".
--  - Quiz `correct` answers and `explain` text are NEVER selectable directly
--    by clients. They live only in the `questions` table (RLS-locked to
--    nobody but the service role), and are only ever read server-side inside
--    the `submit_quiz_attempt()` function below. Clients read questions
--    through the `quiz_questions_public` view, which simply omits those
--    columns. This closes the "open devtools, read the network response,
--    see the answer key" cheat that a naive `select * from questions` would
--    allow.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Explicit grants
--
-- RLS policies restrict which ROWS a role can see/touch, but Postgres also
-- has a separate, coarser layer: table-level GRANTs, which control whether a
-- role can touch a table AT ALL before row security is even evaluated. New
-- Supabase projects come with sensible defaults already in place for the
-- `anon`/`authenticated` roles, but this schema sets them explicitly so it
-- behaves the same whether you run it via the SQL Editor, the CLI, or
-- restore it into a fresh local Postgres for testing — no reliance on
-- unstated platform defaults.
--
-- Deliberately NOT granted to anyone but the service role: `questions` (the
-- answer key). Only the SECURITY DEFINER functions below may read it.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;


create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  email text not null,
  bio text not null default '',
  language text not null default 'English' check (language in ('English', 'Swahili')),
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- The policy above only checks WHICH ROW you may touch, not WHICH COLUMNS
-- you may change — RLS has no column-level granularity. Without the
-- trigger below, a signed-in user could run
--   update profiles set role = 'admin' where id = auth.uid()
-- directly through the client library and grant themselves admin. This
-- trigger silently reverts `role` and `email` to their prior values unless
-- the write comes from the service role (used by handle_new_user() below
-- and any future admin-only server route).
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.role := old.role;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_columns on public.profiles;
create trigger protect_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. player_stats — PUBLIC gamification fields (leaderboard-visible)
-- ---------------------------------------------------------------------------
create table if not exists public.player_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_key text not null default 'B',
  xp integer not null default 0,
  coins integer not null default 0,
  gems integer not null default 0,
  level integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.player_stats enable row level security;
grant select, insert, update on public.player_stats to authenticated;

-- Any signed-in user can read anyone's public stats — this is what powers
-- the leaderboard. Nothing sensitive lives in this table.
drop policy if exists "Authenticated users can view all player stats" on public.player_stats;
create policy "Authenticated users can view all player stats"
  on public.player_stats for select
  to authenticated
  using (true);

drop policy if exists "Users can update their own stats" on public.player_stats;
create policy "Users can update their own stats"
  on public.player_stats for update
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own stats" on public.player_stats;
create policy "Users can insert their own stats"
  on public.player_stats for insert
  with check (auth.uid() = user_id);

