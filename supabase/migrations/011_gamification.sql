-- ============================================================================
-- Migration 011: Gamification — streaks, daily quests, XP rewards
-- Dependencies: 001_core_auth, 003_progress, 004_achievements
-- ============================================================================
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


