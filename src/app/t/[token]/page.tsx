import { prisma } from '@/lib/db';
import { generateQrDataUrl } from '@/services/tickets';
import Badge from '../../Badge';

export const dynamic = 'force-dynamic';

export default async function SharedTicket({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { qrToken: token },
    include: { registration: true },
  });
  if (!ticket) {
    return (
      <main style={{ maxWidth: 420, margin: '4rem auto', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1>Ticket not found</h1>
      </main>
    );
  }
  const qr = await generateQrDataUrl(ticket.qrToken);
  return (
    <Badge
      fullName={ticket.registration.fullName}
      qr={qr}
      referenceCode={ticket.referenceCode}
      checkedIn={!!ticket.checkedInAt}
    />
  );
}
