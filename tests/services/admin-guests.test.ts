import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { registerAttendee } from '@/services/registration';
import { approveRegistration } from '@/services/approval';
import { listGuests, addGuest, removeGuest, AdminGuestError } from '@/services/admin-guests';

const base = { password: 'pw1234567', phone: '0800', paymentReference: 'REF1' };

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

describe('listGuests', () => {
  it('returns everybody with status and ticket info', async () => {
    const a = await admin();
    const r1 = await registerAttendee({ ...base, fullName: 'Alice Approved', email: 'alice@x.com' });
    await registerAttendee({ ...base, fullName: 'Bob Pending', email: 'bob@x.com' });
    await approveRegistration(r1.registrationId, a.id);

    const rows = await listGuests();
    expect(rows).toHaveLength(2);
    const alice = rows.find((g) => g.fullName === 'Alice Approved')!;
    expect(alice.status).toBe('approved');
    expect(alice.referenceCode).toMatch(/^TICK-/);
    const bob = rows.find((g) => g.fullName === 'Bob Pending')!;
    expect(bob.status).toBe('pending');
    expect(bob.referenceCode).toBeNull();
  });

  it('filters by search term across name/email/phone/code', async () => {
    await registerAttendee({ ...base, fullName: 'Searchable Sam', email: 'sam@x.com', phone: '123456' });
    await registerAttendee({ ...base, fullName: 'Other Person', email: 'other@x.com', phone: '999' });
    expect(await listGuests('sam')).toHaveLength(1);
    expect(await listGuests('SAM@X')).toHaveLength(1);
    expect(await listGuests('123456')).toHaveLength(1);
    expect(await listGuests('zzz')).toHaveLength(0);
  });
});

describe('addGuest', () => {
  it('creates an approved guest with a ticket and no login user', async () => {
    const a = await admin();
    const res = await addGuest({ fullName: 'VIP Vera', email: 'vera@x.com', phone: '55', paymentReference: 'CASH' }, a.id);
    expect(res.referenceCode).toMatch(/^TICK-/);
    expect(res.qrToken).toMatch(/^[0-9a-f]{64}$/);
    const reg = await prisma.registration.findUnique({ where: { id: res.registrationId } });
    expect(reg?.status).toBe('approved');
    expect(reg?.userId).toBeNull();
    const rows = await listGuests('vera');
    expect(rows[0].referenceCode).toBe(res.referenceCode);
  });
  it('requires a full name', async () => {
    const a = await admin();
    await expect(addGuest({ fullName: '   ' }, a.id)).rejects.toMatchObject({ code: 'INVALID' });
  });
  it('respects capacity', async () => {
    const a = await admin();
    await prisma.eventSettings.update({ where: { id: 1 }, data: { capacity: 1 } });
    await addGuest({ fullName: 'First' }, a.id);
    await expect(addGuest({ fullName: 'Second' }, a.id)).rejects.toMatchObject({ code: 'FULL' });
  });
});

describe('removeGuest', () => {
  it('deletes the registration, its ticket, and its login user', async () => {
    const r = await registerAttendee({ ...base, fullName: 'Delete Me', email: 'del@x.com' });
    const a = await admin();
    await approveRegistration(r.registrationId, a.id);
    await removeGuest(r.registrationId);
    expect(await prisma.registration.findUnique({ where: { id: r.registrationId } })).toBeNull();
    expect(await prisma.ticket.count()).toBe(0);
    expect(await prisma.user.findUnique({ where: { email: 'del@x.com' } })).toBeNull();
  });
  it('frees a capacity slot', async () => {
    const a = await admin();
    await prisma.eventSettings.update({ where: { id: 1 }, data: { capacity: 1 } });
    const g = await addGuest({ fullName: 'Only One' }, a.id);
    await expect(addGuest({ fullName: 'Blocked' }, a.id)).rejects.toMatchObject({ code: 'FULL' });
    await removeGuest(g.registrationId);
    const ok = await addGuest({ fullName: 'Now Fits' }, a.id);
    expect(ok.referenceCode).toMatch(/^TICK-/);
  });
});
