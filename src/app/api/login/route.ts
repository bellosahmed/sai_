import { NextResponse } from 'next/server';
import { authenticate } from '@/services/login';
import { createSession, SESSION_COOKIE } from '@/services/auth';
export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = await authenticate(email, password);
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  const token = await createSession(user);
  const res = NextResponse.json({ role: user.role });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}
