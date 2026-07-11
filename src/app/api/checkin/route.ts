import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { checkIn, checkInByReference } from '@/services/checkin';
export async function POST(req: Request) {
  const staff = await requireRole('staff');
  const user = staff ?? (await requireRole('admin')); // admins may also scan
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { qrToken, referenceCode } = await req.json();
  const result = qrToken
    ? await checkIn(qrToken, user.userId)
    : referenceCode
      ? await checkInByReference(referenceCode, user.userId)
      : null;
  if (!result) return NextResponse.json({ error: 'Missing qrToken or referenceCode' }, { status: 400 });
  return NextResponse.json(result);
}
