-- ============================================================================
-- Migration 012: Admin panel — CRUD functions for learners, certs, events
-- Dependencies: all previous migrations
-- ============================================================================
-- ============================================================================
-- ADMIN PANEL EXPANSION: Full CRUD for lessons, users, certificates, events
-- ============================================================================

-- Admin: create or update a lesson in the DB
create or replace function public.admin_upsert_lesson(
  p_module_id    text,
  p_day          integer,
  p_title        text,
  p_objective    text,
  p_block1_topic text,
  p_block1_pts   jsonb,  -- ["point1","point2",...]
  p_block2_topic text,
  p_block2_pts   jsonb,
  p_demo         text default null,
  p_homework     text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  insert into public.lessons
    (module_id, day, title, objective, block1_topic, block1_pts, block2_topic, block2_pts, demo, homework)
  values
    (p_module_id, p_day, p_title, p_objective, p_block1_topic, p_block1_pts, p_block2_topic, p_block2_pts, p_demo, p_homework)
  on conflict (module_id, day) do update set
    title        = excluded.title,
    objective    = excluded.objective,
    block1_topic = excluded.block1_topic,
    block1_pts   = excluded.block1_pts,
    block2_topic = excluded.block2_topic,
    block2_pts   = excluded.block2_pts,
    demo         = excluded.demo,
    homework     = excluded.homework
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.admin_upsert_lesson(text,integer,text,text,text,jsonb,text,jsonb,text,text) to authenticated;

-- Admin: delete a user account (cascades to all their data)
create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot delete your own account';
  end if;
  -- Remove from auth.users — cascades to all public tables via FK
  delete from auth.users where id = p_user_id;
end;
$$;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- Admin: create a certificate for any user on any track
create or replace function public.admin_issue_certificate(
  p_user_id  uuid,
  p_track_id text
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_name  text;
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  select coalesce(display_name, username, email) into v_name
  from public.profiles where id = p_user_id;
  v_token := encode(gen_random_bytes(24), 'base64url');
  insert into public.certificates (user_id, track_id, display_name, verify_token)
  values (p_user_id, p_track_id, v_name, v_token)
  on conflict (user_id, track_id) do update
    set verify_token = v_token, issued_at = now();
  return v_token;
end;
$$;
grant execute on function public.admin_issue_certificate(uuid, text) to authenticated;

-- Admin: list all learners (extended with new onboarding fields)
create or replace function public.admin_list_learners()
returns table (
  user_id      uuid,
  display_name text,
  username     text,
  email        text,
  phone_number text,
  country      text,
  city         text,
  xp           integer,
  level        integer,
  coins        integer,
  role         text,
  suspended    boolean,
  onboarding_complete boolean,
  joined_at    timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  return query
  select
    p.id,
    coalesce(p.display_name, ps.display_name) as display_name,
    p.username,
    p.email,
    p.phone_number,
    p.country,
    p.city,
    ps.xp,
    ps.level,
    ps.coins,
    p.role,
    p.suspended,
    p.onboarding_complete,
    p.created_at
  from public.profiles p
  join public.player_stats ps on ps.user_id = p.id
  order by p.created_at desc;
end;
$$;
grant execute on function public.admin_list_learners() to authenticated;


