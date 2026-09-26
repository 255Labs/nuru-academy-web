-- ============================================================================
-- NURU GEM SHOP — DATABASE SCHEMA
-- ============================================================================
--
-- STATUS: COMMENTED OUT / FOUNDATION ONLY
-- Run this in Supabase SQL Editor ONLY when activating the gem shop.
-- Safe to run multiple times (idempotent).
--
-- TABLES
--   gem_inventory    — what each user owns and what is equipped
--   gem_purchases    — full purchase history (audit log)
--   gem_boosters     — active XP booster records with expiry timestamps
--
-- FUNCTIONS
--   gem_purchase_item(item_id, gem_cost, category, effect)
--     Atomically deducts gems from player_stats and records the purchase.
--     Called by the Next.js API route, not the client directly.
--
--   gem_equip_item(item_id, category)
--     Unequips all items in the same category then equips the target item.
--
--   gem_use_life(user_id)
--     Decrements life count by 1. Returns false if no lives left.
--
-- ============================================================================

/*

-- ── gem_inventory ─────────────────────────────────────────────────────────────

create table if not exists public.gem_inventory (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_id      text not null,                  -- matches GemItem.id in gems.ts
  category     text not null,                  -- skin | map | level | life | booster
  quantity     integer not null default 1,     -- for stackable items (lives, boosters)
  equipped_at  timestamptz,                    -- null = not equipped
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (user_id, item_id)
);

alter table public.gem_inventory enable row level security;

drop policy if exists "Users view own inventory"  on public.gem_inventory;
create policy "Users view own inventory"
  on public.gem_inventory for select
  using (auth.uid() = user_id);

drop policy if exists "Users update own inventory" on public.gem_inventory;
create policy "Users update own inventory"
  on public.gem_inventory for update
  using (auth.uid() = user_id);

-- ── gem_purchases ─────────────────────────────────────────────────────────────

create table if not exists public.gem_purchases (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_id      text not null,
  gem_cost     integer not null,
  purchased_at timestamptz not null default now()
);

alter table public.gem_purchases enable row level security;

drop policy if exists "Users view own purchases" on public.gem_purchases;
create policy "Users view own purchases"
  on public.gem_purchases for select
  using (auth.uid() = user_id);

-- ── gem_boosters ──────────────────────────────────────────────────────────────

create table if not exists public.gem_boosters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null,
  multiplier  integer not null default 2,
  activated_at timestamptz not null default now(),
  expires_at  timestamptz not null
);

alter table public.gem_boosters enable row level security;

drop policy if exists "Users view own boosters" on public.gem_boosters;
create policy "Users view own boosters"
  on public.gem_boosters for select
  using (auth.uid() = user_id);

-- ── gem_purchase_item() ───────────────────────────────────────────────────────

create or replace function public.gem_purchase_item(
  p_item_id    text,
  p_gem_cost   integer,
  p_category   text,
  p_effect     jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_gems integer;
  v_effect_type  text;
  v_effect_value integer;
  v_duration_hrs integer;
  v_expires_at   timestamptz;
begin
  -- Lock and check gem balance
  select gems into v_current_gems
  from public.player_stats
  where user_id = auth.uid()
  for update;

  if v_current_gems is null then
    raise exception 'Player stats not found';
  end if;

  if v_current_gems < p_gem_cost then
    raise exception 'Insufficient gems — have %, need %', v_current_gems, p_gem_cost;
  end if;

  -- Deduct gems
  update public.player_stats
  set gems = gems - p_gem_cost,
      updated_at = now()
  where user_id = auth.uid();

  -- Record purchase
  insert into public.gem_purchases (user_id, item_id, gem_cost)
  values (auth.uid(), p_item_id, p_gem_cost);

  -- Upsert inventory
  insert into public.gem_inventory (user_id, item_id, category, quantity)
  values (auth.uid(), p_item_id, p_category, 1)
  on conflict (user_id, item_id)
  do update set
    quantity   = gem_inventory.quantity + 1,
    updated_at = now();

  -- Handle consumable effects
  if p_effect is not null then
    v_effect_type  := p_effect->>'type';
    v_effect_value := (p_effect->>'value')::integer;

    -- XP booster — insert active booster record
    if v_effect_type = 'xp_boost' then
      v_duration_hrs := coalesce((p_effect->>'durationHours')::integer, 24);
      v_expires_at   := now() + (v_duration_hrs || ' hours')::interval;

      insert into public.gem_boosters (user_id, item_id, multiplier, expires_at)
      values (auth.uid(), p_item_id, v_effect_value, v_expires_at);
    end if;
  end if;

end;
$$;

grant execute on function public.gem_purchase_item(text, integer, text, jsonb) to authenticated;

-- ── gem_equip_item() ──────────────────────────────────────────────────────────

create or replace function public.gem_equip_item(
  p_item_id  text,
  p_category text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Unequip all in same category
  update public.gem_inventory
  set equipped_at = null, updated_at = now()
  where user_id = auth.uid()
    and category = p_category
    and equipped_at is not null;

  -- Equip target (or unequip if already equipped — toggle)
  update public.gem_inventory
  set equipped_at = case
        when equipped_at is null then now()
        else null
      end,
      updated_at = now()
  where user_id  = auth.uid()
    and item_id  = p_item_id;
end;
$$;

grant execute on function public.gem_equip_item(text, text) to authenticated;

-- ── gem_use_life() ────────────────────────────────────────────────────────────

create or replace function public.gem_use_life(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_lives integer;
begin
  -- Count total life items
  select coalesce(sum(quantity), 0)
  into v_total_lives
  from public.gem_inventory
  where user_id = auth.uid()
    and category = 'life';

  if v_total_lives <= 0 then
    return false;
  end if;

  -- Decrement life from the first life item found
  update public.gem_inventory
  set quantity   = quantity - 1,
      updated_at = now()
  where id = (
    select id from public.gem_inventory
    where user_id  = auth.uid()
      and category = 'life'
      and quantity > 0
    limit 1
  );

  -- Clean up zero-quantity rows
  delete from public.gem_inventory
  where user_id  = auth.uid()
    and category = 'life'
    and quantity <= 0;

  return true;
end;
$$;

grant execute on function public.gem_use_life(uuid) to authenticated;

-- ── gem_admin_grant() — for admin to manually grant gems ─────────────────────

create or replace function public.gem_admin_grant(
  p_user_id  uuid,
  p_amount   integer,
  p_reason   text default 'admin_grant'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Admin only';
  end if;

  update public.player_stats
  set gems       = gems + p_amount,
      updated_at = now()
  where user_id  = p_user_id;
end;
$$;

grant execute on function public.gem_admin_grant(uuid, integer, text) to authenticated;

*/
-- ============================================================================
-- END OF GEM SHOP SCHEMA — uncomment above block to activate
-- ============================================================================
