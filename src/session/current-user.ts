import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE } from '@/services/auth';
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
