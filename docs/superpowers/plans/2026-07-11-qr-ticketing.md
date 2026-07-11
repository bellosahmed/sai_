# QR Ticketing Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-event web app where attendees register, an admin manually verifies bank transfers and issues a unique per-person QR ticket, and gate staff scan each QR to check attendees in exactly once.

**Architecture:** One Next.js (App Router, TypeScript) application serving attendee, admin, and gate-staff pages plus API route handlers, backed by a Postgres database accessed through Prisma. Business logic lives in framework-agnostic service modules (`src/services/*`) so it can be unit/integration tested without HTTP. Auth is a lightweight custom email+password system using bcrypt hashing and a signed JWT session cookie, with three roles.

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript, Prisma ORM + Postgres (Supabase/Neon in prod, local Postgres for tests), Vitest for tests, `bcryptjs` for hashing, `jose` for JWT session cookies, `qrcode` for QR image generation, `html5-qrcode` for browser camera scanning. Deployed on Vercel.

## Global Constraints

- **Single event only** — one row in `event_settings`; no multi-event/multi-tier logic.
- **Capacity:** hard cap, configurable (default 500). Never issue more approved tickets than `capacity`.
- **No payment processor** — payment is manual bank transfer, admin-verified.
- **No outbound email** — QR delivered on-screen; password reset is admin-assisted.
- **Cost target $0/month** — only free-tier services (Vercel, Supabase/Neon).
- **QR token** must be cryptographically random and unguessable (≥ 32 bytes of entropy), unique per ticket.
- **Check-in must be atomic** — a single conditional UPDATE; only the first scan of a QR succeeds.
- **Roles:** `attendee` | `admin` | `staff` on `users.role`.
- **TDD:** write the failing test first for every service; commit after each green step.

---

## File Structure

```
prisma/
  schema.prisma            # models: User, Registration, Ticket, EventSettings
  seed.ts                  # seeds event_settings + first admin
src/
  lib/
    db.ts                  # Prisma client singleton
    env.ts                 # validated env vars
  services/
    auth.ts                # hashPassword, verifyPassword, createSession, verifySession
    registration.ts        # registerAttendee, capacity/open checks
    approval.ts            # approveRegistration, rejectRegistration (issues ticket)
    tickets.ts             # generateQrToken, generateReferenceCode, generateQrDataUrl
    checkin.ts             # checkIn (atomic), CheckInResult type
    stats.ts               # event counts for admin dashboard
  session/
    current-user.ts        # getCurrentUser() reads cookie server-side
  app/
    layout.tsx
    page.tsx               # landing → links to register/login
    register/page.tsx      # attendee registration form
    login/page.tsx         # shared login (routes by role)
    ticket/page.tsx        # attendee status + QR
    admin/page.tsx         # dashboard: counts, pending list, settings, staff
    scan/page.tsx          # gate-staff scanner
    api/
      register/route.ts
      login/route.ts
      logout/route.ts
      admin/approve/route.ts
      admin/reject/route.ts
      admin/settings/route.ts
      admin/staff/route.ts
      checkin/route.ts
    middleware.ts          # role-based route protection
tests/
  services/*.test.ts       # unit/integration tests per service
vitest.config.ts
.env.example
```

---

### Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/lib/env.ts`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `env` object from `src/lib/env.ts` with `DATABASE_URL: string`, `SESSION_SECRET: string`; a working `npm test` and `npm run dev`.

- [ ] **Step 1: Initialize the Next.js app and install dependencies**

```bash
npx create-next-app@latest . --ts --app --no-tailwind --no-src-dir --eslint --use-npm --yes
# then reorganize into src/ (create-next-app --no-src-dir keeps app/ at root; move it)
mkdir -p src && git mv app src/app 2>/dev/null || mv app src/app
npm install prisma @prisma/client bcryptjs jose qrcode html5-qrcode
npm install -D vitest @vitejs/plugin-react bcryptjs @types/qrcode @types/bcryptjs
```

Set `tsconfig.json` `compilerOptions.paths` to map `"@/*": ["./src/*"]`.

- [ ] **Step 2: Write the smoke test**

```ts
// tests/smoke.test.ts
import { describe, it, expect } from 'vitest';
import { env } from '@/lib/env';

describe('smoke', () => {
  it('loads validated env', () => {
    expect(typeof env.DATABASE_URL).toBe('string');
    expect(typeof env.SESSION_SECRET).toBe('string');
  });
});
```

- [ ] **Step 3: Create env loader and vitest config**

```ts
// src/lib/env.ts
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  SESSION_SECRET: required('SESSION_SECRET'),
};
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: { environment: 'node', setupFiles: ['tests/setup.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

```ts
// tests/setup.ts
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/qrtickets_test';
process.env.SESSION_SECRET ??= 'test-secret-at-least-32-characters-long!!';
```

Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json` scripts.

- [ ] **Step 4: Run the smoke test — expect PASS**

Run: `npm test -- tests/smoke.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Create `.env.example` and `.gitignore` entries**

```
# .env.example
DATABASE_URL="postgresql://USER:PASS@HOST:5432/DBNAME"
SESSION_SECRET="generate-with: openssl rand -base64 48"
```

Ensure `.gitignore` contains `.env`, `node_modules`, `.next`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with vitest and env loader"
```

---

### Task 2: Database schema, client, and seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`
- Create: `src/lib/db.ts`
- Test: `tests/services/db.test.ts`

**Interfaces:**
- Consumes: `env.DATABASE_URL`.
- Produces: `prisma` (PrismaClient singleton) from `@/lib/db`; models `User`, `Registration`, `Ticket`, `EventSettings` with fields exactly as below.

- [ ] **Step 1: Write the schema**

