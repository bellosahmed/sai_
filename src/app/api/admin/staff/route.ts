import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/services/auth';
import { normalizeEmail } from '@/lib/email';
export async function POST(req: Request) {
  if (!(await requireRole('admin'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  if (!body?.email || !body?.password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const email = normalizeEmail(body.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'Email taken' }, { status: 409 });
  await prisma.user.create({ data: { email, passwordHash: await hashPassword(body.password), role: 'staff' } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
