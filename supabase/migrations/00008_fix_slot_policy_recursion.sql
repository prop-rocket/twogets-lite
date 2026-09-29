-- =============================================================================
-- TwoGets — 00008_fix_slot_policy_recursion.sql
--
-- Fixes a regression introduced by 00007.
--
-- 00007 added "slots_tenant_read_booked" on viewing_slots with an inline
-- EXISTS against viewing_bookings. But viewing_bookings already carries
-- "bookings_owner_read_on_listing", whose own USING clause selects from
-- viewing_slots. Postgres therefore had to evaluate each table's policy to
-- evaluate the other's, and every tenant-side read of viewing_slots or
-- viewing_bookings failed with:
--
--     42P17: infinite recursion detected in policy for relation "viewing_slots"
--
-- That silently emptied the property-page slot picker, "My viewings", and the
-- swipe booking sheet.
--
-- Fix: move the lookup into a SECURITY DEFINER helper. It reads
-- viewing_bookings as the function owner, so that table's policies are never
-- evaluated and the cycle is broken — the same technique already used by
-- public.is_admin() and public.viewing_slot_going_count().
-- =============================================================================

drop policy if exists "slots_tenant_read_booked" on public.viewing_slots;

create or replace function public.tenant_has_booking_on_slot(p_slot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.viewing_bookings b
    where b.slot_id = p_slot_id and b.tenant_id = auth.uid()
  );
$$;

create policy "slots_tenant_read_booked" on public.viewing_slots
  for select using (public.tenant_has_booking_on_slot(id));
