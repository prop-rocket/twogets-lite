-- =============================================================================
-- TwoGets — 00010_dual_mode.sql
--
-- One account can now be BOTH a tenant and a lister (Airbnb-style modes).
--
-- Model: hosting is an opt-in CAPABILITY, not an exclusive role. Anyone who
-- isn't an admin can rent; `can_host` additionally lets you list. `users.role`
-- survives only as (a) the admin gate and (b) the signup designation that seeds
-- can_host — it no longer authorizes tenant/lister actions.
--
-- Also closes four security holes. Three of them (self-review, self-booking,
-- self-swipe) are unreachable TODAY only because roles are mutually exclusive;
-- they open the moment one account can be both sides, so they must close here.
-- The fourth (self-awarded verification) is live right now and unrelated to
-- dual-mode — it rides along because it lives in a policy this migration has to
-- recreate anyway.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CAPABILITY
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists can_host boolean not null default false;

-- Everyone who signed up as a homeowner keeps listing without re-opting in.
update public.users set can_host = true where role = 'homeowner' and not can_host;

create index if not exists users_can_host_idx on public.users (can_host) where can_host;

comment on column public.users.can_host is
  'Opt-in ability to publish listings. Anyone non-admin can rent; this adds the lister side.';

-- Security definer so policies can call them without recursing through
-- users'' own RLS (same technique as is_admin()).
create or replace function public.can_host()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
     where id = auth.uid() and can_host and not is_banned
  );
$$;

create or replace function public.can_travel()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
     where id = auth.uid() and role is distinct from 'admin' and not is_banned
  );
$$;

-- ---------------------------------------------------------------------------
-- RE-POINT THE ROLE GATES
-- ---------------------------------------------------------------------------

-- Listing creation: was current_user_role() = 'homeowner'
drop policy if exists "properties_insert_own" on public.properties;
create policy "properties_insert_own" on public.properties
  for insert with check (owner_id = auth.uid() and public.can_host());

