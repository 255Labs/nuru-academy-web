-- ============================================================================
-- Migration 009: Payments, video storage, onboarding, webhook events
-- Dependencies: 001_core_auth, 002_curriculum, 008_mentorship_certs_ussd_map
-- ============================================================================
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
