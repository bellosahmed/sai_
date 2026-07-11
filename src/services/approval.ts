import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { generateQrToken, generateReferenceCode } from '@/services/tickets';

export class ApprovalError extends Error {
  constructor(public code: 'NOT_PENDING' | 'FULL' | 'NOT_FOUND', msg: string) {
    super(msg);
  }
}

// Issue a ticket for a registration inside an existing transaction, enforcing
// capacity. Shared by attendee approval and admin direct-add.
export async function issueTicket(tx: Prisma.TransactionClient, registrationId: string) {
  const settings = await tx.eventSettings.findUnique({ where: { id: 1 } });
  const issued = await tx.ticket.count();
  if (!settings || issued >= settings.capacity)
    throw new ApprovalError('FULL', 'At capacity');
  const ticket = await tx.ticket.create({
    data: {
      registrationId,
      referenceCode: generateReferenceCode(),
      qrToken: generateQrToken(),
    },
  });
  return { ticketId: ticket.id, referenceCode: ticket.referenceCode, qrToken: ticket.qrToken };
}

export async function approveRegistration(registrationId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const reg = await tx.registration.findUnique({ where: { id: registrationId } });
    if (!reg) throw new ApprovalError('NOT_FOUND', 'Registration not found');
    if (reg.status !== 'pending') throw new ApprovalError('NOT_PENDING', 'Not pending');

    const ticket = await issueTicket(tx, registrationId);
    await tx.registration.update({
      where: { id: registrationId },
      data: { status: 'approved', approvedAt: new Date(), approvedById: adminId },
    });
    return ticket;
  });
}

export async function rejectRegistration(registrationId: string) {
  const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!reg) throw new ApprovalError('NOT_FOUND', 'Registration not found');
  await prisma.registration.update({ where: { id: registrationId }, data: { status: 'rejected' } });
}