```prisma
// prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { attendee admin staff }
enum RegStatus { pending approved rejected }

model User {
  id           String        @id @default(cuid())
  email        String        @unique
  passwordHash String
  role         Role          @default(attendee)
  createdAt    DateTime      @default(now())
  registration Registration?
}

model Registration {
  id               String    @id @default(cuid())
  userId           String    @unique
  user             User      @relation(fields: [userId], references: [id])
  fullName         String
  phone            String
  paymentReference String
  status           RegStatus @default(pending)
  createdAt        DateTime  @default(now())
  approvedAt       DateTime?
  approvedById     String?
  ticket           Ticket?
}

model Ticket {
  id             String    @id @default(cuid())
  registrationId String    @unique
  registration   Registration @relation(fields: [registrationId], references: [id])
  referenceCode  String    @unique
  qrToken        String    @unique
  checkedInAt    DateTime?
  checkedInById  String?
  createdAt      DateTime  @default(now())
}

model EventSettings {
  id               Int      @id @default(1)
  eventName        String
  capacity         Int      @default(500)
  registrationOpen Boolean  @default(true)
}
```

- [ ] **Step 2: Create the Prisma client singleton**

```ts
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
```

- [ ] **Step 3: Apply migration to the test database**

Run: `npx prisma migrate dev --name init`
Expected: migration created and applied; `Prisma Client generated`.
(Requires a local Postgres reachable at `DATABASE_URL`; see README note in Task 12.)

- [ ] **Step 4: Write the DB round-trip test**

```ts
// tests/services/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';

beforeEach(async () => {
  await prisma.ticket.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.user.deleteMany();
});

describe('db', () => {
  it('creates and reads a user', async () => {
    const u = await prisma.user.create({
      data: { email: 'a@b.com', passwordHash: 'x', role: 'attendee' },
    });
    const found = await prisma.user.findUnique({ where: { id: u.id } });
    expect(found?.email).toBe('a@b.com');
  });
});
```

- [ ] **Step 5: Run the test — expect PASS**

Run: `npm test -- tests/services/db.test.ts`
Expected: 1 passed.

- [ ] **Step 6: Write the seed script**

```ts
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  await prisma.eventSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, eventName: 'My Event', capacity: 500, registrationOpen: true },
  });
  const email = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const pass = process.env.ADMIN_PASSWORD ?? 'changeme123';
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await bcrypt.hash(pass, 10), role: 'admin' },
  });
}
main().finally(() => prisma.$disconnect());
```

Add to `package.json`: `"prisma": { "seed": "tsx prisma/seed.ts" }` and install `tsx` as a dev dependency (`npm i -D tsx`).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add prisma schema, client, and seed"
```

---

### Task 3: Auth service (hashing + session tokens)

**Files:**
- Create: `src/services/auth.ts`
- Test: `tests/services/auth.test.ts`

**Interfaces:**
- Consumes: `env.SESSION_SECRET`.
- Produces:
  - `hashPassword(pw: string): Promise<string>`
  - `verifyPassword(pw: string, hash: string): Promise<boolean>`
  - `createSession(payload: { userId: string; role: 'attendee'|'admin'|'staff' }): Promise<string>`
  - `verifySession(token: string): Promise<{ userId: string; role: 'attendee'|'admin'|'staff' } | null>`
  - `SESSION_COOKIE = 'session'` (exported const)

- [ ] **Step 1: Write the failing tests**

```ts
// tests/services/auth.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, createSession, verifySession } from '@/services/auth';

