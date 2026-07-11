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
