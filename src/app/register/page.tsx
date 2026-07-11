'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Register() {
  const r = useRouter();
  const [f, setF] = useState({ fullName: '', email: '', phone: '', paymentReference: '', password: '' });
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    const res = await fetch('/api/register', { method: 'POST', body: JSON.stringify(f) });
    if (res.ok) {
      await fetch('/api/login', { method: 'POST', body: JSON.stringify({ email: f.email, password: f.password }) });
      r.push('/ticket');
    } else {
      const b = await res.json();
      setErr(b.code === 'CLOSED' ? 'Registration is closed.' : b.code === 'FULL' ? 'Event is sold out.' : b.error);
    }
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <main style={{ maxWidth: 420, margin: '3rem auto', fontFamily: 'system-ui' }}>
      <h1>Register</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <input required placeholder="Full name" value={f.fullName} onChange={set('fullName')} />
        <input required type="email" placeholder="Email" value={f.email} onChange={set('email')} />
        <input required placeholder="Phone" value={f.phone} onChange={set('phone')} />
        <input required placeholder="Bank transfer reference" value={f.paymentReference} onChange={set('paymentReference')} />
        <input required type="password" placeholder="Password" value={f.password} onChange={set('password')} />
        <button type="submit">Register</button>
      </form>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
    </main>
  );
}
