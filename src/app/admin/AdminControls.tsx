'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function AdminControls({ open, capacity }: { open: boolean; capacity: number }) {
  const r = useRouter();
  const [cap, setCap] = useState(capacity);
  const [staff, setStaff] = useState({ email: '', password: '' });
  async function settings(body: object) {
    await fetch('/api/admin/settings', { method: 'POST', body: JSON.stringify(body) });
    r.refresh();
  }
  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/staff', { method: 'POST', body: JSON.stringify(staff) });
    alert(res.ok ? 'Staff added' : 'Failed'); setStaff({ email: '', password: '' });
  }
  return (
    <section style={{ display: 'grid', gap: 12, margin: '1rem 0' }}>
      <div>
        <button onClick={() => settings({ registrationOpen: !open })}>
          {open ? 'Close registration' : 'Open registration'}
        </button>
      </div>
      <div>
        Capacity: <input type="number" value={cap} onChange={(e) => setCap(Number(e.target.value))} />
        <button onClick={() => settings({ capacity: cap })}>Save</button>
      </div>
      <form onSubmit={addStaff}>
        Add gate staff:{' '}
        <input placeholder="email" value={staff.email} onChange={(e) => setStaff({ ...staff, email: e.target.value })} />
        <input placeholder="password" type="password" value={staff.password} onChange={(e) => setStaff({ ...staff, password: e.target.value })} />
        <button type="submit">Add</button>
      </form>
    </section>
  );
}
