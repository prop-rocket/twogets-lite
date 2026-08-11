-- =============================================================================
-- TwoGets — 00007_tenant_slot_read_on_booking.sql
--
-- Bug: slots_tenant_read_open (00006) only lets a tenant SELECT a viewing_slot
-- while it is still 'open' and in the future. Once a viewing's time passes (or
-- the owner cancels it) the tenant loses read access to a slot they actually
-- booked — so any query embedding viewing_slots onto the tenant's own
-- viewing_bookings gets a null slot back, even though the booking itself is
-- still visible. That crashed the dashboard's "upcoming viewings" count, which
-- read slot.starts_at off the embedded (null) slot.
--
-- Fix: tenants may also read any slot they hold a booking on, independent of
-- the slot's current status/time — mirrors the existing
-- "tenant_profiles_booked_owner" pattern (owners can read a tenant's profile
-- once that tenant has booked their listing).
-- =============================================================================

create policy "slots_tenant_read_booked" on public.viewing_slots
  for select using (
    exists (
      select 1 from public.viewing_bookings b
      where b.slot_id = viewing_slots.id and b.tenant_id = auth.uid()
    )
  );
