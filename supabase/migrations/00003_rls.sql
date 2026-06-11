-- =============================================================================
-- TwoGets — 00003_rls.sql
-- Row Level Security for every table. Deny by default, grant per role.
-- =============================================================================

alter table public.users enable row level security;
alter table public.tenant_profiles enable row level security;
alter table public.homeowner_profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.amenities enable row level security;
alter table public.property_amenities enable row level security;
alter table public.verification_requests enable row level security;
alter table public.saved_properties enable row level security;
alter table public.inquiries enable row level security;
alter table public.appointments enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- USERS — public profiles are readable (needed for owner cards / reviews);
-- only the user updates their own row; role can be set once (null → value).
-- ---------------------------------------------------------------------------
create policy "users_select_all" on public.users
  for select using (true);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- a user can never change their own role to admin or unban themselves
    and (role is not distinct from (select u.role from public.users u where u.id = auth.uid()) or role in ('tenant', 'homeowner'))
    and is_banned = (select u.is_banned from public.users u where u.id = auth.uid())
  );

create policy "users_admin_update" on public.users
  for update using (public.is_admin());

-- inserts happen via the on_auth_user_created trigger (security definer)

-- ---------------------------------------------------------------------------
-- TENANT PROFILES — owner + admin read/write; homeowners can read profiles of
-- tenants who inquired on their properties (so they can vet applicants).
-- ---------------------------------------------------------------------------
create policy "tenant_profiles_own" on public.tenant_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tenant_profiles_admin" on public.tenant_profiles
  for select using (public.is_admin());

create policy "tenant_profiles_inquired_owner" on public.tenant_profiles
  for select using (
    exists (
      select 1 from public.inquiries i
      where i.tenant_id = tenant_profiles.user_id and i.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- HOMEOWNER PROFILES — readable by everyone (shown on listings), writable by owner.
-- ---------------------------------------------------------------------------
create policy "homeowner_profiles_select" on public.homeowner_profiles
  for select using (true);

create policy "homeowner_profiles_own" on public.homeowner_profiles
  for insert with check (auth.uid() = user_id);

create policy "homeowner_profiles_update_own" on public.homeowner_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- PROPERTIES — active listings are public; owners manage their own; admins all.
-- ---------------------------------------------------------------------------
create policy "properties_select_active" on public.properties
  for select using (status = 'active' or owner_id = auth.uid() or public.is_admin());

create policy "properties_insert_own" on public.properties
  for insert with check (
    owner_id = auth.uid() and public.current_user_role() = 'homeowner'
  );

create policy "properties_update_own" on public.properties
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "properties_delete_own" on public.properties
  for delete using (owner_id = auth.uid());

create policy "properties_admin_all" on public.properties
  for all using (public.is_admin());

-- ---------------------------------------------------------------------------
-- PROPERTY IMAGES / AMENITIES — follow the parent property.
-- ---------------------------------------------------------------------------
create policy "property_images_select" on public.property_images
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and (p.status = 'active' or p.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy "property_images_manage" on public.property_images
  for all using (public.owns_property(property_id) or public.is_admin())
  with check (public.owns_property(property_id) or public.is_admin());

create policy "amenities_select" on public.amenities
  for select using (true);

create policy "property_amenities_select" on public.property_amenities
  for select using (true);

create policy "property_amenities_manage" on public.property_amenities
  for all using (public.owns_property(property_id) or public.is_admin())
  with check (public.owns_property(property_id) or public.is_admin());

-- ---------------------------------------------------------------------------
-- VERIFICATION REQUESTS — submitter creates/reads own; only admins review.
-- ---------------------------------------------------------------------------
create policy "verification_requests_own_select" on public.verification_requests
  for select using (user_id = auth.uid() or public.is_admin());

create policy "verification_requests_own_insert" on public.verification_requests
  for insert with check (
    user_id = auth.uid()
    and (property_id is null or public.owns_property(property_id))
  );

create policy "verification_requests_admin_update" on public.verification_requests
  for update using (public.is_admin());

-- ---------------------------------------------------------------------------
-- SAVED PROPERTIES — strictly private to the tenant.
-- ---------------------------------------------------------------------------
create policy "saved_properties_own" on public.saved_properties
  for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

-- ---------------------------------------------------------------------------
-- INQUIRIES — visible to both sides + admin. Tenant creates; owner responds
-- (status transition only); tenant may cancel their own pending inquiry.
-- ---------------------------------------------------------------------------
create policy "inquiries_select_parties" on public.inquiries
  for select using (tenant_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

create policy "inquiries_insert_tenant" on public.inquiries
  for insert with check (
    tenant_id = auth.uid()
    and public.current_user_role() = 'tenant'
    and exists (select 1 from public.properties p where p.id = property_id and p.status = 'active' and p.owner_id = inquiries.owner_id)
  );

create policy "inquiries_update_parties" on public.inquiries
  for update using (tenant_id = auth.uid() or owner_id = auth.uid())
  with check (tenant_id = auth.uid() or owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- APPOINTMENTS — visible/updatable by both parties.
-- (Created automatically by the inquiries_responded trigger.)
-- ---------------------------------------------------------------------------
create policy "appointments_select_parties" on public.appointments
  for select using (tenant_id = auth.uid() or owner_id = auth.uid() or public.is_admin());

create policy "appointments_update_parties" on public.appointments
  for update using (tenant_id = auth.uid() or owner_id = auth.uid())
  with check (tenant_id = auth.uid() or owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- REVIEWS — approved reviews are public; authors write their own, tied to a
-- completed appointment they took part in. Admins moderate.
-- ---------------------------------------------------------------------------
create policy "reviews_select_approved" on public.reviews
  for select using (is_approved or reviewer_id = auth.uid() or public.is_admin());

create policy "reviews_insert_participant" on public.reviews
  for insert with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.status = 'completed'
        and ((a.tenant_id = auth.uid() and a.owner_id = reviewee_id)
          or (a.owner_id = auth.uid() and a.tenant_id = reviewee_id))
    )
  );

create policy "reviews_update_own" on public.reviews
  for update using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());

create policy "reviews_admin_all" on public.reviews
  for all using (public.is_admin());

-- ---------------------------------------------------------------------------
-- REPORTS — anyone signed-in can file; reporters see their own; admins triage.
-- ---------------------------------------------------------------------------
create policy "reports_insert" on public.reports
  for insert with check (reporter_id = auth.uid());

create policy "reports_select" on public.reports
  for select using (reporter_id = auth.uid() or public.is_admin());

create policy "reports_admin_update" on public.reports
  for update using (public.is_admin());

-- ---------------------------------------------------------------------------
-- AUDIT LOGS — admin read-only (writes happen inside security definer functions).
-- ---------------------------------------------------------------------------
create policy "audit_logs_admin_select" on public.audit_logs
  for select using (public.is_admin());
