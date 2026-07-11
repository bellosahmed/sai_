import { prisma } from '@/lib/db';
import { verifyPassword } from '@/services/auth';
export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;
  return { userId: user.id, role: user.role };
}
