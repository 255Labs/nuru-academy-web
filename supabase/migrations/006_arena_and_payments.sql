-- ============================================================================
-- Migration 006: Arena — battle_sessions, battle_answers, complete_lesson, payments
-- Dependencies: 001_core_auth, 002_curriculum, 003_progress
-- ============================================================================
-- 8. complete_lesson — advances enrollment progress for a plain lesson node
--    (not gated by a quiz), awarding the standard +100 XP / +50 coins.
--    p_minutes defaults to 30 for backward compatibility with older
--    clients, but the Level Player now passes the real elapsed time.
-- ---------------------------------------------------------------------------
drop function if exists public.complete_lesson(text);

create or replace function public.complete_lesson(p_track_id text, p_minutes integer default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_minutes integer := greatest(1, least(coalesce(p_minutes, 30), 180)); -- clamp 1..180
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.enrollments (user_id, track_id, progress)
  values (v_user_id, p_track_id, 1)
  on conflict (user_id, track_id)
  do update set progress = public.enrollments.progress + 1;

  update public.player_stats
  set xp = xp + 100, coins = coins + 50, updated_at = now()
  where user_id = v_user_id;

  insert into public.study_log (user_id, study_date, minutes)
  values (v_user_id, current_date, v_minutes)
  on conflict (user_id, study_date)
  do update set minutes = public.study_log.minutes + v_minutes;
end;
$$;

grant execute on function public.complete_lesson(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 8b. enroll_in_track — explicit "I choose this track" action for
--     onboarding. Lesson/quiz completion already creates an enrollment row
--     implicitly (see complete_lesson/submit_quiz_attempt's upserts), but a
--     real onboarding flow needs to show a track as "enrolled" the moment a
--     user picks it — before they've done anything inside it.
-- ---------------------------------------------------------------------------
create or replace function public.enroll_in_track(p_track_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.tracks where id = p_track_id) then
    raise exception 'Unknown track: %', p_track_id;
  end if;

  insert into public.enrollments (user_id, track_id, progress)
  values (v_user_id, p_track_id, 0)
  on conflict (user_id, track_id) do nothing;
end;
$$;

grant execute on function public.enroll_in_track(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8c. admin_list_learners — the admin roster query. RLS scopes every table
--     above to "your own rows," which is correct for normal users but means
--     even a real admin's own client-side select only ever returns their
--     own row. This function self-checks the caller's role before
--     returning anything, so it's safe to grant broadly to `authenticated`
--     — a non-admin calling it gets an error, not data.
-- ---------------------------------------------------------------------------

grant execute on function public.admin_list_learners() to authenticated;

-- ---------------------------------------------------------------------------
-- 8d. admin_list_enrollments — per-user, per-track progress, for the admin
--     roster's "which track / how far along" column. Same self-check
--     pattern as admin_list_learners().
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_enrollments()
returns table (user_id uuid, track_id text, progress integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select profiles.role from public.profiles where profiles.id = auth.uid()) is distinct from 'admin' then
    raise exception 'Admin access required';
  end if;

  return query select e.user_id, e.track_id, e.progress from public.enrollments e;
end;
$$;

grant execute on function public.admin_list_enrollments() to authenticated;

-- ---------------------------------------------------------------------------
-- Payments (ClickPesa) — a real "pay to unlock a track directly" path,
-- separate from the free progression gate (isTrackUnlocked() in
-- src/lib/store.ts, which checks whether the prerequisite track's
-- Emberfall was passed). A track is unlocked if EITHER is true.
--
-- The actual HTTPS call to ClickPesa happens in the Next.js API route
-- (src/lib/clickpesa.ts) — Postgres can't make outbound calls to a
-- payment gateway safely from inside a function. This table only tracks
-- *our own* record of the order, written through two narrow paths:
--   - initiate_track_purchase(): the signed-in user creates their own
--     pending row right before the API route calls ClickPesa.
--   - confirm_track_purchase(): called only by the webhook route using
--     the service-role client, after verifying ClickPesa's checksum —
--     never reachable by a normal signed-in user, by design (no grant to
--     authenticated at all).
-- ---------------------------------------------------------------------------
create table if not exists public.track_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id text not null references public.tracks (id),
  order_reference text not null unique,
  amount_tzs integer not null,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  clickpesa_payment_id text,
  phone_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.track_purchases enable row level security;

-- Read-only to clients (check your own purchase history / current status).
-- Writes go through the two functions below exclusively.
grant select on public.track_purchases to authenticated;

drop policy if exists "Users view their own purchases" on public.track_purchases;
create policy "Users view their own purchases"
  on public.track_purchases for select using (auth.uid() = user_id);

-- initiate_track_purchase — creates a pending order for the caller's own
-- account right before the API route calls ClickPesa. Returns the
-- generated order_reference and the real price (from public.tracks —
-- never trust a client-supplied amount for a payment).
create or replace function public.initiate_track_purchase(p_track_id text, p_phone_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer;
  v_order_reference text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select price_tzs into v_price from public.tracks where id = p_track_id;
  if v_price is null then
    raise exception 'Unknown track: %', p_track_id;
  end if;

  v_order_reference := 'NURU' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.track_purchases (user_id, track_id, order_reference, amount_tzs, phone_number)
  values (v_user_id, p_track_id, v_order_reference, v_price, p_phone_number);

  return jsonb_build_object('order_reference', v_order_reference, 'amount_tzs', v_price);
end;
$$;

grant execute on function public.initiate_track_purchase(text, text) to authenticated;

-- confirm_track_purchase — must NEVER be reachable by a normal signed-in
-- user, only by the webhook route's service-role client after it has
-- already verified ClickPesa's checksum. Two independent layers enforce
-- this (defense in depth, same pattern as protect_profile_privileged_columns
-- above): an internal auth.role() check, AND an explicit revoke of the
-- default PUBLIC execute grant right after creation.
create or replace function public.confirm_track_purchase(
  p_order_reference text, p_status text, p_clickpesa_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if p_status not in ('success', 'failed') then
    raise exception 'Invalid status: %', p_status;
  end if;

  update public.track_purchases
  set status = p_status, clickpesa_payment_id = p_clickpesa_payment_id, updated_at = now()
  where order_reference = p_order_reference and status = 'pending';

  if not found then
    raise exception 'No pending purchase found for order_reference: %', p_order_reference;
  end if;
end;
$$;

revoke all on function public.confirm_track_purchase(text, text, text) from public;


-- ---------------------------------------------------------------------------
-- 9. handle_new_user — auto-create profile + player_stats rows on signup
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
