import { NextResponse } from 'next/server';
import { registerAttendee, RegistrationError } from '@/services/registration';
export async function POST(req: Request) {
  const b = await req.json();
  for (const f of ['email', 'password', 'fullName', 'phone', 'paymentReference'])
    if (!b?.[f]) return NextResponse.json({ error: `Missing ${f}` }, { status: 400 });
  try {
    const r = await registerAttendee(b);
    return NextResponse.json({ registrationId: r.registrationId }, { status: 201 });
  } catch (e) {
    if (e instanceof RegistrationError)
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
