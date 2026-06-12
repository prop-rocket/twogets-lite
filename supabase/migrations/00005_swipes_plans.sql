-- =============================================================================
-- TwoGets — 00005_swipes_plans.sql
-- Swipe-to-find discovery: swipes table, free/plus plans, daily right-swipe
-- quota enforced atomically in the database (cannot be bypassed from a client).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS + PLAN COLUMN
-- ---------------------------------------------------------------------------
create type public.swipe_direction as enum ('left', 'right');
create type public.user_plan as enum ('free', 'plus');

alter table public.users
  add column plan public.user_plan not null default 'free';

-- ---------------------------------------------------------------------------
-- SWIPES
-- One row per (tenant, property). Re-swiping updates direction + swiped_at.
-- swiped_at (not created_at) drives the daily quota so a left→right change
-- counts on the day it happens.
-- ---------------------------------------------------------------------------
create table public.swipes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  direction   public.swipe_direction not null,
  swiped_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (tenant_id, property_id)
);

create index swipes_tenant_idx on public.swipes (tenant_id, swiped_at desc);
create index swipes_tenant_right_idx on public.swipes (tenant_id, swiped_at)
  where direction = 'right';
create index swipes_property_demand_idx on public.swipes (property_id)
  where direction = 'right';

alter table public.swipes enable row level security;

-- Tenants read their own swipe history; admins read all (analytics/moderation).
-- No insert/update/delete policies: all writes go through record_swipe() below,
-- which is SECURITY DEFINER — so the daily quota can't be bypassed via the API.
create policy "swipes_select_own" on public.swipes
  for select using (tenant_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- PLAN IMMUTABILITY
-- Recreate users_update_own so users can't upgrade their own plan via the API.
-- (Plan changes happen through admin moderation / future payment webhooks.)
-- ---------------------------------------------------------------------------
drop policy "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- a user can never change their own role to admin or unban themselves
    and (role is not distinct from (select u.role from public.users u where u.id = auth.uid()) or role in ('tenant', 'homeowner'))
    and is_banned = (select u.is_banned from public.users u where u.id = auth.uid())
    -- a user can never change their own plan
    and plan = (select u.plan from public.users u where u.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- QUOTA HELPERS
-- The free plan allows 3 *new* right swipes per day. Days roll over at
-- midnight IST (Asia/Kolkata) — TwoGets' home market.
-- ---------------------------------------------------------------------------
create or replace function public.ist_day_start()
returns timestamptz
language sql
stable
as $$
  select date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
$$;

create or replace function public.right_swipes_today()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.swipes
   where tenant_id = auth.uid()
     and direction = 'right'
     and swiped_at >= public.ist_day_start();
$$;

-- ---------------------------------------------------------------------------
-- record_swipe — the single write path for swipes.
-- Atomically: checks role/ban/quota, upserts the swipe, and mirrors right
-- swipes into saved_properties (the tenant's shortlist).
-- Returns jsonb: { ok, code?, right_today, remaining } where remaining is
-- null for plus users (unlimited).
-- Codes: auth | role | banned | gone | quota
-- ---------------------------------------------------------------------------
create or replace function public.record_swipe(p_property_id uuid, p_direction public.swipe_direction)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_user        public.users%rowtype;
  v_existing    public.swipes%rowtype;
  v_quota       constant integer := 3;
  v_right_today integer;
  v_consumes    boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'auth');
  end if;

  select * into v_user from public.users where id = v_uid;
  if not found or v_user.role is distinct from 'tenant' then
    return jsonb_build_object('ok', false, 'code', 'role');
  end if;
  if v_user.is_banned then
    return jsonb_build_object('ok', false, 'code', 'banned');
  end if;

  if not exists (
    select 1 from public.properties p where p.id = p_property_id and p.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;

  -- Serialize per-tenant so concurrent requests can't sneak past the quota.
  perform pg_advisory_xact_lock(hashtextextended('twogets.swipe:' || v_uid::text, 0));

  select * into v_existing
    from public.swipes
   where tenant_id = v_uid and property_id = p_property_id;

  -- Only a NEW right swipe consumes quota; re-confirming an existing right
  -- swipe (e.g. after a page reload) is free.
  v_consumes := p_direction = 'right'
    and (v_existing.id is null or v_existing.direction = 'left');

  select count(*)::int into v_right_today
    from public.swipes
   where tenant_id = v_uid
     and direction = 'right'
     and swiped_at >= public.ist_day_start();

  if v_consumes and v_user.plan = 'free' and v_right_today >= v_quota then
    return jsonb_build_object(
      'ok', false, 'code', 'quota',
      'right_today', v_right_today, 'remaining', 0
    );
  end if;

  insert into public.swipes (tenant_id, property_id, direction)
  values (v_uid, p_property_id, p_direction)
  on conflict (tenant_id, property_id)
  do update set direction = excluded.direction, swiped_at = now();

  if p_direction = 'right' then
    insert into public.saved_properties (tenant_id, property_id)
    values (v_uid, p_property_id)
    on conflict do nothing;
  else
    delete from public.saved_properties
     where tenant_id = v_uid and property_id = p_property_id;
  end if;

  -- Recount AFTER the write so the client always gets the live truth
  -- (a left swipe that un-shortlists frees a slot back up).
  select count(*)::int into v_right_today
    from public.swipes
   where tenant_id = v_uid
     and direction = 'right'
     and swiped_at >= public.ist_day_start();

  return jsonb_build_object(
    'ok', true,
    'right_today', v_right_today,
    'remaining', case when v_user.plan = 'plus' then null
                      else greatest(0, v_quota - v_right_today) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Demand signal for owners: how many tenants shortlisted a property.
-- Only the property's owner (or an admin) may ask.
-- ---------------------------------------------------------------------------
create or replace function public.property_right_swipe_count(pid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.owns_property(pid) or public.is_admin() then (
      select count(*)::int from public.swipes
       where property_id = pid and direction = 'right'
    )
    else 0
  end;
$$;
