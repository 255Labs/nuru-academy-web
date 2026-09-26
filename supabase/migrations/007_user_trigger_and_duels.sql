-- ============================================================================
-- Migration 007: handle_new_user trigger + Duel system (real-time 1v1)
-- Dependencies: 001_core_auth, 002_curriculum
-- ============================================================================
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


