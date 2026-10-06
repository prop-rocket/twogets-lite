-- =============================================================================
-- TwoGets — 00018_owner_relationship.sql
--
-- Replaces the sublet model with "whose property are you posting?".
--
-- Subletting is dropped: owners don't encourage it, there's no legal framework
-- behind it in India, and the documentation is impractical. What people actually
-- need is covered by two separate things:
--
--   listing_kind = 'rental'    you are letting a property
--       owner_relationship      self    — it's yours
--                               parents — it belongs to a parent
--                               known   — someone who has authorised you
--   listing_kind = 'roommate'  you already live there and want a flatmate.
--                              You aren't letting the property, you're sharing
--                              a tenancy you hold, so ownership proof is the
--                              wrong question entirely.
--
-- There is deliberately no "client/agent" option — the platform does not
-- encourage brokers, so it isn't offered as a category.
--
-- Listings publish immediately regardless. The owner phone-check gates only the
-- VERIFIED BADGE, and only where the lister isn't the owner.
--
-- Requires 00015 (ration_card, authorisation_letter document types).
-- =============================================================================

create type public.listing_kind as enum ('rental', 'roommate');
create type public.owner_relationship as enum ('self', 'parents', 'known');

alter table public.properties
  add column if not exists listing_kind public.listing_kind not null default 'rental',
  add column if not exists owner_relationship public.owner_relationship not null default 'self',
  -- Who to ring, for the non-self cases.
  add column if not exists owner_contact_name text,
  add column if not exists owner_contact_phone text,
  add column if not exists owner_confirmed_at timestamptz,
  add column if not exists owner_confirmed_by uuid references public.users (id) on delete set null;

comment on column public.properties.owner_relationship is
  'Whose property this is. Only meaningful when listing_kind = ''rental''.';
comment on column public.properties.owner_confirmed_at is
  'Set when an admin has spoken to the real owner. Required for the verified badge on non-self listings.';

-- Carry the old model across: a sublet listing was someone letting a place they
-- rent, which under the new model is the roommate case.
update public.properties
   set listing_kind = 'roommate', is_shared_home = true
 where tenure = 'sublet';

alter table public.properties drop column if exists tenure;
drop type if exists public.listing_tenure;

-- A roommate post describes a shared home by definition.
alter table public.properties drop constraint if exists properties_roommate_is_shared;
alter table public.properties
  add constraint properties_roommate_is_shared
  check (listing_kind <> 'roommate' or is_shared_home);

-- Non-self listings need someone to call before they can be trusted.
alter table public.properties drop constraint if exists properties_owner_contact_present;
alter table public.properties
  add constraint properties_owner_contact_present
  check (
    listing_kind <> 'rental'
    or owner_relationship = 'self'
    or (owner_contact_name is not null and owner_contact_phone is not null)
  );

create index if not exists properties_awaiting_owner_check_idx
  on public.properties (owner_relationship)
  where owner_confirmed_at is null and owner_relationship <> 'self';

-- ---------------------------------------------------------------------------
-- Admin records the owner call. Separate from document review because it is a
-- different kind of evidence — a phone call, not an upload.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_listing_with_owner(p_property_id uuid, p_confirmed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  update public.properties
     set owner_confirmed_at = case when p_confirmed then now() else null end,
         owner_confirmed_by = case when p_confirmed then auth.uid() else null end,
         updated_at = now()
   where id = p_property_id;

  -- Re-evaluate the badge: the call is half the requirement, documents the other.
  perform public.refresh_listing_verification(p_property_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Badge rule, in one place so the trigger and the admin call agree.
--
--   rental/self     any one ownership document
--   rental/parents  ration card OR an Aadhaar naming a parent   + owner call
--   rental/known    Aadhaar AND an authorisation letter          + owner call
--   roommate        your own rental agreement (proves you live there)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_listing_verification(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.properties%rowtype;
  v_docs boolean;
  v_needs_call boolean;
begin
  select * into p from public.properties where id = p_property_id;
  if not found then return; end if;

  if p.listing_kind = 'roommate' then
    v_docs := exists (
      select 1 from public.verification_requests
      where property_id = p_property_id
        and document_type = 'rental_agreement' and status = 'approved'
    );
  elsif p.owner_relationship = 'parents' then
    v_docs := exists (
      select 1 from public.verification_requests
      where property_id = p_property_id
        and document_type in ('ration_card', 'aadhaar') and status = 'approved'
    );
  elsif p.owner_relationship = 'known' then
    v_docs := (
      select count(distinct document_type) = 2 from public.verification_requests
      where property_id = p_property_id
        and document_type in ('aadhaar', 'authorisation_letter') and status = 'approved'
    );
  else
    v_docs := exists (
      select 1 from public.verification_requests
      where property_id = p_property_id
        and document_type in ('utility_bill', 'property_tax_receipt', 'sale_deed')
        and status = 'approved'
    );
  end if;

  v_needs_call := p.listing_kind = 'rental' and p.owner_relationship <> 'self';

  update public.properties
     set is_verified = v_docs and (not v_needs_call or p.owner_confirmed_at is not null)
   where id = p_property_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Document review now defers to the shared rule above.
-- ---------------------------------------------------------------------------
create or replace function public.handle_verification_review()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_verified boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.property_id is not null then
    perform public.refresh_listing_verification(new.property_id);
  else
    -- Identity: both documents, for everyone (unchanged from 00014).
    v_verified := (
      select count(distinct document_type) = 2
      from public.verification_requests
      where user_id = new.user_id and property_id is null
        and document_type in ('aadhaar', 'pan') and status = 'approved'
    );
    update public.users set is_verified = v_verified where id = new.user_id;
    perform public.recalc_trust_score(new.user_id);
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    new.reviewed_by,
    'verification.' || new.status::text,
    'verification_request',
    new.id::text,
    jsonb_build_object('user_id', new.user_id, 'document_type', new.document_type,
                       'property_id', new.property_id)
  );

  return new;
end;
$$;
