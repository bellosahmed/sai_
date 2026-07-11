import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/guard';
import { prisma } from '@/lib/db';
export async function POST(req: Request) {
  if (!(await requireRole('admin'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof b.capacity === 'number') data.capacity = b.capacity;
  if (typeof b.registrationOpen === 'boolean') data.registrationOpen = b.registrationOpen;
  if (typeof b.eventName === 'string') data.eventName = b.eventName;
  const s = await prisma.eventSettings.update({ where: { id: 1 }, data });
  return NextResponse.json(s);
}
