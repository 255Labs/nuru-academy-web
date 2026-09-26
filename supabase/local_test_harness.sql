-- Local-testing harness — OPTIONAL. Emulates just enough of Supabase's
-- `auth` schema and roles (auth.users, auth.uid(), the `authenticated`/`anon`
-- roles) to let you verify schema.sql's RLS policies and functions against a
-- throwaway local Postgres, before you ever touch a real Supabase project.
--
-- Real Supabase already provides all of this for you — you do NOT run this
-- file against your actual Supabase database. It exists purely so you (or a
-- CI job) can sanity-check schema changes locally. See PRODUCT_SETUP.md →
-- "Testing your RLS policies locally before deploying them."
--
-- Usage:
--   createdb nuru_test
--   psql -d nuru_test -c "create extension if not exists pgcrypto;"
--   psql -d nuru_test -f supabase/local_test_harness.sql
--   psql -d nuru_test -f supabase/schema.sql
--   psql -d nuru_test -f supabase/local_test_rls.sql

-- Emulate Supabase's Postgres roles.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;

grant usage on schema public to authenticated, anon;

-- Emulate the `auth` schema.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

grant usage on schema auth to authenticated, anon;
grant select on auth.users to authenticated;

-- Emulate auth.uid() via a settable session variable (real Supabase derives
-- this from the request's verified JWT — here we just fake it per-session).
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('test.current_user_id', true), '')::uuid;
$$;

-- Emulate auth.role() the same way — real Supabase returns 'anon',
-- 'authenticated', or 'service_role' based on the request's JWT/API key.
create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(nullif(current_setting('test.current_role', true), ''), 'authenticated');
$$;
