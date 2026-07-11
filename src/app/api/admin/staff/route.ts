import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/services/auth';
export async function POST(req: Request) {
  if (!(await requireRole('admin'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'Email taken' }, { status: 409 });
  await prisma.user.create({ data: { email, passwordHash: await hashPassword(password), role: 'staff' } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
