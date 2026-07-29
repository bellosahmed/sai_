import { getCurrentUser } from '@/session/current-user';
import { prisma } from '@/lib/db';
import { generateQrDataUrl } from '@/services/tickets';
import { redirect } from 'next/navigation';
import LogoutButton from '../LogoutButton';
import Badge from '../Badge';

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
    <main style={{ fontFamily: 'system-ui' }}>
      <div className="no-print" style={{ maxWidth: 420, margin: '0 auto', padding: '1rem 1rem 0', textAlign: 'right' }}>
        <LogoutButton />
      </div>
      <Badge
        fullName={reg.fullName}
        qr={qr}
        referenceCode={reg.ticket!.referenceCode}
        checkedIn={!!reg.ticket!.checkedInAt}
      />
    </main>
  );
}
function Msg({ title, body }: { title: string; body?: string }) {
  return (
    <main style={{ maxWidth: 420, margin: '4rem auto', textAlign: 'center', fontFamily: 'system-ui' }}>
      <LogoutButton />
      <h1>{title}</h1>{body && <p>{body}</p>}
    </main>
  );
}
