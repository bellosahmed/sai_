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
