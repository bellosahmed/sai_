import { NextResponse, NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '@/services/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySession(token) : null;

  const needsAuth = ['/admin', '/scan', '/ticket'].some((p) => pathname.startsWith(p));
  if (needsAuth && !user) return NextResponse.redirect(new URL('/login', req.url));
  if (pathname.startsWith('/admin') && user?.role !== 'admin')
    return NextResponse.redirect(new URL('/login', req.url));
  if (pathname.startsWith('/scan') && !(user?.role === 'staff' || user?.role === 'admin'))
    return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/admin/:path*', '/scan/:path*', '/ticket/:path*'] };
