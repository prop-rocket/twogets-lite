-- =============================================================================
-- TwoGets — 00013_rooms_and_tenure.sql
--
-- Two additions, both needed for the flatmate-replacement case: a tenant whose
-- roommate is moving out wants to list that one room.
--
-- 1. TENURE — whether the lister owns what they're letting.
--      owned  -> they are a Homeowner, and prove it with ownership documents
--      sublet -> they are a Host, and prove the right to let with a rental
--                agreement + landlord NOC (see 00014)
--    This is per LISTING, not per person: the same account can own one flat and
--    sublet a room in another, and each listing is judged on its own proof.
--
-- 2. ROOMS — property_type 'room' plus the fields a flatshare actually needs.
--    bhk keeps meaning the size of the WHOLE flat, so "Room in a 3BHK" works
--    with the existing 1-10 check and the existing bhk filters stay meaningful.
--
-- Requires 00011 (the 'room' enum value) to have been committed first.
-- =============================================================================

create type public.listing_tenure as enum ('owned', 'sublet');

alter table public.properties
  add column if not exists tenure public.listing_tenure not null default 'owned',
  add column if not exists is_shared_home boolean not null default false,
  add column if not exists rooms_available smallint,
  add column if not exists existing_flatmates smallint,
  add column if not exists attached_bathroom boolean not null default false,
  add column if not exists flatmate_gender_pref text,
  add column if not exists shared_spaces text[] not null default '{}',
  add column if not exists house_rules text;

comment on column public.properties.tenure is
  'Whether the lister owns this place (Homeowner) or sublets it (Host). Drives which documents verify it.';
comment on column public.properties.bhk is
  'Size of the whole property. For a room listing this is the flat it sits in, e.g. a room in a 3BHK.';

alter table public.properties
  drop constraint if exists properties_flatmate_gender_pref_check;
alter table public.properties
  add constraint properties_flatmate_gender_pref_check
  check (flatmate_gender_pref is null or flatmate_gender_pref in ('male', 'female', 'any'));

alter table public.properties
  drop constraint if exists properties_room_requires_shared;
alter table public.properties
  add constraint properties_room_requires_shared
  check (property_type <> 'room' or (is_shared_home and rooms_available is not null));

alter table public.properties
  drop constraint if exists properties_counts_sane;
alter table public.properties
  add constraint properties_counts_sane
  check (
    (rooms_available    is null or rooms_available    between 1 and 10)
    and (existing_flatmates is null or existing_flatmates between 0 and 20)
  );

-- Browse/swipe filter on flatshares.
create index if not exists properties_shared_home_idx
  on public.properties (is_shared_home)
  where is_shared_home and status = 'active';
