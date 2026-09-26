-- Verifies the RLS policies and grading functions in schema.sql. Run this
-- after local_test_harness.sql + schema.sql, against a throwaway database —
-- never against production. Every "check" below states its expected result;
-- read the output and confirm it matches. See PRODUCT_SETUP.md.

-- Insert two fake auth users — the trigger should auto-create their
-- profiles + player_stats rows.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', '{"display_name":"Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com', '{"display_name":"Bob"}');

select 'profiles after signup trigger' as check;
select id, username, email from public.profiles order by email;

select 'player_stats after signup trigger' as check;
select user_id, display_name, avatar_key, xp from public.player_stats order by display_name;

-- Seed a minimal track/module/quiz/questions to test grading.
insert into public.tracks (id, name, subtitle, tagline, price_tzs, passing_pct, tone_hex, tone_deep_hex, enrolled_by_default, sort_order)
values ('beginner', 'AI for Everyone', 'Beginner Track', 'Start here.', 70000, 60, '#5BA8A0', '#3F7E78', true, 0);

insert into public.modules (id, track_id, week, name, tagline, sort_order)
values ('beginner:b1', 'beginner', 1, 'Foundations', 'What AI is.', 0);

insert into public.quizzes (id, module_id, title, subtitle, minutes, passing_pct)
values ('33333333-3333-3333-3333-333333333333', 'beginner:b1', 'Foundations Challenge', 'Prove it.', 10, 60);

insert into public.questions (quiz_id, sort_position, type, question_text, options, correct, explain) values
  ('33333333-3333-3333-3333-333333333333', 1, 'mcq', 'What does AI stand for?',
   array['Automatic Internet','Artificial Intelligence','Applied Info','Advanced Imaging'], '1'::jsonb,
   'AI = Artificial Intelligence.'),
  ('33333333-3333-3333-3333-333333333333', 2, 'tf', 'A clearer prompt gives a better answer.',
   null, 'true'::jsonb, 'Yes, always.'),
  ('33333333-3333-3333-3333-333333333333', 3, 'short', 'What do we call the instruction you give an AI?',
   null, '["prompt","a prompt"]'::jsonb, 'The prompt.');

-- ---------------------------------------------------------------------------
-- Test 1: RLS on profiles — Alice can see her own row, not Bob's.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);

select 'TEST 1a: Alice selecting profiles (expect only her own row)' as check;
select id, username from public.profiles;

reset role;

-- ---------------------------------------------------------------------------
-- Test 2: player_stats is readable by anyone authenticated (leaderboard).
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);

select 'TEST 2: Alice selecting player_stats (expect BOTH rows - leaderboard)' as check;
select display_name, xp from public.player_stats order by display_name;

reset role;

-- ---------------------------------------------------------------------------
-- Test 3: direct select on `questions` must be denied (no policy for authenticated).
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);

select 'TEST 3: direct select on questions (expect ERROR: permission denied)' as check;
do $$
begin
  begin
    perform * from public.questions limit 1;
    raise notice 'FAIL: query succeeded, should have been denied';
  exception when insufficient_privilege then
    raise notice 'PASS: permission denied as expected';
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 4: get_quiz_questions() returns rows WITHOUT correct/explain.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);

select 'TEST 4: get_quiz_questions (expect 3 rows, no correct/explain columns)' as check;
select * from public.get_quiz_questions('33333333-3333-3333-3333-333333333333');

reset role;

-- ---------------------------------------------------------------------------
-- Test 5: submit_quiz_attempt grades correctly, updates enrollment + xp.
-- Alice answers: Q1 correct (index 1), Q2 correct (true), Q3 wrong ("banana").
-- Expect: 2/3 correct = 67% >= 60% passing => passed = true.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);

select 'TEST 5: submit_quiz_attempt result (expect 2/3, 67%, passed=true)' as check;
select public.submit_quiz_attempt(
  '33333333-3333-3333-3333-333333333333'::uuid,
  '[{"type":"mcq","value":1}, {"type":"tf","value":true}, {"type":"short","value":"banana"}]'::jsonb
);

select 'TEST 5b: enrollment progress after pass (expect progress=1)' as check;
select track_id, progress from public.enrollments where user_id = '11111111-1111-1111-1111-111111111111';

select 'TEST 5c: player_stats xp after pass (expect xp=500)' as check;
select xp, coins from public.player_stats where user_id = '11111111-1111-1111-1111-111111111111';

select 'TEST 5d: Bob cannot see Alice quiz_attempts (RLS)' as check;
select set_config('test.current_user_id', '22222222-2222-2222-2222-222222222222', false);
select count(*) as bob_visible_attempts from public.quiz_attempts;

reset role;

