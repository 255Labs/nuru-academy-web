-- ============================================================================
-- Migration 005: AI Chat (Ask Nuru) + anti-cheat quiz grading function
-- Dependencies: 001_core_auth, 002_curriculum, 003_progress, 004_achievements
-- ============================================================================
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

