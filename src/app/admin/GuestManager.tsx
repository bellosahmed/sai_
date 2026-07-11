'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Guest = {
  registrationId: string;
  fullName: string;
  email: string | null;
  phone: string;
  paymentReference: string;
  status: 'pending' | 'approved' | 'rejected';
  referenceCode: string | null;
  qrToken: string | null;
  checkedInAt: string | null;
  hasLogin: boolean;
};

export default function GuestManager() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [add, setAdd] = useState({ fullName: '', email: '', phone: '', paymentReference: '' });
  const [msg, setMsg] = useState('');

  const load = useCallback(async (term: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/guests?search=${encodeURIComponent(term)}`);
    const data = await res.json();
    setGuests(data.guests ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 250); // debounce
    return () => clearTimeout(t);
  }, [search, load]);

  async function addGuest(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    if (!add.fullName.trim()) { setMsg('Full name is required.'); return; }
    const res = await fetch('/api/admin/guests', { method: 'POST', body: JSON.stringify(add) });
    const data = await res.json();
    if (res.ok) {
      setMsg(`Added ${add.fullName} — ${data.referenceCode}`);
      setAdd({ fullName: '', email: '', phone: '', paymentReference: '' });
      load(search);
      router.refresh(); // update the count tiles
    } else {
      setMsg(data.code === 'FULL' ? 'Event is at capacity.' : data.error ?? 'Failed to add.');
    }
  }

  async function remove(g: Guest) {
    if (!confirm(`Remove ${g.fullName}? This deletes their ticket and frees a slot.`)) return;
    const res = await fetch('/api/admin/guests/remove', {
      method: 'POST', body: JSON.stringify({ registrationId: g.registrationId }),
    });
    if (res.ok) { load(search); router.refresh(); } else { alert('Failed to remove.'); }
  }

  const badge = (s: Guest['status']) => ({
    pending: '#b8860b', approved: 'green', rejected: 'crimson',
  }[s]);

  return (
    <section style={{ margin: '1.5rem 0' }}>
      <h2>All guests</h2>

      <form onSubmit={addGuest} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0.5rem 0 1rem' }}>
        <input placeholder="Full name *" value={add.fullName} onChange={(e) => setAdd({ ...add, fullName: e.target.value })} />
        <input placeholder="Email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} />
        <input placeholder="Phone" value={add.phone} onChange={(e) => setAdd({ ...add, phone: e.target.value })} />
        <input placeholder="Payment ref" value={add.paymentReference} onChange={(e) => setAdd({ ...add, paymentReference: e.target.value })} />
        <button type="submit">+ Add guest</button>
      </form>
      {msg && <p style={{ color: '#333' }}>{msg}</p>}

      <input
        placeholder="Search name, email, phone, or code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', padding: 8, margin: '0.5rem 0' }}
      />

      {loading ? <p>Loading…</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
              <th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Code</th><th>Checked in</th><th></th>
            </tr>
          </thead>
          <tbody>
            {guests.map((g) => (
              <tr key={g.registrationId} style={{ borderBottom: '1px solid #eee' }}>
                <td>{g.fullName}</td>
                <td>{g.email ?? '—'}</td>
                <td>{g.phone || '—'}</td>
                <td style={{ color: badge(g.status), fontWeight: 600 }}>{g.status}</td>
                <td>
                  {g.qrToken
                    ? <a href={`/t/${g.qrToken}`} target="_blank" rel="noreferrer">{g.referenceCode}</a>
                    : '—'}
                </td>
                <td>{g.checkedInAt ? '✅' : '—'}</td>
                <td><button onClick={() => remove(g)} style={{ color: 'crimson' }}>Remove</button></td>
              </tr>
            ))}
            {guests.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 12, color: '#777' }}>No guests found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
