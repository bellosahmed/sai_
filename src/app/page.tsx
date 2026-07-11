import Link from 'next/link';
export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'system-ui', textAlign: 'center' }}>
      <h1>Event Tickets</h1>
      <p><Link href="/register">Register</Link> · <Link href="/login">Log in</Link></p>
    </main>
  );
}
