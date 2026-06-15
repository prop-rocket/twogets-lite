-- =============================================================================
-- TwoGets — 00006_viewing_slots.sql
-- Owner-published viewing slots replace the old "tenant proposes any time" flow.
--
--   * Owners publish availability: one-off slots, or recurring weekly rules that
--     materialize concrete slots on a rolling 28-day horizon.
--   * Tenants can ONLY book published, open, future slots — never a custom time.
--   * Open house: many tenants per slot (optional capacity cap), auto-confirmed.
--   * All booking goes through book_viewing_slot() (security definer) so the
--     atomic, row-locked capacity check cannot be bypassed.
--
-- Adapted to this repo's conventions: listings live in public.properties with
-- status = 'active' (the spec's listings/'published'); users in public.users.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type public.viewing_slot_source   as enum ('manual', 'recurring');
create type public.viewing_slot_status    as enum ('open', 'cancelled');
create type public.viewing_booking_status as enum ('confirmed', 'cancelled', 'attended', 'no_show');

-- ---------------------------------------------------------------------------
-- RECURRING AVAILABILITY RULES
-- A rule auto-generates slots on a rolling horizon (see generate_slots_for_rule).
-- slot_duration_min null  => the whole window is ONE open-house slot.
-- capacity null           => unlimited tenants per slot.
-- ---------------------------------------------------------------------------
create table public.viewing_availability_rules (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references public.properties (id) on delete cascade,
  owner_id          uuid not null references public.users (id) on delete cascade,
  day_of_week       smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time        time not null,
  end_time          time not null,
  slot_duration_min int,
  capacity          int,
  valid_from        date not null default current_date,
  valid_until       date,
  timezone          text not null default 'Asia/Kolkata',
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (end_time > start_time),
  check (slot_duration_min is null or slot_duration_min > 0),
  check (capacity is null or capacity > 0)
);
create index viewing_rules_listing_idx on public.viewing_availability_rules (listing_id);
create index viewing_rules_active_idx on public.viewing_availability_rules (active) where active;

-- ---------------------------------------------------------------------------
-- CONCRETE BOOKABLE SLOTS
-- ---------------------------------------------------------------------------
create table public.viewing_slots (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.properties (id) on delete cascade,
  owner_id   uuid not null references public.users (id) on delete cascade,
  rule_id    uuid references public.viewing_availability_rules (id) on delete set null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  capacity   int,
  status     public.viewing_slot_status not null default 'open',
  source     public.viewing_slot_source not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (capacity is null or capacity > 0),
  unique (listing_id, starts_at, ends_at)        -- prevents duplicate generation
);
create index viewing_slots_listing_idx on public.viewing_slots (listing_id, starts_at);
create index viewing_slots_status_idx on public.viewing_slots (status, starts_at);

-- ---------------------------------------------------------------------------
-- BOOKINGS (open house: many per slot)
-- ---------------------------------------------------------------------------
create table public.viewing_bookings (
  id         uuid primary key default gen_random_uuid(),
  slot_id    uuid not null references public.viewing_slots (id) on delete cascade,
  listing_id uuid not null references public.properties (id) on delete cascade,
  tenant_id  uuid not null references public.users (id) on delete cascade,
  status     public.viewing_booking_status not null default 'confirmed',
  party_size int not null default 1 check (party_size between 1 and 10),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index viewing_bookings_slot_idx on public.viewing_bookings (slot_id);
create index viewing_bookings_tenant_idx on public.viewing_bookings (tenant_id);
-- A tenant holds at most ONE confirmed booking per slot.
create unique index uniq_confirmed_booking_per_tenant_slot
  on public.viewing_bookings (slot_id, tenant_id) where status = 'confirmed';

-- updated_at maintenance (reuses public.set_updated_at from 00002)
create trigger viewing_rules_updated_at before update on public.viewing_availability_rules
  for each row execute function public.set_updated_at();
create trigger viewing_slots_updated_at before update on public.viewing_slots
  for each row execute function public.set_updated_at();
create trigger viewing_bookings_updated_at before update on public.viewing_bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- LIVE COUNTS
-- The going_count must count ALL confirmed bookings regardless of who's asking,
-- so it comes from a security-definer helper. The VIEW itself is
-- security_invoker so slot visibility still honors viewing_slots RLS (tenants
-- only see open, future slots on active listings).
-- ---------------------------------------------------------------------------
create or replace function public.viewing_slot_going_count(p_slot_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.viewing_bookings
   where slot_id = p_slot_id and status = 'confirmed';
$$;

create view public.viewing_slots_with_counts
with (security_invoker = true) as
select s.*,
  g.going_count,
  case when s.capacity is null then null
       else greatest(s.capacity - g.going_count, 0) end as spots_left,
  (s.capacity is not null and g.going_count >= s.capacity) as is_full
from public.viewing_slots s
cross join lateral (select public.viewing_slot_going_count(s.id) as going_count) g;

-- ---------------------------------------------------------------------------
-- generate_slots_for_rule — materialize slots for a rule on a rolling horizon.
-- Idempotent (unique(listing_id,starts_at,ends_at) + on conflict do nothing).
-- NOT security definer: when an owner calls it, RLS scopes the rule lookup to
-- their own rules; pg_cron runs as a superuser and bypasses RLS for the refill.
-- ---------------------------------------------------------------------------
create or replace function public.generate_slots_for_rule(p_rule_id uuid, p_horizon_days int default 28)
returns int
language plpgsql
set search_path = public
as $$
declare
  r public.viewing_availability_rules%rowtype;
  d date;
  win_start timestamptz; win_end timestamptz; cur timestamptz; nxt timestamptz;
  inserted int := 0;
begin
  select * into r from public.viewing_availability_rules where id = p_rule_id and active;
  if not found then return 0; end if;

  d := greatest(r.valid_from, current_date);
  while d <= current_date + p_horizon_days loop
    if extract(dow from d)::int = r.day_of_week
       and (r.valid_until is null or d <= r.valid_until) then
      win_start := (d::text || ' ' || r.start_time::text)::timestamp at time zone r.timezone;
      win_end   := (d::text || ' ' || r.end_time::text)::timestamp   at time zone r.timezone;

      if r.slot_duration_min is null then
        insert into public.viewing_slots (listing_id, owner_id, rule_id, starts_at, ends_at, capacity, source)
        values (r.listing_id, r.owner_id, r.id, win_start, win_end, r.capacity, 'recurring')
        on conflict (listing_id, starts_at, ends_at) do nothing;
        if found then inserted := inserted + 1; end if;
      else
        cur := win_start;
        while cur < win_end loop
          nxt := least(cur + (r.slot_duration_min || ' minutes')::interval, win_end);
          insert into public.viewing_slots (listing_id, owner_id, rule_id, starts_at, ends_at, capacity, source)
          values (r.listing_id, r.owner_id, r.id, cur, nxt, r.capacity, 'recurring')
          on conflict (listing_id, starts_at, ends_at) do nothing;
          if found then inserted := inserted + 1; end if;
          cur := nxt;
        end loop;
      end if;
    end if;
    d := d + 1;
  end loop;
  return inserted;
end;
$$;

-- ---------------------------------------------------------------------------
-- book_viewing_slot — the single write path for bookings. Atomic + row-locked.
-- Many tenants per slot; capacity enforced under the lock so two simultaneous
-- bookings for the last spot resolve to exactly one success.
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
  if not found or v_user.role is distinct from 'tenant' then
    raise exception 'Only tenants can book viewings';
  end if;
  if v_user.is_banned then raise exception 'Account suspended'; end if;

  select * into s from public.viewing_slots where id = p_slot_id for update;
  if not found then raise exception 'Slot not found'; end if;
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
-- cancel_viewing_slot — owner cancels a slot; cascades to confirmed bookings.
-- NOTE: notify affected tenants here (wire to the notification system).
-- ---------------------------------------------------------------------------
create or replace function public.cancel_viewing_slot(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s public.viewing_slots%rowtype;
begin
  select * into s from public.viewing_slots where id = p_slot_id;
  if not found then raise exception 'Slot not found'; end if;
  if s.owner_id <> auth.uid() then raise exception 'Not your slot'; end if;
  if s.starts_at <= now() then raise exception 'Cannot cancel a past slot'; end if;

  update public.viewing_slots set status = 'cancelled', updated_at = now() where id = p_slot_id;
  update public.viewing_bookings set status = 'cancelled', updated_at = now()
   where slot_id = p_slot_id and status = 'confirmed';
  -- TODO(notify): notify attendees their viewing was cancelled by the owner.
end;
$$;

-- ---------------------------------------------------------------------------
-- set_booking_attendance — owner marks who showed up. 'attended' unlocks the
-- two-way review for that booking (see reviews RLS below). Only the slot owner
-- may call this; bookings otherwise have no general UPDATE path.
-- ---------------------------------------------------------------------------
create or replace function public.set_booking_attendance(p_booking_id uuid, p_status public.viewing_booking_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.viewing_bookings%rowtype;
  s public.viewing_slots%rowtype;
begin
  if p_status not in ('attended', 'no_show', 'confirmed') then
    raise exception 'Invalid attendance status';
  end if;
  select * into b from public.viewing_bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found'; end if;
  select * into s from public.viewing_slots where id = b.slot_id;
  if s.owner_id <> auth.uid() then raise exception 'Not your listing'; end if;

  update public.viewing_bookings set status = p_status, updated_at = now() where id = p_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.viewing_availability_rules enable row level security;
alter table public.viewing_slots             enable row level security;
alter table public.viewing_bookings          enable row level security;

-- Rules: owner-only.
create policy "rules_owner_all" on public.viewing_availability_rules
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "rules_admin_read" on public.viewing_availability_rules
  for select using (public.is_admin());

-- Slots: owner manages own; tenants read only open future slots on active listings.
create policy "slots_owner_all" on public.viewing_slots
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "slots_tenant_read_open" on public.viewing_slots
  for select using (
    status = 'open'
    and starts_at > now()
    and exists (select 1 from public.properties p where p.id = listing_id and p.status = 'active')
  );
create policy "slots_admin_read" on public.viewing_slots
  for select using (public.is_admin());

-- Bookings are created ONLY via book_viewing_slot() (security definer); there is
-- deliberately no INSERT policy so the atomic capacity check can't be bypassed.
create policy "bookings_tenant_read_own" on public.viewing_bookings
  for select using (tenant_id = auth.uid());
create policy "bookings_owner_read_on_listing" on public.viewing_bookings
  for select using (
    exists (select 1 from public.viewing_slots s where s.id = slot_id and s.owner_id = auth.uid())
  );
create policy "bookings_admin_read" on public.viewing_bookings
  for select using (public.is_admin());
-- A tenant may only ever transition their own booking to 'cancelled'
-- (attendance is owner-set via set_booking_attendance()).
create policy "bookings_tenant_cancel_own" on public.viewing_bookings
  for update using (tenant_id = auth.uid())
  with check (tenant_id = auth.uid() and status = 'cancelled');

-- ---------------------------------------------------------------------------
-- Owners can read the profile of any tenant who booked a viewing on their
-- listing (vetting). Mirrors the old "inquired owner" policy onto bookings.
-- ---------------------------------------------------------------------------
create policy "tenant_profiles_booked_owner" on public.tenant_profiles
  for select using (
    exists (
      select 1 from public.viewing_bookings b
      join public.viewing_slots s on s.id = b.slot_id
      where b.tenant_id = tenant_profiles.user_id and s.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- REVIEWS — re-point from appointments onto viewing_bookings.
-- A review now hangs off an 'attended' booking (the new post-viewing seam).
-- Legacy reviews keep their content (reviewer/ratings/comment) for display and
-- for the trust scores already computed; their booking link is nulled so the
-- new FK can't be violated by old appointment ids.
-- ---------------------------------------------------------------------------
drop policy if exists "reviews_insert_participant" on public.reviews;
alter table public.reviews drop constraint if exists reviews_appointment_id_fkey;
alter table public.reviews rename column appointment_id to booking_id;
alter table public.reviews alter column booking_id drop not null;
update public.reviews set booking_id = null;  -- legacy appointment refs are no longer valid
alter table public.reviews
  add constraint reviews_booking_id_fkey
  foreign key (booking_id) references public.viewing_bookings (id) on delete cascade;

create policy "reviews_insert_participant" on public.reviews
  for insert with check (
    reviewer_id = auth.uid()
    and booking_id is not null
    and exists (
      select 1 from public.viewing_bookings b
      join public.viewing_slots s on s.id = b.slot_id
      where b.id = booking_id
        and b.status = 'attended'
        and ((b.tenant_id = auth.uid() and s.owner_id = reviewee_id)
          or (s.owner_id = auth.uid() and b.tenant_id = reviewee_id))
    )
  );

-- ---------------------------------------------------------------------------
-- DEPRECATE the old arbitrary-time flow. Keep the tables for one release; do
-- NOT auto-convert old viewing requests into slots — the models differ.
-- ---------------------------------------------------------------------------
do $$
declare n_inq int; n_appt int;
begin
  select count(*) into n_inq  from public.inquiries;
  select count(*) into n_appt from public.appointments;
  raise notice 'Deprecating old viewing flow: % inquiries, % appointments preserved in *_deprecated tables.', n_inq, n_appt;
  -- TODO backfill? Decide whether any historical inquiries/appointments should
  -- be represented in the new slot/booking model before these tables are dropped.
end $$;

-- Drop the auto-appointment trigger so the deprecated tables are inert.
drop trigger if exists inquiries_responded on public.inquiries;
alter table public.inquiries   rename to inquiries_deprecated;
alter table public.appointments rename to appointments_deprecated;

-- ---------------------------------------------------------------------------
-- ROLLING HORIZON REFILL — keep ~28 days of slots materialized for every active
-- rule. Runs daily via pg_cron when available; otherwise schedule externally.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'twogets-refill-viewing-slots') then
      perform cron.unschedule('twogets-refill-viewing-slots');
    end if;
    perform cron.schedule(
      'twogets-refill-viewing-slots',
      '0 2 * * *',
      $cron$ select public.generate_slots_for_rule(id) from public.viewing_availability_rules where active; $cron$
    );
    raise notice 'Scheduled daily pg_cron job twogets-refill-viewing-slots (02:00 UTC).';
  else
    raise notice 'pg_cron unavailable — run generate_slots_for_rule() for active rules daily via an external scheduler.';
  end if;
exception when others then
  raise notice 'Could not schedule pg_cron refill (%). Schedule generate_slots_for_rule() externally.', sqlerrm;
end $$;
