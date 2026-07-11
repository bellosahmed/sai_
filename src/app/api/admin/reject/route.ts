import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { rejectRegistration } from '@/services/approval';
export async function POST(req: Request) {
  const admin = await requireRole('admin');
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { registrationId } = await req.json();
  await rejectRegistration(registrationId);
  return NextResponse.json({ ok: true });
}
