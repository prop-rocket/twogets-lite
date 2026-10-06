-- =============================================================================
-- TwoGets — 00016_booking_approval.sql
--
-- A site visit is now a REQUEST the owner accepts or declines, rather than an
-- instant confirmation. Owners asked to vet who is coming before agreeing.
--
-- Capacity rule: requests are unlimited, only ACCEPTED bookings consume a spot.
-- The owner picks from everyone who asked, which is how an open house actually
-- works — so the capacity check moves out of booking and into acceptance.
--
-- Requires 00015 ('pending' / 'declined') to have been committed first.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- DEDUPE INDEX — must move with the status, or it silently stops working.
--
-- uniq_confirmed_booking_per_tenant_slot was `where status = 'confirmed'`, and
-- book_viewing_slot()'s ON CONFLICT clause has to match it textually. Once rows
-- start life as 'pending' neither applies, and one tenant could open unlimited
-- requests on a single slot. Both now cover the live states.
-- ---------------------------------------------------------------------------
drop index if exists public.uniq_confirmed_booking_per_tenant_slot;
create unique index if not exists uniq_live_booking_per_tenant_slot
  on public.viewing_bookings (slot_id, tenant_id)
  where status in ('pending', 'confirmed');

-- ---------------------------------------------------------------------------
-- Requesting a visit
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
  v_tenant uuid := auth.uid();
  result public.viewing_bookings%rowtype;
begin
  if v_tenant is null then raise exception 'Must be signed in to book'; end if;

  select * into v_user from public.users where id = v_tenant;
  if not found or v_user.role = 'admin' then
    raise exception 'Only renters can request viewings';
  end if;
  if v_user.is_banned then raise exception 'Account suspended'; end if;

  select * into s from public.viewing_slots where id = p_slot_id;
  if not found then raise exception 'Slot not found'; end if;
  if s.owner_id = v_tenant then raise exception 'You cannot book your own viewing slot'; end if;
  if s.status <> 'open' then raise exception 'Slot is not open'; end if;
  if s.starts_at <= now() then raise exception 'Slot is in the past'; end if;

  -- No capacity check here on purpose: asking is unlimited, the owner decides.
  insert into public.viewing_bookings (slot_id, listing_id, tenant_id, party_size, note, status)
  values (p_slot_id, s.listing_id, v_tenant, coalesce(p_party_size, 1), p_note, 'pending')
  on conflict (slot_id, tenant_id) where (status in ('pending', 'confirmed'))
    do update set party_size = excluded.party_size, note = excluded.note, updated_at = now()
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Answering a request
--
-- viewing_bookings has no owner-facing UPDATE policy by design (the only one is
-- bookings_tenant_cancel_own), so this has to be a security definer RPC. It
-- follows set_booking_attendance(): check the slot's owner, then compare-and-set
-- on the expected status so two taps can't double-apply.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_booking(p_booking_id uuid, p_accept boolean)
returns public.viewing_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.viewing_bookings%rowtype;
  s public.viewing_slots%rowtype;
  taken int;
  result public.viewing_bookings%rowtype;
begin
  select * into b from public.viewing_bookings where id = p_booking_id;
  if not found then raise exception 'Request not found'; end if;

  -- Lock the slot so two simultaneous accepts can't both pass the capacity check.
  select * into s from public.viewing_slots where id = b.slot_id for update;
  if not found then raise exception 'Slot not found'; end if;
  if s.owner_id <> auth.uid() then raise exception 'Not your listing'; end if;
  if b.status <> 'pending' then raise exception 'That request was already answered'; end if;

  if p_accept and s.capacity is not null then
    select count(*) into taken from public.viewing_bookings
     where slot_id = b.slot_id and status = 'confirmed';
    if taken >= s.capacity then raise exception 'Slot is full'; end if;
  end if;

  update public.viewing_bookings
     set status = case when p_accept then 'confirmed' else 'declined' end,
         updated_at = now()
   where id = p_booking_id
     and status = 'pending'
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelling a slot must also kill the requests waiting on it, otherwise an
-- owner cancels and the pending queue survives against a dead slot.
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
   where slot_id = p_slot_id and status in ('pending', 'confirmed');
end;
$$;

-- ---------------------------------------------------------------------------
-- "Going" still means accepted. Owners also need to see how many are waiting.
-- ---------------------------------------------------------------------------
create or replace function public.viewing_slot_pending_count(p_slot_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.viewing_bookings
   where slot_id = p_slot_id and status = 'pending';
$$;

drop view if exists public.viewing_slots_with_counts;
create view public.viewing_slots_with_counts
with (security_invoker = true) as
select s.*,
  g.going_count,
  p.pending_count,
  case when s.capacity is null then null
       else greatest(s.capacity - g.going_count, 0) end as spots_left,
  (s.capacity is not null and g.going_count >= s.capacity) as is_full
from public.viewing_slots s
cross join lateral (select public.viewing_slot_going_count(s.id) as going_count) g
cross join lateral (select public.viewing_slot_pending_count(s.id) as pending_count) p;
