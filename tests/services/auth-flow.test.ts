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
