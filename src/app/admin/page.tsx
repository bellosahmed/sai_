import { prisma } from '@/lib/db';
import { getEventStats } from '@/services/stats';
import PendingList from './PendingList';
import AdminControls from './AdminControls';

export const dynamic = 'force-dynamic';
export default async function Admin() {
  const stats = await getEventStats();
  const pending = await prisma.registration.findMany({
    where: { status: 'pending' }, orderBy: { createdAt: 'asc' },
    select: { id: true, fullName: true, phone: true, paymentReference: true },
  });
  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>Admin dashboard</h1>
      <ul style={{ display: 'flex', gap: 16, listStyle: 'none', padding: 0 }}>
        <li>Registered: {stats.registered}</li>
        <li>Approved: {stats.approved}</li>
        <li>Checked in: {stats.checkedIn}</li>
        <li>Remaining: {stats.remaining}/{stats.capacity}</li>
      </ul>
      <AdminControls open={stats.registrationOpen} capacity={stats.capacity} />
      <h2>Pending payments</h2>
      <PendingList items={pending} />
    </main>
  );
}
