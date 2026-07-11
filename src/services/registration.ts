import { prisma } from '@/lib/db';
import { hashPassword } from '@/services/auth';

export class RegistrationError extends Error {
  constructor(public code: 'CLOSED' | 'FULL' | 'EMAIL_TAKEN', msg: string) {
    super(msg);
  }
}

export async function registerAttendee(input: {
  email: string; password: string; fullName: string; phone: string; paymentReference: string;
}) {
  const settings = await prisma.eventSettings.findUnique({ where: { id: 1 } });
  if (!settings || !settings.registrationOpen)
    throw new RegistrationError('CLOSED', 'Registration is closed');

  const approvedCount = await prisma.ticket.count();
  if (approvedCount >= settings.capacity)
    throw new RegistrationError('FULL', 'Event is at capacity');

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new RegistrationError('EMAIL_TAKEN', 'Email already registered');

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: 'attendee',
      registration: {
        create: {
          fullName: input.fullName,
          phone: input.phone,
          paymentReference: input.paymentReference,
        },
      },
    },
    include: { registration: true },
  });
  return { userId: user.id, registrationId: user.registration!.id };
}
