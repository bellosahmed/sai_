# QR Ticketing Web App — Design Spec

**Date:** 2026-07-11
**Status:** Approved for planning

## 1. Summary

A web application for a single event where people register, have their bank
transfer manually verified by an admin, and then receive a unique per-person QR
code ticket. Gate staff scan each QR at the door to check attendees in. Every QR
is cryptographically unique to one ticket and can only be used to check in once.

**Goal:** A real product to launch for one event (capacity up to 500).

**Cost target:** $0/month using free tiers.

## 2. Tech Stack

- **Framework:** Next.js (TypeScript) — React frontend + API routes in one codebase.
- **Database:** Postgres via Supabase (or Neon) free tier.
- **Hosting:** Vercel free tier.
- **QR generation:** open-source QR library (server-side image generation).
- **QR scanning:** browser camera library on the gate-staff phone (no app install).
- **Payments:** none — manual bank transfer, admin-verified.
- **Email:** none for launch — on-screen QR delivery, admin-assisted password reset.

Rationale: one codebase, one deploy, full control over the critical check-in
logic, and everything runs comfortably inside free tiers for one <500-person event.

## 3. User Roles

Three roles served from the same app, distinguished by `users.role`:

1. **Attendee** — registers, logs in, views ticket status and QR code.
2. **Admin** (sole admin = the operator) — verifies transfers, approves/rejects
   registrations, issues tickets, manages settings and staff, views live counts.
3. **Gate staff** — logs into a scanner page on a phone, scans QRs at the door.
   One or more staff accounts, created by the admin.

## 4. Architecture

```
Next.js app (Vercel)
  ├── Attendee pages (register, login, ticket status/QR)
  ├── Admin pages (dashboard, pending list, settings, staff mgmt)
  ├── Scanner page (camera scan + result)
  └── API routes (registration, approval, QR issue, check-in)
          │
     Supabase Postgres (users, registrations, tickets, event_settings)
```

Role-based auth: the login system knows whether a user is an attendee, admin, or
staff, and routes them to the appropriate pages.

## 5. Data Model

### `users`
- `id`
- `email` (unique)
- `password_hash`
- `role`: `attendee` | `admin` | `staff`
- `created_at`

### `registrations`
- `id`
- `user_id` → `users.id`
- `full_name`
- `phone`
- `payment_reference` (attendee's bank-transfer reference)
- `status`: `pending` | `approved` | `rejected`
- `created_at`
- `approved_at`
- `approved_by` → `users.id` (admin)

### `tickets`
Created only when a registration is approved.
- `id`
- `registration_id` → `registrations.id`
- `reference_code` — human-friendly, e.g. `TICK-4821`
- `qr_token` — long cryptographically-random unguessable string (~32 chars);
  this is what the QR encodes. Unique.
- `checked_in_at` — null until first scan
- `checked_in_by` → `users.id` (staff)
- `created_at`

### `event_settings`
Single row for the one event.
- `event_name`
- `capacity` (configurable, e.g. 500)
- `registration_open` (bool)

Notes:
- A ticket (and its QR) exists **only after admin approval**.
- `qr_token` (secret authenticity proof) is distinct from `reference_code`
  (human/support reference).
- Capacity is enforced by counting approved tickets against `capacity`.

## 6. QR Code Security & Check-in (Critical Logic)

**QR contents:** On approval, the server generates a cryptographically-random
`qr_token` tied to exactly one ticket row. The QR image encodes this token (or a
URL containing it). Random + unique + server-issued ⇒ unforgeable and unique per
attendee.

**On scan (gate staff phone):**
1. Browser reads `qr_token`, sends it to the check-in API.
2. Server looks up ticket by `qr_token`:
   - **Not found** → ❌ "Invalid ticket".
   - **Found, not checked in** → ✅ "Valid — {full_name}", and atomically marks
     the ticket checked in.
   - **Found, already checked in** → ⚠️ "Already used at {time} by {staff}".
3. On success, staff sees the attendee's **name** to visually confirm identity.

**Atomicity:** Check-in is a single conditional update:
`UPDATE tickets SET checked_in_at = now(), checked_in_by = ?
 WHERE qr_token = ? AND checked_in_at IS NULL`.
Only the first of two concurrent scans of the same QR succeeds; the other sees
"already used". This makes the one-time guarantee bulletproof against shared
screenshots.

## 7. End-to-End Flows

### Attendee
1. Register: full name, email, phone, payment reference, password.
2. If registration closed or capacity reached → "Registration closed", cannot submit.
3. Log in → status page: "Payment under review".
4. On approval → status page shows QR code + reference code + event details.
5. On rejection → polite message: "We couldn't verify your payment — contact us."

### Admin
1. Log in → dashboard with live counts (registered, approved, checked-in,
   capacity remaining).
2. Pending registrations list (name, phone, payment reference).
3. Verify transfer externally → Approve (issues ticket + QR) or Reject.
4. Create gate-staff accounts; toggle registration open/closed; set capacity.

### Gate staff
1. Log in on phone → scanner page → grant camera access.
2. Scan QR → instant ✅ / ⚠️ / ❌ with attendee name.
3. Running checked-in count visible.

## 8. Edge Cases & Error Handling

- **Double-scan / shared screenshot** → atomic check-in; only first admitted.
- **Capacity race** → capacity checked at approval against live count; never
  exceed cap.
- **Lost link / forgotten password** → email+password login; admin-assisted
  password reset for launch (no email infra). Email-based reset can be added later.
- **Fake/garbage QR** → token not found → "Invalid ticket".
- **No internet at gate** → scanner requires connectivity; venue wifi or mobile
  data on the scanning phone is a known operational requirement.
- **Registration closed / sold out** → registration form blocks submissions.

## 9. Testing

- **Unit tests:** `qr_token` uniqueness/randomness, atomic check-in (including the
  concurrent double-scan case), capacity enforcement.
- **Integration tests:** API route flow register → approve → issue QR → scan →
  re-scan.
- **Manual test pass:** real-phone camera scanner check before the event.
- **Test-first (TDD):** especially for check-in and capacity logic — the parts
  that must not fail on event day.

## 10. Out of Scope (for launch)

- Online payment processing (manual bank transfer only).
- Email delivery (on-screen QR; admin-assisted password reset).
- Multiple events / ticket tiers (single event only).
- Attendee photos on scan (name only).
- Offline scanning mode.
