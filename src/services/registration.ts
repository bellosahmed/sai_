import { prisma } from '@/lib/db';
import { hashPassword } from '@/services/auth';
import { normalizeEmail } from '@/lib/email';

export const MIN_PASSWORD_LENGTH = 8;

export class RegistrationError extends Error {
  constructor(public code: 'CLOSED' | 'FULL' | 'EMAIL_TAKEN' | 'WEAK_PASSWORD', msg: string) {
    super(msg);
  }
}

export async function registerAttendee(input: {
  email: string; password: string; fullName: string; phone: string; paymentReference: string;
}) {
  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH)
    throw new RegistrationError('WEAK_PASSWORD', `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);

  const settings = await prisma.eventSettings.findUnique({ where: { id: 1 } });
  if (!settings || !settings.registrationOpen)
    throw new RegistrationError('CLOSED', 'Registration is closed');

  const approvedCount = await prisma.ticket.count();
  if (approvedCount >= settings.capacity)
    throw new RegistrationError('FULL', 'Event is at capacity');

  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new RegistrationError('EMAIL_TAKEN', 'Email already registered');

  const user = await prisma.user.create({
    data: {
      email,
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
