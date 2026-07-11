import { prisma } from '@/lib/db';
import { generateQrDataUrl } from '@/services/tickets';

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
    <main style={{ maxWidth: 420, margin: '3rem auto', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h1>{ticket.registration.fullName}</h1>
      <p>Show this at the door.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Ticket QR code" style={{ width: 320, height: 320 }} />
      <p><strong>{ticket.referenceCode}</strong></p>
      {ticket.checkedInAt && <p style={{ color: '#b8860b' }}>Checked in.</p>}
    </main>
  );
}
