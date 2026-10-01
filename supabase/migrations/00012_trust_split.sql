-- =============================================================================
-- TwoGets — 00012_trust_split.sql
--
-- One reputation per side of the marketplace.
--
-- Now that an account can both let and rent, pooling every review into one
-- trust_score merges two genuinely incommensurable things: how good a landlord
-- someone is, and how good a tenant they are. The review table already carries
-- the distinction (review_dimensions_match_type forces each review into exactly
-- one dimension set) — only the aggregate ignored it.
--
--   owner_review  = a review OF a lister  -> letting_trust_score
--   tenant_review = a review OF a renter  -> renting_trust_score
--
-- trust_score itself is KEPT and keeps its original pooled formula. Dropping it
-- would mean touching every read site at once; keeping it means the split is
-- purely additive and nothing existing changes behaviour.
-- =============================================================================

alter table public.users
  add column if not exists letting_trust_score numeric(5, 2) not null default 20.00,
  add column if not exists renting_trust_score numeric(5, 2) not null default 20.00;

comment on column public.users.letting_trust_score is
  'Reputation as a Homeowner/Host, from owner_review ratings.';
comment on column public.users.renting_trust_score is
  'Reputation as a renter, from tenant_review ratings.';

-- ---------------------------------------------------------------------------
-- One pass, three scores. Identity verification is mode-agnostic, so it counts
-- toward both sides as well as the pooled figure.
-- ---------------------------------------------------------------------------
create or replace function public.recalc_trust_score(target uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_verified boolean;
  v_bonus    numeric;
  v_avg      numeric;  v_count      integer;
  v_let_avg  numeric;  v_let_count  integer;
  v_rent_avg numeric;  v_rent_count integer;
begin
  select is_verified into v_verified from public.users where id = target;
  if not found then return; end if;
  v_bonus := case when v_verified then 30 else 0 end;

  select
    coalesce(avg(overall_rating), 0),
    count(*),
    coalesce(avg(overall_rating) filter (where review_type = 'owner_review'), 0),
    count(*)              filter (where review_type = 'owner_review'),
    coalesce(avg(overall_rating) filter (where review_type = 'tenant_review'), 0),
    count(*)              filter (where review_type = 'tenant_review')
  into v_avg, v_count, v_let_avg, v_let_count, v_rent_avg, v_rent_count
  from public.reviews
  where reviewee_id = target and is_approved;

  update public.users set
    -- unchanged pooled formula, so existing reads keep their current meaning
    trust_score         = round(20 + v_bonus + (v_avg      / 5.0) * 50 * (least(v_count,      10) / 10.0), 2),
    letting_trust_score = round(20 + v_bonus + (v_let_avg  / 5.0) * 50 * (least(v_let_count,  10) / 10.0), 2),
    renting_trust_score = round(20 + v_bonus + (v_rent_avg / 5.0) * 50 * (least(v_rent_count, 10) / 10.0), 2)
  where id = target;
end;
$$;

-- ---------------------------------------------------------------------------
-- The new columns would otherwise be freely self-writable: users_update_own
-- only constrains the columns it names. Pin them alongside the others.
-- ---------------------------------------------------------------------------
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (role is not distinct from (select u.role from public.users u where u.id = auth.uid())
         or role in ('tenant', 'homeowner'))
    and is_banned           = (select u.is_banned           from public.users u where u.id = auth.uid())
    and plan                = (select u.plan                from public.users u where u.id = auth.uid())
    and is_verified         = (select u.is_verified         from public.users u where u.id = auth.uid())
    and trust_score         = (select u.trust_score         from public.users u where u.id = auth.uid())
    and letting_trust_score = (select u.letting_trust_score from public.users u where u.id = auth.uid())
    and renting_trust_score = (select u.renting_trust_score from public.users u where u.id = auth.uid())
    and email               = (select u.email               from public.users u where u.id = auth.uid())
  );

-- Populate the new columns for everyone. Idempotent, and by construction this
-- leaves trust_score exactly as it was.
select public.recalc_trust_score(id) from public.users;
