# Event QR Ticketing

A single-event web app: attendees register, an admin manually verifies their bank
transfer and issues a **unique per-person QR ticket**, and gate staff scan each QR
to check attendees in **exactly once**.

Built with Next.js (App Router) + Prisma + Postgres. Designed to run on free tiers
(Vercel + Supabase/Neon) at **$0/month**.

## Roles

- **Attendee** — registers, logs in, views ticket status and QR code at `/ticket`.
- **Admin** — verifies transfers and approves/rejects at `/admin`; manages capacity,
  registration open/close, and gate-staff accounts. Can also search the full guest
  roster, add a guest directly (instant ticket, no login), view/share any guest's QR
  via a public `/t/<token>` link, and remove a guest (frees a capacity slot).
- **Gate staff** — scans QR codes at the door at `/scan`.

## Local development

Prerequisites: Node 20+, and a Postgres database. The quickest local Postgres:

```bash
docker run -d --name qrtickets-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=qrtickets_test \
  -p 5432:5432 postgres:16
# create a SEPARATE database for dev/demo so the test suite never wipes it:
docker exec qrtickets-pg psql -U postgres -c "CREATE DATABASE qrtickets_dev;"
```

> **Important:** the test suite wipes its database on every run. Keep dev/demo
> and tests on **different** databases — dev on `qrtickets_dev`, tests on
> `qrtickets_test` (the default in `tests/setup.ts`). Otherwise `npm test` will
> delete your seeded admin and demo data.

Then:

```bash
cp .env.example .env
# set DATABASE_URL to the DEV database (…/qrtickets_dev) and a session secret:
#   openssl rand -base64 48
npx prisma migrate dev          # apply schema to the dev DB
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=strongpass npm run prisma:seed
npm run dev                     # http://localhost:3000
```

Log in at `/login` with the admin credentials you seeded.

## Running tests

Tests run against a real Postgres database (they read/write and **delete** real
rows), so they must use their own throwaway DB — never your dev/prod one.

```bash
# apply the schema to the test DB once:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qrtickets_test" npx prisma migrate deploy
npm test    # tests/setup.ts defaults DATABASE_URL to qrtickets_test
```

## Deployment (Vercel + Supabase/Neon)

1. **Database:** create a free Supabase or Neon Postgres project. Copy its connection
   string (the pooled/`DATABASE_URL` value).
2. **Apply schema once** against the production DB:
   `DATABASE_URL="<prod-url>" npx prisma migrate deploy`
   then seed the admin + event settings:
   `DATABASE_URL="<prod-url>" ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run prisma:seed`
3. **Vercel:** create a project from this repo. Set environment variables:
   - `DATABASE_URL` = production connection string
   - `SESSION_SECRET` = output of `openssl rand -base64 48`
4. Deploy. `prisma generate` runs automatically via the `build`/`postinstall` scripts.
5. (Optional) add a custom domain in Vercel.

## Operational notes

- **The scanning phone needs internet** (venue wifi or mobile data) — check-in is
  verified server-side on each scan.
- **Password reset is admin-assisted** for launch (no outbound email). To reset a
  user, update their `passwordHash` directly (e.g. via a one-off script using
  `bcrypt.hash`).
- **Capacity** and **registration open/close** are controlled from `/admin`.

## Event-day manual test checklist

1. Register an attendee → `/ticket` shows "Payment under review".
2. Admin logs in → sees the pending registration → **Approve** → attendee `/ticket`
   now shows the QR code + `TICK-####` reference.
3. Staff logs in → `/scan` → scan the attendee QR → ✅ name shown, count increments.
4. Scan the same QR again → ⚠️ "Already used".
5. Scan a random/garbage QR → ❌ "Invalid ticket".
5b. **Manual fallback:** on `/scan`, type the attendee's `TICK-XXXXXX` code
    (case-insensitive, prefix optional) → ✅ checks them in the same way.
6. Set capacity to the current approved count → approving another registration →
   "At capacity".
7. Close registration → a new registration attempt → "Registration is closed."
8. A non-admin visiting `/admin` and a non-staff visiting `/scan` are redirected to
   `/login`.
