-- =============================================================================
-- TwoGets — 00017_fix_booking_response_cast.sql
--
-- Fixes respond_to_booking() from 00016, which could never run.
--
-- The status was assigned from a CASE expression:
--     set status = case when p_accept then 'confirmed' else 'declined' end
--
-- Postgres resolves a CASE over bare string literals to `text`, and will not
-- implicitly coerce text into an enum column, so every call failed with
--     42804: column "status" is of type viewing_booking_status
--            but expression is of type text
-- Accepting a request appeared to do nothing. A plain literal assignment (as in
-- cancel_viewing_slot) infers fine; only the CASE needed the explicit cast.
-- =============================================================================

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
  v_next public.viewing_booking_status;
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

  v_next := (case when p_accept then 'confirmed' else 'declined' end)::public.viewing_booking_status;

  update public.viewing_bookings
     set status = v_next,
         updated_at = now()
   where id = p_booking_id
     and status = 'pending'
  returning * into result;

  return result;
end;
$$;
