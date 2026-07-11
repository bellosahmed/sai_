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
