-- ============================================================================
-- Migration 008: Expanded platform — learner_profiles, mentorship, certificates, USSD competitions, map
-- Dependencies: 001_core_auth, 002_curriculum, 003_progress
-- ============================================================================
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


