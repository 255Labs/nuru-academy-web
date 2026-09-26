-- ============================================================================
-- Migration 013: CMS — daily_challenges, lesson_images, cert_templates, full CRUD functions
-- Dependencies: 001_core_auth, 002_curriculum
-- ============================================================================
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


