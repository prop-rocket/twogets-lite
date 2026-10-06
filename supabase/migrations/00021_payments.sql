-- =============================================================================
-- TwoGets — 00021_payments.sql
--
-- Monetisation scaffolding. NOTHING here charges real money — there is no
-- gateway yet. The shape is chosen so Razorpay can be added later by writing a
-- webhook into payment_events and filling the provider_* columns, without
-- redesigning anything.
--
-- users.plan stays exactly as it is and stays the thing the public app reads.
-- It becomes a denormalised cache maintained by a trigger on subscriptions, so
-- the tenant-facing Plus/free behaviour is untouched.
-- =============================================================================

create type public.subscription_status as enum
  ('trialing', 'active', 'past_due', 'cancelled', 'expired');
create type public.transaction_status as enum
  ('created', 'authorized', 'captured', 'failed', 'refunded');

-- ---------------------------------------------------------------------------
-- What can be sold. Prices in paise — integer money, never floating point.
-- ---------------------------------------------------------------------------
create table public.plans (
  code        text primary key,
  name        text not null,
  price_paise integer not null check (price_paise >= 0),
  interval    text not null default 'month' check (interval in ('month', 'year', 'once')),
  features    jsonb not null default '[]',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.plans (code, name, price_paise, interval, features) values
  ('free', 'Free',  0,      'month', '["3 shortlists a day"]'),
  ('plus', 'Plus',  29900,  'month', '["Unlimited shortlists","Priority support"]')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Who is on what. provider defaults to 'manual' because today an admin keys
-- these in; Razorpay later writes the same rows with its own ids.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.users (id) on delete cascade,
  plan_code               text not null references public.plans (code),
  status                  public.subscription_status not null default 'active',
  started_at              timestamptz not null default now(),
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  provider                text not null default 'manual',
  provider_subscription_id text,
  notes                   text,
  created_by              uuid references public.users (id) on delete set null,
  metadata                jsonb not null default '{}',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- At most one live subscription per person.
create unique index subscriptions_one_live_per_user
  on public.subscriptions (user_id)
  where status in ('trialing', 'active', 'past_due');
create index subscriptions_user_idx on public.subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Money actually moving.
-- ---------------------------------------------------------------------------
create table public.transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  subscription_id   uuid references public.subscriptions (id) on delete set null,
  amount_paise      integer not null check (amount_paise >= 0),
  currency          text not null default 'INR',
  status            public.transaction_status not null default 'captured',
  method            text,
  provider          text not null default 'manual',
  provider_payment_id text,
  provider_order_id   text,
  /** The admin who keyed this in, for a manual record. */
  recorded_by       uuid references public.users (id) on delete set null,
  notes             text,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  captured_at       timestamptz
);
create index transactions_user_idx on public.transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Raw gateway callbacks, stored before interpretation. Unused until Razorpay
-- exists, but having it now means the webhook has somewhere idempotent to land.
-- ---------------------------------------------------------------------------
create table public.payment_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  event_type        text not null,
  provider_event_id text unique,
  payload           jsonb not null default '{}',
  processed_at      timestamptz,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- users.plan follows the subscription. SECURITY DEFINER because the writer may
-- be an admin acting on someone else's row, and users_update_own pins plan.
-- ---------------------------------------------------------------------------
create or replace function public.sync_user_plan()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := coalesce(new.user_id, old.user_id);
begin
  update public.users u
     set plan = case
       when exists (
         select 1 from public.subscriptions s
          where s.user_id = v_user
            and s.plan_code = 'plus'
            and s.status in ('trialing', 'active', 'past_due')
       ) then 'plus'::public.user_plan
       else 'free'::public.user_plan
     end
   where u.id = v_user;
  return null;
end;
$$;

create trigger subscriptions_sync_plan
  after insert or update or delete on public.subscriptions
  for each row execute function public.sync_user_plan();

-- ---------------------------------------------------------------------------
-- RLS: billing is admin-only to write. People may read their own records.
-- ---------------------------------------------------------------------------
alter table public.plans          enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.transactions   enable row level security;
alter table public.payment_events enable row level security;

create policy "plans_read_all" on public.plans for select using (true);
create policy "plans_admin_write" on public.plans for all
  using (public.is_admin()) with check (public.is_admin());

create policy "subscriptions_read_own" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "subscriptions_admin_write" on public.subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "transactions_read_own" on public.transactions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "transactions_admin_write" on public.transactions
  for all using (public.is_admin()) with check (public.is_admin());

-- Gateway payloads are admin-only; nothing user-facing should read them.
create policy "payment_events_admin" on public.payment_events
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Revenue summary for the admin dashboard.
-- ---------------------------------------------------------------------------
create or replace function public.admin_revenue_summary(p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => p_days);
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select jsonb_build_object(
    'captured_paise', coalesce(sum(amount_paise) filter (where status = 'captured'), 0),
    'refunded_paise', coalesce(sum(amount_paise) filter (where status = 'refunded'), 0),
    'failed_count',   count(*) filter (where status = 'failed'),
    'txn_count',      count(*) filter (where status = 'captured'),
    'active_subs',    (select count(*) from public.subscriptions
                        where status in ('trialing', 'active', 'past_due')),
    'mrr_paise',      (select coalesce(sum(pl.price_paise), 0)
                         from public.subscriptions s
                         join public.plans pl on pl.code = s.plan_code
                        where s.status in ('trialing', 'active')
                          and pl.interval = 'month')
  ) into v_result
  from public.transactions
  where created_at >= v_since;

  return v_result;
end;
$$;
