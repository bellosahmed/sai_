import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { normalizeEmail } from '@/lib/email';
import { registerAttendee, RegistrationError } from '@/services/registration';
import { authenticate } from '@/services/login';

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

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Jane@X.COM ')).toBe('jane@x.com');
  });
});

describe('email handling', () => {
  it('stores registration email normalized', async () => {
    await registerAttendee({ ...base, email: '  Mixed@Case.Com ' });
    const user = await prisma.user.findUnique({ where: { email: 'mixed@case.com' } });
    expect(user).not.toBeNull();
  });
  it('treats different-cased emails as the same account', async () => {
    await registerAttendee({ ...base, email: 'Person@Example.com' });
    await expect(registerAttendee({ ...base, email: 'person@example.com' }))
      .rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });
  it('lets a user log in regardless of email casing', async () => {
    await registerAttendee({ ...base, email: 'caps@example.com' });
    const u = await authenticate('CAPS@EXAMPLE.COM', 'pw1234567');
    expect(u?.role).toBe('attendee');
  });
});
