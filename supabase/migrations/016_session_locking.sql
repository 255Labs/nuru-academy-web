-- ============================================================================
-- Migration 016: Session locking — one active session per user, admin force-logout
-- Dependencies: 001_core_auth
-- ============================================================================
-- ============================================================================
-- SESSION LOCKING — ONE ACTIVE SESSION PER USER
-- ============================================================================
-- Ensures only one device can be logged in at a time per account.
-- When a new login occurs, the previous session token is replaced,
-- kicking out any other device immediately on their next request.

create table if not exists public.user_sessions (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  session_token text not null,           -- matches Supabase JWT jti claim
  device_hint   text,                    -- e.g. "Chrome on Windows" for admin visibility
  ip_address    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

alter table public.user_sessions enable row level security;

drop policy if exists "Users view own session" on public.user_sessions;
create policy "Users view own session"
  on public.user_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users upsert own session" on public.user_sessions;
create policy "Users upsert own session"
  on public.user_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin can view all sessions
drop policy if exists "Admins view all sessions" on public.user_sessions;
create policy "Admins view all sessions"
  on public.user_sessions for select
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Admin can delete (force-logout) any session
drop policy if exists "Admins delete sessions" on public.user_sessions;
create policy "Admins delete sessions"
  on public.user_sessions for delete
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Register or replace session — called on every login
create or replace function public.upsert_session(
  p_session_token text,
  p_device_hint   text default null,
  p_ip_address    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_sessions (user_id, session_token, device_hint, ip_address)
  values (auth.uid(), p_session_token, p_device_hint, p_ip_address)
  on conflict (user_id) do update set
    session_token = excluded.session_token,
    device_hint   = excluded.device_hint,
    ip_address    = excluded.ip_address,
    created_at    = now(),
    last_seen_at  = now();
end;
$$;

grant execute on function public.upsert_session(text, text, text) to authenticated;

-- Validate session — returns true if token matches stored token
create or replace function public.validate_session(p_session_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stored_token text;
begin
  select session_token into v_stored_token
  from public.user_sessions
  where user_id = auth.uid();

  if v_stored_token is null then
    return false;
  end if;

  -- Update last_seen if valid
  if v_stored_token = p_session_token then
    update public.user_sessions
    set last_seen_at = now()
    where user_id = auth.uid();
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.validate_session(text) to authenticated;

-- Admin: list all active sessions
create or replace function public.admin_list_sessions()
returns table (
  user_id      uuid,
  display_name text,
  email        text,
  device_hint  text,
  ip_address   text,
  created_at   timestamptz,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin only';
  end if;

  return query
  select
    us.user_id,
    ps.display_name,
    p.email,
    us.device_hint,
    us.ip_address,
    us.created_at,
    us.last_seen_at
  from public.user_sessions us
  join public.profiles p  on p.id  = us.user_id
  left join public.player_stats ps on ps.user_id = us.user_id
  order by us.last_seen_at desc;
end;
$$;

grant execute on function public.admin_list_sessions() to authenticated;

-- Admin: force-logout a user
create or replace function public.admin_force_logout(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin only';
  end if;
  delete from public.user_sessions where user_id = p_user_id;
end;
$$;

grant execute on function public.admin_force_logout(uuid) to authenticated;