-- ---------------------------------------------------------------------------
-- Test 6: complete_lesson advances progress and awards xp/coins for Bob.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '22222222-2222-2222-2222-222222222222', false);

select 'TEST 6: complete_lesson for Bob' as check;
select public.complete_lesson('beginner');

select 'TEST 6b: Bob enrollment + stats after completing a lesson' as check;
select progress from public.enrollments where user_id = '22222222-2222-2222-2222-222222222222';
select xp, coins from public.player_stats where user_id = '22222222-2222-2222-2222-222222222222';

reset role;

-- ---------------------------------------------------------------------------
-- Test 7: privilege escalation via profiles.role must be blocked.
-- A signed-in user's own update should succeed for ordinary columns (bio)
-- but silently fail to change role/email — see
-- protect_profile_privileged_columns() in schema.sql.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);
select set_config('test.current_role', 'authenticated', false);

select 'TEST 7a: role before attack (expect student)' as check;
select role from public.profiles where id = '11111111-1111-1111-1111-111111111111';

update public.profiles set role = 'admin', bio = 'attempted escalation'
  where id = '11111111-1111-1111-1111-111111111111';

select 'TEST 7b: after a normal user tries to self-promote (expect role=student, bio=attempted escalation)' as check;
select role, bio from public.profiles where id = '11111111-1111-1111-1111-111111111111';

reset role;

select 'TEST 7c: a real service_role write DOES change role (expect admin)' as check;
select set_config('test.current_role', 'service_role', false);
update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
select role from public.profiles where id = '11111111-1111-1111-1111-111111111111';
select set_config('test.current_role', 'authenticated', false); -- reset for tests below

-- ---------------------------------------------------------------------------
-- Test 8: enroll_in_track creates an explicit progress=0 row (onboarding).
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '22222222-2222-2222-2222-222222222222', false);

select 'TEST 8: enroll_in_track for Bob on beginner, before any activity (expect progress=0 row)' as check;
select public.enroll_in_track('beginner');
select track_id, progress from public.enrollments
  where user_id = '22222222-2222-2222-2222-222222222222' and track_id = 'beginner';

reset role;

-- ---------------------------------------------------------------------------
-- Test 9: complete_lesson records the REAL elapsed minutes passed in, not a
-- hardcoded value.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '22222222-2222-2222-2222-222222222222', false);

select 'TEST 9: complete_lesson(beginner, 7) (expect study_log minutes to include +7)' as check;
select public.complete_lesson('beginner', 7);
select minutes from public.study_log
  where user_id = '22222222-2222-2222-2222-222222222222' and study_date = current_date;

reset role;

-- ---------------------------------------------------------------------------
-- Test 10: admin_list_learners / admin_list_enrollments deny non-admins and
-- work for real admins. (Alice's role was flipped to admin in Test 7c above
-- via simulated service_role — reusing her as the admin here.)
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '22222222-2222-2222-2222-222222222222', false); -- Bob = student

select 'TEST 10a: Bob (student) calling admin_list_learners (expect denial)' as check;
do $$
begin
  begin
    perform * from public.admin_list_learners();
    raise notice 'FAIL: student was able to call admin_list_learners';
  exception when others then
    if sqlerrm = 'Admin access required' then
      raise notice 'PASS: correctly denied';
    else
      raise notice 'FAIL (wrong reason): %', sqlerrm;
    end if;
  end;
end $$;

reset role;

set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false); -- Alice = admin (Test 7c)

select 'TEST 10b: Alice (admin) calling admin_list_learners (expect 2 rows)' as check;
select display_name, role from public.admin_list_learners();

select 'TEST 10c: Alice (admin) calling admin_list_enrollments (expect rows for both users)' as check;
select * from public.admin_list_enrollments();

reset role;

-- ---------------------------------------------------------------------------
-- Test 11: Battle Trial — real-time per-question play, and specifically
-- the anti-brute-force lock: a wrong first guess must NOT be overwritable
-- by a later, correct guess on the same question within the same session.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);

do $$
declare
  v_session_id uuid;
  v_result jsonb;
  v_q1_id uuid;
begin
  v_result := public.battle_start('33333333-3333-3333-3333-333333333333');
  v_session_id := (v_result ->> 'session_id')::uuid;
  if jsonb_array_length(v_result -> 'questions') <> 3 then
    raise notice 'FAIL: expected 3 answer-free questions, got %', jsonb_array_length(v_result -> 'questions');
  else
    raise notice 'PASS: battle_start returned 3 answer-free questions';
  end if;

  select (q ->> 'id')::uuid into v_q1_id
  from jsonb_array_elements(v_result -> 'questions') q
  where (q ->> 'sort_position')::int = 1;

  v_result := public.battle_answer(v_session_id, v_q1_id, '0'::jsonb);
  if (v_result ->> 'ok')::boolean <> false then
    raise notice 'FAIL: expected first (wrong) guess to be marked incorrect';
  end if;

  v_result := public.battle_answer(v_session_id, v_q1_id, '1'::jsonb);
  if (v_result ->> 'ok')::boolean = true or (v_result ->> 'already_answered')::boolean <> true then
    raise notice 'FAIL: a later correct guess on the same question was NOT locked out — brute-force protection broken';
  else
    raise notice 'PASS: second guess on the same question locked to the first (wrong) result, not re-graded';
  end if;
