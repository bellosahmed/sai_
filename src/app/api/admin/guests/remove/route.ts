import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { removeGuest, AdminGuestError } from '@/services/admin-guests';

export async function POST(req: Request) {
  if (!(await requireRole('admin'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { registrationId } = await req.json();
  if (!registrationId) return NextResponse.json({ error: 'Missing registrationId' }, { status: 400 });
  try {
    await removeGuest(registrationId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminGuestError) return NextResponse.json({ error: e.message, code: e.code }, { status: 404 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