describe('auth', () => {
  it('hashes and verifies a password', async () => {
    const h = await hashPassword('secret123');
    expect(await verifyPassword('secret123', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });
  it('round-trips a session token', async () => {
    const token = await createSession({ userId: 'u1', role: 'admin' });
    const decoded = await verifySession(token);
    expect(decoded).toEqual({ userId: 'u1', role: 'admin' });
  });
  it('rejects a tampered token', async () => {
    expect(await verifySession('not.a.jwt')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module '@/services/auth'`)

Run: `npm test -- tests/services/auth.test.ts`

- [ ] **Step 3: Implement the auth service**

```ts
// src/services/auth.ts
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

export const SESSION_COOKIE = 'session';
type Role = 'attendee' | 'admin' | 'staff';
const key = new TextEncoder().encode(env.SESSION_SECRET);

export function hashPassword(pw: string) { return bcrypt.hash(pw, 10); }
export function verifyPassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }

export async function createSession(payload: { userId: string; role: Role }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(key);
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, key);
    return { userId: payload.userId as string, role: payload.role as Role };
  } catch { return null; }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/services/auth.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/auth.ts tests/services/auth.test.ts
git commit -m "feat: add auth service (bcrypt + jose sessions)"
```

---

### Task 4: Registration service (capacity + open checks)

**Files:**
- Create: `src/services/registration.ts`
- Test: `tests/services/registration.test.ts`

**Interfaces:**
- Consumes: `prisma`, `hashPassword`.
- Produces:
  - `class RegistrationError extends Error { code: 'CLOSED' | 'FULL' | 'EMAIL_TAKEN' }`
  - `registerAttendee(input: { email: string; password: string; fullName: string; phone: string; paymentReference: string }): Promise<{ userId: string; registrationId: string }>`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/services/registration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { registerAttendee, RegistrationError } from '@/services/registration';

const base = { password: 'pw1234567', fullName: 'A B', phone: '0800', paymentReference: 'REF1' };

beforeEach(async () => {
  await prisma.ticket.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.user.deleteMany();
  await prisma.eventSettings.upsert({
    where: { id: 1 }, update: { capacity: 500, registrationOpen: true },
    create: { id: 1, eventName: 'E', capacity: 500, registrationOpen: true },
  });
});

describe('registerAttendee', () => {
  it('creates a user + pending registration', async () => {
    const r = await registerAttendee({ ...base, email: 'x@y.com' });
    const reg = await prisma.registration.findUnique({ where: { id: r.registrationId } });
    expect(reg?.status).toBe('pending');
    const user = await prisma.user.findUnique({ where: { id: r.userId } });
    expect(user?.role).toBe('attendee');
  });
  it('rejects duplicate email', async () => {
    await registerAttendee({ ...base, email: 'dupe@y.com' });
    await expect(registerAttendee({ ...base, email: 'dupe@y.com' }))
      .rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });
  it('rejects when registration is closed', async () => {
    await prisma.eventSettings.update({ where: { id: 1 }, data: { registrationOpen: false } });
    await expect(registerAttendee({ ...base, email: 'z@y.com' }))
      .rejects.toMatchObject({ code: 'CLOSED' });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/services/registration.test.ts`

- [ ] **Step 3: Implement the registration service**

```ts
// src/services/registration.ts
import { prisma } from '@/lib/db';
import { hashPassword } from '@/services/auth';

export class RegistrationError extends Error {
  constructor(public code: 'CLOSED' | 'FULL' | 'EMAIL_TAKEN', msg: string) { super(msg); }
}

export async function registerAttendee(input: {
  email: string; password: string; fullName: string; phone: string; paymentReference: string;
}) {
  const settings = await prisma.eventSettings.findUnique({ where: { id: 1 } });
  if (!settings || !settings.registrationOpen)
    throw new RegistrationError('CLOSED', 'Registration is closed');

  const approvedCount = await prisma.ticket.count();
  if (approvedCount >= settings.capacity)
    throw new RegistrationError('FULL', 'Event is at capacity');

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new RegistrationError('EMAIL_TAKEN', 'Email already registered');

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: 'attendee',
      registration: {
        create: {
          fullName: input.fullName,
          phone: input.phone,
          paymentReference: input.paymentReference,
        },
      },
    },
    include: { registration: true },
  });
  return { userId: user.id, registrationId: user.registration!.id };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/services/registration.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/registration.ts tests/services/registration.test.ts
git commit -m "feat: add registration service with capacity and open checks"
```

---

### Task 5: Ticket helpers (token, reference code, QR image)

**Files:**
- Create: `src/services/tickets.ts`
- Test: `tests/services/tickets.test.ts`

**Interfaces:**
- Consumes: `qrcode` package.
- Produces:
  - `generateQrToken(): string` — 32 random bytes hex (64 chars).
  - `generateReferenceCode(): string` — format `TICK-XXXX` (4 digits).
  - `generateQrDataUrl(token: string): Promise<string>` — PNG `data:` URL.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/services/tickets.test.ts
import { describe, it, expect } from 'vitest';
import { generateQrToken, generateReferenceCode, generateQrDataUrl } from '@/services/tickets';

describe('ticket helpers', () => {
  it('generates unique 64-char hex tokens', () => {
    const a = generateQrToken(), b = generateQrToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
  it('generates TICK-#### reference codes', () => {
    expect(generateReferenceCode()).toMatch(/^TICK-\d{4}$/);
  });
  it('renders a PNG data url', async () => {
    const url = await generateQrDataUrl('abc');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/services/tickets.test.ts`

- [ ] **Step 3: Implement the helpers**

```ts
// src/services/tickets.ts
import { randomBytes, randomInt } from 'node:crypto';
import QRCode from 'qrcode';

export function generateQrToken(): string {
  return randomBytes(32).toString('hex');
}
export function generateReferenceCode(): string {
  return `TICK-${randomInt(0, 10000).toString().padStart(4, '0')}`;
}
export function generateQrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 2, width: 320 });
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/services/tickets.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/tickets.ts tests/services/tickets.test.ts
git commit -m "feat: add ticket token/reference/QR helpers"
```

---

### Task 6: Approval service (issue ticket, enforce capacity, reject)

**Files:**
- Create: `src/services/approval.ts`
- Test: `tests/services/approval.test.ts`

**Interfaces:**
- Consumes: `prisma`, `generateQrToken`, `generateReferenceCode`.
- Produces:
  - `class ApprovalError extends Error { code: 'NOT_PENDING' | 'FULL' | 'NOT_FOUND' }`
  - `approveRegistration(registrationId: string, adminId: string): Promise<{ ticketId: string; referenceCode: string; qrToken: string }>`
  - `rejectRegistration(registrationId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/services/approval.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { registerAttendee } from '@/services/registration';
import { approveRegistration, rejectRegistration, ApprovalError } from '@/services/approval';

const base = { password: 'pw1234567', fullName: 'A B', phone: '0800', paymentReference: 'REF1' };

async function admin() {
  return prisma.user.create({ data: { email: `adm${Math.random()}@x.com`, passwordHash: 'x', role: 'admin' } });
}
beforeEach(async () => {
  await prisma.ticket.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.user.deleteMany();
  await prisma.eventSettings.upsert({
    where: { id: 1 }, update: { capacity: 500, registrationOpen: true },
    create: { id: 1, eventName: 'E', capacity: 500, registrationOpen: true },
  });
});

describe('approveRegistration', () => {
  it('issues a ticket and marks registration approved', async () => {
    const a = await admin();
    const r = await registerAttendee({ ...base, email: 'p@q.com' });
    const t = await approveRegistration(r.registrationId, a.id);
    expect(t.qrToken).toMatch(/^[0-9a-f]{64}$/);
    const reg = await prisma.registration.findUnique({ where: { id: r.registrationId } });
    expect(reg?.status).toBe('approved');
    expect(reg?.approvedById).toBe(a.id);
  });
  it('refuses to approve past capacity', async () => {
    const a = await admin();
    await prisma.eventSettings.update({ where: { id: 1 }, data: { capacity: 1 } });
    const r1 = await registerAttendee({ ...base, email: 'c1@q.com' });
    const r2 = await registerAttendee({ ...base, email: 'c2@q.com' });
    await approveRegistration(r1.registrationId, a.id);
    await expect(approveRegistration(r2.registrationId, a.id))
      .rejects.toMatchObject({ code: 'FULL' });
  });
  it('refuses to re-approve a non-pending registration', async () => {
    const a = await admin();
    const r = await registerAttendee({ ...base, email: 'd@q.com' });
    await approveRegistration(r.registrationId, a.id);
    await expect(approveRegistration(r.registrationId, a.id))
      .rejects.toMatchObject({ code: 'NOT_PENDING' });
  });
  it('rejects a registration', async () => {
    const r = await registerAttendee({ ...base, email: 'e@q.com' });
    await rejectRegistration(r.registrationId);
    const reg = await prisma.registration.findUnique({ where: { id: r.registrationId } });
    expect(reg?.status).toBe('rejected');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/services/approval.test.ts`

- [ ] **Step 3: Implement the approval service**

```ts
// src/services/approval.ts
import { prisma } from '@/lib/db';
import { generateQrToken, generateReferenceCode } from '@/services/tickets';

export class ApprovalError extends Error {
  constructor(public code: 'NOT_PENDING' | 'FULL' | 'NOT_FOUND', msg: string) { super(msg); }
}

export async function approveRegistration(registrationId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const reg = await tx.registration.findUnique({ where: { id: registrationId } });
    if (!reg) throw new ApprovalError('NOT_FOUND', 'Registration not found');
    if (reg.status !== 'pending') throw new ApprovalError('NOT_PENDING', 'Not pending');

    const settings = await tx.eventSettings.findUnique({ where: { id: 1 } });
    const issued = await tx.ticket.count();
    if (!settings || issued >= settings.capacity)
      throw new ApprovalError('FULL', 'At capacity');

    const ticket = await tx.ticket.create({
      data: {
        registrationId,
        referenceCode: generateReferenceCode(),
        qrToken: generateQrToken(),
      },
    });
    await tx.registration.update({
      where: { id: registrationId },
      data: { status: 'approved', approvedAt: new Date(), approvedById: adminId },
    });
    return { ticketId: ticket.id, referenceCode: ticket.referenceCode, qrToken: ticket.qrToken };
  });
}

export async function rejectRegistration(registrationId: string) {
  const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!reg) throw new ApprovalError('NOT_FOUND', 'Registration not found');
  await prisma.registration.update({ where: { id: registrationId }, data: { status: 'rejected' } });
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/services/approval.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/approval.ts tests/services/approval.test.ts
git commit -m "feat: add approval service (issue ticket, enforce capacity)"
```

---

### Task 7: Check-in service (atomic one-time)

**Files:**
- Create: `src/services/checkin.ts`
- Test: `tests/services/checkin.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces:
  - `type CheckInResult = { status: 'ok'; fullName: string; referenceCode: string } | { status: 'already_used'; fullName: string; checkedInAt: Date } | { status: 'invalid' }`
  - `checkIn(qrToken: string, staffId: string): Promise<CheckInResult>`

- [ ] **Step 1: Write the failing tests (incl. concurrent double-scan)**

```ts
// tests/services/checkin.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { registerAttendee } from '@/services/registration';
import { approveRegistration } from '@/services/approval';
import { checkIn } from '@/services/checkin';

const base = { password: 'pw1234567', fullName: 'Jane Doe', phone: '0800', paymentReference: 'R' };

async function issued() {
  const admin = await prisma.user.create({ data: { email: `a${Math.random()}@x.com`, passwordHash: 'x', role: 'admin' } });
  const staff = await prisma.user.create({ data: { email: `s${Math.random()}@x.com`, passwordHash: 'x', role: 'staff' } });
  const r = await registerAttendee({ ...base, email: `u${Math.random()}@x.com` });
  const t = await approveRegistration(r.registrationId, admin.id);
  return { staffId: staff.id, qrToken: t.qrToken };
}
beforeEach(async () => {
  await prisma.ticket.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.user.deleteMany();
  await prisma.eventSettings.upsert({
    where: { id: 1 }, update: { capacity: 500, registrationOpen: true },
    create: { id: 1, eventName: 'E', capacity: 500, registrationOpen: true },
  });
});

describe('checkIn', () => {
  it('admits a valid ticket once', async () => {
    const { staffId, qrToken } = await issued();
    const r = await checkIn(qrToken, staffId);
    expect(r).toMatchObject({ status: 'ok', fullName: 'Jane Doe' });
  });
  it('reports already_used on second scan', async () => {
    const { staffId, qrToken } = await issued();
    await checkIn(qrToken, staffId);
    const r = await checkIn(qrToken, staffId);
    expect(r.status).toBe('already_used');
  });
  it('reports invalid for unknown token', async () => {
    const { staffId } = await issued();
    const r = await checkIn('deadbeef', staffId);
    expect(r.status).toBe('invalid');
  });
  it('admits only one of two concurrent scans', async () => {
    const { staffId, qrToken } = await issued();
    const [a, b] = await Promise.all([checkIn(qrToken, staffId), checkIn(qrToken, staffId)]);
    const oks = [a, b].filter((x) => x.status === 'ok');
    expect(oks.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/services/checkin.test.ts`

- [ ] **Step 3: Implement the atomic check-in**

```ts
// src/services/checkin.ts
import { prisma } from '@/lib/db';

export type CheckInResult =
  | { status: 'ok'; fullName: string; referenceCode: string }
  | { status: 'already_used'; fullName: string; checkedInAt: Date }
  | { status: 'invalid' };

export async function checkIn(qrToken: string, staffId: string): Promise<CheckInResult> {
  const ticket = await prisma.ticket.findUnique({
    where: { qrToken },
    include: { registration: true },
  });
  if (!ticket) return { status: 'invalid' };

  // Atomic: only rows still un-checked-in are updated. count===1 means we won.
  const res = await prisma.ticket.updateMany({
    where: { qrToken, checkedInAt: null },
    data: { checkedInAt: new Date(), checkedInById: staffId },
  });

  if (res.count === 1) {
    return { status: 'ok', fullName: ticket.registration.fullName, referenceCode: ticket.referenceCode };
  }
  const used = await prisma.ticket.findUnique({ where: { qrToken }, include: { registration: true } });
  return { status: 'already_used', fullName: used!.registration.fullName, checkedInAt: used!.checkedInAt! };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/services/checkin.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/checkin.ts tests/services/checkin.test.ts
git commit -m "feat: add atomic one-time check-in service"
```

---

### Task 8: Stats service + current-user helper

**Files:**
- Create: `src/services/stats.ts`, `src/session/current-user.ts`
- Test: `tests/services/stats.test.ts`

**Interfaces:**
- Consumes: `prisma`, `verifySession`, `SESSION_COOKIE`, `next/headers`.
- Produces:
  - `getEventStats(): Promise<{ registered: number; approved: number; checkedIn: number; capacity: number; remaining: number; registrationOpen: boolean }>`
  - `getCurrentUser(): Promise<{ userId: string; role: 'attendee'|'admin'|'staff' } | null>` (reads cookie via `cookies()`).

- [ ] **Step 1: Write the failing stats test**

```ts
// tests/services/stats.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { registerAttendee } from '@/services/registration';
import { approveRegistration } from '@/services/approval';
import { getEventStats } from '@/services/stats';

const base = { password: 'pw1234567', fullName: 'A', phone: '0', paymentReference: 'R' };
beforeEach(async () => {
  await prisma.ticket.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.user.deleteMany();
  await prisma.eventSettings.upsert({
    where: { id: 1 }, update: { capacity: 10, registrationOpen: true },
    create: { id: 1, eventName: 'E', capacity: 10, registrationOpen: true },
  });
});

describe('getEventStats', () => {
  it('counts registered/approved/remaining', async () => {
    const admin = await prisma.user.create({ data: { email: 'a@x.com', passwordHash: 'x', role: 'admin' } });
    const r1 = await registerAttendee({ ...base, email: '1@x.com' });
    await registerAttendee({ ...base, email: '2@x.com' });
    await approveRegistration(r1.registrationId, admin.id);
    const s = await getEventStats();
    expect(s.registered).toBe(2);
    expect(s.approved).toBe(1);
    expect(s.remaining).toBe(9);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/services/stats.test.ts`

- [ ] **Step 3: Implement stats and current-user**

```ts
// src/services/stats.ts
import { prisma } from '@/lib/db';
export async function getEventStats() {
  const settings = await prisma.eventSettings.findUnique({ where: { id: 1 } });
  const capacity = settings?.capacity ?? 0;
  const [registered, approved, checkedIn] = await Promise.all([
    prisma.registration.count(),
    prisma.ticket.count(),
    prisma.ticket.count({ where: { checkedInAt: { not: null } } }),
  ]);
  return {
    registered, approved, checkedIn, capacity,
    remaining: Math.max(0, capacity - approved),
    registrationOpen: settings?.registrationOpen ?? false,
  };
}
```

```ts
// src/session/current-user.ts
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE } from '@/services/auth';
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/services/stats.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/stats.ts src/session/current-user.ts tests/services/stats.test.ts
git commit -m "feat: add stats service and current-user helper"
```

---

### Task 9: Auth + registration API routes

**Files:**
- Create: `src/app/api/register/route.ts`, `src/app/api/login/route.ts`, `src/app/api/logout/route.ts`
- Test: `tests/services/auth-flow.test.ts`

**Interfaces:**
- Consumes: `registerAttendee`, `verifyPassword`, `createSession`, `SESSION_COOKIE`, `prisma`.
- Produces: HTTP endpoints:
  - `POST /api/register` `{ email, password, fullName, phone, paymentReference }` → 201 `{ registrationId }` or 4xx `{ error, code }`.
  - `POST /api/login` `{ email, password }` → 200 sets `session` cookie, `{ role }` or 401.
  - `POST /api/logout` → 200 clears cookie.

- [ ] **Step 1: Write a login-helper test (pure logic used by the route)**

Add a small pure helper so login is unit-testable without HTTP:

```ts
// tests/services/auth-flow.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/services/auth';
import { authenticate } from '@/services/login';

beforeEach(async () => {
  await prisma.ticket.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.user.deleteMany();
});

describe('authenticate', () => {
  it('returns user on correct password', async () => {
    await prisma.user.create({ data: { email: 'l@x.com', passwordHash: await hashPassword('pw1234567'), role: 'staff' } });
    const u = await authenticate('l@x.com', 'pw1234567');
    expect(u?.role).toBe('staff');
  });
  it('returns null on wrong password', async () => {
    await prisma.user.create({ data: { email: 'l2@x.com', passwordHash: await hashPassword('pw1234567'), role: 'staff' } });
    expect(await authenticate('l2@x.com', 'nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/services/auth-flow.test.ts`

- [ ] **Step 3: Implement `authenticate` and the routes**

```ts
// src/services/login.ts
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/services/auth';
export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return { userId: user.id, role: user.role };
}
```

```ts
// src/app/api/register/route.ts
import { NextResponse } from 'next/server';
import { registerAttendee, RegistrationError } from '@/services/registration';
export async function POST(req: Request) {
  const b = await req.json();
  for (const f of ['email', 'password', 'fullName', 'phone', 'paymentReference'])
    if (!b?.[f]) return NextResponse.json({ error: `Missing ${f}` }, { status: 400 });
  try {
    const r = await registerAttendee(b);
    return NextResponse.json({ registrationId: r.registrationId }, { status: 201 });
  } catch (e) {
    if (e instanceof RegistrationError)
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

```ts
// src/app/api/login/route.ts
import { NextResponse } from 'next/server';
import { authenticate, } from '@/services/login';
import { createSession, SESSION_COOKIE } from '@/services/auth';
export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = await authenticate(email, password);
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  const token = await createSession(user);
  const res = NextResponse.json({ role: user.role });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}
```

```ts
// src/app/api/logout/route.ts
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/services/auth';
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/services/auth-flow.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/login.ts src/app/api/register src/app/api/login src/app/api/logout tests/services/auth-flow.test.ts
git commit -m "feat: add register/login/logout API routes"
```

---

### Task 10: Admin API routes (approve, reject, settings, staff)

**Files:**
- Create: `src/app/api/admin/approve/route.ts`, `src/app/api/admin/reject/route.ts`, `src/app/api/admin/settings/route.ts`, `src/app/api/admin/staff/route.ts`
- Create: `src/lib/guard.ts` (role guard for route handlers)
- Test: `tests/services/guard.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `approveRegistration`, `rejectRegistration`, `hashPassword`, `prisma`.
- Produces:
  - `requireRole(role: 'admin'|'staff'): Promise<{ userId: string; role: string } | null>` — returns user if role matches else null.
  - `POST /api/admin/approve` `{ registrationId }` → `{ referenceCode }`.
  - `POST /api/admin/reject` `{ registrationId }` → `{ ok: true }`.
  - `POST /api/admin/settings` `{ capacity?, registrationOpen?, eventName? }` → updated settings.
  - `POST /api/admin/staff` `{ email, password }` → creates a `staff` user.

- [ ] **Step 1: Write the guard test**

```ts
// tests/services/guard.test.ts
import { describe, it, expect } from 'vitest';
import { matchesRole } from '@/lib/guard';

describe('matchesRole', () => {
  it('accepts exact role', () => expect(matchesRole({ userId: 'u', role: 'admin' }, 'admin')).toBe(true));
  it('rejects wrong role', () => expect(matchesRole({ userId: 'u', role: 'staff' }, 'admin')).toBe(false));
  it('rejects null user', () => expect(matchesRole(null, 'admin')).toBe(false));
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/services/guard.test.ts`

- [ ] **Step 3: Implement guard + admin routes**

```ts
// src/lib/guard.ts
import { getCurrentUser } from '@/session/current-user';
type Session = { userId: string; role: string } | null;
export function matchesRole(user: Session, role: 'admin' | 'staff'): boolean {
  return !!user && user.role === role;
}
export async function requireRole(role: 'admin' | 'staff') {
  const user = await getCurrentUser();
  return matchesRole(user, role) ? user : null;
}
```

```ts
// src/app/api/admin/approve/route.ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { approveRegistration, ApprovalError } from '@/services/approval';
export async function POST(req: Request) {
  const admin = await requireRole('admin');
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { registrationId } = await req.json();
  try {
    const t = await approveRegistration(registrationId, admin.userId);
    return NextResponse.json({ referenceCode: t.referenceCode });
  } catch (e) {
    if (e instanceof ApprovalError) return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

```ts
// src/app/api/admin/reject/route.ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { rejectRegistration } from '@/services/approval';
export async function POST(req: Request) {
  const admin = await requireRole('admin');
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { registrationId } = await req.json();
  await rejectRegistration(registrationId);
  return NextResponse.json({ ok: true });
}
```

```ts
// src/app/api/admin/settings/route.ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { prisma } from '@/lib/db';
export async function POST(req: Request) {
  if (!(await requireRole('admin'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof b.capacity === 'number') data.capacity = b.capacity;
  if (typeof b.registrationOpen === 'boolean') data.registrationOpen = b.registrationOpen;
  if (typeof b.eventName === 'string') data.eventName = b.eventName;
  const s = await prisma.eventSettings.update({ where: { id: 1 }, data });
  return NextResponse.json(s);
}
```

```ts
// src/app/api/admin/staff/route.ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/services/auth';
export async function POST(req: Request) {
  if (!(await requireRole('admin'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'Email taken' }, { status: 409 });
  await prisma.user.create({ data: { email, passwordHash: await hashPassword(password), role: 'staff' } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/services/guard.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/guard.ts src/app/api/admin tests/services/guard.test.ts
git commit -m "feat: add admin API routes (approve/reject/settings/staff)"
```

---

### Task 11: Check-in API route

**Files:**
- Create: `src/app/api/checkin/route.ts`
- Test: covered by `tests/services/checkin.test.ts` (service) + manual route check.

**Interfaces:**
- Consumes: `requireRole`, `checkIn`.
- Produces: `POST /api/checkin` `{ qrToken }` → `CheckInResult` JSON (staff-only).

- [ ] **Step 1: Implement the route**

```ts
// src/app/api/checkin/route.ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { checkIn } from '@/services/checkin';
export async function POST(req: Request) {
  const staff = await requireRole('staff');
  const admin = staff ?? (await requireRole('admin')); // admins may also scan
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { qrToken } = await req.json();
  if (!qrToken) return NextResponse.json({ error: 'Missing qrToken' }, { status: 400 });
  const result = await checkIn(qrToken, admin.userId);
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Verify full service suite still green**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/checkin/route.ts
git commit -m "feat: add check-in API route (staff/admin only)"
```

---

### Task 12: Middleware route protection

**Files:**
- Create: `src/middleware.ts`
- Test: manual (documented in Task 16 checklist).

**Interfaces:**
- Consumes: `SESSION_COOKIE`, `verifySession`.
- Produces: redirects unauthenticated users away from `/admin`, `/scan`, `/ticket`; enforces role for `/admin` (admin) and `/scan` (staff or admin).

- [ ] **Step 1: Implement middleware**

```ts
// src/middleware.ts
import { NextResponse, NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/services/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySession(token) : null;

  const needsAuth = ['/admin', '/scan', '/ticket'].some((p) => pathname.startsWith(p));
  if (needsAuth && !user) return NextResponse.redirect(new URL('/login', req.url));
  if (pathname.startsWith('/admin') && user?.role !== 'admin')
    return NextResponse.redirect(new URL('/login', req.url));
  if (pathname.startsWith('/scan') && !(user?.role === 'staff' || user?.role === 'admin'))
    return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/admin/:path*', '/scan/:path*', '/ticket/:path*'] };
```

- [ ] **Step 2: Build to confirm middleware compiles**

Run: `npm run build`
Expected: build succeeds (Prisma client generated; no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add role-based route protection middleware"
```

---

### Task 13: Attendee pages (register, login, ticket status + QR)

**Files:**
- Create: `src/app/register/page.tsx`, `src/app/login/page.tsx`, `src/app/ticket/page.tsx`
- Modify: `src/app/page.tsx` (landing links)

**Interfaces:**
- Consumes: `/api/register`, `/api/login`, `getCurrentUser`, `prisma`, `generateQrDataUrl`.
- Produces: attendee-facing UI. `/ticket` is a server component that loads the current user's registration + ticket and renders status or QR.

- [ ] **Step 1: Landing page**

```tsx
// src/app/page.tsx
import Link from 'next/link';
export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'system-ui', textAlign: 'center' }}>
      <h1>Event Tickets</h1>
      <p><Link href="/register">Register</Link> · <Link href="/login">Log in</Link></p>
    </main>
  );
}
```

- [ ] **Step 2: Register page (client component)**

```tsx
// src/app/register/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Register() {
  const r = useRouter();
  const [f, setF] = useState({ fullName: '', email: '', phone: '', paymentReference: '', password: '' });
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    const res = await fetch('/api/register', { method: 'POST', body: JSON.stringify(f) });
    if (res.ok) { await fetch('/api/login', { method: 'POST', body: JSON.stringify({ email: f.email, password: f.password }) }); r.push('/ticket'); }
    else { const b = await res.json(); setErr(b.code === 'CLOSED' ? 'Registration is closed.' : b.code === 'FULL' ? 'Event is sold out.' : b.error); }
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <main style={{ maxWidth: 420, margin: '3rem auto', fontFamily: 'system-ui' }}>
      <h1>Register</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <input required placeholder="Full name" value={f.fullName} onChange={set('fullName')} />
        <input required type="email" placeholder="Email" value={f.email} onChange={set('email')} />
        <input required placeholder="Phone" value={f.phone} onChange={set('phone')} />
        <input required placeholder="Bank transfer reference" value={f.paymentReference} onChange={set('paymentReference')} />
        <input required type="password" placeholder="Password" value={f.password} onChange={set('password')} />
        <button type="submit">Register</button>
      </form>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
    </main>
  );
}
```

- [ ] **Step 3: Login page (client component, routes by role)**

```tsx
// src/app/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Login() {
  const r = useRouter();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify(f) });
    if (!res.ok) { setErr('Invalid credentials'); return; }
    const { role } = await res.json();
    r.push(role === 'admin' ? '/admin' : role === 'staff' ? '/scan' : '/ticket');
  }
  return (
    <main style={{ maxWidth: 380, margin: '3rem auto', fontFamily: 'system-ui' }}>
      <h1>Log in</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <input required type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input required type="password" placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <button type="submit">Log in</button>
      </form>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
    </main>
  );
}
```

- [ ] **Step 4: Ticket status page (server component)**

```tsx
// src/app/ticket/page.tsx
import { getCurrentUser } from '@/session/current-user';
import { prisma } from '@/lib/db';
import { generateQrDataUrl } from '@/services/tickets';
import { redirect } from 'next/navigation';

export default async function TicketPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const reg = await prisma.registration.findUnique({
    where: { userId: user.userId }, include: { ticket: true },
  });
  if (!reg) return <Msg title="No registration found" />;
  if (reg.status === 'pending') return <Msg title="Payment under review" body="We're verifying your bank transfer. Check back soon." />;
  if (reg.status === 'rejected') return <Msg title="Payment not verified" body="We couldn't verify your payment — please contact us." />;
  const qr = await generateQrDataUrl(reg.ticket!.qrToken);
  return (
    <main style={{ maxWidth: 420, margin: '3rem auto', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h1>You're in, {reg.fullName.split(' ')[0]}!</h1>
      <p>Show this at the door.</p>
      <img src={qr} alt="Your ticket QR code" style={{ width: 320, height: 320 }} />
      <p><strong>{reg.ticket!.referenceCode}</strong></p>
    </main>
  );
}
function Msg({ title, body }: { title: string; body?: string }) {
  return (
    <main style={{ maxWidth: 420, margin: '4rem auto', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h1>{title}</h1>{body && <p>{body}</p>}
    </main>
  );
}
```

- [ ] **Step 5: Build + manual smoke**

Run: `npm run build`
Expected: build succeeds. Manually: register a user, confirm redirect to `/ticket` showing "Payment under review".

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/register src/app/login src/app/ticket
git commit -m "feat: add attendee register/login/ticket pages"
```

---

### Task 14: Admin dashboard page

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/PendingList.tsx` (client), `src/app/admin/AdminControls.tsx` (client)

**Interfaces:**
- Consumes: `getEventStats`, `prisma`, `/api/admin/*`.
- Produces: server page rendering stats + pending registrations; client components post to admin APIs and refresh.

- [ ] **Step 1: Server page**

```tsx
// src/app/admin/page.tsx
import { prisma } from '@/lib/db';
import { getEventStats } from '@/services/stats';
import PendingList from './PendingList';
import AdminControls from './AdminControls';

export const dynamic = 'force-dynamic';
export default async function Admin() {
  const stats = await getEventStats();
  const pending = await prisma.registration.findMany({
    where: { status: 'pending' }, orderBy: { createdAt: 'asc' },
    select: { id: true, fullName: true, phone: true, paymentReference: true },
  });
  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>Admin dashboard</h1>
      <ul style={{ display: 'flex', gap: 16, listStyle: 'none', padding: 0 }}>
        <li>Registered: {stats.registered}</li>
        <li>Approved: {stats.approved}</li>
        <li>Checked in: {stats.checkedIn}</li>
        <li>Remaining: {stats.remaining}/{stats.capacity}</li>
      </ul>
      <AdminControls open={stats.registrationOpen} capacity={stats.capacity} />
      <h2>Pending payments</h2>
      <PendingList items={pending} />
    </main>
  );
}
```

- [ ] **Step 2: PendingList client component**

```tsx
// src/app/admin/PendingList.tsx
'use client';
import { useRouter } from 'next/navigation';
type Item = { id: string; fullName: string; phone: string; paymentReference: string };
export default function PendingList({ items }: { items: Item[] }) {
  const r = useRouter();
  async function act(path: string, registrationId: string) {
    const res = await fetch(path, { method: 'POST', body: JSON.stringify({ registrationId }) });
    if (!res.ok) { const b = await res.json(); alert(b.error ?? 'Error'); }
    r.refresh();
  }
  if (!items.length) return <p>No pending registrations.</p>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {items.map((i) => (
          <tr key={i.id} style={{ borderBottom: '1px solid #ddd' }}>
            <td>{i.fullName}</td><td>{i.phone}</td><td>{i.paymentReference}</td>
            <td>
              <button onClick={() => act('/api/admin/approve', i.id)}>Approve</button>{' '}
              <button onClick={() => act('/api/admin/reject', i.id)}>Reject</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: AdminControls client component (settings + staff)**

```tsx
// src/app/admin/AdminControls.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function AdminControls({ open, capacity }: { open: boolean; capacity: number }) {
  const r = useRouter();
  const [cap, setCap] = useState(capacity);
  const [staff, setStaff] = useState({ email: '', password: '' });
  async function settings(body: object) {
    await fetch('/api/admin/settings', { method: 'POST', body: JSON.stringify(body) });
    r.refresh();
  }
  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/staff', { method: 'POST', body: JSON.stringify(staff) });
    alert(res.ok ? 'Staff added' : 'Failed'); setStaff({ email: '', password: '' });
  }
  return (
    <section style={{ display: 'grid', gap: 12, margin: '1rem 0' }}>
      <div>
        <button onClick={() => settings({ registrationOpen: !open })}>
          {open ? 'Close registration' : 'Open registration'}
        </button>
      </div>
      <div>
        Capacity: <input type="number" value={cap} onChange={(e) => setCap(Number(e.target.value))} />
        <button onClick={() => settings({ capacity: cap })}>Save</button>
      </div>
      <form onSubmit={addStaff}>
        Add gate staff:{' '}
        <input placeholder="email" value={staff.email} onChange={(e) => setStaff({ ...staff, email: e.target.value })} />
        <input placeholder="password" type="password" value={staff.password} onChange={(e) => setStaff({ ...staff, password: e.target.value })} />
        <button type="submit">Add</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Build + commit**

Run: `npm run build`
Expected: build succeeds.

```bash
git add src/app/admin
git commit -m "feat: add admin dashboard (stats, approve/reject, settings, staff)"
```

---

### Task 15: Gate-staff scanner page

**Files:**
- Create: `src/app/scan/page.tsx`, `src/app/scan/Scanner.tsx` (client)

**Interfaces:**
- Consumes: `html5-qrcode`, `/api/checkin`.
- Produces: camera scanner that reads a QR, posts the token, shows ✅/⚠️/❌ + name and a running checked-in count for the session.

- [ ] **Step 1: Server wrapper page**

```tsx
// src/app/scan/page.tsx
import Scanner from './Scanner';
export const dynamic = 'force-dynamic';
export default function ScanPage() {
  return (
    <main style={{ maxWidth: 480, margin: '1rem auto', fontFamily: 'system-ui', textAlign: 'center' }}>
      <h1>Gate scanner</h1>
      <Scanner />
    </main>
  );
}
```

- [ ] **Step 2: Scanner client component**

```tsx
// src/app/scan/Scanner.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type Result = { status: string; fullName?: string; checkedInAt?: string; referenceCode?: string };
export default function Scanner() {
  const [result, setResult] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const busy = useRef(false);
  const divId = 'qr-reader';

  useEffect(() => {
    const scanner = new Html5Qrcode(divId);
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      async (decoded) => {
        if (busy.current) return;
        busy.current = true;
        try {
          const res = await fetch('/api/checkin', { method: 'POST', body: JSON.stringify({ qrToken: decoded }) });
          const body = await res.json();
          setResult(body);
          if (body.status === 'ok') setCount((c) => c + 1);
        } finally {
          setTimeout(() => { busy.current = false; }, 1500);
        }
      },
      () => {}
    ).catch(() => setResult({ status: 'camera_error' }));
    return () => { scanner.stop().catch(() => {}); };
  }, []);

  const color = result?.status === 'ok' ? 'green' : result?.status === 'already_used' ? '#b8860b' : 'crimson';
  const label =
    result?.status === 'ok' ? `✅ ${result.fullName}` :
    result?.status === 'already_used' ? `⚠️ Already used — ${result.fullName}` :
    result?.status === 'invalid' ? '❌ Invalid ticket' :
    result?.status === 'camera_error' ? 'Camera unavailable' : 'Point at a QR code';

  return (
    <div>
      <div id={divId} style={{ width: '100%' }} />
      <p style={{ color, fontSize: 24, fontWeight: 700 }}>{label}</p>
      <p>Checked in this session: {count}</p>
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

Run: `npm run build`
Expected: build succeeds.

```bash
git add src/app/scan
git commit -m "feat: add gate-staff camera scanner page"
```

---

### Task 16: Deployment config + README + manual test checklist

**Files:**
- Create: `README.md`
- Modify: `package.json` (ensure `postinstall: prisma generate`, `build: prisma generate && next build`)

**Interfaces:**
- Consumes: everything above.
- Produces: documented deploy path (Supabase + Vercel) and a manual event-day test checklist.

- [ ] **Step 1: Wire Prisma into build**

In `package.json` scripts:
```json
"postinstall": "prisma generate",
"build": "prisma generate && next build"
```

- [ ] **Step 2: Write README**

`README.md` must document:
- Local dev: start Postgres, `cp .env.example .env`, set `DATABASE_URL` + `SESSION_SECRET` (`openssl rand -base64 48`), `npx prisma migrate dev`, `npm run prisma:seed` (set `ADMIN_EMAIL`/`ADMIN_PASSWORD`), `npm run dev`.
- Tests: point `DATABASE_URL` at a throwaway Postgres DB, `npx prisma migrate deploy`, `npm test`.
- Deploy: create Supabase/Neon project → copy connection string; create Vercel project → set `DATABASE_URL`, `SESSION_SECRET` env vars → deploy; run `prisma migrate deploy` and seed against the prod DB once.
- **Gate requirement:** the scanning phone needs internet (venue wifi or mobile data).

- [ ] **Step 3: Manual test checklist (run before the event)**

Document and execute:
1. Register attendee → `/ticket` shows "Payment under review".
2. Admin logs in → sees pending → Approve → attendee `/ticket` now shows QR + `TICK-####`.
3. Staff logs in → `/scan` → scan attendee QR → ✅ name shown, count increments.
4. Scan same QR again → ⚠️ already used.
5. Scan a random/garbage QR → ❌ invalid.
6. Set capacity to current approved count → approving another registration → "At capacity".
7. Close registration → new registration attempt → "Registration is closed."
8. Non-admin visiting `/admin` and non-staff visiting `/scan` → redirected to `/login`.

- [ ] **Step 4: Full test run + build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add README.md package.json
git commit -m "docs: add README, deploy guide, and manual test checklist"
```

---

## Self-Review Notes

- **Spec coverage:** register (T4/T9/T13), manual admin verify + approve/issue (T6/T10/T14), unique per-person QR token (T5/T6), on-screen QR delivery (T13), email+password login + reference code (T3/T5/T9/T13), phone-browser scanner (T15), atomic one-time check-in (T7/T11), capacity cap (T4/T6/T10), registration open/close (T4/T10/T14), roles + route protection (T3/T10/T12), polite rejection message (T13), admin-assisted reset (documented — no email; admin can reset a `passwordHash` directly / future enhancement), event settings single row (T2), testing strategy (each task TDD + T16 manual). All spec sections map to tasks.
- **Placeholder scan:** no TBD/TODO; every code step contains real code.
- **Type consistency:** `CheckInResult`, `RegistrationError.code`, `ApprovalError.code`, `SESSION_COOKIE`, `getCurrentUser`, `requireRole`/`matchesRole`, `generateQrToken/generateReferenceCode/generateQrDataUrl`, `getEventStats`, `authenticate` names are used consistently across tasks.
