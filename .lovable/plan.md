# Trip Budget App — Plan

A multi-trip budget tracker with login, multi-currency expenses, and a fast "+/−" entry flow. Ocean Deep palette (deep navy → teal).

## Core flows

1. **Sign up / sign in** — email+password and Google (Lovable Cloud auth).
2. **My Trips** — list of trips with name, dates, destination, total budget, spent, remaining. Big "+ New trip" button.
3. **Trip detail** — the workhorse screen:
   - Budget ring/bar: spent vs. remaining in trip currency.
   - Big **+** (expense) and **−** (refund/income) buttons always visible.
   - Quick-add sheet: amount → currency → category → note → (optional date). Saves in one tap.
   - Live list of expenses grouped by day, each with category icon, amount, note, currency badge if not trip currency.
   - Swipe / tap row to edit or delete.
4. **Categories** — preset (Food, Transport, Lodging, Activities, Shopping, Other) with icons + ability to add custom categories per user.
5. **Summary** — per-category totals, per-day totals, % of budget used.

## Pages (TanStack routes)

- `/` — landing (brief pitch, CTA to sign up / open app)
- `/login`, `/signup`, `/reset-password`
- `/_authenticated/trips` — trips list
- `/_authenticated/trips/new` — create trip
- `/_authenticated/trips/$tripId` — trip detail with quick-add
- `/_authenticated/trips/$tripId/summary` — breakdowns
- `/_authenticated/settings` — currencies, custom categories, sign out

## Data model (Lovable Cloud / Postgres)

- `profiles` (id, display_name, default_currency)
- `trips` (id, user_id, name, destination, start_date, end_date, budget_amount, currency, created_at)
- `categories` (id, user_id NULL for presets, name, icon, color)
- `expenses` (id, trip_id, user_id, amount, currency, fx_rate_to_trip, amount_in_trip_currency, category_id, note, spent_at, kind: 'expense' | 'income', created_at)

RLS: users can only access their own rows. Roles not needed for v1.

## Multi-currency

- Each expense stores its original amount + currency AND a converted amount in the trip's currency.
- FX rates fetched from a free public endpoint (e.g. exchangerate.host) via a server function, cached per day. User can override the rate when adding.

## Design (Ocean Deep)

- Background: deep navy `#0c2340`; cards `#1a4a6e`; accent teal `#2d8a9e`; highlight `#5cbdb9`.
- Typography: a clean sans (Inter/Sora) headings, lighter body.
- Big rounded budget ring, soft glow on accent CTAs, generous spacing. Mobile-first; works on desktop.

## Tech

- TanStack Start + Tailwind tokens in `src/styles.css`.
- Lovable Cloud (Supabase) for auth + DB; `createServerFn` for FX lookups and any privileged reads.
- React Query for data fetching; zod for input validation.

## Build order

1. Enable Lovable Cloud, set up auth (email + Google) and `profiles` table.
2. Define `trips`, `categories`, `expenses` tables + RLS + seed preset categories.
3. Design tokens + layout shell (header, nav, theme).
4. Trips list + create-trip form.
5. Trip detail with quick add/subtract and live list.
6. FX conversion server function + currency picker.
7. Custom categories + settings.
8. Summary view (totals by category & day).
9. Landing page polish + SEO meta on each route.
