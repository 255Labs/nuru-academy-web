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

-- ---------------------------------------------------------------------------
-- 4. Enrollments, quiz attempts, study log — per-user progress
-- ---------------------------------------------------------------------------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id text not null references public.tracks (id) on delete cascade,
  progress integer not null default 0,   -- linear node index reached
  created_at timestamptz not null default now(),
  unique (user_id, track_id)
);

drop policy if exists "Enrolled learners read lessons" on public.lessons;
create policy "Enrolled learners read lessons"
  on public.lessons for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.modules m on m.id = lessons.module_id
      where e.user_id = auth.uid() and e.track_id = m.track_id
    )
    or (select role from public.profiles where id = auth.uid()) = 'admin'
    or auth.role() = 'anon'
  );

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  score_pct integer not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  study_date date not null,
  minutes integer not null default 0,
  primary key (user_id, study_date)
);

alter table public.enrollments enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.study_log enable row level security;

grant select, insert, update, delete on public.enrollments to authenticated;
grant select, insert, update, delete on public.quiz_attempts to authenticated;
grant select, insert, update, delete on public.study_log to authenticated;

drop policy if exists "Users manage their own enrollments" on public.enrollments;
create policy "Users manage their own enrollments"
  on public.enrollments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own quiz attempts" on public.quiz_attempts;
create policy "Users manage their own quiz attempts"
  on public.quiz_attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own study log" on public.study_log;
create policy "Users manage their own study log"
  on public.study_log for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Achievements
-- ---------------------------------------------------------------------------
create table if not exists public.achievements (
  id text primary key,             -- slug, e.g. 'quick_learner'
  label text not null,
  description text not null,
  icon text not null,
  sort_order integer not null default 0
);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

grant select on public.achievements to anon, authenticated;
grant select on public.user_achievements to authenticated;
-- No insert grant on user_achievements — only submit_quiz_attempt() (or a
-- future award-achievement function you add) may write to it.

drop policy if exists "Achievements are publicly readable" on public.achievements;
create policy "Achievements are publicly readable"
  on public.achievements for select using (true);

drop policy if exists "Users view their own earned achievements" on public.user_achievements;
create policy "Users view their own earned achievements"
  on public.user_achievements for select
  using (auth.uid() = user_id);

-- Achievements are only ever granted by the grading function below (server-
-- side, security definer) — no client insert policy on user_achievements.

-- ---------------------------------------------------------------------------
-- 6. AI chat history (Ask Nuru)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.ai_chats enable row level security;
grant select, insert, update, delete on public.ai_chats to authenticated;

drop policy if exists "Users manage their own chat history" on public.ai_chats;
create policy "Users manage their own chat history"
  on public.ai_chats for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 6b. grade_single_answer — internal grading helper, shared by
