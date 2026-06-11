-- =============================================================================
-- TwoGets — 00002_functions_triggers.sql
-- Helper functions, auth sync, trust scoring, review aggregation, audit hooks.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so they can be used inside RLS policies
-- without recursive policy evaluation on public.users)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

create or replace function public.owns_property(pid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.properties where id = pid and owner_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger tenant_profiles_updated_at before update on public.tenant_profiles
  for each row execute function public.set_updated_at();
create trigger homeowner_profiles_updated_at before update on public.homeowner_profiles
  for each row execute function public.set_updated_at();
create trigger properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();
create trigger verification_requests_updated_at before update on public.verification_requests
  for each row execute function public.set_updated_at();
create trigger inquiries_updated_at before update on public.inquiries
  for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Mirror auth.users → public.users on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    -- role is set at signup for email flows; OAuth users pick a role on first login
    nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Trust score
-- 20 base + 30 identity verification + up to 50 from reviews
-- (review component is damped until a user has 10+ reviews)
-- ---------------------------------------------------------------------------
create or replace function public.recalc_trust_score(target uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_verified boolean;
  v_avg numeric;
  v_count integer;
  v_score numeric;
begin
  select is_verified into v_verified from public.users where id = target;
  if not found then return; end if;

  select coalesce(avg(overall_rating), 0), count(*)
  into v_avg, v_count
  from public.reviews
  where reviewee_id = target and is_approved;

  v_score := 20
    + (case when v_verified then 30 else 0 end)
    + (v_avg / 5.0) * 50 * (least(v_count, 10) / 10.0);

  update public.users set trust_score = round(v_score, 2) where id = target;
end;
$$;

-- ---------------------------------------------------------------------------
-- Review aggregation → property rating + reviewee trust score
-- ---------------------------------------------------------------------------
create or replace function public.handle_review_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  rec public.reviews;
begin
  rec := coalesce(new, old);

  if rec.property_id is not null then
    update public.properties p set
      avg_rating = coalesce((
        select round(avg(overall_rating), 2) from public.reviews
        where property_id = rec.property_id and is_approved
      ), 0),
      review_count = (
        select count(*) from public.reviews
        where property_id = rec.property_id and is_approved
      )
    where p.id = rec.property_id;
  end if;

  perform public.recalc_trust_score(rec.reviewee_id);
  return rec;
end;
$$;

create trigger reviews_aggregate
  after insert or update or delete on public.reviews
  for each row execute function public.handle_review_change();

-- ---------------------------------------------------------------------------
-- Verification approval → verified badges
-- Identity: tenant needs aadhaar + pan approved; homeowner needs aadhaar OR pan.
-- Property: any one ownership document (utility bill / tax receipt / sale deed).
-- ---------------------------------------------------------------------------
create or replace function public.handle_verification_review()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_identity_verified boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.property_id is not null then
    update public.properties set is_verified = exists (
      select 1 from public.verification_requests
      where property_id = new.property_id
        and document_type in ('utility_bill', 'property_tax_receipt', 'sale_deed')
        and status = 'approved'
    ) where id = new.property_id;
  else
    select role into v_role from public.users where id = new.user_id;
    if v_role = 'tenant' then
      v_identity_verified := (
        select count(distinct document_type) = 2 from public.verification_requests
        where user_id = new.user_id and property_id is null
          and document_type in ('aadhaar', 'pan') and status = 'approved'
      );
    else
      v_identity_verified := exists (
        select 1 from public.verification_requests
        where user_id = new.user_id and property_id is null
          and document_type in ('aadhaar', 'pan') and status = 'approved'
      );
    end if;
    update public.users set is_verified = v_identity_verified where id = new.user_id;
    perform public.recalc_trust_score(new.user_id);
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    new.reviewed_by,
    'verification.' || new.status::text,
    'verification_request',
    new.id::text,
    jsonb_build_object('user_id', new.user_id, 'document_type', new.document_type, 'property_id', new.property_id)
  );

  return new;
end;
$$;

create trigger verification_requests_reviewed
  after update on public.verification_requests
  for each row execute function public.handle_verification_review();

-- ---------------------------------------------------------------------------
-- Inquiry acceptance → auto-create appointment
-- ---------------------------------------------------------------------------
create or replace function public.handle_inquiry_response()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    insert into public.appointments (inquiry_id, property_id, tenant_id, owner_id, scheduled_date, scheduled_time)
    values (new.id, new.property_id, new.tenant_id, new.owner_id, new.preferred_date, new.preferred_time)
    on conflict (inquiry_id) do nothing;
    new.responded_at = now();
  elsif new.status = 'rejected' and old.status = 'pending' then
    new.responded_at = now();
  end if;
  return new;
end;
$$;

create trigger inquiries_responded
  before update on public.inquiries
  for each row execute function public.handle_inquiry_response();

-- ---------------------------------------------------------------------------
-- Audit: property lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.audit_property_changes()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'property.deleted', 'property', old.id::text,
            jsonb_build_object('title', old.title, 'owner_id', old.owner_id));
    return old;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'property.status.' || new.status::text, 'property', new.id::text,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

create trigger properties_audit
  after update or delete on public.properties
  for each row execute function public.audit_property_changes();

-- ---------------------------------------------------------------------------
-- Atomic view counter (called from the property details page)
-- ---------------------------------------------------------------------------
create or replace function public.increment_view_count(pid uuid)
returns void
language sql security definer
set search_path = public
as $$
  update public.properties set view_count = view_count + 1 where id = pid;
$$;
