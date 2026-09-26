-- ============================================================================
-- Migration 010: Competitions system (real-time scored competitions)
-- Dependencies: 001_core_auth
-- ============================================================================
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


