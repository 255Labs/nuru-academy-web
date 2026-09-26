-- ============================================================================
-- Migration 002: Curriculum content — tracks, modules, lessons, quizzes, questions
-- Dependencies: 001_core_auth
-- ============================================================================
-- ---------------------------------------------------------------------------
-- 3. Curriculum content — tracks, modules, lessons, quizzes, questions.
--    Read-only to clients (no insert/update/delete policy => only the
--    service role, which bypasses RLS entirely, can write — i.e. only your
--    seed script or an admin-only server route).
-- ---------------------------------------------------------------------------
create table if not exists public.tracks (
  id text primary key,              -- 'beginner' | 'intermediate' | 'expert'
  name text not null,
  subtitle text not null,
  tagline text not null,
  price_tzs integer not null,
  passing_pct integer not null,
  tone_hex text not null,
  tone_deep_hex text not null,
  enrolled_by_default boolean not null default false,
  requires text,
  sort_order integer not null default 0
);

create table if not exists public.modules (
  id text primary key,              -- e.g. 'beginner:b1'
  track_id text not null references public.tracks (id) on delete cascade,
  week integer not null,
  name text not null,
  tagline text not null,
  sort_order integer not null default 0
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id text not null references public.modules (id) on delete cascade,
  day integer not null,
  title text not null,
  objective text not null,
  block1_topic text not null,
  block1_points text[] not null,
  block2_topic text not null,
  block2_points text[] not null,
  demo text,
  homework text,
  unique (module_id, day)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  module_id text not null unique references public.modules (id) on delete cascade,
  title text not null,
  subtitle text not null,
  minutes integer not null,
  passing_pct integer not null,
  is_placeholder boolean not null default false
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  sort_position integer not null,
  type text not null check (type in ('mcq', 'tf', 'short')),
  question_text text not null,
  options text[],                   -- mcq only
  correct jsonb not null,           -- mcq: index (number) · tf: boolean · short: string[] of accepted answers
  explain text not null
);

alter table public.tracks enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;

-- Curriculum content is browsable before signup (marketing catalog), except
-- `questions` — deliberately no grant there at all, not even select. The
-- answer key is reachable only through the SECURITY DEFINER functions below.
grant select on public.tracks, public.modules, public.lessons, public.quizzes to anon, authenticated;

drop policy if exists "Curriculum is publicly readable" on public.tracks;
create policy "Curriculum is publicly readable" on public.tracks for select using (true);
drop policy if exists "Curriculum is publicly readable" on public.modules;
create policy "Curriculum is publicly readable" on public.modules for select using (true);
drop policy if exists "Curriculum is publicly readable" on public.quizzes;
create policy "Curriculum is publicly readable" on public.quizzes for select using (true);
-- Deliberately NO select policy on `questions` for the anon/authenticated
-- roles — direct reads are denied. Clients use the view below instead.

-- The client-safe view: same columns, minus `correct` and `explain`.
create or replace view public.quiz_questions_public
  with (security_invoker = true) as
  select id, quiz_id, sort_position, type, question_text, options
  from public.questions;

-- Views inherit RLS from their querying role when security_invoker = true,
-- but since the view itself selects from a table with no select policy for
-- authenticated/anon, we still need an explicit grant + policy path: the
-- simplest correct approach is a SECURITY DEFINER function instead of relying
-- on view RLS quirks. Use this function from the client instead of querying
-- the view directly:
create or replace function public.get_quiz_questions(p_quiz_id uuid)
returns table (
  id uuid, quiz_id uuid, sort_position integer, type text, question_text text, options text[]
)
language sql
security definer
set search_path = public
as $$
  select id, quiz_id, sort_position, type, question_text, options
  from public.questions
  where questions.quiz_id = p_quiz_id
  order by sort_position;
$$;

-- Any authenticated user may call this function (it only ever returns
-- answer-free rows, regardless of who calls it).
grant execute on function public.get_quiz_questions(uuid) to authenticated;

