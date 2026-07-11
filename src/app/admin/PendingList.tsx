'use client';
import { useRouter } from 'next/navigation';
type Item = { id: string; fullName: string; phone: string; paymentReference: string };
export default function PendingList({ items }: { items: Item[] }) {
  const r = useRouter();
  async function act(path: string, registrationId: string) {
    const res = await fetch(path, { method: 'POST', body: JSON.stringify({ registrationId }) });
    if (!res.ok) { const b = await res.json(); alert(b.error ?? 'Error'); }
    r.refresh();
  }
  if (!items.length) return <p>No pending registrations.</p>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {items.map((i) => (
          <tr key={i.id} style={{ borderBottom: '1px solid #ddd' }}>
            <td>{i.fullName}</td><td>{i.phone}</td><td>{i.paymentReference}</td>
            <td>
              <button onClick={() => act('/api/admin/approve', i.id)}>Approve</button>{' '}
              <button onClick={() => act('/api/admin/reject', i.id)}>Reject</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
