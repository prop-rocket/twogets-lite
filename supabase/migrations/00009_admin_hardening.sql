-- =============================================================================
-- TwoGets — 00009_admin_hardening.sql
--
-- 1. Restores working admin audit logging.
--
--    00003 deliberately gave audit_logs an admin SELECT policy only, noting
--    "writes happen inside security definer functions". The admin server
--    actions never honoured that: they INSERT through the RLS-scoped client and
--    discard the result, so every write was silently rejected. Verified on the
--    live database — audit_logs contained only rows written by the existing
--    SECURITY DEFINER triggers, and none from the app.
--
--    log_admin_action() is the missing writer. It self-checks is_admin() and
--    stamps actor_id from auth.uid(), so the actor cannot be spoofed by the
--    caller and no INSERT policy (which would be spoofable) is needed.
--
-- 2. Gives admins read access to saved_properties. It had only a
--    "tenant_id = auth.uid()" policy, so an admin saw zero rows and any
--    shortlist metric silently read as empty.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Admin audit writer
-- ---------------------------------------------------------------------------
create or replace function public.log_admin_action(
  p_action      text,
  p_entity_type text,
  p_entity_id   text,
  p_metadata    jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admins can read shortlists (needed for demand metrics)
-- ---------------------------------------------------------------------------
drop policy if exists "saved_properties_admin_select" on public.saved_properties;
create policy "saved_properties_admin_select" on public.saved_properties
  for select using (public.is_admin());
