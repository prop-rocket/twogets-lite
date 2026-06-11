-- =============================================================================
-- TwoGets — 00001_schema.sql
-- Core schema: enums, tables, foreign keys, indexes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('tenant', 'homeowner', 'admin');
create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.document_type as enum ('aadhaar', 'pan', 'utility_bill', 'property_tax_receipt', 'sale_deed');
create type public.property_type as enum ('apartment', 'independent_house', 'villa', 'studio', 'row_house', 'penthouse');
create type public.furnished_status as enum ('unfurnished', 'semi_furnished', 'fully_furnished');
create type public.occupancy_preference as enum ('bachelor', 'family', 'any');
create type public.food_preference as enum ('vegetarian', 'non_vegetarian', 'eggetarian', 'no_preference');
create type public.income_range as enum ('below_3l', '3l_6l', '6l_12l', '12l_24l', 'above_24l');
create type public.property_status as enum ('draft', 'active', 'archived', 'rented');
create type public.inquiry_status as enum ('pending', 'accepted', 'rejected', 'cancelled');
create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');
create type public.review_type as enum ('owner_review', 'tenant_review'); -- owner_review = a review OF a homeowner
create type public.report_target as enum ('user', 'property', 'review');
create type public.report_status as enum ('open', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------------
-- USERS (public profile mirror of auth.users)
-- ---------------------------------------------------------------------------
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.user_role,
  full_name     text not null default '',
  email         text not null,
  phone         text,
  avatar_url    text,
  is_verified   boolean not null default false,
  trust_score   numeric(5, 2) not null default 20.00,
  is_banned     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index users_role_idx on public.users (role);
create index users_is_verified_idx on public.users (is_verified) where is_verified;

-- ---------------------------------------------------------------------------
-- TENANT PROFILES
-- ---------------------------------------------------------------------------
create table public.tenant_profiles (
  user_id             uuid primary key references public.users (id) on delete cascade,
  occupation          text,
  employer            text,
  income_range        public.income_range,
  occupancy_type      public.occupancy_preference not null default 'any',
  has_pets            boolean not null default false,
  food_preference     public.food_preference not null default 'no_preference',
  preferred_locations text[] not null default '{}',
  budget_min          integer check (budget_min is null or budget_min >= 0),
  budget_max          integer check (budget_max is null or budget_max >= 0),
  move_in_date        date,
  linkedin_url        text,
  about               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint budget_range_valid check (
    budget_min is null or budget_max is null or budget_max >= budget_min
  )
);

-- ---------------------------------------------------------------------------
-- HOMEOWNER PROFILES
-- ---------------------------------------------------------------------------
create table public.homeowner_profiles (
  user_id       uuid primary key references public.users (id) on delete cascade,
  about         text,
  city          text,
  linkedin_url  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PROPERTIES
-- ---------------------------------------------------------------------------
create table public.properties (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.users (id) on delete cascade,
  title            text not null check (char_length(title) between 5 and 120),
  description      text not null default '',
  property_type    public.property_type not null,
  bhk              smallint not null check (bhk between 1 and 10),
  furnished_status public.furnished_status not null default 'unfurnished',
  address_line     text not null,
  locality         text not null,
  city             text not null,
  state            text not null,
  pincode          text not null,
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  rent             integer not null check (rent > 0),
  deposit          integer not null default 0 check (deposit >= 0),
  available_from   date not null default current_date,
  pet_friendly     boolean not null default false,
  preferred_tenants public.occupancy_preference not null default 'any',
  video_url        text,
  status           public.property_status not null default 'draft',
  is_verified      boolean not null default false,
  view_count       integer not null default 0,
  avg_rating       numeric(3, 2) not null default 0,
  review_count     integer not null default 0,
  search_vector    tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(locality, '') || ' ' || coalesce(city, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index properties_owner_idx on public.properties (owner_id);
create index properties_status_city_idx on public.properties (status, city);
create index properties_rent_idx on public.properties (rent);
create index properties_bhk_idx on public.properties (bhk);
create index properties_created_idx on public.properties (created_at desc);
create index properties_search_idx on public.properties using gin (search_vector);
create index properties_geo_idx on public.properties (latitude, longitude);

-- ---------------------------------------------------------------------------
-- PROPERTY IMAGES
-- ---------------------------------------------------------------------------
create table public.property_images (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  storage_path text not null,
  alt_text     text not null default '',
  sort_order   smallint not null default 0,
  is_cover     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index property_images_property_idx on public.property_images (property_id, sort_order);

-- ---------------------------------------------------------------------------
-- AMENITIES (lookup) + PROPERTY_AMENITIES (join)
-- ---------------------------------------------------------------------------
create table public.amenities (
  id    serial primary key,
  slug  text not null unique,
  label text not null,
  icon  text not null default 'check'
);

create table public.property_amenities (
  property_id uuid not null references public.properties (id) on delete cascade,
  amenity_id  integer not null references public.amenities (id) on delete cascade,
  primary key (property_id, amenity_id)
);

create index property_amenities_amenity_idx on public.property_amenities (amenity_id);

insert into public.amenities (slug, label, icon) values
  ('parking', 'Parking', 'car'),
  ('lift', 'Lift', 'arrow-up-down'),
  ('power_backup', 'Power Backup', 'zap'),
  ('water_supply', '24x7 Water', 'droplets'),
  ('security', 'Gated Security', 'shield'),
  ('gym', 'Gym', 'dumbbell'),
  ('swimming_pool', 'Swimming Pool', 'waves'),
  ('clubhouse', 'Clubhouse', 'building'),
  ('park', 'Children''s Park', 'trees'),
  ('wifi', 'WiFi Ready', 'wifi'),
  ('ac', 'Air Conditioning', 'snowflake'),
  ('modular_kitchen', 'Modular Kitchen', 'cooking-pot'),
  ('balcony', 'Balcony', 'sun'),
  ('cctv', 'CCTV', 'cctv'),
  ('intercom', 'Intercom', 'phone');

-- ---------------------------------------------------------------------------
-- VERIFICATION REQUESTS (identity docs for users, ownership docs for properties)
-- ---------------------------------------------------------------------------
create table public.verification_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users (id) on delete cascade,
  property_id      uuid references public.properties (id) on delete cascade,
  document_type    public.document_type not null,
  storage_path     text not null,
  status           public.verification_status not null default 'pending',
  rejection_reason text,
  reviewed_by      uuid references public.users (id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index verification_requests_user_idx on public.verification_requests (user_id);
create index verification_requests_status_idx on public.verification_requests (status, created_at desc);
create index verification_requests_property_idx on public.verification_requests (property_id);
-- one live request per document type per user/property
create unique index verification_requests_unique_pending
  on public.verification_requests (user_id, document_type, coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('pending', 'approved');

-- ---------------------------------------------------------------------------
-- SAVED PROPERTIES (tenant wishlist)
-- ---------------------------------------------------------------------------
create table public.saved_properties (
  tenant_id   uuid not null references public.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (tenant_id, property_id)
);

create index saved_properties_property_idx on public.saved_properties (property_id);

-- ---------------------------------------------------------------------------
-- INQUIRIES (viewing requests)
-- ---------------------------------------------------------------------------
create table public.inquiries (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.properties (id) on delete cascade,
  tenant_id      uuid not null references public.users (id) on delete cascade,
  owner_id       uuid not null references public.users (id) on delete cascade,
  message        text not null default '',
  preferred_date date not null,
  preferred_time time not null,
  status         public.inquiry_status not null default 'pending',
  responded_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index inquiries_tenant_idx on public.inquiries (tenant_id, created_at desc);
create index inquiries_owner_idx on public.inquiries (owner_id, status, created_at desc);
create index inquiries_property_idx on public.inquiries (property_id);
-- a tenant may have only one open request per property
create unique index inquiries_unique_open
  on public.inquiries (tenant_id, property_id)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- APPOINTMENTS (confirmed viewings)
-- ---------------------------------------------------------------------------
create table public.appointments (
  id             uuid primary key default gen_random_uuid(),
  inquiry_id     uuid not null unique references public.inquiries (id) on delete cascade,
  property_id    uuid not null references public.properties (id) on delete cascade,
  tenant_id      uuid not null references public.users (id) on delete cascade,
  owner_id       uuid not null references public.users (id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time not null,
  status         public.appointment_status not null default 'scheduled',
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index appointments_tenant_idx on public.appointments (tenant_id, scheduled_date);
create index appointments_owner_idx on public.appointments (owner_id, scheduled_date);

-- ---------------------------------------------------------------------------
-- REVIEWS (bidirectional, tied to a completed appointment)
-- ---------------------------------------------------------------------------
create table public.reviews (
  id                uuid primary key default gen_random_uuid(),
  review_type       public.review_type not null,
  appointment_id    uuid not null references public.appointments (id) on delete cascade,
  property_id       uuid references public.properties (id) on delete cascade,
  reviewer_id       uuid not null references public.users (id) on delete cascade,
  reviewee_id       uuid not null references public.users (id) on delete cascade,
  -- shared dimension
  rating_communication smallint not null check (rating_communication between 1 and 5),
  -- owner_review dimensions (review OF a homeowner)
  rating_deposit_fairness  smallint check (rating_deposit_fairness between 1 and 5),
  rating_property_accuracy smallint check (rating_property_accuracy between 1 and 5),
  -- tenant_review dimensions (review OF a tenant)
  rating_reliability    smallint check (rating_reliability between 1 and 5),
  rating_property_care  smallint check (rating_property_care between 1 and 5),
  overall_rating numeric(3, 2) not null,
  comment        text not null default '',
  is_approved    boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint one_review_per_side unique (appointment_id, reviewer_id),
  constraint review_dimensions_match_type check (
    (review_type = 'owner_review'
      and rating_deposit_fairness is not null and rating_property_accuracy is not null
      and rating_reliability is null and rating_property_care is null)
    or
    (review_type = 'tenant_review'
      and rating_reliability is not null and rating_property_care is not null
      and rating_deposit_fairness is null and rating_property_accuracy is null)
  )
);

create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);
create index reviews_property_idx on public.reviews (property_id) where property_id is not null;

-- ---------------------------------------------------------------------------
-- REPORTS (user-flagged content for admin triage)
-- ---------------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id) on delete cascade,
  target_type public.report_target not null,
  target_id   uuid not null,
  reason      text not null,
  details     text not null default '',
  status      public.report_status not null default 'open',
  resolved_by uuid references public.users (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at desc);

-- ---------------------------------------------------------------------------
-- AUDIT LOGS
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.users (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
