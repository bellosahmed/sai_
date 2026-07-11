import { prisma } from '@/lib/db';

export type CheckInResult =
  | { status: 'ok'; fullName: string; referenceCode: string }
  | { status: 'already_used'; fullName: string; checkedInAt: Date }
  | { status: 'invalid' };

export async function checkIn(qrToken: string, staffId: string): Promise<CheckInResult> {
  const ticket = await prisma.ticket.findUnique({
    where: { qrToken },
    include: { registration: true },
  });
  if (!ticket) return { status: 'invalid' };

  // Atomic: only rows still un-checked-in are updated. count===1 means we won.
  const res = await prisma.ticket.updateMany({
    where: { qrToken, checkedInAt: null },
    data: { checkedInAt: new Date(), checkedInById: staffId },
  });

  if (res.count === 1) {
    return { status: 'ok', fullName: ticket.registration.fullName, referenceCode: ticket.referenceCode };
  }
  const used = await prisma.ticket.findUnique({ where: { qrToken }, include: { registration: true } });
  return { status: 'already_used', fullName: used!.registration.fullName, checkedInAt: used!.checkedInAt! };
}
