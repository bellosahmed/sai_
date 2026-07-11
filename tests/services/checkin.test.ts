import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { registerAttendee } from '@/services/registration';
import { approveRegistration } from '@/services/approval';
import { checkIn, checkInByReference } from '@/services/checkin';

const base = { password: 'pw1234567', fullName: 'Jane Doe', phone: '0800', paymentReference: 'R' };

async function issued() {
  const admin = await prisma.user.create({ data: { email: `a${Math.random()}@x.com`, passwordHash: 'x', role: 'admin' } });
  const staff = await prisma.user.create({ data: { email: `s${Math.random()}@x.com`, passwordHash: 'x', role: 'staff' } });
  const r = await registerAttendee({ ...base, email: `u${Math.random()}@x.com` });
  const t = await approveRegistration(r.registrationId, admin.id);
  return { staffId: staff.id, qrToken: t.qrToken, referenceCode: t.referenceCode };
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

describe('checkInByReference (manual fallback)', () => {
  it('admits a valid ticket by its reference code', async () => {
    const { staffId, referenceCode } = await issued();
    const r = await checkInByReference(referenceCode, staffId);
    expect(r).toMatchObject({ status: 'ok', fullName: 'Jane Doe' });
  });
  it('accepts the code case-insensitively and without the TICK- prefix', async () => {
    const { staffId, referenceCode } = await issued();
    const bare = referenceCode.replace('TICK-', '').toLowerCase();
    const r = await checkInByReference(` ${bare} `, staffId);
    expect(r.status).toBe('ok');
  });
  it('reports already_used when the QR was already scanned', async () => {
    const { staffId, qrToken, referenceCode } = await issued();
    await checkIn(qrToken, staffId);
    const r = await checkInByReference(referenceCode, staffId);
    expect(r.status).toBe('already_used');
  });
  it('reports invalid for an unknown reference code', async () => {
    const { staffId } = await issued();
    const r = await checkInByReference('TICK-ZZZZZZ', staffId);
    expect(r.status).toBe('invalid');
  });
  it('admits only one of a concurrent QR scan and manual entry', async () => {
    const { staffId, qrToken, referenceCode } = await issued();
    const [a, b] = await Promise.all([
      checkIn(qrToken, staffId),
      checkInByReference(referenceCode, staffId),
    ]);
    const oks = [a, b].filter((x) => x.status === 'ok');
    expect(oks.length).toBe(1);
  });
});
