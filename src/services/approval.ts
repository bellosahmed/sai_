import { prisma } from '@/lib/db';
import { generateQrToken, generateReferenceCode } from '@/services/tickets';

export class ApprovalError extends Error {
  constructor(public code: 'NOT_PENDING' | 'FULL' | 'NOT_FOUND', msg: string) {
    super(msg);
  }
}

export async function approveRegistration(registrationId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const reg = await tx.registration.findUnique({ where: { id: registrationId } });
    if (!reg) throw new ApprovalError('NOT_FOUND', 'Registration not found');
    if (reg.status !== 'pending') throw new ApprovalError('NOT_PENDING', 'Not pending');

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
    await tx.registration.update({
      where: { id: registrationId },
      data: { status: 'approved', approvedAt: new Date(), approvedById: adminId },
    });
    return { ticketId: ticket.id, referenceCode: ticket.referenceCode, qrToken: ticket.qrToken };
  });
}

export async function rejectRegistration(registrationId: string) {
  const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!reg) throw new ApprovalError('NOT_FOUND', 'Registration not found');
  await prisma.registration.update({ where: { id: registrationId }, data: { status: 'rejected' } });
}
