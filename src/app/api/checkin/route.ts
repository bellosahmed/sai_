import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { checkIn } from '@/services/checkin';
export async function POST(req: Request) {
  const staff = await requireRole('staff');
  const user = staff ?? (await requireRole('admin')); // admins may also scan
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { qrToken } = await req.json();
  if (!qrToken) return NextResponse.json({ error: 'Missing qrToken' }, { status: 400 });
  const result = await checkIn(qrToken, user.userId);
  return NextResponse.json(result);
}
