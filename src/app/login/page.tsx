'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Login() {
  const r = useRouter();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify(f) });
    if (!res.ok) { setErr('Invalid credentials'); return; }
    const { role } = await res.json();
    r.push(role === 'admin' ? '/admin' : role === 'staff' ? '/scan' : '/ticket');
  }
  return (
    <main style={{ maxWidth: 380, margin: '3rem auto', fontFamily: 'system-ui' }}>
      <h1>Log in</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
        <input required type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input required type="password" placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <button type="submit">Log in</button>
      </form>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
    </main>
  );
}
