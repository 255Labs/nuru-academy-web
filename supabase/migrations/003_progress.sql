-- ============================================================================
-- Migration 003: Progress tracking — enrollments, quiz_attempts, study_log
-- Dependencies: 001_core_auth, 002_curriculum
-- ============================================================================
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

