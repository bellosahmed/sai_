import { getCurrentUser } from '@/session/current-user';
import { prisma } from '@/lib/db';
import { generateQrDataUrl } from '@/services/tickets';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function TicketPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const reg = await prisma.registration.findUnique({
    where: { userId: user.userId }, include: { ticket: true },
  });
  if (!reg) return <Msg title="No registration found" />;
  if (reg.status === 'pending') return <Msg title="Payment under review" body="We're verifying your bank transfer. Check back soon." />;
  if (reg.status === 'rejected') return <Msg title="Payment not verified" body="We couldn't verify your payment — please contact us." />;
  const qr = await generateQrDataUrl(reg.ticket!.qrToken);
  return (
    <main style={{ maxWidth: 420, margin: '3rem auto', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h1>You&apos;re in, {reg.fullName.split(' ')[0]}!</h1>
      <p>Show this at the door.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Your ticket QR code" style={{ width: 320, height: 320 }} />
      <p><strong>{reg.ticket!.referenceCode}</strong></p>
    </main>
  );
}
function Msg({ title, body }: { title: string; body?: string }) {
  return (
    <main style={{ maxWidth: 420, margin: '4rem auto', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h1>{title}</h1>{body && <p>{body}</p>}
    </main>
  );
}
