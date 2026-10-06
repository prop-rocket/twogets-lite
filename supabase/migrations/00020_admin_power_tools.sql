-- =============================================================================
-- TwoGets — 00020_admin_power_tools.sql
--
-- 1. Admin oversight of viewings. Admins are read-only on viewing_slots and
--    viewing_bookings, so they cannot step into a dispute. These are NEW
--    functions rather than edits to cancel_viewing_slot() /
--    set_booking_attendance(): those hard-require owner_id = auth.uid() and are
--    called by owners from src/server/actions/viewings.ts, so changing their
--    contract would break the live owner flow.
--
-- 2. A last-admin guard. Role changes are about to become possible from the UI,
--    and the obvious way to lock yourself out of the platform is to demote the
--    only admin. Enforced in the database so it holds regardless of which path
--    does the update.
-- =============================================================================

create or replace function public.admin_cancel_viewing_slot(p_slot_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare s public.viewing_slots%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select * into s from public.viewing_slots where id = p_slot_id;
  if not found then raise exception 'Slot not found'; end if;

  update public.viewing_slots set status = 'cancelled', updated_at = now() where id = p_slot_id;
  update public.viewing_bookings set status = 'cancelled', updated_at = now()
   where slot_id = p_slot_id and status in ('pending', 'confirmed');

  perform public.log_admin_action('slot.cancelled', 'viewing_slot', p_slot_id::text,
    jsonb_build_object('listing_id', s.listing_id, 'owner_id', s.owner_id));
end;
$$;

create or replace function public.admin_set_booking_status(
  p_booking_id uuid,
  p_status public.viewing_booking_status
)
returns void
language plpgsql security definer set search_path = public
as $$
declare b public.viewing_bookings%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('confirmed', 'declined', 'cancelled', 'attended', 'no_show') then
    raise exception 'Invalid booking status';
  end if;

  select * into b from public.viewing_bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found'; end if;

  update public.viewing_bookings set status = p_status, updated_at = now() where id = p_booking_id;

  perform public.log_admin_action('booking.' || p_status::text, 'viewing_booking',
    p_booking_id::text, jsonb_build_object('was', b.status, 'listing_id', b.listing_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- You cannot remove the last admin. A statement-level constraint trigger so it
-- holds for a multi-row update too, not just the single-row path the UI uses.
-- ---------------------------------------------------------------------------
create or replace function public.guard_last_admin()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from public.users where role = 'admin') = 0 then
    raise exception 'Refusing to remove the last admin';
  end if;
  return null;
end;
$$;

drop trigger if exists users_last_admin_guard on public.users;
create constraint trigger users_last_admin_guard
  after update or delete on public.users
  deferrable initially deferred
  for each row execute function public.guard_last_admin();
