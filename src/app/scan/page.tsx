import Scanner from './Scanner';
export const dynamic = 'force-dynamic';
export default function ScanPage() {
  return (
    <main style={{ maxWidth: 480, margin: '1rem auto', fontFamily: 'system-ui', textAlign: 'center' }}>
      <h1>Gate scanner</h1>
      <Scanner />
    </main>
  );
}
