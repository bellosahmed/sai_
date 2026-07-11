import { getCurrentUser } from '@/session/current-user';
type Session = { userId: string; role: string } | null;
export function matchesRole(user: Session, role: 'admin' | 'staff'): boolean {
  return !!user && user.role === role;
}
export async function requireRole(role: 'admin' | 'staff') {
  const user = await getCurrentUser();
  return matchesRole(user, role) ? user : null;
}
