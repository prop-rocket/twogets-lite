-- =============================================================================
-- TwoGets — 00019_admin_analytics.sql
--
-- Admin dashboard metrics, computed in SQL rather than in the Next.js layer.
--
-- Why in the database: the funnel spans swipes -> saved_properties ->
-- viewing_bookings -> reviews, which PostgREST cannot express as one aggregate,
-- so doing it in Node would mean pulling every swipe row into the server. A
-- SECURITY DEFINER function guarded by is_admin() on its first line is correct
-- by construction and needs no service-role key on that path.
--
-- Every function here is stable and refuses non-admins.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Signups per day, split by role. generate_series so quiet days appear as zero
-- rather than going missing from the chart.
-- ---------------------------------------------------------------------------
create or replace function public.admin_signup_timeseries(p_days int default 30)
returns table (day date, tenants bigint, hosts bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  return query
  select d::date as day,
         count(*) filter (where u.role = 'tenant')    as tenants,
         count(*) filter (where u.can_host)           as hosts
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') d
  left join public.users u
    on u.created_at >= d and u.created_at < d + interval '1 day'
  group by d
  order by d;
end;
$$;

-- ---------------------------------------------------------------------------
-- Supply: where the listings are and what state they're in.
-- ---------------------------------------------------------------------------
create or replace function public.admin_listing_breakdown()
returns table (city text, total bigint, active bigint, verified bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  return query
  select p.city,
         count(*)                                        as total,
         count(*) filter (where p.status = 'active')      as active,
         count(*) filter (where p.is_verified)            as verified
  from public.properties p
  group by p.city
  order by count(*) desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- The funnel, keyed on (tenant, property) so each stage counts intents, not rows.
-- Requested/accepted are separate now that owners approve site visits — the gap
-- between them is the owner-responsiveness signal.
-- ---------------------------------------------------------------------------
create or replace function public.admin_funnel(p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => p_days);
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select jsonb_build_object(
    'swiped_right', (select count(*) from public.swipes
                      where direction = 'right' and swiped_at >= v_since),
    'shortlisted',  (select count(*) from public.saved_properties
                      where created_at >= v_since),
    'requested',    (select count(distinct (tenant_id, listing_id)) from public.viewing_bookings
                      where created_at >= v_since),
    'accepted',     (select count(distinct (tenant_id, listing_id)) from public.viewing_bookings
                      where created_at >= v_since
                        and status in ('confirmed', 'attended', 'no_show')),
    'attended',     (select count(distinct (tenant_id, listing_id)) from public.viewing_bookings
                      where created_at >= v_since and status = 'attended'),
    'reviewed',     (select count(*) from public.reviews
                      where created_at >= v_since and is_approved)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Did the viewings actually happen, and did owners answer at all?
-- ---------------------------------------------------------------------------
create or replace function public.admin_viewing_health(p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => p_days);
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select jsonb_build_object(
    'pending',   count(*) filter (where status = 'pending'),
    'confirmed', count(*) filter (where status = 'confirmed'),
    'declined',  count(*) filter (where status = 'declined'),
    'cancelled', count(*) filter (where status = 'cancelled'),
    'attended',  count(*) filter (where status = 'attended'),
    'no_show',   count(*) filter (where status = 'no_show'),
    -- Requests still unanswered after two days: the owner-neglect signal.
    'stale_requests', count(*) filter (
      where status = 'pending' and created_at < now() - interval '2 days'
    )
  ) into v_result
  from public.viewing_bookings
  where created_at >= v_since;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- How quickly the verification queue is being worked, and what's stuck.
-- ---------------------------------------------------------------------------
create or replace function public.admin_verification_sla()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select jsonb_build_object(
    'pending',        count(*) filter (where status = 'pending'),
    'approved',       count(*) filter (where status = 'approved'),
    'rejected',       count(*) filter (where status = 'rejected'),
    'oldest_pending_days',
      coalesce(extract(day from now() - min(created_at) filter (where status = 'pending'))::int, 0),
    'avg_hours_to_review',
      coalesce(round(avg(extract(epoch from (reviewed_at - created_at)) / 3600.0)
        filter (where reviewed_at is not null))::int, 0),
    -- Listings whose paperwork is in but still need the owner phoned.
    'awaiting_owner_call',
      (select count(*) from public.properties
        where owner_relationship <> 'self' and listing_kind = 'rental'
          and owner_confirmed_at is null)
  ) into v_result
  from public.verification_requests;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who's on the platform, and on what plan.
-- ---------------------------------------------------------------------------
create or replace function public.admin_user_mix()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select jsonb_build_object(
    'total',     count(*),
    'tenants',   count(*) filter (where role = 'tenant'),
    'hosts',     count(*) filter (where can_host),
    'dual',      count(*) filter (where can_host and role = 'tenant'),
    'verified',  count(*) filter (where is_verified),
    'banned',    count(*) filter (where is_banned),
    'plus',      count(*) filter (where plan = 'plus'),
    'free',      count(*) filter (where plan = 'free')
  ) into v_result
  from public.users
  where role is distinct from 'admin';

  return v_result;
end;
$$;