end $$;

reset role;

-- Test 12: a finished session rejects further answers; another user cannot
-- touch a session that isn't theirs, even knowing the exact session id.
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);

do $$
declare
  v_session_id uuid;
  v_start_result jsonb;
  v_q2_id uuid;
  v_q3_id uuid;
begin
  v_start_result := public.battle_start('33333333-3333-3333-3333-333333333333');
  v_session_id := (v_start_result ->> 'session_id')::uuid;

  select (q ->> 'id')::uuid into v_q2_id
  from jsonb_array_elements(v_start_result -> 'questions') q
  where (q ->> 'sort_position')::int = 2;
  select (q ->> 'id')::uuid into v_q3_id
  from jsonb_array_elements(v_start_result -> 'questions') q
  where (q ->> 'sort_position')::int = 3;

  perform public.battle_answer(v_session_id, v_q2_id, 'true'::jsonb);
  perform public.battle_finish(v_session_id);

  begin
    perform public.battle_answer(v_session_id, v_q3_id, '"prompt"'::jsonb);
    raise notice 'FAIL: battle_answer succeeded on a finished session';
  exception when others then
    raise notice 'PASS: finished session correctly rejects further answers';
  end;
end $$;

reset role;


-- ---------------------------------------------------------------------------
-- Test 13: CRITICAL — Postgres grants EXECUTE to PUBLIC on every new
-- function by default (unlike tables). A function with no explicit grant
-- statement is NOT automatically private — this is a real bug found and
-- fixed in this exact codebase: grade_single_answer() was callable
-- directly by any signed-in client, handing back the answer key for free,
-- completely bypassing the write-once lock in battle_answer() and the
-- batch grading in submit_quiz_attempt(). Both grade_single_answer() and
-- confirm_track_purchase() now have explicit `revoke ... from public`
-- statements — this test exists so that pattern can never silently
-- regress if someone adds a new "internal-only" helper later without
-- remembering the revoke.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);

do $$
declare
  v_quiz_id uuid;
  v_question_id uuid;
  v_questions jsonb;
begin
  select id into v_quiz_id from public.quizzes where module_id = 'beginner:b1' limit 1;
  v_questions := to_jsonb(array(select public.get_quiz_questions(v_quiz_id)));
  v_question_id := (v_questions -> 0 ->> 'id')::uuid;

  begin
    perform public.grade_single_answer(v_question_id, '0'::jsonb);
    raise notice 'FAIL: grade_single_answer is directly callable — anti-cheat bypass regressed';
  exception when others then
    raise notice 'PASS: grade_single_answer correctly blocked from direct client calls';
  end;

  begin
    perform public.confirm_track_purchase('ANY-REF', 'success', 'any-id');
    raise notice 'FAIL: confirm_track_purchase is directly callable by a normal user — payment bypass regressed';
  exception when others then
    raise notice 'PASS: confirm_track_purchase correctly blocked from direct client calls';
  end;
end $$;

reset role;

-- Test 14: the legitimate path must still work after both revokes — a
-- real signed-in user completing a real quiz attempt end to end.
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);

do $$
declare
  v_quiz_id uuid;
  v_result jsonb;
begin
  select id into v_quiz_id from public.quizzes where module_id = 'beginner:b1' limit 1;
  v_result := public.submit_quiz_attempt(v_quiz_id,
    '[{"type":"mcq","value":1}, {"type":"tf","value":true}, {"type":"short","value":"prompt"}]'::jsonb);
  if (v_result ->> 'passed')::boolean then
    raise notice 'PASS: submit_quiz_attempt still works correctly through the internal grade_single_answer() call';
  else
    raise notice 'FAIL: submit_quiz_attempt broke after the revoke — %', v_result;
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Test 15: Flashcard Duels — full 1v1 lifecycle via friend-invite code,
-- covering two real bugs found during initial development:
--   (a) an infinite-recursion RLS policy on duel_participants that
--       self-referenced the same table it was protecting — fixed via a
--       security definer helper function instead.
--   (b) submit_duel_answer() advancing progress on a REPEAT submission
--       of an already-answered question, which could finish a duel after
--       too few genuine answers — fixed by returning early on a repeat,
--       before any progress/completion logic runs.
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);

