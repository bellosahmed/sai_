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
  it('rejects a too-short password', async () => {
    await expect(registerAttendee({ ...base, email: 'weak@y.com', password: 'short' }))
      .rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
  });
  it('rejects when registration is closed', async () => {
    await prisma.eventSettings.update({ where: { id: 1 }, data: { registrationOpen: false } });
    await expect(registerAttendee({ ...base, email: 'z@y.com' }))
      .rejects.toMatchObject({ code: 'CLOSED' });
  });
});
