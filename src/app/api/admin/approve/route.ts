import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { approveRegistration, ApprovalError } from '@/services/approval';
export async function POST(req: Request) {
  const admin = await requireRole('admin');
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { registrationId } = await req.json();
  try {
    const t = await approveRegistration(registrationId, admin.userId);
    return NextResponse.json({ referenceCode: t.referenceCode });
  } catch (e) {
    if (e instanceof ApprovalError) return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
