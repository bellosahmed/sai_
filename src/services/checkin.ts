import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export type CheckInResult =
  | { status: 'ok'; fullName: string; referenceCode: string; ticketNumber: number }
  | { status: 'already_used'; fullName: string; checkedInAt: Date; ticketNumber: number }
  | { status: 'invalid' };

type TicketWithReg = Prisma.TicketGetPayload<{ include: { registration: true } }>;

// Atomic one-time check-in for an already-loaded ticket. Only rows still
// un-checked-in are updated, so count===1 means this call won the race.
async function performCheckIn(ticket: TicketWithReg, staffId: string): Promise<CheckInResult> {
  const res = await prisma.ticket.updateMany({
    where: { id: ticket.id, checkedInAt: null },
    data: { checkedInAt: new Date(), checkedInById: staffId },
  });
  if (res.count === 1) {
    return {
      status: 'ok',
      fullName: ticket.registration.fullName,
      referenceCode: ticket.referenceCode,
      ticketNumber: ticket.ticketNumber,
    };
  }
  const used = await prisma.ticket.findUnique({ where: { id: ticket.id }, include: { registration: true } });
  return {
    status: 'already_used',
    fullName: used!.registration.fullName,
    checkedInAt: used!.checkedInAt!,
    ticketNumber: used!.ticketNumber,
  };
}

export async function checkIn(qrToken: string, staffId: string): Promise<CheckInResult> {
  const ticket = await prisma.ticket.findUnique({ where: { qrToken }, include: { registration: true } });
  if (!ticket) return { status: 'invalid' };
  return performCheckIn(ticket, staffId);
}

// Normalize whatever staff type: trim, drop spaces, uppercase, ensure TICK- prefix.
export function normalizeReferenceCode(input: string): string {
  let s = input.trim().toUpperCase().replace(/\s+/g, '');
  if (s.startsWith('TICK-')) return s;
  if (s.startsWith('TICK')) return `TICK-${s.slice(4)}`;
  return `TICK-${s}`;
}

// Manual fallback used when the camera or QR won't work.
export async function checkInByReference(referenceCode: string, staffId: string): Promise<CheckInResult> {
  const ticket = await prisma.ticket.findUnique({
    where: { referenceCode: normalizeReferenceCode(referenceCode) },
    include: { registration: true },
  });
  if (!ticket) return { status: 'invalid' };
  return performCheckIn(ticket, staffId);
}
