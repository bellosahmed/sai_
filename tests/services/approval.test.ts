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