do $$
declare
  v_result jsonb;
  v_room_id uuid;
  v_code text;
  v_quiz_id uuid;
  v_q1 uuid;
  v_q2 uuid;
  v_q3 uuid;
begin
  select id into v_quiz_id from public.quizzes where module_id = 'beginner:b1' limit 1;
  select (q ->> 'id')::uuid into v_q1 from jsonb_array_elements(
    to_jsonb(array(select public.get_quiz_questions(v_quiz_id)))
  ) q where (q ->> 'sort_position')::int = 1;
  select (q ->> 'id')::uuid into v_q2 from jsonb_array_elements(
    to_jsonb(array(select public.get_quiz_questions(v_quiz_id)))
  ) q where (q ->> 'sort_position')::int = 2;
  select (q ->> 'id')::uuid into v_q3 from jsonb_array_elements(
    to_jsonb(array(select public.get_quiz_questions(v_quiz_id)))
  ) q where (q ->> 'sort_position')::int = 3;

  v_result := public.create_duel_room('1v1', v_quiz_id);
  v_room_id := (v_result ->> 'room_id')::uuid;
  v_code := v_result ->> 'invite_code';
  raise notice 'PASS: create_duel_room returned a real room and invite code';

  perform set_config('test.duel_room_id', v_room_id::text, false);
  perform set_config('test.duel_code', v_code, false);
  perform set_config('test.duel_q1', v_q1::text, false);
  perform set_config('test.duel_q2', v_q2::text, false);
  perform set_config('test.duel_q3', v_q3::text, false);
end $$;

reset role;
set role authenticated;
select set_config('test.current_user_id', '22222222-2222-2222-2222-222222222222', false);

do $$
declare
  v_room_id uuid := current_setting('test.duel_room_id')::uuid;
  v_code text := current_setting('test.duel_code');
  v_q1 uuid := current_setting('test.duel_q1')::uuid;
  v_q2 uuid := current_setting('test.duel_q2')::uuid;
  v_q3 uuid := current_setting('test.duel_q3')::uuid;
  v_result jsonb;
  v_room_status text;
begin
  v_result := public.join_duel_room(v_code);
  select status into v_room_status from public.duel_rooms where id = v_room_id;
  if v_room_status = 'active' then
    raise notice 'PASS: room activates once the 1v1 pair is full';
  else
    raise notice 'FAIL: room did not activate — status is %', v_room_status;
  end if;

  -- Regression test for bug (b): wrong first, then retry with the
  -- correct answer for the SAME question, must not falsely finish.
  v_result := public.submit_duel_answer(v_room_id, v_q1, '0'::jsonb);
  v_result := public.submit_duel_answer(v_room_id, v_q1, '999'::jsonb);
  if (v_result ->> 'already_answered')::boolean and not (v_result ->> 'finished')::boolean then
    raise notice 'PASS: repeat submission locked to first result, did not falsely advance/finish';
  else
    raise notice 'FAIL: repeat submission regression reappeared — %', v_result;
  end if;

  v_result := public.submit_duel_answer(v_room_id, v_q2, 'true'::jsonb);
  v_result := public.submit_duel_answer(v_room_id, v_q3, '"prompt"'::jsonb);
  if (v_result ->> 'finished')::boolean then
    raise notice 'PASS: genuinely finishes only after all real questions answered';
  else
    raise notice 'FAIL: did not finish after answering every real question — %', v_result;
  end if;
end $$;

reset role;

-- Test 16: RLS regression for bug (a) — a participant sees their
-- opponent's live progress in a shared room, but a total stranger sees
-- nothing from that same room.
set role authenticated;
select set_config('test.current_user_id', '11111111-1111-1111-1111-111111111111', false);

do $$
declare
  v_room_id uuid := current_setting('test.duel_room_id')::uuid;
  v_count integer;
begin
  select count(*) into v_count from public.duel_participants where room_id = v_room_id;
  if v_count = 2 then
    raise notice 'PASS: a participant sees both rows in their own room (no recursion error, live opponent visibility works)';
  else
    raise notice 'FAIL: expected 2 visible participant rows, got %', v_count;
  end if;
end $$;

reset role;

set role authenticated;
select set_config('test.current_user_id', '33333333-3333-3333-3333-333333333333', false);

do $$
declare
  v_room_id uuid := current_setting('test.duel_room_id')::uuid;
  v_count integer;
begin
  select count(*) into v_count from public.duel_participants where room_id = v_room_id;
  if v_count = 0 then
    raise notice 'PASS: a non-participant sees zero rows from someone else''s duel';
  else
    raise notice 'FAIL: a non-participant could see % rows from a duel they are not in', v_count;
  end if;
end $$;

reset role;
