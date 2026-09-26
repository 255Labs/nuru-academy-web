-- ============================================================================
-- Migration 004: Achievements system
-- Dependencies: 001_core_auth
-- ============================================================================
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