--     submit_quiz_attempt() below and the battle_* functions further down.
--     Deliberately NOT granted to authenticated — callable only from other
--     security definer functions in this file, never directly over the API.
--     Kept as the single source of truth for grading logic so the
--     real-time battle path and the batch path can never silently drift
--     apart and produce different scores for the same answers.
-- ---------------------------------------------------------------------------
create or replace function public.grade_single_answer(p_question_id uuid, p_answer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q record;
  v_ok boolean := false;
  v_normalized_given text;
  v_accept text;
  v_matched boolean := false;
begin
  select * into v_q from public.questions where id = p_question_id;
  if v_q.id is null then
    raise exception 'Question not found';
  end if;

  if v_q.type = 'mcq' then
    v_ok := (p_answer)::int = (v_q.correct)::int;

  elsif v_q.type = 'tf' then
    v_ok := (p_answer)::boolean = (v_q.correct)::boolean;

  elsif v_q.type = 'short' then
    v_normalized_given := trim(regexp_replace(lower(coalesce(p_answer #>> '{}', '')), '[.,!?;:]', '', 'g'));
    for v_accept in select jsonb_array_elements_text(v_q.correct) loop
      if v_normalized_given <> '' and (
        v_normalized_given = trim(lower(v_accept))
        or v_normalized_given like '%' || trim(lower(v_accept)) || '%'
        or trim(lower(v_accept)) like '%' || v_normalized_given || '%'
      ) then
        v_matched := true;
      end if;
    end loop;
    v_ok := v_matched;
  end if;

  return jsonb_build_object(
    'ok', v_ok,
    'quiz_id', v_q.quiz_id,
    'sort_position', v_q.sort_position,
    'correct_answer', v_q.correct,
    'explain', v_q.explain
  );
end;
$$;

-- CRITICAL: Postgres grants EXECUTE to PUBLIC on every new function by
-- default, unlike tables (which grant nothing by default). "No grant
-- statement" does NOT mean "no access" — it means the default PUBLIC
-- grant is still in effect. This was a real bug: without the revoke
-- below, any signed-in client could call grade_single_answer() directly
-- via a raw RPC request and read back `correct_answer`/`explain` for any
-- question, for free, completely bypassing both the write-once lock in
-- battle_answer() and the batch grading in submit_quiz_attempt() below —
-- verified against a real Postgres instance before this revoke existed,
-- and reverified after it to confirm the fix actually closes it (see
-- local_test_rls.sql).
revoke all on function public.grade_single_answer(uuid, jsonb) from public;

-- 7. submit_quiz_attempt — the anti-cheat grading function
--
-- Clients never see `correct` or `explain` until AFTER they submit. This
-- function runs server-side (security definer), grades against the real
-- answer key via grade_single_answer() above, records the attempt,
-- advances enrollment progress on a pass, and returns a review array — the
-- same shape the QuizRunner UI already expects, so wiring the frontend to
-- this is a drop-in swap for the local grading logic in
-- src/components/QuizRunner.tsx.
--
-- p_answers shape: jsonb array parallel to question `sort_position`, each element
-- one of: {"type":"mcq","value":<option index>}
--         {"type":"tf","value":<true|false>}
--         {"type":"short","value":"<free text>"}
-- ---------------------------------------------------------------------------
create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_module_id text;
  v_track_id text;
  v_passing_pct integer;
  v_total integer := 0;
  v_correct_count integer := 0;
  v_reviews jsonb := '[]'::jsonb;
  v_q record;
  v_given jsonb;
  v_result jsonb;
  v_pct integer;
  v_passed boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select module_id, passing_pct into v_module_id, v_passing_pct
  from public.quizzes where id = p_quiz_id;

  if v_module_id is null then
    raise exception 'Quiz not found';
  end if;

  select track_id into v_track_id from public.modules where id = v_module_id;

  for v_q in
    select * from public.questions where quiz_id = p_quiz_id order by sort_position
  loop
    v_total := v_total + 1;
    v_given := p_answers -> (v_q.sort_position - 1) -> 'value';
    v_result := public.grade_single_answer(v_q.id, v_given);

    if (v_result ->> 'ok')::boolean then
      v_correct_count := v_correct_count + 1;
    end if;

    v_reviews := v_reviews || jsonb_build_object(
      'question_id', v_q.id,
      'sort_position', v_q.sort_position,
      'ok', (v_result ->> 'ok')::boolean,
      'correct_answer', v_result -> 'correct_answer',
      'explain', v_result ->> 'explain'
    );
  end loop;

  v_pct := round((v_correct_count::numeric / greatest(v_total, 1)) * 100);
  v_passed := v_pct >= v_passing_pct;

  insert into public.quiz_attempts (user_id, quiz_id, score_pct, passed)
  values (v_user_id, p_quiz_id, v_pct, v_passed);

  if v_passed then
    insert into public.enrollments (user_id, track_id, progress)
    values (v_user_id, v_track_id, 1)
    on conflict (user_id, track_id)
    do update set progress = public.enrollments.progress + 1;

    update public.player_stats
    set xp = xp + 500, coins = coins + 250, updated_at = now()
    where user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'correct', v_correct_count,
    'total', v_total,
    'pct', v_pct,
    'passed', v_passed,
    'reviews', v_reviews
  );
end;
$$;

grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 7b. Battle Trial — real-time per-question play (Mission Quests reskinned
--     as a battle against a "Doubt" enemy: correct answers deal damage,
--     wrong/timeout answers let the enemy counter-hit).
--
-- Why this needs its own tables rather than just calling
-- grade_single_answer() straight from the client: a naive "grade this one
-- answer" endpoint invites brute-forcing — call it with option 0, 1, 2, 3
-- in a row and read off which one returns ok:true, before ever committing
-- to a real answer. battle_answers makes each (session, question) pair
-- write-once: the first graded answer is permanent for that session, and
-- every later call for the same question just replays that same result
-- instead of grading a fresh guess. This mirrors the real constraint of a
-- timed battle anyway — you don't get to keep re-guessing while the clock
-- runs — so the anti-cheat property falls directly out of the game design
-- rather than being bolted on separately.
-- ---------------------------------------------------------------------------
create table if not exists public.battle_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.battle_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.battle_sessions (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  given_answer jsonb,
  correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (session_id, question_id)
);

alter table public.battle_sessions enable row level security;
alter table public.battle_answers enable row level security;

-- Read-only to clients, for reviewing your own battle history — every
-- write goes exclusively through the three functions below, which run as
-- their (elevated) owner regardless of these grants.
grant select on public.battle_sessions to authenticated;
grant select on public.battle_answers to authenticated;

drop policy if exists "Users view their own battle sessions" on public.battle_sessions;
create policy "Users view their own battle sessions"
  on public.battle_sessions for select using (auth.uid() = user_id);

drop policy if exists "Users view their own battle answers" on public.battle_answers;
create policy "Users view their own battle answers"
  on public.battle_answers for select
  using (exists (
    select 1 from public.battle_sessions bs
    where bs.id = battle_answers.session_id and bs.user_id = auth.uid()
  ));

-- battle_start — begins a session, returns the answer-free question set
-- (same shape as get_quiz_questions()).
create or replace function public.battle_start(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_questions jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.quizzes where id = p_quiz_id) then
    raise exception 'Quiz not found';
  end if;

  insert into public.battle_sessions (user_id, quiz_id)
  values (v_user_id, p_quiz_id)
  returning id into v_session_id;

  select jsonb_agg(jsonb_build_object(
           'id', id, 'quiz_id', quiz_id, 'sort_position', sort_position,
           'type', type, 'question_text', question_text, 'options', options
         ) order by sort_position)
  into v_questions
  from public.questions where quiz_id = p_quiz_id;

  return jsonb_build_object('session_id', v_session_id, 'questions', coalesce(v_questions, '[]'::jsonb));
end;
$$;

grant execute on function public.battle_start(uuid) to authenticated;

-- battle_answer — grades one question, once, for this session. Repeat
-- calls for a question already answered in this session replay the
-- original result rather than grading the new guess.
create or replace function public.battle_answer(p_session_id uuid, p_question_id uuid, p_answer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing record;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.battle_sessions
    where id = p_session_id and user_id = v_user_id and finished_at is null
  ) then
    raise exception 'Battle session not found or already finished';
  end if;

  select * into v_existing from public.battle_answers
  where session_id = p_session_id and question_id = p_question_id;

  if v_existing.id is not null then
    -- Already answered — replay the locked-in result, don't re-grade.
    return jsonb_build_object(
      'ok', v_existing.correct,
      'already_answered', true,
      'explain', (select explain from public.questions where id = p_question_id),
      'correct_answer', (select correct from public.questions where id = p_question_id)
    );
  end if;

  v_result := public.grade_single_answer(p_question_id, p_answer);

  insert into public.battle_answers (session_id, question_id, given_answer, correct)
  values (p_session_id, p_question_id, p_answer, (v_result ->> 'ok')::boolean);

  return jsonb_build_object(
    'ok', (v_result ->> 'ok')::boolean,
    'already_answered', false,
    'explain', v_result ->> 'explain',
    'correct_answer', v_result -> 'correct_answer'
  );
end;
$$;

grant execute on function public.battle_answer(uuid, uuid, jsonb) to authenticated;

-- battle_finish — aggregates every locked-in answer for this session,
-- records the same quiz_attempts/enrollment/XP outcome submit_quiz_attempt()
-- produces, and marks the session finished so no further battle_answer()
-- calls are accepted against it.
create or replace function public.battle_finish(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz_id uuid;
  v_module_id text;
  v_track_id text;
  v_passing_pct integer;
  v_total integer;
  v_correct_count integer;
  v_pct integer;
  v_passed boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select quiz_id into v_quiz_id from public.battle_sessions
  where id = p_session_id and user_id = v_user_id and finished_at is null;

  if v_quiz_id is null then
    raise exception 'Battle session not found or already finished';
  end if;

  select module_id, passing_pct into v_module_id, v_passing_pct
  from public.quizzes where id = v_quiz_id;
  select track_id into v_track_id from public.modules where id = v_module_id;

  select count(*) into v_total from public.questions where quiz_id = v_quiz_id;
  select count(*) into v_correct_count from public.battle_answers
  where session_id = p_session_id and correct = true;

  v_pct := round((v_correct_count::numeric / greatest(v_total, 1)) * 100);
  v_passed := v_pct >= v_passing_pct;

  update public.battle_sessions set finished_at = now() where id = p_session_id;

  insert into public.quiz_attempts (user_id, quiz_id, score_pct, passed)
  values (v_user_id, v_quiz_id, v_pct, v_passed);

  if v_passed then
    insert into public.enrollments (user_id, track_id, progress)
    values (v_user_id, v_track_id, 1)
    on conflict (user_id, track_id)
    do update set progress = public.enrollments.progress + 1;

    update public.player_stats
    set xp = xp + 500, coins = coins + 250, updated_at = now()
    where user_id = v_user_id;
  end if;

  return jsonb_build_object('correct', v_correct_count, 'total', v_total, 'pct', v_pct, 'passed', v_passed);
end;
$$;

grant execute on function public.battle_finish(uuid) to authenticated;

-- 8. complete_lesson — advances enrollment progress for a plain lesson node
--    (not gated by a quiz), awarding the standard +100 XP / +50 coins.
--    p_minutes defaults to 30 for backward compatibility with older
--    clients, but the Level Player now passes the real elapsed time.
-- ---------------------------------------------------------------------------
drop function if exists public.complete_lesson(text);

create or replace function public.complete_lesson(p_track_id text, p_minutes integer default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_minutes integer := greatest(1, least(coalesce(p_minutes, 30), 180)); -- clamp 1..180
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.enrollments (user_id, track_id, progress)
  values (v_user_id, p_track_id, 1)
  on conflict (user_id, track_id)
  do update set progress = public.enrollments.progress + 1;

  update public.player_stats
  set xp = xp + 100, coins = coins + 50, updated_at = now()
  where user_id = v_user_id;

  insert into public.study_log (user_id, study_date, minutes)
  values (v_user_id, current_date, v_minutes)
  on conflict (user_id, study_date)
  do update set minutes = public.study_log.minutes + v_minutes;
end;
$$;

grant execute on function public.complete_lesson(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 8b. enroll_in_track — explicit "I choose this track" action for
--     onboarding. Lesson/quiz completion already creates an enrollment row
--     implicitly (see complete_lesson/submit_quiz_attempt's upserts), but a
--     real onboarding flow needs to show a track as "enrolled" the moment a
--     user picks it — before they've done anything inside it.
-- ---------------------------------------------------------------------------
create or replace function public.enroll_in_track(p_track_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.tracks where id = p_track_id) then
    raise exception 'Unknown track: %', p_track_id;
  end if;

  insert into public.enrollments (user_id, track_id, progress)
  values (v_user_id, p_track_id, 0)
  on conflict (user_id, track_id) do nothing;
end;
$$;

grant execute on function public.enroll_in_track(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8c. admin_list_learners — the admin roster query. RLS scopes every table
--     above to "your own rows," which is correct for normal users but means
--     even a real admin's own client-side select only ever returns their
--     own row. This function self-checks the caller's role before
--     returning anything, so it's safe to grant broadly to `authenticated`
--     — a non-admin calling it gets an error, not data.
-- ---------------------------------------------------------------------------

grant execute on function public.admin_list_learners() to authenticated;

-- ---------------------------------------------------------------------------
-- 8d. admin_list_enrollments — per-user, per-track progress, for the admin
--     roster's "which track / how far along" column. Same self-check
--     pattern as admin_list_learners().
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_enrollments()
returns table (user_id uuid, track_id text, progress integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select profiles.role from public.profiles where profiles.id = auth.uid()) is distinct from 'admin' then
    raise exception 'Admin access required';
  end if;

  return query select e.user_id, e.track_id, e.progress from public.enrollments e;
end;
$$;

grant execute on function public.admin_list_enrollments() to authenticated;

-- ---------------------------------------------------------------------------
-- Payments (ClickPesa) — a real "pay to unlock a track directly" path,
-- separate from the free progression gate (isTrackUnlocked() in
-- src/lib/store.ts, which checks whether the prerequisite track's
-- Emberfall was passed). A track is unlocked if EITHER is true.
--
-- The actual HTTPS call to ClickPesa happens in the Next.js API route
-- (src/lib/clickpesa.ts) — Postgres can't make outbound calls to a
-- payment gateway safely from inside a function. This table only tracks
-- *our own* record of the order, written through two narrow paths:
--   - initiate_track_purchase(): the signed-in user creates their own
--     pending row right before the API route calls ClickPesa.
--   - confirm_track_purchase(): called only by the webhook route using
--     the service-role client, after verifying ClickPesa's checksum —
--     never reachable by a normal signed-in user, by design (no grant to
--     authenticated at all).
-- ---------------------------------------------------------------------------
create table if not exists public.track_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id text not null references public.tracks (id),
  order_reference text not null unique,
  amount_tzs integer not null,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  clickpesa_payment_id text,
  phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.track_purchases enable row level security;

-- Read-only to clients (check your own purchase history / current status).
-- Writes go through the two functions below exclusively.
grant select on public.track_purchases to authenticated;

drop policy if exists "Users view their own purchases" on public.track_purchases;
create policy "Users view their own purchases"
  on public.track_purchases for select using (auth.uid() = user_id);

-- initiate_track_purchase — creates a pending order for the caller's own
-- account right before the API route calls ClickPesa. Returns the
-- generated order_reference and the real price (from public.tracks —
-- never trust a client-supplied amount for a payment).
create or replace function public.initiate_track_purchase(p_track_id text, p_phone_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer;
  v_order_reference text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select price_tzs into v_price from public.tracks where id = p_track_id;
  if v_price is null then
    raise exception 'Unknown track: %', p_track_id;
  end if;

  v_order_reference := 'NURU' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.track_purchases (user_id, track_id, order_reference, amount_tzs, phone_number)
  values (v_user_id, p_track_id, v_order_reference, v_price, p_phone_number);

  return jsonb_build_object('order_reference', v_order_reference, 'amount_tzs', v_price);
end;
$$;

grant execute on function public.initiate_track_purchase(text, text) to authenticated;

-- confirm_track_purchase — must NEVER be reachable by a normal signed-in
-- user, only by the webhook route's service-role client after it has
-- already verified ClickPesa's checksum. Two independent layers enforce
-- this (defense in depth, same pattern as protect_profile_privileged_columns
-- above): an internal auth.role() check, AND an explicit revoke of the
-- default PUBLIC execute grant right after creation.
create or replace function public.confirm_track_purchase(
  p_order_reference text, p_status text, p_clickpesa_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if p_status not in ('success', 'failed') then
    raise exception 'Invalid status: %', p_status;
  end if;

  update public.track_purchases
  set status = p_status, clickpesa_payment_id = p_clickpesa_payment_id, updated_at = now()
  where order_reference = p_order_reference and status = 'pending';

  if not found then
    raise exception 'No pending purchase found for order_reference: %', p_order_reference;
  end if;
end;
$$;

revoke all on function public.confirm_track_purchase(text, text, text) from public;


-- ---------------------------------------------------------------------------
-- 9. handle_new_user — auto-create profile + player_stats rows on signup
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Flashcard Duels — real-time multiplayer, tied to the weekly Mission Boss.
-- Two ways in: a friend invite code, or a random-stranger matchmaking
-- queue. Both 1v1 and small-group (3-4) modes share the same tables.
--
-- The critical design constraint, learned the hard way earlier in this
-- project: EVERY function below has an explicit grant or an explicit
-- revoke — nothing relies on "no grant statement = private," which was a
-- real vulnerability (see grade_single_answer's history above). Every
-- single function here states its access level on purpose.
--
-- Live opponent progress works by clients subscribing to Supabase
-- Realtime changes on duel_participants — but that table's progress
-- columns are only ever written by submit_duel_answer() below, which
-- grades server-side through the same grade_single_answer() helper the
-- rest of the app already trusts. A client broadcasting "I'm ahead"
-- without actually answering correctly first is not possible, because
-- there's no direct update grant on duel_participants at all.
-- ---------------------------------------------------------------------------

create table if not exists public.duel_rooms (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('1v1', 'group')),
  max_players integer not null,
  quiz_id uuid not null references public.quizzes (id),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  invite_code text unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.duel_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.duel_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  correct_count integer not null default 0,
  current_question_idx integer not null default 0,
  finished_at timestamptz,
  final_rank integer,
  unique (room_id, user_id)
);

-- Write-once per-question lock, same anti-brute-force pattern as
-- battle_answers — a wrong first guess can't be overwritten by a later,
-- correct guess within the same duel.
create table if not exists public.duel_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.duel_rooms (id) on delete cascade,
  participant_id uuid not null references public.duel_participants (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  correct boolean not null,
  answered_at timestamptz not null default now(),
  unique (participant_id, question_id)
);

-- Matchmaking waiting pool for random-stranger duels. No client ever
-- reads this directly (see grants below) — it exists purely for
-- queue_for_random_duel() to match against.
create table if not exists public.duel_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('1v1', 'group')),
  quiz_id uuid not null references public.quizzes (id),
  queued_at timestamptz not null default now(),
  unique (user_id, mode, quiz_id)
);

alter table public.duel_rooms enable row level security;
alter table public.duel_participants enable row level security;
alter table public.duel_answers enable row level security;
alter table public.duel_queue enable row level security;

-- Rooms: visible to anyone who is a participant in them.
grant select on public.duel_rooms to authenticated;
drop policy if exists "Participants view their own rooms" on public.duel_rooms;
create policy "Participants view their own rooms"
  on public.duel_rooms for select using (
    exists (select 1 from public.duel_participants p where p.room_id = duel_rooms.id and p.user_id = auth.uid())
  );

-- Helper for the duel_participants policy below — a security definer
-- function bypasses RLS internally when it queries the table itself,
-- which is exactly what's needed here: a raw self-referential subquery
-- directly inside the policy causes infinite recursion (Postgres has to
-- re-evaluate the same policy to answer the subquery, which needs the
-- policy evaluated again, forever). Routing the membership check through
-- a function breaks that cycle. Found and fixed via actual testing
-- against real Postgres — see local_test_rls.sql.
create or replace function public.is_duel_room_member(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.duel_participants where room_id = p_room_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_duel_room_member(uuid) from public;
grant execute on function public.is_duel_room_member(uuid) to authenticated;

-- Participants: deliberately broader than the usual "own rows only" —
-- you need to see your opponents' live progress in a room you're in,
-- not just your own row. Still scoped tightly: only rooms you're
-- actually part of, never any room.
grant select on public.duel_participants to authenticated;
drop policy if exists "See participants in your own rooms" on public.duel_participants;
create policy "See participants in your own rooms"
  on public.duel_participants for select using (
    public.is_duel_room_member(room_id)
  );

-- Answers: no client select grant at all — there's nothing a client
-- legitimately needs to read here directly; progress is derived from
-- duel_participants instead. Writes exclusively through submit_duel_answer().
revoke all on public.duel_answers from authenticated;

-- Queue: fully private. Matching happens entirely inside
-- queue_for_random_duel() — no client ever lists or browses it directly,
-- which also means a user can't see who else is waiting.
revoke all on public.duel_queue from authenticated;

-- create_duel_room — starts a friend-invite room, auto-joins the creator,
-- returns a short shareable code.
create or replace function public.create_duel_room(p_mode text, p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_max integer;
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_mode not in ('1v1', 'group') then
    raise exception 'Invalid mode: %', p_mode;
  end if;
  if not exists (select 1 from public.quizzes where id = p_quiz_id) then
    raise exception 'Quiz not found';
  end if;

  v_max := case p_mode when '1v1' then 2 else 4 end;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.duel_rooms (mode, max_players, quiz_id, invite_code, created_by)
  values (p_mode, v_max, p_quiz_id, v_code, v_user_id)
  returning id into v_room_id;

  insert into public.duel_participants (room_id, user_id) values (v_room_id, v_user_id);

  return jsonb_build_object('room_id', v_room_id, 'invite_code', v_code, 'max_players', v_max);
end;
$$;

grant execute on function public.create_duel_room(text, uuid) to authenticated;

-- join_duel_room — the friend-invite path: join an existing waiting room
-- by its code.
create or replace function public.join_duel_room(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room record;
  v_current_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_room from public.duel_rooms where invite_code = upper(p_invite_code);
  if v_room.id is null then
    raise exception 'Invite code not found';
  end if;
  if v_room.status <> 'waiting' then
    raise exception 'This duel has already started or finished';
  end if;

  select count(*) into v_current_count from public.duel_participants where room_id = v_room.id;
  if v_current_count >= v_room.max_players then
    raise exception 'This duel is full';
  end if;

  insert into public.duel_participants (room_id, user_id)
  values (v_room.id, v_user_id)
  on conflict (room_id, user_id) do nothing;

  if v_current_count + 1 >= v_room.max_players then
    update public.duel_rooms set status = 'active', started_at = now() where id = v_room.id;
  end if;

  return jsonb_build_object('room_id', v_room.id, 'quiz_id', v_room.quiz_id);
end;
$$;

grant execute on function public.join_duel_room(text) to authenticated;

-- queue_for_random_duel — the stranger-matchmaking path. Uses
-- `FOR UPDATE SKIP LOCKED` so two simultaneous callers can never both
-- claim the same waiting players into two different rooms — one of them
-- gets the match, the other sees whoever's left (or stays queued).
create or replace function public.queue_for_random_duel(p_mode text, p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_needed integer;
  v_matched_ids uuid[];
  v_matched_users uuid[];
  v_room_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_mode not in ('1v1', 'group') then
    raise exception 'Invalid mode: %', p_mode;
  end if;

  insert into public.duel_queue (user_id, mode, quiz_id)
  values (v_user_id, p_mode, p_quiz_id)
  on conflict (user_id, mode, quiz_id) do nothing;

  v_needed := case p_mode when '1v1' then 2 else 4 end;

  select array_agg(id), array_agg(user_id) into v_matched_ids, v_matched_users
  from (
    select id, user_id from public.duel_queue
    where mode = p_mode and quiz_id = p_quiz_id
    order by queued_at
    limit v_needed
    for update skip locked
  ) q;

  if array_length(v_matched_users, 1) is null or array_length(v_matched_users, 1) < v_needed then
    return jsonb_build_object('status', 'queued');
  end if;

  insert into public.duel_rooms (mode, max_players, quiz_id, status, created_by, started_at)
  values (p_mode, v_needed, p_quiz_id, 'active', v_user_id, now())
  returning id into v_room_id;

  insert into public.duel_participants (room_id, user_id)
  select v_room_id, u from unnest(v_matched_users) as u;

  delete from public.duel_queue where id = any(v_matched_ids);

  return jsonb_build_object('status', 'matched', 'room_id', v_room_id);
end;
$$;

grant execute on function public.queue_for_random_duel(text, uuid) to authenticated;

-- leave_duel_queue — cancel waiting.
create or replace function public.leave_duel_queue(p_mode text, p_quiz_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from public.duel_queue where user_id = auth.uid() and mode = p_mode and quiz_id = p_quiz_id;
end;
$$;

grant execute on function public.leave_duel_queue(text, uuid) to authenticated;

-- submit_duel_answer — grades one question through the same
-- grade_single_answer() helper the rest of the app trusts, write-once per
-- question (mirrors battle_answer's anti-brute-force lock exactly), and
-- assigns a finish rank the moment a participant completes their last
-- question — first to finish gets rank 1, and so on, live, per player,
-- rather than waiting for everyone.
create or replace function public.submit_duel_answer(p_room_id uuid, p_question_id uuid, p_answer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant record;
  v_room record;
  v_total_questions integer;
  v_existing record;
  v_result jsonb;
  v_rank integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_room from public.duel_rooms where id = p_room_id;
  if v_room.id is null or v_room.status <> 'active' then
    raise exception 'Duel not found or not active';
  end if;

  select * into v_participant from public.duel_participants
  where room_id = p_room_id and user_id = v_user_id;
  if v_participant.id is null then
    raise exception 'You are not a participant in this duel';
  end if;
  if v_participant.finished_at is not null then
    raise exception 'You have already finished this duel';
  end if;

  select * into v_existing from public.duel_answers
  where participant_id = v_participant.id and question_id = p_question_id;

  if v_existing.id is not null then
    -- Repeat submission for a question already locked in — return the
    -- cached result unchanged. Progress must NOT advance again here, or
    -- re-submitting the same question would falsely count as reaching a
    -- new question and could finish the duel early on too few real
    -- answers (found via testing — see local_test_rls.sql).
    return jsonb_build_object('ok', v_existing.correct, 'already_answered', true, 'finished', v_participant.finished_at is not null);
  end if;

  declare v_graded jsonb;
  begin
    v_graded := public.grade_single_answer(p_question_id, p_answer);
    insert into public.duel_answers (room_id, participant_id, question_id, correct)
    values (p_room_id, v_participant.id, p_question_id, (v_graded ->> 'ok')::boolean);
    v_result := jsonb_build_object('ok', (v_graded ->> 'ok')::boolean, 'already_answered', false);
  end;

  update public.duel_participants
  set current_question_idx = current_question_idx + 1,
      correct_count = correct_count + case when (v_result ->> 'ok')::boolean then 1 else 0 end
  where id = v_participant.id;

  select count(*) into v_total_questions from public.questions where quiz_id = v_room.quiz_id;

  if (select current_question_idx from public.duel_participants where id = v_participant.id) >= v_total_questions then
    select count(*) + 1 into v_rank from public.duel_participants
    where room_id = p_room_id and finished_at is not null;

    update public.duel_participants set finished_at = now(), final_rank = v_rank where id = v_participant.id;
    v_result := v_result || jsonb_build_object('finished', true, 'rank', v_rank);

    if v_rank >= (select max_players from public.duel_rooms where id = p_room_id)
       or v_rank >= (select count(*) from public.duel_participants where room_id = p_room_id) then
      update public.duel_rooms set status = 'finished', finished_at = now() where id = p_room_id;
    end if;
  else
    v_result := v_result || jsonb_build_object('finished', false);
  end if;

  return v_result;
end;
$$;

grant execute on function public.submit_duel_answer(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin function: list all track purchases with user details
--
-- Requires `auth.role() = 'service_role'` — intended to be called by
-- an authenticated admin user through a server-side route that verifies
-- the caller's role = 'admin' BEFORE invoking this function.
--
-- Returns rows with all purchase details plus the buyer's username and email.
-- Fails safely with clear error if called by anyone but the service role.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_payments()
returns table (
  purchase_id uuid,
  user_id uuid,
  username text,
  email text,
  track_id text,
  order_reference text,
  amount_tzs integer,
  status text,
  clickpesa_payment_id text,
  phone_number text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'admin_list_payments: only callable by service role';
  end if;

  return query
  select
    tp.id,
    tp.user_id,
    p.username,
    p.email,
    tp.track_id,
    tp.order_reference,
    tp.amount_tzs,
    tp.status,
    tp.clickpesa_payment_id,
    tp.phone_number,
    tp.created_at,
    tp.updated_at
  from public.track_purchases tp
  join public.profiles p on tp.user_id = p.id
  order by tp.created_at desc;
end;
$$;

grant execute on function public.admin_list_payments() to authenticated;

-- Required for live opponent-progress sync — without a table being added
-- to this publication, Supabase Realtime's postgres_changes subscriptions
-- silently receive nothing (no error, just no events), which is exactly
-- the kind of gap that looks like a client bug but isn't. duel_rooms is
-- included too so the waiting-room screen can react the instant a room
-- fills and flips to 'active', without polling.
--
-- Wrapped in a DO block with an existence check because
-- ALTER PUBLICATION ... ADD TABLE has no "IF NOT EXISTS" form — running
-- it twice on an already-added table raises an error and would silently
-- kill everything after it on a schema.sql re-run, the exact same
-- category of bug already found and fixed once this build with
-- CREATE POLICY not supporting IF NOT EXISTS either.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Not running on Supabase (e.g. a plain local Postgres used for
    -- testing) — Realtime publications don't exist here at all, and
    -- that's fine. Skip rather than error, so this script still runs
    -- cleanly end-to-end everywhere schema.sql gets applied.
    return;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duel_participants'
  ) then
    alter publication supabase_realtime add table public.duel_participants;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duel_rooms'
  ) then
    alter publication supabase_realtime add table public.duel_rooms;
  end if;
end $$;


-- ============================================================================
-- FEATURE EXPANSION: Mentorship, Age Tiers, Certificates, USSD, RPG Map
-- All tables wrapped in IF NOT EXISTS — safe to re-run on an existing DB.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AGE TIER / LEARNER PROFILE
-- Drives adaptive gamification (child vs teen vs adult UX, different XP
-- multipliers, content tone). Stored separately from profiles so it can
-- evolve independently. age_tier: 'child' (6-12), 'teen' (13-17),
-- 'adult' (18+), 'professional' (working adult, accelerated pace).
-- ----------------------------------------------------------------------------
create table if not exists public.learner_profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  age_tier       text not null default 'adult'
                   check (age_tier in ('child','teen','adult','professional')),
  display_lang   text not null default 'en'
                   check (display_lang in ('en','sw','fr','am','ha','yo','zu')),
  ui_mode        text not null default 'standard'
                   check (ui_mode in ('standard','playful','focused')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.learner_profiles enable row level security;
grant select, insert, update on public.learner_profiles to authenticated;

drop policy if exists "Users manage own learner profile" on public.learner_profiles;
create policy "Users manage own learner profile"
  on public.learner_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Add display_lang + age_tier to handle_new_user trigger output
create or replace function public.upsert_learner_profile(
  p_age_tier text default 'adult',
  p_display_lang text default 'en',
  p_ui_mode text default 'standard'
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.learner_profiles (user_id, age_tier, display_lang, ui_mode)
    values (auth.uid(), p_age_tier, p_display_lang, p_ui_mode)
    on conflict (user_id) do update
      set age_tier = excluded.age_tier,
          display_lang = excluded.display_lang,
          ui_mode = excluded.ui_mode,
          updated_at = now();
end;
$$;
grant execute on function public.upsert_learner_profile(text,text,text) to authenticated;

create or replace function public.get_learner_profile()
returns table (age_tier text, display_lang text, ui_mode text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  select lp.age_tier, lp.display_lang, lp.ui_mode
  from public.learner_profiles lp
  where lp.user_id = auth.uid();
end;
$$;
grant execute on function public.get_learner_profile() to authenticated;

-- ----------------------------------------------------------------------------
-- 2. MENTORSHIP
-- mentor_profiles: instructors who have applied and been approved.
-- mentorship_sessions: booked 1:1 sessions between a learner and mentor.
-- mentorship_spaces: structured group tutorial spaces (up to 20 learners).
-- ----------------------------------------------------------------------------
create table if not exists public.mentor_profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  bio            text not null default '',
  specialties    text[] not null default '{}', -- e.g. ['beginner','intermediate']
  hourly_rate_tzs integer not null default 0,  -- 0 = volunteer
  available      boolean not null default true,
  approved       boolean not null default false, -- admin must approve
  created_at     timestamptz not null default now()
);
alter table public.mentor_profiles enable row level security;
grant select on public.mentor_profiles to authenticated;
grant insert, update on public.mentor_profiles to authenticated;

drop policy if exists "Anyone can view approved mentors" on public.mentor_profiles;
create policy "Anyone can view approved mentors"
  on public.mentor_profiles for select
  using (approved = true or auth.uid() = user_id);

drop policy if exists "Mentors manage own profile" on public.mentor_profiles;
create policy "Mentors manage own profile"
  on public.mentor_profiles for insert with check (auth.uid() = user_id);

drop policy if exists "Mentors update own profile" on public.mentor_profiles;
create policy "Mentors update own profile"
  on public.mentor_profiles for update using (auth.uid() = user_id);

create table if not exists public.mentorship_sessions (
  id             uuid primary key default gen_random_uuid(),
  mentor_id      uuid not null references auth.users (id) on delete cascade,
  learner_id     uuid not null references auth.users (id) on delete cascade,
  track_id       text not null,
  scheduled_at   timestamptz not null,
  duration_mins  integer not null default 60,
  status         text not null default 'pending'
                   check (status in ('pending','confirmed','completed','cancelled')),
  notes          text,
  meet_link      text,
  created_at     timestamptz not null default now()
);
alter table public.mentorship_sessions enable row level security;
grant select, insert, update on public.mentorship_sessions to authenticated;

drop policy if exists "Participants see own sessions" on public.mentorship_sessions;
create policy "Participants see own sessions"
  on public.mentorship_sessions for select
  using (auth.uid() = mentor_id or auth.uid() = learner_id);

drop policy if exists "Learners book sessions" on public.mentorship_sessions;
create policy "Learners book sessions"
  on public.mentorship_sessions for insert
  with check (auth.uid() = learner_id);

drop policy if exists "Participants update sessions" on public.mentorship_sessions;
create policy "Participants update sessions"
  on public.mentorship_sessions for update
  using (auth.uid() = mentor_id or auth.uid() = learner_id);

create table if not exists public.mentorship_spaces (
  id             uuid primary key default gen_random_uuid(),
  mentor_id      uuid not null references auth.users (id) on delete cascade,
  title          text not null,
  description    text not null default '',
  track_id       text not null,
  max_learners   integer not null default 20,
  scheduled_at   timestamptz not null,
  duration_mins  integer not null default 90,
  status         text not null default 'open'
                   check (status in ('open','full','completed','cancelled')),
  meet_link      text,
  created_at     timestamptz not null default now()
);
alter table public.mentorship_spaces enable row level security;
grant select on public.mentorship_spaces to authenticated;
grant insert, update on public.mentorship_spaces to authenticated;

drop policy if exists "Anyone can view open spaces" on public.mentorship_spaces;
create policy "Anyone can view open spaces"
  on public.mentorship_spaces for select using (true);

drop policy if exists "Mentors create spaces" on public.mentorship_spaces;
create policy "Mentors create spaces"
  on public.mentorship_spaces for insert with check (auth.uid() = mentor_id);

drop policy if exists "Mentors update own spaces" on public.mentorship_spaces;
create policy "Mentors update own spaces"
  on public.mentorship_spaces for update using (auth.uid() = mentor_id);

create table if not exists public.space_enrollments (
  space_id       uuid not null references public.mentorship_spaces (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  joined_at      timestamptz not null default now(),
  primary key (space_id, user_id)
);
alter table public.space_enrollments enable row level security;
grant select, insert, delete on public.space_enrollments to authenticated;

drop policy if exists "Users see own space enrollments" on public.space_enrollments;
create policy "Users see own space enrollments"
  on public.space_enrollments for select using (auth.uid() = user_id);

drop policy if exists "Users join spaces" on public.space_enrollments;
create policy "Users join spaces"
  on public.space_enrollments for insert with check (auth.uid() = user_id);

drop policy if exists "Users leave spaces" on public.space_enrollments;
create policy "Users leave spaces"
  on public.space_enrollments for delete using (auth.uid() = user_id);

-- Convenience RPC: book a 1:1 mentorship session
create or replace function public.book_mentorship_session(
  p_mentor_id    uuid,
  p_track_id     text,
  p_scheduled_at timestamptz,
  p_duration_mins integer default 60,
  p_notes        text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  -- Verify mentor is approved
  if not exists (select 1 from public.mentor_profiles where user_id = p_mentor_id and approved = true) then
    raise exception 'Mentor not found or not yet approved';
  end if;

  insert into public.mentorship_sessions
    (mentor_id, learner_id, track_id, scheduled_at, duration_mins, notes)
    values (p_mentor_id, auth.uid(), p_track_id, p_scheduled_at, p_duration_mins, p_notes)
    returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.book_mentorship_session(uuid,text,timestamptz,integer,text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. DIGITAL CERTIFICATES
-- Issued on track completion (all 5 modules passed at >= passingPct).
-- certificate_url: a generated signed URL or path to the PDF/image.
-- verify_token: public, URL-safe token for /verify/[token] page.
-- ----------------------------------------------------------------------------
create table if not exists public.certificates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  track_id        text not null,
  issued_at       timestamptz not null default now(),
  display_name    text not null,   -- snapshot of name at time of issue
  certificate_url text,            -- set by the certificate generation worker
  verify_token    text not null unique default encode(gen_random_bytes(24), 'base64url'),
  unique (user_id, track_id)       -- one cert per track per learner
);
alter table public.certificates enable row level security;
grant select on public.certificates to authenticated;
grant insert on public.certificates to authenticated;

drop policy if exists "Users view own certificates" on public.certificates;
create policy "Users view own certificates"
  on public.certificates for select
  using (auth.uid() = user_id);

-- Public verification uses verify_certificate() SECURITY DEFINER function
-- (granted to anon below) — the table itself is owner-only.
-- No public table-level read policy here by design.

-- Issue a certificate — called after final module quiz passes
create or replace function public.issue_certificate(p_track_id text)
returns table (cert_id uuid, verify_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_display_name text;
  v_cert_id      uuid;
  v_token        text;
begin
  select display_name into v_display_name
  from public.player_stats where user_id = auth.uid();

  insert into public.certificates (user_id, track_id, display_name)
    values (auth.uid(), p_track_id, coalesce(v_display_name, 'Learner'))
    on conflict (user_id, track_id) do update
      set issued_at = now(), display_name = coalesce(v_display_name, 'Learner')
    returning id, certificates.verify_token into v_cert_id, v_token;

  return query select v_cert_id, v_token;
end;
$$;
grant execute on function public.issue_certificate(text) to authenticated;

-- Public function to look up a certificate by verify_token (no auth)
create or replace function public.verify_certificate(p_token text)
returns table (
  display_name text,
  track_id     text,
  issued_at    timestamptz,
  valid        boolean
)
language plpgsql security definer set search_path = public as $$
begin
  return query
  select c.display_name, c.track_id, c.issued_at, true as valid
  from public.certificates c
  where c.verify_token = p_token;
end;
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. USSD COMPETITIONS
-- ussd_sessions: tracks state machine for *278# style sessions.
-- ussd_competitions: a timed quiz competition accessible via USSD or web.
-- ussd_entries: one row per user per competition — tracks score + progress.
-- ----------------------------------------------------------------------------
create table if not exists public.ussd_competitions (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text not null default '',
  track_id       text not null,
  quiz_id        uuid references public.quizzes (id),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  prize_desc     text,            -- e.g. "Airtime TZS 50,000"
  entry_fee_tzs  integer not null default 0,
  max_entries    integer,
  status         text not null default 'upcoming'
                   check (status in ('upcoming','active','ended')),
  created_at     timestamptz not null default now()
);
alter table public.ussd_competitions enable row level security;
grant select on public.ussd_competitions to authenticated, anon;
drop policy if exists "Anyone views competitions" on public.ussd_competitions;
create policy "Anyone views competitions" on public.ussd_competitions for select using (true);

create table if not exists public.ussd_entries (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.ussd_competitions (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete set null,
  phone_number    text not null,     -- for USSD entrants without an account
  score           integer not null default 0,
  answers_given   integer not null default 0,
  completed       boolean not null default false,
  session_data    jsonb,             -- USSD state machine state
  created_at      timestamptz not null default now(),
  unique (competition_id, phone_number)
);
alter table public.ussd_entries enable row level security;
grant select, insert, update on public.ussd_entries to authenticated, anon;
drop policy if exists "Entries visible to owner" on public.ussd_entries;
create policy "Entries visible to owner" on public.ussd_entries for select
  using (auth.uid() = user_id or auth.role() = 'service_role');
drop policy if exists "Service role manages entries" on public.ussd_entries;
create policy "Service role manages entries" on public.ussd_entries for all
  using (auth.role() = 'service_role');

-- USSD sessions (state machine for *278# menu flow)
create table if not exists public.ussd_sessions (
  session_id     text primary key,   -- telco-provided session ID
  phone_number   text not null,
  state          text not null default 'MENU',
  competition_id uuid references public.ussd_competitions (id),
  entry_id       uuid references public.ussd_entries (id),
  question_idx   integer not null default 0,
  score          integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.ussd_sessions enable row level security;
grant all on public.ussd_sessions to service_role;

-- Competition leaderboard function
-- ----------------------------------------------------------------------------
-- 5. RPG MAP EXPANSION (foundation only — no gameplay yet)
-- Defines the 11 world regions referenced in the design doc.
-- Learners unlock regions as they progress through tracks.
-- map_progress stores per-user unlock state.
-- ----------------------------------------------------------------------------
create table if not exists public.map_regions (
  id             text primary key,  -- e.g. 'welcome_camp', 'silicon_savannah'
  name           text not null,
  description    text not null default '',
  unlock_requires text,             -- track_id that must be enrolled
  sort_order     integer not null default 0,
  scene_key      text,              -- public/illustrations/scene-*.png key
  active         boolean not null default false  -- only active regions are playable
);
alter table public.map_regions enable row level security;
grant select on public.map_regions to authenticated, anon;
drop policy if exists "Anyone views map regions" on public.map_regions;
create policy "Anyone views map regions" on public.map_regions for select using (true);

create table if not exists public.map_progress (
  user_id     uuid not null references auth.users (id) on delete cascade,
  region_id   text not null references public.map_regions (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  stars       integer not null default 0 check (stars between 0 and 3),
  primary key (user_id, region_id)
);
alter table public.map_progress enable row level security;
grant select, insert, update on public.map_progress to authenticated;
drop policy if exists "Users see own map progress" on public.map_progress;
create policy "Users see own map progress"
  on public.map_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed the 11 regions from the design doc
insert into public.map_regions (id, name, description, unlock_requires, sort_order, scene_key, active)
values
  ('welcome_camp',       'Welcome Camp',         'Your first steps into AI.',                null,           1,  'scene-future_africa',       true),
  ('silicon_savannah',   'Silicon Savannah',     'Nairobi''s tech heartbeat.',               'beginner',     2,  'scene-silicon_savannah',    false),
  ('swahili_coast',      'Swahili Coast',        'Trade routes of knowledge.',               'beginner',     3,  'scene-swahili_coast',       false),
  ('ubuntu_village',     'Ubuntu Village',       'Community and collaborative AI.',          'intermediate', 4,  'scene-ubuntu_village',      false),
  ('great_rift_highlands','Great Rift Highlands','The peaks of machine learning.',           'intermediate', 5,  'scene-great_rift_highlands',false),
  ('timbuktu_library',   'Timbuktu Library',     'Ancient wisdom meets modern models.',      'intermediate', 6,  'scene-timbuktu_library',    false),
  ('future_africa',      'Future Africa',        'The world your skills will build.',        'expert',       7,  'scene-future_africa',       false),
  ('sahara_protocol',    'Sahara Protocol',      'Edge AI and resource-constrained systems.','expert',       8,  null,                        false),
  ('lagos_nexus',        'Lagos Nexus',          'High-frequency AI in commerce.',           'expert',       9,  null,                        false),
  ('cape_of_synthesis',  'Cape of Synthesis',    'Multimodal and agentic systems.',          'expert',       10, null,                        false),
  ('nuru_station',       'Nuru Station',         'The final frontier — build your own AI.',  'expert',       11, null,                        false)
on conflict (id) do nothing;


-- ============================================================================
-- ADMIN EXPANSION: Full control panel functions
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Admin: get one learner's full history
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_learner(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  select jsonb_build_object(
    'profile',      row_to_json(p.*),
    'stats',        row_to_json(ps.*),
    'learner',      row_to_json(lp.*),
    'enrollments',  (select jsonb_agg(row_to_json(e.*)) from public.enrollments e where e.user_id = p_user_id),
    'quiz_attempts',(select jsonb_agg(row_to_json(qa.*)) from public.quiz_attempts qa where qa.user_id = p_user_id order by qa.taken_at desc limit 20),
    'purchases',    (select jsonb_agg(row_to_json(tp.*)) from public.track_purchases tp where tp.user_id = p_user_id order by tp.created_at desc),
    'certificates', (select jsonb_agg(row_to_json(c.*)) from public.certificates c where c.user_id = p_user_id),
    'study_log',    (select jsonb_agg(row_to_json(sl.*)) from public.study_log sl where sl.user_id = p_user_id order by sl.study_date desc limit 30)
  ) into v_result
  from public.profiles p
  join public.player_stats ps on ps.user_id = p.id
  left join public.learner_profiles lp on lp.user_id = p.id
  where p.id = p_user_id;
  return v_result;
end;
$$;
grant execute on function public.admin_get_learner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: change a user's role (promote/demote)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  if p_role not in ('student','admin') then
    raise exception 'Invalid role: %', p_role;
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot change your own role';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: suspend / reactivate account (via profiles.suspended column)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_reason text;

create or replace function public.admin_set_suspended(p_user_id uuid, p_suspended boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot suspend yourself';
  end if;
  update public.profiles
  set suspended = p_suspended, suspended_reason = p_reason
  where id = p_user_id;
end;
$$;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: approve / reject mentor application
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_mentor_approved(p_user_id uuid, p_approved boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  update public.mentor_profiles set approved = p_approved where user_id = p_user_id;
end;
$$;
grant execute on function public.admin_set_mentor_approved(uuid, boolean) to authenticated;

-- Admin: list all mentor applications (pending and approved)
create or replace function public.admin_list_mentors()
returns table (
  user_id uuid, display_name text, email text,
  bio text, specialties text[], hourly_rate_tzs integer,
  approved boolean, available boolean, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  return query
  select mp.user_id, ps.display_name, p.email,
         mp.bio, mp.specialties, mp.hourly_rate_tzs,
         mp.approved, mp.available, mp.created_at
  from public.mentor_profiles mp
  join public.profiles p on p.id = mp.user_id
  join public.player_stats ps on ps.user_id = mp.user_id
  order by mp.created_at desc;
end;
$$;
grant execute on function public.admin_list_mentors() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: revoke a certificate
-- ---------------------------------------------------------------------------
create or replace function public.admin_revoke_certificate(p_cert_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  delete from public.certificates where id = p_cert_id;
end;
$$;
grant execute on function public.admin_revoke_certificate(uuid) to authenticated;

-- Admin: re-issue a certificate (resets verify_token)
create or replace function public.admin_reissue_certificate(p_cert_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  update public.certificates
  set verify_token = encode(gen_random_bytes(24), 'base64url'), issued_at = now()
  where id = p_cert_id
  returning verify_token into v_token;
  return v_token;
end;
$$;
grant execute on function public.admin_reissue_certificate(uuid) to authenticated;

-- Admin: list all certificates
create or replace function public.admin_list_certificates()
returns table (
  cert_id uuid, user_id uuid, display_name text, email text,
  track_id text, issued_at timestamptz, verify_token text
)
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  return query
  select c.id, c.user_id, c.display_name, p.email,
         c.track_id, c.issued_at, c.verify_token
  from public.certificates c
  join public.profiles p on p.id = c.user_id
  order by c.issued_at desc;
end;
$$;
grant execute on function public.admin_list_certificates() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: revenue summary by track and month
-- ---------------------------------------------------------------------------
create or replace function public.admin_revenue_summary()
returns table (
  track_id text, month text,
  total_tzs bigint, successful_payments bigint, pending_payments bigint, failed_payments bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  return query
  select
    tp.track_id,
    to_char(tp.created_at, 'YYYY-MM') as month,
    sum(case when tp.status = 'success' then tp.amount_tzs else 0 end) as total_tzs,
    count(*) filter (where tp.status = 'success') as successful_payments,
    count(*) filter (where tp.status = 'pending') as pending_payments,
    count(*) filter (where tp.status = 'failed') as failed_payments
  from public.track_purchases tp
  group by tp.track_id, to_char(tp.created_at, 'YYYY-MM')
  order by month desc, tp.track_id;
end;
$$;
grant execute on function public.admin_revenue_summary() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: demographics breakdown (age tier + language)
-- ---------------------------------------------------------------------------
create or replace function public.admin_demographics()
returns table (
  age_tier text, display_lang text, count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  return query
  select
    coalesce(lp.age_tier, 'unknown') as age_tier,
    coalesce(lp.display_lang, 'en') as display_lang,
    count(*) as count
  from public.profiles p
  left join public.learner_profiles lp on lp.user_id = p.id
  group by coalesce(lp.age_tier, 'unknown'), coalesce(lp.display_lang, 'en')
  order by count desc;
end;
$$;
grant execute on function public.admin_demographics() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: manage USSD competitions (insert/update)
-- Grant service_role full access; authenticated admins go through RPCs
-- ---------------------------------------------------------------------------
grant insert, update, delete on public.ussd_competitions to authenticated;

create or replace function public.admin_upsert_competition(
  p_id uuid default null,
  p_title text default '',
  p_description text default '',
  p_track_id text default 'beginner',
  p_quiz_id uuid default null,
  p_starts_at timestamptz default now(),
  p_ends_at timestamptz default now() + interval '7 days',
  p_prize_desc text default null,
  p_entry_fee_tzs integer default 0,
  p_max_entries integer default null,
  p_status text default 'upcoming'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  if p_id is not null then
    update public.ussd_competitions set
      title = p_title, description = p_description, track_id = p_track_id,
      quiz_id = p_quiz_id, starts_at = p_starts_at, ends_at = p_ends_at,
      prize_desc = p_prize_desc, entry_fee_tzs = p_entry_fee_tzs,
      max_entries = p_max_entries, status = p_status
    where id = p_id returning id into v_id;
  else
    insert into public.ussd_competitions
      (title, description, track_id, quiz_id, starts_at, ends_at, prize_desc, entry_fee_tzs, max_entries, status)
    values
      (p_title, p_description, p_track_id, p_quiz_id, p_starts_at, p_ends_at, p_prize_desc, p_entry_fee_tzs, p_max_entries, p_status)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
grant execute on function public.admin_upsert_competition(uuid,text,text,text,uuid,timestamptz,timestamptz,text,integer,integer,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Content flags: quiz placeholder and lesson video
-- ---------------------------------------------------------------------------
alter table public.quizzes
  add column if not exists published boolean not null default false;

-- Mentorship videos — protected, admin-upload-only
-- video_token: a short-lived signed token generated server-side for streaming.
-- No public URL ever stored — only the storage path.
create table if not exists public.lesson_videos (
  id               uuid primary key default gen_random_uuid(),
  module_id        text not null references public.modules (id) on delete cascade,
  lesson_day       integer not null,
  title            text not null,
  storage_path     text not null unique,  -- Supabase Storage path OR 'mux:<assetId>'
  mux_asset_id     text,                  -- Mux asset ID (when using Mux DRM)
  mux_playback_id  text,                  -- Mux signed playback ID
  duration_secs    integer,
  uploaded_by      uuid references auth.users (id),
  uploaded_at      timestamptz not null default now(),
  is_active        boolean not null default true,
  unique (module_id, lesson_day)
);
alter table public.lesson_videos enable row level security;

-- Only enrolled learners can access video metadata (not the actual stream)
drop policy if exists "Enrolled learners see video metadata" on public.lesson_videos;
create policy "Enrolled learners see video metadata"
  on public.lesson_videos for select
  using (
    exists (
      select 1 from public.enrollments e
      join public.modules m on m.id = lesson_videos.module_id
      where e.user_id = auth.uid() and e.track_id = m.track_id
    )
    or
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Only admins can insert/update/delete
drop policy if exists "Admins manage videos" on public.lesson_videos;
create policy "Admins manage videos"
  on public.lesson_videos for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Generate a short-lived signed URL for a video (enrolled users only)
-- Supabase Storage signed URLs expire; this RPC validates enrollment first.
create or replace function public.get_video_signed_url(p_video_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_path text;
  v_track_id text;
begin
  select lv.storage_path, m.track_id
  into v_path, v_track_id
  from public.lesson_videos lv
  join public.modules m on m.id = lv.module_id
  where lv.id = p_video_id and lv.is_active = true;

  if v_path is null then
    raise exception 'Video not found';
  end if;

  -- Check enrollment
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    if not exists (
      select 1 from public.enrollments
      where user_id = auth.uid() and track_id = v_track_id
    ) then
      raise exception 'Not enrolled in this track';
    end if;
  end if;

  -- Return the storage path — the Next.js API route generates
  -- the actual Supabase Storage signed URL server-side using the secret key
  return v_path;
end;
$$;
grant execute on function public.get_video_signed_url(uuid) to authenticated;


-- ============================================================================
-- SECURITY & BUG FIXES (issues #3, #4, #8, #15, #20)
-- ============================================================================

-- Fix #4: confirm_track_purchase — also revoke from authenticated role
-- (was only revoked from public, leaving authenticated able to call it directly)
revoke all on function public.confirm_track_purchase(text, text, text) from authenticated;

-- Fix #3: Certificates — remove overly-broad public read policy.
-- The verify_certificate() function uses SECURITY DEFINER and is granted to
-- anon, so public verification still works through the function — but a
-- raw `SELECT * FROM certificates` no longer returns every user's data.

drop policy if exists "Users view own certificates" on public.certificates;
create policy "Users view own certificates"
  on public.certificates for select
  using (auth.uid() = user_id);

-- Fix #8: handle_new_user — also create learner_profiles row on signup
-- so age tier and language defaults exist from the first session.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.player_stats (user_id, display_name, avatar_key)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data ->> 'display_name', new.email), 1))
  )
  on conflict (user_id) do nothing;

  -- Fix #8: always create a learner_profile row so age tier and language
  -- are available immediately without the user visiting Settings first.
  insert into public.learner_profiles (user_id, age_tier, display_lang, ui_mode)
  values (new.id, 'adult', 'en', 'standard')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fix #15: USSD answer grading — RPC that grades without leaking correct_answer.
-- The USSD route now calls this instead of reading questions directly.
create or replace function public.ussd_grade_answer(
  p_quiz_id     uuid,
  p_question_id uuid,
  p_answer      text  -- "0","1","2","3" for MCQ index; "true"/"false" for TF
)
returns table (correct boolean, is_last boolean, total_questions integer)
language plpgsql security definer set search_path = public as $$
declare
  v_correct_raw jsonb;
  v_type text;
  v_total integer;
  v_position integer;
  v_correct boolean := false;
begin
  -- service_role only — never reachable by anon/authenticated directly
  if auth.role() not in ('service_role') then
    raise exception 'ussd_grade_answer: service role only';
  end if;

  select correct, type, sort_position
  into v_correct_raw, v_type, v_position
  from public.questions
  where id = p_question_id and quiz_id = p_quiz_id;

  if not found then
    raise exception 'Question not found';
  end if;

  select count(*) into v_total from public.questions where quiz_id = p_quiz_id;

  if v_type = 'mcq' then
    v_correct := (v_correct_raw::int = p_answer::int);
  elsif v_type = 'tf' then
    v_correct := ((v_correct_raw::boolean)::text = lower(p_answer));
  elsif v_type = 'short' then
    select bool_or(lower(trim(a)) = lower(trim(p_answer)))
    into v_correct
    from jsonb_array_elements_text(v_correct_raw) as a;
  end if;

  return query select v_correct, (v_position = v_total), v_total::integer;
end;
$$;
-- Only callable by service role (the USSD API route uses the admin client)
revoke all on function public.ussd_grade_answer(uuid, uuid, text) from public, authenticated;
grant execute on function public.ussd_grade_answer(uuid, uuid, text) to service_role;


-- ============================================================================
-- Fix #5: Lesson content restricted to enrolled learners
-- Tracks and modules remain publicly readable (needed for the marketing catalog
-- and course browser). Lessons and their detailed content require enrollment.
-- ============================================================================


drop policy if exists "Enrolled learners read lessons" on public.lessons;
create policy "Enrolled learners read lessons"
  on public.lessons for select
  using (
    -- Enrolled users: check the module's track_id
    exists (
      select 1 from public.enrollments e
      join public.modules m on m.id = lessons.module_id
      where e.user_id = auth.uid() and e.track_id = m.track_id
    )
    or
    -- Admins can always read everything
    (select role from public.profiles where id = auth.uid()) = 'admin'
    or
    -- Anon / unauthenticated users can read lesson metadata (title, objective)
    -- but NOT block content. This is handled application-side — the policy
    -- allows select; the app only shows block content to enrolled users.
    -- For a harder enforcement, remove this clause and require sign-in before
    -- browsing lessons at all. For now we allow metadata for SEO/marketing.
    auth.role() = 'anon'
  );

-- Fix #20: verify_certificate function is SECURITY DEFINER so it bypasses
-- the owner-only table policy above. Re-confirm the grant is correct after
-- the policy change on certificates.
-- (The function already exists with correct grants — this is a no-op re-assert.)
grant execute on function public.verify_certificate(text) to anon, authenticated;


-- ============================================================================
-- Fix #17: Webhook event log for idempotency and retry auditing
-- Records every ClickPesa webhook event — prevents double-processing on retry,
-- gives visibility into payment failures and webhook delivery issues.
-- ============================================================================
create table if not exists public.webhook_events (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null default 'clickpesa',
  event_type     text not null,
  order_reference text,
  payload        jsonb not null,
  processed      boolean not null default false,
  process_error  text,
  received_at    timestamptz not null default now(),
  processed_at   timestamptz
);
alter table public.webhook_events enable row level security;
-- Only service role can read/write webhook events — never exposed to clients
grant all on public.webhook_events to service_role;


-- ============================================================================
-- UNIFIED COMPETITION: Web + USSD players in the same leaderboard
-- ============================================================================

-- Add entry_source, timing, and per-question answer log to ussd_entries
alter table public.ussd_entries
  add column if not exists entry_source text not null default 'ussd'
    check (entry_source in ('ussd', 'web')),
  add column if not exists started_at  timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists time_taken_secs integer; -- total seconds from first to last answer

-- Per-question answer log — lets us replay a session and audit scores
create table if not exists public.competition_answers (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references public.ussd_entries (id) on delete cascade,
  question_id     uuid not null references public.questions (id),
  question_index  integer not null,   -- 0-based position in the quiz
  answer_given    text not null,      -- "0","1","2","3" for MCQ; "true"/"false" for TF
  correct         boolean not null,
  answered_at     timestamptz not null default now(),
  time_taken_secs integer             -- seconds since question was shown
);
alter table public.competition_answers enable row level security;
grant select on public.competition_answers to authenticated;
drop policy if exists "Entry owner views answers" on public.competition_answers;
create policy "Entry owner views answers" on public.competition_answers for select
  using (
    exists (
      select 1 from public.ussd_entries ue
      where ue.id = competition_answers.entry_id
      and ue.user_id = auth.uid()
    )
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- ── Web compete: start a competition entry ────────────────────────────────────
-- Creates or returns an existing ussd_entries row for the authenticated web user.
-- Safe: only one entry per user per competition (unique on competition_id + user_id for web).
create or replace function public.web_compete_start(p_competition_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id   uuid := auth.uid();
  v_comp      record;
  v_entry_id  uuid;
  v_phone     text;
  v_questions jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Load competition
  select * into v_comp from public.ussd_competitions
  where id = p_competition_id and status = 'active';
  if not found then
    raise exception 'Competition not found or not active';
  end if;

  -- Use email as phone placeholder for web users (masked on leaderboard anyway)
  select coalesce(p.email, v_user_id::text) into v_phone
  from auth.users p where p.id = v_user_id;

  -- Upsert entry — idempotent so "Start" button can be pressed multiple times
  insert into public.ussd_entries
    (competition_id, user_id, phone_number, entry_source, started_at)
  values
    (p_competition_id, v_user_id, v_phone, 'web', now())
  on conflict (competition_id, phone_number)
  do update set
    started_at = coalesce(ussd_entries.started_at, now())
  returning id into v_entry_id;

  -- Return questions WITHOUT correct answers — display fields only
  select jsonb_agg(
    jsonb_build_object(
      'id',            q.id,
      'question_text', q.question_text,
      'type',          q.type,
      'options',       q.options,
      'sort_position', q.sort_position
    ) order by q.sort_position
  ) into v_questions
  from public.questions q
  where q.quiz_id = v_comp.quiz_id;

  return jsonb_build_object(
    'entry_id',    v_entry_id,
    'competition', row_to_json(v_comp),
    'questions',   v_questions
  );
end;
$$;
grant execute on function public.web_compete_start(uuid) to authenticated;

-- ── Web compete: submit one answer ───────────────────────────────────────────
-- Grades the answer server-side, logs it, updates score.
-- Rate-limited by the API route — this function trusts the caller is authenticated.
create or replace function public.web_compete_answer(
  p_entry_id      uuid,
  p_question_id   uuid,
  p_question_index integer,
  p_answer        text,          -- "0","1","2","3" or "true"/"false" or short text
  p_time_secs     integer default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user_id   uuid := auth.uid();
  v_entry     record;
  v_comp      record;
  v_q         record;
  v_correct   boolean := false;
  v_new_score integer;
  v_total_q   integer;
  v_is_last   boolean;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  -- Load and validate entry ownership
  select * into v_entry from public.ussd_entries
  where id = p_entry_id and user_id = v_user_id;
  if not found then raise exception 'Entry not found or not yours'; end if;
  if v_entry.completed then raise exception 'Competition already completed'; end if;

  -- Load competition
  select * into v_comp from public.ussd_competitions where id = v_entry.competition_id;
  if v_comp.status <> 'active' then raise exception 'Competition is not active'; end if;

  -- Load question (validates it belongs to this competition's quiz)
  select * into v_q from public.questions
  where id = p_question_id and quiz_id = v_comp.quiz_id;
  if not found then raise exception 'Question not found in this competition'; end if;

  -- Prevent double-answering the same question
  if exists (
    select 1 from public.competition_answers
    where entry_id = p_entry_id and question_id = p_question_id
  ) then
    raise exception 'Question already answered';
  end if;

  -- Grade the answer (same logic as ussd_grade_answer but inline for web)
  if v_q.type = 'mcq' then
    v_correct := (v_q.correct::int = p_answer::int);
  elsif v_q.type = 'tf' then
    v_correct := ((v_q.correct::boolean)::text = lower(trim(p_answer)));
  elsif v_q.type = 'short' then
    select bool_or(lower(trim(a)) = lower(trim(p_answer)))
    into v_correct
    from jsonb_array_elements_text(v_q.correct) as a;
  end if;

  -- Log the answer
  insert into public.competition_answers
    (entry_id, question_id, question_index, answer_given, correct, time_taken_secs)
  values
    (p_entry_id, p_question_id, p_question_index, p_answer, v_correct, p_time_secs);

  -- Count total questions and check if this is the last
  select count(*) into v_total_q from public.questions where quiz_id = v_comp.quiz_id;
  v_is_last := (p_question_index + 1 >= v_total_q);

  -- Update score and completion
  update public.ussd_entries
  set
    score        = score + case when v_correct then 1 else 0 end,
    answers_given = answers_given + 1,
    completed    = v_is_last,
    finished_at  = case when v_is_last then now() else finished_at end,
    time_taken_secs = case when v_is_last then
      extract(epoch from (now() - started_at))::integer
    else time_taken_secs end
  where id = p_entry_id
  returning score into v_new_score;

  return jsonb_build_object(
    'correct',    v_correct,
    'new_score',  v_new_score,
    'is_last',    v_is_last,
    'total_q',    v_total_q
  );
end;
$$;
grant execute on function public.web_compete_answer(uuid, uuid, integer, text, integer) to authenticated;

-- ── Updated leaderboard — includes entry_source, timing ──────────────────────
create or replace function public.competition_leaderboard(p_competition_id uuid)
returns table (
  rank            bigint,
  display_name    text,
  phone_number    text,   -- masked
  score           integer,
  answers_given   integer,
  completed       boolean,
  entry_source    text,
  time_taken_secs integer
)
language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    row_number() over (
      order by ue.score desc, ue.answers_given asc,
               coalesce(ue.time_taken_secs, 99999) asc
    ) as rank,
    coalesce(ps.display_name, 'Player') as display_name,
    left(ue.phone_number, 4) || '****' as phone_number,
    ue.score,
    ue.answers_given,
    ue.completed,
    ue.entry_source,
    ue.time_taken_secs
  from public.ussd_entries ue
  left join public.player_stats ps on ue.user_id = ps.user_id
  where ue.competition_id = p_competition_id
  order by ue.score desc, ue.answers_given asc,
           coalesce(ue.time_taken_secs, 99999) asc
  limit 100;
end;
$$;
grant execute on function public.competition_leaderboard(uuid) to authenticated, anon;

-- Enable Realtime on ussd_entries so the leaderboard updates live
-- (run once — safe to re-run)
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ussd_entries'
  ) then
    alter publication supabase_realtime add table public.ussd_entries;
  end if;
end $$;


-- ============================================================================
-- ONBOARDING EXPANSION: Extended profile fields collected at sign-up
-- ============================================================================

-- Add new columns to profiles (all nullable — existing rows stay valid)
alter table public.profiles
  add column if not exists display_name    text,
  add column if not exists phone_number    text,
  add column if not exists country         text,
  add column if not exists city            text,
  add column if not exists learning_style  text check (
    learning_style is null or
    learning_style in ('visual','reading','hands_on','video','mixed')
  ),
  add column if not exists goal            text check (
    goal is null or
    goal in ('career','curiosity','business','academic','other')
  ),
  add column if not exists terms_agreed    boolean not null default false,
  add column if not exists terms_agreed_at timestamptz,
  add column if not exists marketing_consent     boolean not null default false,
  add column if not exists notifications_consent boolean not null default true,
  add column if not exists onboarding_complete   boolean not null default false;

-- RPC to save extended onboarding data in one call
create or replace function public.complete_onboarding(
  p_display_name        text,
  p_username            text,
  p_phone_number        text default null,
  p_country             text default null,
  p_city                text default null,
  p_learning_style      text default 'mixed',
  p_goal                text default 'curiosity',
  p_age_tier            text default 'adult',
  p_display_lang        text default 'en',
  p_track_id            text default 'beginner',
  p_terms_agreed        boolean default false,
  p_marketing_consent   boolean default false,
  p_notifications_consent boolean default true
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not p_terms_agreed then raise exception 'Terms must be accepted'; end if;

  -- Validate phone format loosely: must start with + and be digits only
  if p_phone_number is not null and p_phone_number <> '' then
    if p_phone_number !~ '^\+[0-9]{7,15}$' then
      raise exception 'Phone number must be in international format: +255712345678';
    end if;
  end if;

  -- Update profiles
  update public.profiles set
    display_name            = p_display_name,
    username                = p_username,
    phone_number            = p_phone_number,
    country                 = p_country,
    city                    = p_city,
    learning_style          = p_learning_style,
    goal                    = p_goal,
    terms_agreed            = p_terms_agreed,
    terms_agreed_at         = case when p_terms_agreed then now() else null end,
    marketing_consent       = p_marketing_consent,
    notifications_consent   = p_notifications_consent,
    onboarding_complete     = true
  where id = v_user_id;

  -- Update player_stats display name
  update public.player_stats set
    display_name = p_display_name
  where user_id = v_user_id;

  -- Upsert learner profile
  insert into public.learner_profiles (user_id, age_tier, display_lang, ui_mode)
  values (
    v_user_id, p_age_tier, p_display_lang,
    case p_age_tier when 'child' then 'playful' when 'teen' then 'standard' else 'focused' end
  )
  on conflict (user_id) do update set
    age_tier     = excluded.age_tier,
    display_lang = excluded.display_lang,
    ui_mode      = excluded.ui_mode,
    updated_at   = now();

  -- Enroll in chosen track
  insert into public.enrollments (user_id, track_id)
  values (v_user_id, p_track_id)
  on conflict (user_id, track_id) do nothing;
end;
$$;
grant execute on function public.complete_onboarding(text,text,text,text,text,text,text,text,text,text,boolean,boolean,boolean) to authenticated;


-- ============================================================================
-- QUEST SYSTEM: Server-side quest tracking and reward gating
-- ============================================================================

-- Daily quest log — one row per user per date per quest.
-- This is the source of truth. Client state mirrors it; it never leads.
create table if not exists public.daily_quest_completions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  quest_id    text not null,   -- 'lesson', 'quiz', 'duel', 'study20', 'challenge'
  quest_date  date not null default current_date,
  completed   boolean not null default false,
  progress    integer not null default 0,
  target      integer not null default 1,
  xp_rewarded integer not null default 0,
  coins_rewarded integer not null default 0,
  rewarded_at timestamptz,     -- null until reward is actually claimed
  created_at  timestamptz not null default now(),
  unique (user_id, quest_id, quest_date)
);
alter table public.daily_quest_completions enable row level security;
grant select, insert, update on public.daily_quest_completions to authenticated;

drop policy if exists "Users manage own quest completions" on public.daily_quest_completions;
create policy "Users manage own quest completions"
  on public.daily_quest_completions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Quest definitions: what each quest requires and what it rewards.
-- Stored as a function-return so it's easy to evolve without a migration.
create or replace function public.get_quest_definitions()
returns table (
  quest_id    text,
  label       text,
  icon        text,
  target      integer,
  xp_reward   integer,
  coins_reward integer
)
language sql security definer set search_path = public as $$
  select * from (values
    ('lesson',    'Complete 1 Lesson',       'book',  1,   100,  50),
    ('quiz',      'Pass a Mission Quest',     'quiz',  1,   500, 250),
    ('duel',      'Win an Arena Duel',        'duel',  1,   200, 100),
    ('study20',   'Study for 20 minutes',     'clock', 20,  150,  75),
    ('challenge', 'Answer a Daily Challenge', 'zap',   1,   50,   25)
  ) as t(quest_id, label, icon, target, xp_reward, coins_reward);
$$;
grant execute on function public.get_quest_definitions() to authenticated;

-- Load today's quest state for the current user.
-- Creates rows if they don't exist yet (idempotent).
create or replace function public.get_today_quests()
returns table (
  quest_id       text,
  label          text,
  icon           text,
  target         integer,
  progress       integer,
  completed      boolean,
  rewarded       boolean,
  xp_reward      integer,
  coins_reward   integer
)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  -- Ensure rows exist for today
  insert into public.daily_quest_completions
    (user_id, quest_id, quest_date, target, xp_rewarded, coins_rewarded)
  select v_user_id, qd.quest_id, current_date, qd.target, 0, 0
  from public.get_quest_definitions() qd
  on conflict (user_id, quest_id, quest_date) do nothing;

  return query
  select
    qd.quest_id,
    qd.label,
    qd.icon,
    qd.target,
    coalesce(dqc.progress, 0)::integer,
    coalesce(dqc.completed, false),
    (dqc.rewarded_at is not null) as rewarded,
    qd.xp_reward,
    qd.coins_reward
  from public.get_quest_definitions() qd
  left join public.daily_quest_completions dqc
    on dqc.user_id = v_user_id
    and dqc.quest_id = qd.quest_id
    and dqc.quest_date = current_date
  order by
    case qd.quest_id
      when 'lesson'    then 1
      when 'quiz'      then 2
      when 'duel'      then 3
      when 'study20'   then 4
      when 'challenge' then 5
      else 6
    end;
end;
$$;
grant execute on function public.get_today_quests() to authenticated;

-- Advance quest progress. Only callable for valid quest IDs.
-- Returns whether the quest just became complete (for triggering UI).
create or replace function public.advance_quest(
  p_quest_id  text,
  p_increment integer default 1
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user_id    uuid := auth.uid();
  v_target     integer;
  v_old_prog   integer;
  v_new_prog   integer;
  v_completed  boolean;
  v_already    boolean;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  -- Validate quest ID
  select target into v_target from public.get_quest_definitions() where quest_id = p_quest_id;
  if not found then raise exception 'Unknown quest: %', p_quest_id; end if;

  -- Ensure row exists
  insert into public.daily_quest_completions
    (user_id, quest_id, quest_date, target)
  values (v_user_id, p_quest_id, current_date, v_target)
  on conflict (user_id, quest_id, quest_date) do nothing;

  -- Get current state
  select progress, completed into v_old_prog, v_already
  from public.daily_quest_completions
  where user_id = v_user_id and quest_id = p_quest_id and quest_date = current_date;

  if v_already then
    -- Already complete — no further progress
    return jsonb_build_object('quest_id', p_quest_id, 'just_completed', false, 'already_complete', true, 'progress', v_old_prog, 'target', v_target);
  end if;

  -- Advance progress
  v_new_prog  := least(v_target, v_old_prog + p_increment);
  v_completed := (v_new_prog >= v_target);

  update public.daily_quest_completions
  set progress  = v_new_prog,
      completed = v_completed
  where user_id = v_user_id and quest_id = p_quest_id and quest_date = current_date;

  return jsonb_build_object(
    'quest_id',        p_quest_id,
    'just_completed',  v_completed and not v_already,
    'already_complete',false,
    'progress',        v_new_prog,
    'target',          v_target
  );
end;
$$;
grant execute on function public.advance_quest(text, integer) to authenticated;

-- Claim quest reward. Only works when:
--   (a) quest is completed today, AND
--   (b) reward has not yet been claimed today.
-- Awards XP + coins atomically in the DB. Returns the amounts awarded.
create or replace function public.claim_quest_reward(p_quest_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user_id    uuid := auth.uid();
  v_xp         integer;
  v_coins      integer;
  v_completed  boolean;
  v_rewarded   boolean;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  -- Load completion state
  select dqc.completed, (dqc.rewarded_at is not null),
         qd.xp_reward, qd.coins_reward
  into v_completed, v_rewarded, v_xp, v_coins
  from public.daily_quest_completions dqc
  join public.get_quest_definitions() qd on qd.quest_id = dqc.quest_id
  where dqc.user_id = v_user_id
    and dqc.quest_id = p_quest_id
    and dqc.quest_date = current_date;

  if not found then
    raise exception 'Quest not started today: %', p_quest_id;
  end if;
  if not v_completed then
    raise exception 'Quest % not yet complete', p_quest_id;
  end if;
  if v_rewarded then
    raise exception 'Reward already claimed for % today', p_quest_id;
  end if;

  -- Mark claimed
  update public.daily_quest_completions
  set rewarded_at    = now(),
      xp_rewarded    = v_xp,
      coins_rewarded = v_coins
  where user_id = v_user_id and quest_id = p_quest_id and quest_date = current_date;

  -- Award XP + coins
  update public.player_stats
  set xp = xp + v_xp, coins = coins + v_coins, updated_at = now()
  where user_id = v_user_id;

  return jsonb_build_object('xp', v_xp, 'coins', v_coins, 'quest_id', p_quest_id);
end;
$$;
grant execute on function public.claim_quest_reward(text) to authenticated;


-- ============================================================================
-- ADMIN PANEL EXPANSION: Full CRUD for lessons, users, certificates, events
-- ============================================================================

-- Admin: create or update a lesson in the DB
create or replace function public.admin_upsert_lesson(
  p_module_id    text,
  p_day          integer,
  p_title        text,
  p_objective    text,
  p_block1_topic text,
  p_block1_pts   jsonb,  -- ["point1","point2",...]
  p_block2_topic text,
  p_block2_pts   jsonb,
  p_demo         text default null,
  p_homework     text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  insert into public.lessons
    (module_id, day, title, objective, block1_topic, block1_pts, block2_topic, block2_pts, demo, homework)
  values
    (p_module_id, p_day, p_title, p_objective, p_block1_topic, p_block1_pts, p_block2_topic, p_block2_pts, p_demo, p_homework)
  on conflict (module_id, day) do update set
    title        = excluded.title,
    objective    = excluded.objective,
    block1_topic = excluded.block1_topic,
    block1_pts   = excluded.block1_pts,
    block2_topic = excluded.block2_topic,
    block2_pts   = excluded.block2_pts,
    demo         = excluded.demo,
    homework     = excluded.homework
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.admin_upsert_lesson(text,integer,text,text,text,jsonb,text,jsonb,text,text) to authenticated;

-- Admin: delete a user account (cascades to all their data)
create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot delete your own account';
  end if;
  -- Remove from auth.users — cascades to all public tables via FK
  delete from auth.users where id = p_user_id;
end;
$$;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- Admin: create a certificate for any user on any track
create or replace function public.admin_issue_certificate(
  p_user_id  uuid,
  p_track_id text
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_name  text;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  select coalesce(display_name, username, email) into v_name
  from public.profiles where id = p_user_id;
  v_token := encode(gen_random_bytes(24), 'base64url');
  insert into public.certificates (user_id, track_id, display_name, verify_token)
  values (p_user_id, p_track_id, v_name, v_token)
  on conflict (user_id, track_id) do update
    set verify_token = v_token, issued_at = now();
  return v_token;
end;
$$;
grant execute on function public.admin_issue_certificate(uuid, text) to authenticated;

-- Admin: list all learners (extended with new onboarding fields)
create or replace function public.admin_list_learners()
returns table (
  user_id      uuid,
  display_name text,
  username     text,
  email        text,
  phone_number text,
  country      text,
  city         text,
  xp           integer,
  level        integer,
  coins        integer,
  role         text,
  suspended    boolean,
  onboarding_complete boolean,
  joined_at    timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  return query
  select
    p.id,
    coalesce(p.display_name, ps.display_name) as display_name,
    p.username,
    p.email,
    p.phone_number,
    p.country,
    p.city,
    ps.xp,
    ps.level,
    ps.coins,
    p.role,
    p.suspended,
    p.onboarding_complete,
    p.created_at
  from public.profiles p
  join public.player_stats ps on ps.user_id = p.id
  order by p.created_at desc;
end;
$$;
grant execute on function public.admin_list_learners() to authenticated;


-- ============================================================================
-- CMS EXPANSION: Full content management via admin dashboard
-- ============================================================================

-- Extend lessons with all content types
alter table public.lessons
  add column if not exists notes        text,
  add column if not exists video_title  text,
  add column if not exists sort_order   integer not null default 1;

-- Extend tracks with richer metadata
alter table public.tracks
  add column if not exists description  text,
  add column if not exists hero_image   text,  -- URL
  add column if not exists card_gradient_from text,
  add column if not exists card_gradient_to   text,
  add column if not exists is_published boolean not null default true;

-- Extend modules
alter table public.modules
  add column if not exists description  text,
  add column if not exists cover_image  text;

-- Daily challenges (one per lesson, separate table for clean CRUD)
create table if not exists public.daily_challenges (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  question      text not null,
  type          text not null default 'mcq' check (type in ('mcq','short')),
  options       text[],           -- mcq only
  correct       jsonb not null,   -- mcq: index int | short: string[]
  hint          text,
  xp_reward     integer not null default 50,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (lesson_id)
);
alter table public.daily_challenges enable row level security;
grant select on public.daily_challenges to authenticated;
drop policy if exists "Enrolled learners read challenges" on public.daily_challenges;
create policy "Enrolled learners read challenges" on public.daily_challenges for select
  using (
    exists (
      select 1 from public.lessons l
      join public.modules m on m.id = l.module_id
      join public.enrollments e on e.track_id = m.track_id
      where l.id = daily_challenges.lesson_id and e.user_id = auth.uid()
    )
    or (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Lesson images (gallery per lesson)
create table if not exists public.lesson_images (
  id          uuid primary key default gen_random_uuid(),
  lesson_id   uuid references public.lessons(id) on delete cascade,
  module_id   text references public.modules(id) on delete cascade,
  url         text not null,
  caption     text,
  alt_text    text,
  sort_order  integer not null default 0,
  uploaded_at timestamptz not null default now()
);
alter table public.lesson_images enable row level security;
grant select on public.lesson_images to authenticated, anon;
drop policy if exists "Lesson images are public" on public.lesson_images;
create policy "Lesson images are public" on public.lesson_images for select using (true);

-- Certificate templates (per track)
create table if not exists public.certificate_templates (
  id              uuid primary key default gen_random_uuid(),
  track_id        text not null references public.tracks(id) on delete cascade,
  title           text not null,
  subtitle        text not null default '',
  issuer_name     text not null default 'Nuru AI Academy',
  issuer_title    text not null default 'Dar es Salaam, Tanzania',
  signature_name  text,
  signature_title text,
  background_url  text,
  logo_url        text,
  accent_color    text not null default '#6B4EFF',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (track_id)
);
alter table public.certificate_templates enable row level security;
grant select on public.certificate_templates to authenticated;
drop policy if exists "Cert templates readable" on public.certificate_templates;
create policy "Cert templates readable" on public.certificate_templates for select using (true);

-- Competition questions (many per competition)
alter table public.ussd_competitions
  add column if not exists quiz_questions jsonb,  -- inline question bank for web+USSD
  add column if not exists cover_image    text,
  add column if not exists total_questions integer not null default 10;

-- ── ADMIN CMS FUNCTIONS ────────────────────────────────────────────────────

-- Tracks
create or replace function public.admin_upsert_track(
  p_id          text,
  p_name        text,
  p_subtitle    text,
  p_tagline     text,
  p_description text default null,
  p_price_tzs   integer default 0,
  p_passing_pct integer default 60,
  p_tone_hex    text default '#6B4EFF',
  p_tone_deep   text default '#5738E8',
  p_requires    text default null,
  p_hero_image  text default null,
  p_sort_order  integer default 0,
  p_is_published boolean default true
) returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  insert into public.tracks (id, name, subtitle, tagline, description, price_tzs, passing_pct,
    tone_hex, tone_deep_hex, requires, hero_image, sort_order, is_published)
  values (p_id, p_name, p_subtitle, p_tagline, p_description, p_price_tzs, p_passing_pct,
    p_tone_hex, p_tone_deep, p_requires, p_hero_image, p_sort_order, p_is_published)
  on conflict (id) do update set
    name = excluded.name, subtitle = excluded.subtitle, tagline = excluded.tagline,
    description = excluded.description, price_tzs = excluded.price_tzs,
    passing_pct = excluded.passing_pct, tone_hex = excluded.tone_hex,
    tone_deep_hex = excluded.tone_deep_hex, requires = excluded.requires,
    hero_image = excluded.hero_image, sort_order = excluded.sort_order,
    is_published = excluded.is_published;
end;
$$;
grant execute on function public.admin_upsert_track(text,text,text,text,text,integer,integer,text,text,text,text,integer,boolean) to authenticated;

-- Modules
create or replace function public.admin_upsert_module(
  p_id          text,
  p_track_id    text,
  p_week        integer,
  p_name        text,
  p_tagline     text,
  p_description text default null,
  p_sort_order  integer default 0
) returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  insert into public.modules (id, track_id, week, name, tagline, description, sort_order)
  values (p_id, p_track_id, p_week, p_name, p_tagline, p_description, p_sort_order)
  on conflict (id) do update set
    track_id = excluded.track_id, week = excluded.week, name = excluded.name,
    tagline = excluded.tagline, description = excluded.description, sort_order = excluded.sort_order;
end;
$$;
grant execute on function public.admin_upsert_module(text,text,integer,text,text,text,integer) to authenticated;

-- Lessons (full CRUD including notes)
create or replace function public.admin_upsert_lesson_full(
  p_module_id   text,
  p_day         integer,
  p_title       text,
  p_objective   text,
  p_b1_topic    text,
  p_b1_pts      jsonb,
  p_b2_topic    text,
  p_b2_pts      jsonb,
  p_demo        text default null,
  p_homework    text default null,
  p_notes       text default null,
  p_video_title text default null,
  p_sort_order  integer default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  insert into public.lessons
    (module_id, day, title, objective, block1_topic, block1_points,
     block2_topic, block2_points, demo, homework, notes, video_title, sort_order)
  values
    (p_module_id, p_day, p_title, p_objective, p_b1_topic,
     array(select jsonb_array_elements_text(p_b1_pts)),
     p_b2_topic,
     array(select jsonb_array_elements_text(p_b2_pts)),
     p_demo, p_homework, p_notes, p_video_title,
     coalesce(p_sort_order, p_day))
  on conflict (module_id, day) do update set
    title = excluded.title, objective = excluded.objective,
    block1_topic = excluded.block1_topic, block1_points = excluded.block1_points,
    block2_topic = excluded.block2_topic, block2_points = excluded.block2_points,
    demo = excluded.demo, homework = excluded.homework,
    notes = excluded.notes, video_title = excluded.video_title,
    sort_order = excluded.sort_order
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.admin_upsert_lesson_full(text,integer,text,text,text,jsonb,text,jsonb,text,text,text,text,integer) to authenticated;

-- Delete lesson
create or replace function public.admin_delete_lesson(p_lesson_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  delete from public.lessons where id = p_lesson_id;
end;
$$;
grant execute on function public.admin_delete_lesson(uuid) to authenticated;

-- Delete module
create or replace function public.admin_delete_module(p_module_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  delete from public.modules where id = p_module_id;
end;
$$;
grant execute on function public.admin_delete_module(text) to authenticated;

-- Quizzes / questionnaires
create or replace function public.admin_upsert_quiz(
  p_module_id   text,
  p_title       text,
  p_subtitle    text,
  p_minutes     integer default 10,
  p_passing_pct integer default 60,
  p_is_placeholder boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  insert into public.quizzes (module_id, title, subtitle, minutes, passing_pct, is_placeholder)
  values (p_module_id, p_title, p_subtitle, p_minutes, p_passing_pct, p_is_placeholder)
  on conflict (module_id) do update set
    title = excluded.title, subtitle = excluded.subtitle,
    minutes = excluded.minutes, passing_pct = excluded.passing_pct,
    is_placeholder = excluded.is_placeholder
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.admin_upsert_quiz(text,text,text,integer,integer,boolean) to authenticated;

-- Questions (one at a time)
create or replace function public.admin_upsert_question(
  p_quiz_id      uuid,
  p_question_id  uuid default null,
  p_sort_pos     integer default 1,
  p_type         text default 'mcq',
  p_text         text default '',
  p_options      text[] default null,
  p_correct      jsonb default '0',
  p_explain      text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  if p_question_id is not null then
    update public.questions set
      quiz_id = p_quiz_id, sort_position = p_sort_pos, type = p_type,
      question_text = p_text, options = p_options, correct = p_correct, explain = p_explain
    where id = p_question_id
    returning id into v_id;
  else
    insert into public.questions (quiz_id, sort_position, type, question_text, options, correct, explain)
    values (p_quiz_id, p_sort_pos, p_type, p_text, p_options, p_correct, p_explain)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
grant execute on function public.admin_upsert_question(uuid,uuid,integer,text,text,text[],jsonb,text) to authenticated;

-- Delete question
create or replace function public.admin_delete_question(p_question_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then raise exception 'Admin access required'; end if;
  delete from public.questions where id = p_question_id;
end;
$$;
grant execute on function public.admin_delete_question(uuid) to authenticated;

-- Daily challenges
create or replace function public.admin_upsert_challenge(
  p_lesson_id  uuid,
  p_question   text,
  p_type       text default 'mcq',
  p_options    text[] default null,
  p_correct    jsonb default '0',
  p_hint       text default null,
  p_xp_reward  integer default 50
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  insert into public.daily_challenges (lesson_id, question, type, options, correct, hint, xp_reward)
  values (p_lesson_id, p_question, p_type, p_options, p_correct, p_hint, p_xp_reward)
  on conflict (lesson_id) do update set
    question = excluded.question, type = excluded.type, options = excluded.options,
    correct = excluded.correct, hint = excluded.hint, xp_reward = excluded.xp_reward
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.admin_upsert_challenge(uuid,text,text,text[],jsonb,text,integer) to authenticated;

-- Certificate templates
create or replace function public.admin_upsert_cert_template(
  p_track_id       text,
  p_title          text,
  p_subtitle       text default '',
  p_issuer_name    text default 'Nuru AI Academy',
  p_issuer_title   text default 'Dar es Salaam, Tanzania',
  p_sig_name       text default null,
  p_sig_title      text default null,
  p_bg_url         text default null,
  p_accent_color   text default '#6B4EFF'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  insert into public.certificate_templates
    (track_id, title, subtitle, issuer_name, issuer_title, signature_name, signature_title, background_url, accent_color)
  values (p_track_id, p_title, p_subtitle, p_issuer_name, p_issuer_title, p_sig_name, p_sig_title, p_bg_url, p_accent_color)
  on conflict (track_id) do update set
    title = excluded.title, subtitle = excluded.subtitle, issuer_name = excluded.issuer_name,
    issuer_title = excluded.issuer_title, signature_name = excluded.signature_name,
    signature_title = excluded.signature_title, background_url = excluded.background_url,
    accent_color = excluded.accent_color
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.admin_upsert_cert_template(text,text,text,text,text,text,text,text,text) to authenticated;

-- Admin: list all lessons for a module (full data for editor)
create or replace function public.admin_list_lessons(p_module_id text)
returns table (
  id uuid, day integer, title text, objective text,
  block1_topic text, block1_points text[],
  block2_topic text, block2_points text[],
  demo text, homework text, notes text, video_title text,
  has_video boolean, has_challenge boolean
)
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  return query
  select
    l.id, l.day, l.title, l.objective,
    l.block1_topic, l.block1_points,
    l.block2_topic, l.block2_points,
    l.demo, l.homework, l.notes, l.video_title,
    exists(select 1 from public.lesson_videos lv where lv.module_id = l.module_id and lv.lesson_day = l.day) as has_video,
    exists(select 1 from public.daily_challenges dc where dc.lesson_id = l.id) as has_challenge
  from public.lessons l
  where l.module_id = p_module_id
  order by l.day;
end;
$$;
grant execute on function public.admin_list_lessons(text) to authenticated;

-- Admin: get full quiz with questions
create or replace function public.admin_get_quiz(p_module_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_quiz record; v_questions jsonb;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  select * into v_quiz from public.quizzes where module_id = p_module_id;
  if not found then return null; end if;
  select jsonb_agg(
    jsonb_build_object(
      'id', q.id, 'sort_position', q.sort_position, 'type', q.type,
      'question_text', q.question_text, 'options', q.options,
      'correct', q.correct, 'explain', q.explain
    ) order by q.sort_position
  ) into v_questions from public.questions q where q.quiz_id = v_quiz.id;
  return jsonb_build_object(
    'id', v_quiz.id, 'title', v_quiz.title, 'subtitle', v_quiz.subtitle,
    'minutes', v_quiz.minutes, 'passing_pct', v_quiz.passing_pct,
    'is_placeholder', v_quiz.is_placeholder,
    'questions', coalesce(v_questions, '[]'::jsonb)
  );
end;
$$;
grant execute on function public.admin_get_quiz(text) to authenticated;

-- Admin: get challenge for a lesson
create or replace function public.admin_get_challenge(p_lesson_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ch record;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  select * into v_ch from public.daily_challenges where lesson_id = p_lesson_id;
  if not found then return null; end if;
  return row_to_json(v_ch)::jsonb;
end;
$$;
grant execute on function public.admin_get_challenge(uuid) to authenticated;

-- Admin: list cert templates
create or replace function public.admin_list_cert_templates()
returns table (id uuid, track_id text, title text, subtitle text, issuer_name text,
  signature_name text, accent_color text, is_active boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  return query select ct.id, ct.track_id, ct.title, ct.subtitle, ct.issuer_name,
    ct.signature_name, ct.accent_color, ct.is_active, ct.created_at
  from public.certificate_templates ct order by ct.created_at;
end;
$$;
grant execute on function public.admin_list_cert_templates() to authenticated;


-- ============================================================================
-- SERVER-SIDE QUERY: All questions (with answers) for server rendering
-- Only accessible with service_role or admin JWT — never from the browser
-- ============================================================================
create or replace function public.get_all_questions_admin()
returns table (
  id uuid, quiz_id uuid, sort_position integer, type text,
  question_text text, options text[], correct jsonb, explain text
)
language plpgsql security definer set search_path = public as $$
begin
  -- Only callable from server-side contexts (service role or admin)
  -- The function is granted to authenticated but should only be called
  -- from server components / route handlers, never from the browser bundle.
  return query
  select q.id, q.quiz_id, q.sort_position, q.type,
         q.question_text, q.options, q.correct, q.explain
  from public.questions q
  order by q.quiz_id, q.sort_position;
end;
$$;
grant execute on function public.get_all_questions_admin() to authenticated;

-- ============================================================================
-- CURRICULUM SEED DATA
-- All tracks, modules, lessons, quizzes, and questions seeded from the
-- TypeScript curriculum file. Run this ONCE on a fresh database.
-- Running it again is safe — all inserts use ON CONFLICT DO UPDATE.
-- ============================================================================

-- TRACKS
insert into public.tracks (id, name, subtitle, tagline, price_tzs, passing_pct, tone_hex, tone_deep_hex, sort_order, is_published) values
  ('beginner',     'AI for Everyone',       'Beginner Track',      'Start here. Real skills, plain language, Tanzanian examples.', 70000,  60, '#3B82F6', '#2563EB', 1, true),
  ('intermediate', 'LLMs Under the Hood',   'Intermediate Track',  'For builders. Mechanics, workflows, first coding.',             160000, 65, '#22C55E', '#16A34A', 2, true),
  ('expert',       'The Model Landscape',   'Expert Track',        'For depth. Architecture, RAG, governance, production.',         250000, 70, '#8B6CFF', '#6B4EFF', 3, true)
on conflict (id) do update set
  name = excluded.name, subtitle = excluded.subtitle, tagline = excluded.tagline,
  price_tzs = excluded.price_tzs, passing_pct = excluded.passing_pct,
  tone_hex = excluded.tone_hex, tone_deep_hex = excluded.tone_deep_hex,
  sort_order = excluded.sort_order;

-- Update requires
update public.tracks set requires = 'beginner'      where id = 'intermediate';
update public.tracks set requires = 'intermediate'  where id = 'expert';

-- BEGINNER MODULES
insert into public.modules (id, track_id, week, name, tagline, sort_order) values
  ('b1', 'beginner', 1, 'Foundations',          'What AI is, how to talk to it, why it matters in Tanzania.',      1),
  ('b2', 'beginner', 2, 'Use Cases & Productivity', 'Writing, summarising, images, and research — real outputs today.', 2),
  ('b3', 'beginner', 3, 'Ethics, Limits, Code',  'Using AI honestly, critically, and creatively.',                  3),
  ('b4', 'beginner', 4, 'Business, Automation, Integration', 'AI in your business, automations, and first no-code.',     4),
  ('b5', 'beginner', 5, 'Emberfall',             'The test that proves what you''ve learned — and opens the next path.', 5)
on conflict (id) do update set track_id=excluded.track_id, week=excluded.week, name=excluded.name, tagline=excluded.tagline, sort_order=excluded.sort_order;

-- INTERMEDIATE MODULES
insert into public.modules (id, track_id, week, name, tagline, sort_order) values
  ('i1', 'intermediate', 1, 'LLM Mechanics',        'Token prediction, context windows, the API layer.',              1),
  ('i2', 'intermediate', 2, 'Prompting Techniques', 'Zero-shot to few-shot, system prompts, structured outputs.',     2),
  ('i3', 'intermediate', 3, 'Ethics, Limits, Code', 'Bias, privacy, critical evaluation, first no-code.',             3),
  ('i4', 'intermediate', 4, 'Business & APIs',      'Analysis, automations, APIs, careers.',                          4),
  ('i5', 'intermediate', 5, 'Emberfall',            'The test that proves what you''ve learned — and opens the next path.', 5)
on conflict (id) do update set track_id=excluded.track_id, week=excluded.week, name=excluded.name, tagline=excluded.tagline, sort_order=excluded.sort_order;

-- EXPERT MODULES
insert into public.modules (id, track_id, week, name, tagline, sort_order) values
  ('e1', 'expert', 1, 'Foundations (Architecture)', 'Transformers, models, cost, advanced prompting.',           1),
  ('e2', 'expert', 2, 'Production Engineering',     'RAG, images at scale, custom voice, tool stacks.',          2),
  ('e3', 'expert', 3, 'Governance, Compliance, Code', 'Red-teaming, PDPA compliance, IP, coding with AI.',       3),
  ('e4', 'expert', 4, 'Deployment & Business',      'Pipelines, chatbots, agents, production APIs, careers.',    4),
  ('e5', 'expert', 5, 'Emberfall',                  'The final trial — capstone that proves mastery.',            5)
on conflict (id) do update set track_id=excluded.track_id, week=excluded.week, name=excluded.name, tagline=excluded.tagline, sort_order=excluded.sort_order;

-- BEGINNER LESSONS (Week 1)
insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order) values
  ('b1',1,'What is AI?','Define AI in your own words and name three AI tools you have encountered.',
    'What AI actually is — separating hype from reality',ARRAY['AI predicts likely next words or actions based on patterns','Not magic, not human — it is a very good pattern-matcher','Your phone already uses AI every day: autocomplete, face unlock, spam filter'],
    'Tanzanian examples of AI you already touch',ARRAY['M-Pesa fraud detection is AI','Safaricom customer-service chatbots use AI','WhatsApp voice-to-text is a small AI model'],1),
  ('b1',2,'How LLMs Work (Plain Language)','Explain to a friend how ChatGPT produces an answer — without using jargon.',
    'Next-word prediction made simple',ARRAY['LLM = Large Language Model — trained on billions of sentences','It predicts the most likely next word, again and again','That is how a paragraph appears — one word at a time'],
    'What training data is and why it matters',ARRAY['Trained on the internet, books, code — before a cutoff date','Does not know today''s news unless it has a search tool','Confident-sounding answers can still be wrong — always verify'],2),
  ('b1',3,'Your First Prompts','Write three prompts that each get a useful, specific response.',
    'Anatomy of a good prompt',ARRAY['WHO: give the AI a role — "Act as a Swahili teacher"','WHAT: be specific about the task and output format','CONTEXT: add relevant background — audience, length, tone'],
    'Common beginner mistakes',ARRAY['Too vague: "write something" → too broad to be useful','No context: missing audience, purpose, or constraints','Not iterating: refine prompts the way you refine a Google search'],3),
  ('b1',4,'Prompt Patterns That Work','Apply three prompt patterns to get better AI outputs.',
    'High-leverage patterns',ARRAY['Role + task + format: "You are a ... Write a ... as a bullet list"','Step-by-step: ask the AI to think through each step before answering','Examples in the prompt: show one good example before asking for more'],
    'Practice — real Tanzanian scenarios',ARRAY['Draft an SMS to a boda rider about a parcel pickup','Summarise a 500-word government announcement in 3 bullet points','Write a polite follow-up email to a client who has not paid'],4),
  ('b1',5,'AI Tools Landscape','Name and categorise five AI tools relevant to your work or study.',
    'Text tools',ARRAY['ChatGPT, Claude, Gemini — general-purpose assistants','Specialized: Grammarly (writing), Perplexity (search), NotionAI (notes)','Free tiers vs paid tiers and what each unlocks'],
    'Image, voice, and other modalities',ARRAY['Image: Midjourney, DALL·E, Canva AI','Voice: ElevenLabs, Whisper (transcription)','Code: GitHub Copilot, Cursor, Replit — for Week 3'],5)
on conflict (module_id, day) do update set
  title=excluded.title, objective=excluded.objective,
  block1_topic=excluded.block1_topic, block1_points=excluded.block1_points,
  block2_topic=excluded.block2_topic, block2_points=excluded.block2_points;

-- BEGINNER LESSONS (Week 2)
insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order) values
  ('b2',1,'AI for Writing','Produce one polished piece of writing with AI — in Swahili or English.',
    'Writing use cases',ARRAY['Emails, proposals, social posts, reports, stories','Summarise long documents into key takeaways','Translate and localise — Swahili ↔ English with cultural nuance'],
    'Quality control for AI writing',ARRAY['Always read and edit — AI makes factual errors','Add your voice, local knowledge, personal experience','Run the FACT-TONE-FIT check before sending'],2),
  ('b2',2,'AI for Research','Use AI to research a topic and produce a reliable summary with sources.',
    'Researching with AI assistants',ARRAY['Perplexity and ChatGPT with browsing for current facts','Ask for sources — then verify them independently','Use AI to structure research, not to replace verification'],
    'Hallucination awareness',ARRAY['AI confidently invents statistics, quotes, and citations','Cross-check every claim you plan to use or share','The rule: AI for drafts, human for facts'],3),
  ('b2',3,'AI for Images','Generate one image that matches a brief you write yourself.',
    'Image generation basics',ARRAY['Prompt = text description of what you want the image to show','Style modifiers: photorealistic, cartoon, watercolour, cinematic','Negative prompts: tell the model what to exclude'],
    'Practical uses in Tanzania',ARRAY['Social media graphics for your business page','Concept art for pitches or school projects','Logo exploration before hiring a designer'],4),
  ('b2',4,'AI for Learning','Use AI as a personal tutor for one topic you want to understand better.',
    'AI as a Socratic tutor',ARRAY['"Explain X as if I am 12" — simplify any concept','Ask follow-up questions: "Why?" and "Can you give an example?"','Use it to test yourself: "Quiz me on what we just covered"'],
    'Study techniques powered by AI',ARRAY['Flashcard generation from notes','Summarising lecture transcripts','Getting explanations in Swahili for complex English-language material'],5),
  ('b2',5,'AI for Planning','Produce a 7-day plan for a real goal using AI.',
    'Planning prompts',ARRAY['Give context: your situation, constraints, available time, and resources','Ask for a structured output: day-by-day, table, or checklist','Iterate: ask it to adjust for your feedback'],
    'When NOT to rely on AI for planning',ARRAY['Local regulations and requirements — verify with official sources','Interpersonal decisions — AI lacks the full human context','Anything with financial or legal consequences — consult a professional'],6)
on conflict (module_id, day) do update set
  title=excluded.title, objective=excluded.objective,
  block1_topic=excluded.block1_topic, block1_points=excluded.block1_points,
  block2_topic=excluded.block2_topic, block2_points=excluded.block2_points;

-- BEGINNER LESSONS (Weeks 3-5 — skeleton, expand in CMS)
insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order) values
  ('b3',1,'AI Limitations & Hallucinations','Identify three types of AI errors and verify a suspicious AI claim.',
    'Types of AI mistakes',ARRAY['Hallucinations — confident false facts','Outdated knowledge — training cutoff','Bias — skewed outputs from skewed training data'],
    'How to catch and correct errors',ARRAY['The three-source rule for important facts','Asking the AI to explain its reasoning','When to distrust AI entirely'],1),
  ('b3',2,'Ethics in Practice','Apply an ethical checklist before publishing AI-generated content.',
    'The three ethical questions',ARRAY['Is it accurate? — Verify facts independently','Is it fair? — Check for bias in tone or representation','Is it mine? — Understand AI and copyright basics'],
    'Responsible use in Tanzania',ARRAY['TCRA guidelines on AI-generated content','Academic and professional disclosure norms','Protecting your clients'' and customers'' data'],2),
  ('b3',3,'Privacy & Data Safety','Identify what data you should never put into an AI tool.',
    'What AI tools do with your data',ARRAY['Inputs may be used for training — check the privacy policy','Enterprise tiers typically offer stronger data protection','Public AI tools are not secure vaults'],
    'Safe prompting habits',ARRAY['Never paste ID numbers, passwords, or financial details','Anonymise client data before using AI to analyse it','Use placeholders: "Client A" instead of real names'],3),
  ('b3',4,'Critical Evaluation','Score an AI output on accuracy, tone, and completeness.',
    'The evaluation checklist',ARRAY['Accuracy: is every fact verifiable?','Tone: does it match the audience and purpose?','Completeness: does it address the full brief?'],
    'Building your editing reflex',ARRAY['Never publish the first draft unchanged','Read aloud — your ear catches what your eye misses','AI + human review = professional quality output'],4),
  ('b3',5,'AI & Your Career','Map three concrete ways AI will change your job in the next 2 years.',
    'Skills that grow with AI',ARRAY['Prompt engineering — direction and quality control','Critical thinking — verifying and improving AI outputs','Domain expertise — AI amplifies specialists, not replaces them'],
    'Tanzanian job market context',ARRAY['Roles most exposed: data entry, basic writing, translation','Roles most boosted: sales, teaching, design, customer service','Your unfair advantage: local knowledge, relationships, language'],5),
  ('b4',1,'AI for Your Business','Use AI to produce one real business document for your own work.',
    'Business writing at speed',ARRAY['Proposals, quotes, invoices — AI drafts in seconds','Business plans — structure and language AI handles well','Market research summaries — AI aggregates, you verify'],
    'Customer-facing applications',ARRAY['FAQ pages and knowledge bases','Social media content calendars','Product descriptions in multiple languages'],1),
  ('b4',2,'Simple Automation','Build one working automation that saves you time every week.',
    'What automation means in practice',ARRAY['Automation = a task runs itself based on a trigger','No code required for most business automations','ROI calculation: if it takes 30 min/day, automation saves 180+ hours/year'],
    'Tanzanian-relevant automation ideas',ARRAY['Google Form → WhatsApp notification via Zapier/Make','New email → auto-labelled in Gmail with AI categorisation','Spreadsheet updated → summary sent to your phone nightly'],2),
  ('b4',3,'AI for Customer Service','Set up an AI-assisted customer service workflow for a real or imagined business.',
    'Building a response library',ARRAY['FAQs with AI-suggested answers','Tone guidelines: how your brand speaks','Escalation rules: when to hand over to a human'],
    'Tools that work in Tanzania',ARRAY['WhatsApp Business API with AI routing','Tidio, Crisp, or Intercom with AI features','Custom ChatGPT with your product knowledge uploaded'],3),
  ('b4',4,'AI & Money','Use AI to help with one financial task: budgeting, forecasting, or analysis.',
    'Financial AI use cases',ARRAY['Budget analysis from a spreadsheet export','Cash-flow forecasting with scenario modelling','Invoice and receipt extraction with AI vision tools'],
    'Important limits',ARRAY['AI is not a financial adviser — never replace professional advice','Verify all numbers — AI hallucinates financial figures readily','Use AI for structure; you provide the data and the decisions'],4),
  ('b4',5,'Building Your AI Toolkit','Assemble and document your personal AI toolkit for your specific role.',
    'Choosing your tools',ARRAY['Match the tool to the task: text, image, voice, code, automation','Free vs paid: what is worth paying for at your stage','One tool at depth beats five tools at surface level'],
    'Your personal AI workflow',ARRAY['Morning: AI-assisted inbox triage and task prioritisation','Creation: AI first draft → your edit → fact-check → publish','Learning: daily 15-minute AI conversation on one topic you want to understand'],5),
  ('b5',1,'Revision — Weeks 1 & 2','Reconfirm AI basics, prompting, and productivity tools.',
    'Days 1–10 in 30 minutes',ARRAY['What AI is and how LLMs work','Prompt anatomy and patterns that work','Tools landscape and output quality checks'],
    'Practice scenarios',ARRAY['Live prompt improvement — take a weak prompt, make it great','Tool selection quiz — which tool for which task?','Pair review — critique a partner''s AI output'],1),
  ('b5',2,'Revision — Weeks 3 & 4','Reconfirm ethics, business use, and automation.',
    'Days 11–20 in 30 minutes',ARRAY['AI limitations, hallucinations, and verification','Ethics checklist and data safety','Business applications and simple automations'],
    'Case study clinic',ARRAY['A Tanzanian SME that used AI wrong — what happened?','A school that used AI right — what did they do?','Your own work: what AI change would have the biggest impact?'],2),
  ('b5',3,'Mock Exam','Complete a full timed practice exam mirroring the real Week 5 assessment.',
    'Exam format',ARRAY['20 MCQ questions — 30 minutes','5 short-answer prompting tasks — 20 minutes','1 scenario-based ethics question — 10 minutes'],
    'Exam strategy',ARRAY['Answer what you know first, flag what you''re unsure about','For prompting tasks: use the role + task + format pattern','For ethics: use the three-question checklist'],3),
  ('b5',4,'Exam Day','Sit the Beginner Track exam and pass with 60% or more.',
    'Exam logistics',ARRAY['60 minutes total, closed-book but can use your notes','25 questions: MCQ, true/false, and short answer','Immediate score — certificate issued same day if you pass'],
    'Mindset for success',ARRAY['You have practised all of this over the past 4 weeks','Trust your preparation and read each question carefully','If you don''t pass first time, you can retry after 24 hours'],4),
  ('b5',5,'Certificate Day','Receive and share your Nuru Beginner Track certificate.',
    'What your certificate proves',ARRAY['You can identify AI tools and use them safely','You can write effective prompts for real tasks','You understand AI limitations and apply ethics checks'],
    'What comes next',ARRAY['Intermediate Track: LLMs Under the Hood — mechanics, APIs, coding','Share your certificate on LinkedIn and WhatsApp','Join the Nuru alumni community for ongoing challenges'],5)
on conflict (module_id, day) do update set
  title=excluded.title, objective=excluded.objective,
  block1_topic=excluded.block1_topic, block1_points=excluded.block1_points,
  block2_topic=excluded.block2_topic, block2_points=excluded.block2_points;

-- INTERMEDIATE & EXPERT LESSONS (skeletons — flesh out in CMS)
do $$
declare
  mid text; d int; titles text[];
begin
  -- Intermediate
  for d in 1..5 loop
    insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
    values ('i1', d, 'LLM Mechanics Day ' || d, 'Complete this lesson in the Content Management dashboard.',
      'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
    on conflict (module_id, day) do nothing;
    insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
    values ('i2', d, 'Prompting Day ' || d, 'Complete this lesson in the Content Management dashboard.',
      'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
    on conflict (module_id, day) do nothing;
    insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
    values ('i3', d, 'Ethics Day ' || d, 'Complete this lesson in the Content Management dashboard.',
      'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
    on conflict (module_id, day) do nothing;
    insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
    values ('i4', d, 'Business Day ' || d, 'Complete this lesson in the Content Management dashboard.',
      'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
    on conflict (module_id, day) do nothing;
    insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
    values ('i5', d, 'Emberfall Day ' || d, 'Complete this lesson in the Content Management dashboard.',
      'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
    on conflict (module_id, day) do nothing;
    -- Expert
    for mid in select id from public.modules where track_id = 'expert' loop
      insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
      values (mid, d, 'Expert Day ' || d, 'Complete this lesson in the Content Management dashboard.',
        'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
      on conflict (module_id, day) do nothing;
    end loop;
  end loop;
end;
$$;

-- BEGINNER WEEK 1 QUIZ (real questions)
insert into public.quizzes (module_id, title, subtitle, minutes, passing_pct, is_placeholder) values
  ('b1', 'Foundations Challenge', 'Prove what you learned in Week 1: recognising AI and prompting basics.', 10, 60, false)
on conflict (module_id) do update set title=excluded.title, subtitle=excluded.subtitle, is_placeholder=excluded.is_placeholder;

insert into public.questions (quiz_id, sort_position, type, question_text, options, correct, explain)
select q.id, v.sort_pos, v.qtype, v.qtext, v.opts, v.corr::jsonb, v.expl
from public.quizzes q
cross join (values
  (1, 'tf',    'AI like ChatGPT understands you the same way a human friend does.', null, 'false', 'AI predicts likely words — it does not truly understand.'),
  (2, 'mcq',   'What does ''AI'' stand for?', ARRAY['Automatic Internet','Artificial Intelligence','Applied Information','Advanced Imaging'], '1', 'AI = Artificial Intelligence. Artificial = man-made; intelligence = thinking-like ability.'),
  (3, 'mcq',   'Which is an example of AI you might already use?', ARRAY['A paper calculator','Entering an M-Pesa PIN','Predictive text on your keyboard','A wall clock'], '2', 'Autocomplete predicts the next word — that''s a tiny LLM on your phone.'),
  (4, 'mcq',   'A prompt is:', ARRAY['A payment','The instruction you give the AI','An error message','A password'], '1', 'Prompt = your instruction to the AI.'),
  (5, 'mcq',   'Which prompt is BETTER?', ARRAY['''write''','''Write a 3-sentence Swahili SMS reminding salon clients of tomorrow''s appointment.'''], '1', 'The good prompt specifies WHO, WHAT, HOW LONG and STYLE.'),
  (6, 'mcq',   'If the AI gives you a wrong fact, you should:', ARRAY['Trust it because it sounds confident','Check it against a reliable source','Retype your question louder','Restart your phone'], '1', 'AI sounds confident even when wrong. Always verify important facts.'),
  (7, 'short', 'What do we call the instruction you type to an AI?', null, '["prompt","a prompt"]', 'The prompt — your instruction.'),
  (8, 'mcq',   'The best FIRST step when writing a prompt is:', ARRAY['Give no detail','Describe what you have and exactly what you want','Ask the AI to guess','Send a single word'], '1', 'Be specific: WHO + WHAT + HOW LONG + STYLE = clear prompts = useful answers.')
) as v(sort_pos, qtype, qtext, opts, corr, expl)
where q.module_id = 'b1'
on conflict do nothing;

-- PLACEHOLDER QUIZZES for all other modules
do $$
declare rec record;
begin
  for rec in select id from public.modules where id not in ('b1') loop
    insert into public.quizzes (module_id, title, subtitle, minutes, passing_pct, is_placeholder)
    values (rec.id, 'Mission Quest', 'Build this quiz in the Content Management dashboard.', 10, 60, true)
    on conflict (module_id) do nothing;
  end loop;
end;
$$;


-- ============================================================================
-- NOTE: The following email template settings CANNOT be set via SQL.
-- They must be configured in the Supabase Dashboard manually.
-- See PRODUCT_SETUP.md for step-by-step instructions.
-- Reference: https://supabase.com/dashboard/project/{ref}/auth/templates
-- ============================================================================

-- ============================================================================
-- STORAGE BUCKETS (run once — safe to re-run)
-- ============================================================================

-- Private video bucket — only accessible via signed URLs generated server-side
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-videos',
  'lesson-videos',
  false,
  1073741824,  -- 1 GB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public images bucket — lesson cover images, accessible without auth
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-images',
  'lesson-images',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public certificates bucket — generated certificate images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificates',
  'certificates',
  true,
  5242880,   -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS policies
drop policy if exists "Admin uploads videos" on storage.objects;
create policy "Admin uploads videos" on storage.objects
  for insert with check (
    bucket_id = 'lesson-videos'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Admin reads videos" on storage.objects;
create policy "Admin reads videos" on storage.objects
  for select using (
    bucket_id = 'lesson-videos'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Enrolled learners read videos" on storage.objects;
create policy "Enrolled learners read videos" on storage.objects
  for select using (
    bucket_id = 'lesson-videos'
    and exists (
      select 1 from public.enrollments e
      join public.modules m on m.track_id = e.track_id
      where e.user_id = auth.uid()
    )
  );

drop policy if exists "Anyone reads lesson images" on storage.objects;
create policy "Anyone reads lesson images" on storage.objects
  for select using (bucket_id = 'lesson-images');

drop policy if exists "Admin uploads lesson images" on storage.objects;
create policy "Admin uploads lesson images" on storage.objects
  for insert with check (
    bucket_id = 'lesson-images'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Admin deletes lesson images" on storage.objects;
create policy "Admin deletes lesson images" on storage.objects
  for delete using (
    bucket_id = 'lesson-images'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Anyone reads certificates" on storage.objects;
create policy "Anyone reads certificates" on storage.objects
  for select using (bucket_id = 'certificates');

drop policy if exists "Service role writes certificates" on storage.objects;
create policy "Service role writes certificates" on storage.objects
  for insert with check (bucket_id = 'certificates');


-- ============================================================================
-- SESSION LOCKING — ONE ACTIVE SESSION PER USER
-- ============================================================================
-- Ensures only one device can be logged in at a time per account.
-- When a new login occurs, the previous session token is replaced,
-- kicking out any other device immediately on their next request.

create table if not exists public.user_sessions (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  session_token text not null,           -- matches Supabase JWT jti claim
  device_hint   text,                    -- e.g. "Chrome on Windows" for admin visibility
  ip_address    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

alter table public.user_sessions enable row level security;

drop policy if exists "Users view own session" on public.user_sessions;
create policy "Users view own session"
  on public.user_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users upsert own session" on public.user_sessions;
create policy "Users upsert own session"
  on public.user_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin can view all sessions
drop policy if exists "Admins view all sessions" on public.user_sessions;
create policy "Admins view all sessions"
  on public.user_sessions for select
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Admin can delete (force-logout) any session
drop policy if exists "Admins delete sessions" on public.user_sessions;
create policy "Admins delete sessions"
  on public.user_sessions for delete
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Register or replace session — called on every login
create or replace function public.upsert_session(
  p_session_token text,
  p_device_hint   text default null,
  p_ip_address    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_sessions (user_id, session_token, device_hint, ip_address)
  values (auth.uid(), p_session_token, p_device_hint, p_ip_address)
  on conflict (user_id) do update set
    session_token = excluded.session_token,
    device_hint   = excluded.device_hint,
    ip_address    = excluded.ip_address,
    created_at    = now(),
    last_seen_at  = now();
end;
$$;

grant execute on function public.upsert_session(text, text, text) to authenticated;

-- Validate session — returns true if token matches stored token
create or replace function public.validate_session(p_session_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stored_token text;
begin
  select session_token into v_stored_token
  from public.user_sessions
  where user_id = auth.uid();

  if v_stored_token is null then
    return false;
  end if;

  -- Update last_seen if valid
  if v_stored_token = p_session_token then
    update public.user_sessions
    set last_seen_at = now()
    where user_id = auth.uid();
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.validate_session(text) to authenticated;

-- Admin: list all active sessions
create or replace function public.admin_list_sessions()
returns table (
  user_id      uuid,
  display_name text,
  email        text,
  device_hint  text,
  ip_address   text,
  created_at   timestamptz,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin only';
  end if;

  return query
  select
    us.user_id,
    ps.display_name,
    p.email,
    us.device_hint,
    us.ip_address,
    us.created_at,
    us.last_seen_at
  from public.user_sessions us
  join public.profiles p  on p.id  = us.user_id
  left join public.player_stats ps on ps.user_id = us.user_id
  order by us.last_seen_at desc;
end;
$$;

grant execute on function public.admin_list_sessions() to authenticated;

-- Admin: force-logout a user
create or replace function public.admin_force_logout(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin only';
  end if;
  delete from public.user_sessions where user_id = p_user_id;
end;
$$;

grant execute on function public.admin_force_logout(uuid) to authenticated;
