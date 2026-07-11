import { prisma } from '@/lib/db';
import { issueTicket, ApprovalError } from '@/services/approval';
import { normalizeEmail } from '@/lib/email';

export class AdminGuestError extends Error {
  constructor(public code: 'INVALID' | 'FULL' | 'NOT_FOUND', msg: string) {
    super(msg);
  }
}

export type GuestRow = {
  registrationId: string;
  fullName: string;
  email: string | null;
  phone: string;
  paymentReference: string;
  status: 'pending' | 'approved' | 'rejected';
  referenceCode: string | null;
  qrToken: string | null;
  checkedInAt: Date | null;
  hasLogin: boolean;
};

export async function listGuests(search?: string): Promise<GuestRow[]> {
  const term = search?.trim();
  const regs = await prisma.registration.findMany({
    orderBy: { createdAt: 'desc' },
    where: term
      ? {
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
            { ticket: { referenceCode: { contains: term, mode: 'insensitive' } } },
          ],
        }
      : undefined,
    include: { ticket: true },
  });
  return regs.map((r) => ({
    registrationId: r.id,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    paymentReference: r.paymentReference,
    status: r.status,
    referenceCode: r.ticket?.referenceCode ?? null,
    qrToken: r.ticket?.qrToken ?? null,
    checkedInAt: r.ticket?.checkedInAt ?? null,
    hasLogin: r.userId !== null,
  }));
}

export async function addGuest(
  input: { fullName: string; email?: string; phone?: string; paymentReference?: string },
  adminId: string,
) {
  const fullName = input.fullName?.trim();
  if (!fullName) throw new AdminGuestError('INVALID', 'Full name is required');

  try {
    return await prisma.$transaction(async (tx) => {
      const reg = await tx.registration.create({
        data: {
          fullName,
          email: input.email ? normalizeEmail(input.email) : null,
          phone: input.phone?.trim() || '',
          paymentReference: input.paymentReference?.trim() || 'ADMIN-ADDED',
          status: 'approved',
          approvedAt: new Date(),
          approvedById: adminId,
        },
      });
      const ticket = await issueTicket(tx, reg.id);
      return { registrationId: reg.id, referenceCode: ticket.referenceCode, qrToken: ticket.qrToken };
    });
  } catch (e) {
    if (e instanceof ApprovalError && e.code === 'FULL')
      throw new AdminGuestError('FULL', 'Event is at capacity');
    throw e;
  }
}

export async function removeGuest(registrationId: string): Promise<void> {
  const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!reg) throw new AdminGuestError('NOT_FOUND', 'Guest not found');
  await prisma.$transaction(async (tx) => {
    await tx.ticket.deleteMany({ where: { registrationId } });
    await tx.registration.delete({ where: { id: registrationId } });
    if (reg.userId) await tx.user.delete({ where: { id: reg.userId } });
  });
}