-- Listing photo upload: was current_user_role() in ('homeowner','admin')
drop policy if exists "property_media_insert" on storage.objects;
create policy "property_media_insert" on storage.objects
  for insert with check (
    bucket_id = 'property-media'
    and auth.uid()::text = (storage.foldername(name))[1]
    and (public.can_host() or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- SECURITY: stop users awarding themselves verification and trust
--
-- users_update_own only ever PINNED role/is_banned/plan, leaving is_verified
-- and trust_score freely self-writable over the REST API. Both columns are
-- written exclusively by security-definer triggers (recalc_trust_score,
-- handle_verification_review), so pinning them breaks no legitimate path.
-- Users still freely edit full_name, phone, avatar_url and can_host.
-- ---------------------------------------------------------------------------
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- never promote yourself to admin
    and (role is not distinct from (select u.role from public.users u where u.id = auth.uid())
         or role in ('tenant', 'homeowner'))
    -- never unban yourself, change your own plan, or forge trust signals
    and is_banned   = (select u.is_banned   from public.users u where u.id = auth.uid())
    and plan        = (select u.plan        from public.users u where u.id = auth.uid())
    and is_verified = (select u.is_verified from public.users u where u.id = auth.uid())
    and trust_score = (select u.trust_score from public.users u where u.id = auth.uid())
    and email       = (select u.email       from public.users u where u.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- SELF-DEALING #1 — reviewing yourself
--
-- The old predicate passed when booking.tenant_id = slot.owner_id = auth.uid():
-- both disjuncts held with reviewee_id = auth.uid(). Pair each side with the
-- OPPOSITE party so reviewer and reviewee can never be the same person.
-- ---------------------------------------------------------------------------
drop policy if exists "reviews_insert_participant" on public.reviews;
create policy "reviews_insert_participant" on public.reviews
  for insert with check (
    reviewer_id = auth.uid()
    and reviewee_id <> auth.uid()
    and booking_id is not null
    and exists (
      select 1 from public.viewing_bookings b
      join public.viewing_slots s on s.id = b.slot_id
      where b.id = booking_id
        and b.status = 'attended'
        and b.tenant_id <> s.owner_id
        and ((b.tenant_id = auth.uid() and s.owner_id = reviewee_id)
          or (s.owner_id  = auth.uid() and b.tenant_id = reviewee_id))
    )
  );

-- Belt and braces at the table level. Verified against live data: zero
-- existing rows violate this, so it validates immediately.
alter table public.reviews drop constraint if exists reviews_no_self_review;
alter table public.reviews
  add constraint reviews_no_self_review check (reviewer_id <> reviewee_id);

-- ---------------------------------------------------------------------------
-- SELF-DEALING #2 — booking your own viewing slot
-- ---------------------------------------------------------------------------
create or replace function public.book_viewing_slot(p_slot_id uuid, p_party_size int default 1, p_note text default null)
returns public.viewing_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.viewing_slots%rowtype;
  v_user public.users%rowtype;
  taken int;
  v_tenant uuid := auth.uid();
  result public.viewing_bookings%rowtype;
begin
  if v_tenant is null then raise exception 'Must be signed in to book'; end if;

  select * into v_user from public.users where id = v_tenant;
  if not found or v_user.role = 'admin' then
    raise exception 'Only renters can book viewings';
  end if;
  if v_user.is_banned then raise exception 'Account suspended'; end if;

  select * into s from public.viewing_slots where id = p_slot_id for update;
  if not found then raise exception 'Slot not found'; end if;
  if s.owner_id = v_tenant then raise exception 'You cannot book your own viewing slot'; end if;
  if s.status <> 'open' then raise exception 'Slot is not open'; end if;
  if s.starts_at <= now() then raise exception 'Slot is in the past'; end if;

  if s.capacity is not null then
    select count(*) into taken from public.viewing_bookings
     where slot_id = p_slot_id and status = 'confirmed';
    if taken >= s.capacity then raise exception 'Slot is full'; end if;
  end if;

  insert into public.viewing_bookings (slot_id, listing_id, tenant_id, party_size, note)
  values (p_slot_id, s.listing_id, v_tenant, coalesce(p_party_size, 1), p_note)
  on conflict (slot_id, tenant_id) where (status = 'confirmed')
    do update set party_size = excluded.party_size, note = excluded.note, updated_at = now()
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- SELF-DEALING #3 — swiping right on your own listing
--
-- Would inflate the "N shortlisted" demand signal owners see, and mirror the
-- listing into the owner's own shortlist. New code 'own' is returned so the
-- client can distinguish it from a deleted listing ('gone').
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
  if not found or v_user.role = 'admin' then
    return jsonb_build_object('ok', false, 'code', 'role');
  end if;
  if v_user.is_banned then
    return jsonb_build_object('ok', false, 'code', 'banned');
  end if;

  if exists (select 1 from public.properties p where p.id = p_property_id and p.owner_id = v_uid) then
    return jsonb_build_object('ok', false, 'code', 'own');
  end if;

  if not exists (
    select 1 from public.properties p where p.id = p_property_id and p.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('twogets.swipe:' || v_uid::text, 0));

  select * into v_existing
    from public.swipes
   where tenant_id = v_uid and property_id = p_property_id;

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

-- Historical self-swipes stop inflating the owner-facing demand signal.
create or replace function public.property_right_swipe_count(pid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.owns_property(pid) or public.is_admin() then (
      select count(*)::int from public.swipes s
       join public.properties p on p.id = s.property_id
       where s.property_id = pid
         and s.direction = 'right'
         and s.tenant_id <> p.owner_id
    )
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
-- Signup: seed can_host from the chosen role
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url, role, can_host)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role,
    coalesce(new.raw_user_meta_data ->> 'role', '') = 'homeowner'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
