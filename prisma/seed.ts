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
