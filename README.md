<p align="center">
  <img src="public/brand/logo-full.svg" alt="TwoGets" width="320" />
</p>

<h3 align="center">Home rental made instant — get your place, get moving.</h3>

<p align="center">
  A trust-first rental marketplace connecting <strong>verified homeowners</strong> directly with <strong>verified tenants</strong>.<br/>
  No brokers. Real documents. Real reviews. Real trust.
</p>

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 (App Router, Server Components), React 19, TypeScript |
| Styling | TailwindCSS v4, shadcn/ui-style component library, Advent Pro (brand typeface) |
| Backend | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Auth | Supabase Auth — email/password + Google OAuth |
| Deployment | Vercel |

## Features

- **Auth** — signup/login/logout, role selection (Tenant / Homeowner), Google OAuth, protected routes via middleware, session refresh.
- **Tenant module** — rich tenant profile (occupation, employer, income range, bachelor/family, pets, food preference, preferred locations, budget, move-in date), profile completion meter, Aadhaar/PAN verification, LinkedIn, saved properties, viewing requests.
- **Property discovery** — full-text search, filters (location, BHK, rent range, furnishing, pet friendly, verified owner), sorting, pagination.
- **Property details** — gallery, amenities, rent & deposit, owner profile with trust score, reviews, request-viewing scheduler.
- **Homeowner module** — create/edit/archive/delete listings with photos, video, amenities, lat/lng; ownership verification per property (utility bill / tax receipt / sale deed).
- **Inquiry system** — tenants request viewings, owners accept/reject; accepting auto-creates an appointment (date/time/status lifecycle).
- **Two-way reviews** — tenants rate owners (communication, deposit fairness, property accuracy); owners rate tenants (communication, reliability, property care). Aggregated into property ratings and user trust scores by DB triggers.
- **Trust features** — Verified Owner/Tenant/Property badges, 0–100 trust scores, review aggregation — all computed in Postgres.
- **Admin panel** — verification queue with private-document signed URLs, user ban/unban, listing takedown, review moderation, report triage, audit log.

## Project structure

```
supabase/
  migrations/
    00001_schema.sql              # enums, tables, FKs, indexes
    00002_functions_triggers.sql  # auth sync, trust score, review aggregation, audit
    00003_rls.sql                 # row-level security for every table
    00004_storage.sql             # buckets + storage policies
  seed.sql
src/
  app/
    (public)/                     # landing, /properties, /properties/[id]
    (auth)/                       # /login, /signup, /onboarding/role
    auth/callback/                # OAuth & email-confirm code exchange
    dashboard/                    # tenant & homeowner dashboards (role-aware)
    admin/                        # admin panel
    sitemap.ts, robots.ts         # SEO
  components/
    ui/                           # shadcn-style primitives
    brand/ layout/ shared/        # logo, header/footer, badges, trust score…
    property/ listing/ inquiry/ appointment/ review/ verification/ admin/
  lib/
    supabase/                     # browser / server / middleware / admin clients
    validations.ts                # zod schemas (single source of input truth)
    constants.ts  utils.ts
  server/
    actions/                      # type-safe server actions (the write API)
    queries.ts                    # read-side data access
  types/                          # Database types + app-level types
middleware.ts                     # session refresh + protected routes
```

## Local setup

### 1. Prerequisites

- Node 20+
- A [Supabase](https://supabase.com) project (free tier is fine)

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in from **Supabase → Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server-only, never exposed
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Apply database migrations

Either with the Supabase CLI:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

…or paste each file in `supabase/migrations/` (in order) into the Supabase **SQL Editor** and run them.

### 4. Configure auth

In **Supabase → Authentication**:

1. **URL configuration** — set Site URL to your domain (or `http://localhost:3000`) and add `https://<your-domain>/auth/callback` (and the localhost variant) to Redirect URLs.
2. **Google provider** — create OAuth credentials in Google Cloud Console (authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`), then paste the client ID/secret into the Google provider settings.

### 5. Run

```bash
npm install
npm run dev
```

### 6. Create an admin

Sign up normally, then in the SQL editor:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

## Deploying to Vercel

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com/new).
2. Add the four environment variables from `.env.example` (set `NEXT_PUBLIC_SITE_URL` to the production URL).
3. Deploy. Then update Supabase **Auth → URL configuration** with the production domain.
4. (Recommended) Enable Vercel Analytics & set up a custom domain.

## Security model

- **RLS everywhere** — every table denies by default; policies grant per role (`tenant`, `homeowner`, `admin`) using `auth.uid()` and security-definer helpers to avoid recursive policies.
- **Private documents** — Aadhaar/PAN/ownership docs live in a private bucket; only the uploader and admins can read them, and admins view via short-lived signed URLs.
- **Defense in depth** — server actions re-validate with zod and re-check ownership even though RLS would also block; the service-role client is only ever used inside admin-gated server code.
- **Badges & scores in the database** — verification badges, review aggregates and trust scores are computed by triggers, so no client can spoof them.

## Scaling notes (the 100k-user view)

- Read-heavy search hits composite + GIN indexes (`status+city`, full-text `search_vector`); pagination is range-based and capped.
- Aggregates (avg rating, review counts, trust score) are denormalized and trigger-maintained — no fan-out reads at request time.
- Public listing pages are server-rendered with the landing page on ISR (`revalidate = 300`); media is served from Supabase Storage CDN with `next/image` optimization.
- When the time comes: move trust-score recalculation to a queue (pg_cron / Edge Functions), add read replicas, and put listing search behind a typed RPC or a search service.
