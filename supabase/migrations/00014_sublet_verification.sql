-- =============================================================================
-- TwoGets — 00014_sublet_verification.sql
--
-- Verification is per role and separate. Verifying your identity does not make
-- you a verified lister, and vice versa.
--
--   IDENTITY (Aadhaar + PAN)        -> users.is_verified      -> Verified renter
--   LETTING  (per listing, by tenure) -> properties.is_verified
--        tenure 'owned'  -> an ownership document  -> Verified Homeowner
--        tenure 'sublet' -> rental agreement AND landlord NOC -> Verified Host
--
-- A rental agreement alone proves you rent the place, not that you may sublet
-- it, so the NOC is required alongside it.
--
-- Identity used to branch on users.role: tenants needed both documents,
-- everyone else needed only one. With one account able to do both, the
-- requirement can't depend on which button they clicked at signup — it is now
-- both documents for everyone. Safe to tighten: no verification request has
-- ever been approved on this database, so no badge changes hands.
--
-- Requires 00011 (the sublet document enum values) and 00013 (properties.tenure).
-- =============================================================================

create or replace function public.handle_verification_review()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenure public.listing_tenure;
  v_verified boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.property_id is not null then
    select tenure into v_tenure from public.properties where id = new.property_id;

    if v_tenure = 'sublet' then
      -- Right to let: the agreement shows they rent it, the NOC that the owner
      -- permits subletting. Both are required.
      v_verified := (
        select count(distinct document_type) = 2
        from public.verification_requests
        where property_id = new.property_id
          and document_type in ('rental_agreement', 'landlord_noc')
          and status = 'approved'
      );
    else
      v_verified := exists (
        select 1 from public.verification_requests
        where property_id = new.property_id
          and document_type in ('utility_bill', 'property_tax_receipt', 'sale_deed')
          and status = 'approved'
      );
    end if;

    update public.properties set is_verified = v_verified where id = new.property_id;
  else
    -- Identity: both documents, for everyone.
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
    jsonb_build_object('user_id', new.user_id, 'property_id', new.property_id,
                       'document_type', new.document_type)
  );

  return new;
end;
$$;
