-- =============================================================================
-- TwoGets — 00011_enum_values.sql
--
-- Enum additions ONLY, deliberately alone in their own file.
--
-- Postgres will not let a newly added enum value be USED by other statements in
-- the same transaction, and the Supabase SQL editor wraps each paste in one. So
-- these three values must land and commit before 00012 can reference them in
-- columns, checks or defaults.
--
--   room            — a single room in a shared home (the flatmate-replacement
--                     case), as opposed to letting a whole property
--   rental_agreement \ right-to-sublet proof, for a Host who lets something
--   landlord_noc    / they do not own
-- =============================================================================

alter type public.property_type add value if not exists 'room';

alter type public.document_type add value if not exists 'rental_agreement';
alter type public.document_type add value if not exists 'landlord_noc';
