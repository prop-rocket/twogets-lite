-- =============================================================================
-- TwoGets — 00015_booking_approval_enums.sql
--
-- Enum values ONLY, alone in their own file.
--
-- Postgres will not let a newly added enum value be USED by other statements in
-- the same transaction, and the Supabase SQL editor wraps each paste in one. So
-- these must land and commit before 00016 (which defaults bookings to 'pending')
-- and 00017 (which offers the new document types) can reference them.
--
--   pending / declined   — site visits become a request the owner answers,
--                          instead of auto-confirming
--   ration_card          \ proof when the property belongs to a parent, or to
--   authorisation_letter / someone who has authorised you to list it
-- =============================================================================

alter type public.viewing_booking_status add value if not exists 'pending';
alter type public.viewing_booking_status add value if not exists 'declined';

alter type public.document_type add value if not exists 'ration_card';
alter type public.document_type add value if not exists 'authorisation_letter';
