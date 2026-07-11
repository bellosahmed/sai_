import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { listGuests, addGuest, AdminGuestError } from '@/services/admin-guests';

export async function GET(req: Request) {
  if (!(await requireRole('admin'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const search = new URL(req.url).searchParams.get('search') ?? undefined;
  return NextResponse.json({ guests: await listGuests(search) });
}

export async function POST(req: Request) {
  const admin = await requireRole('admin');
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  try {
    const res = await addGuest(body, admin.userId);
    return NextResponse.json(res, { status: 201 });
  } catch (e) {
    if (e instanceof AdminGuestError) {
      const status = e.code === 'FULL' ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
