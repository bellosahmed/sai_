import Scanner from './Scanner';
import LogoutButton from '../LogoutButton';
export const dynamic = 'force-dynamic';
export default function ScanPage() {
  return (
    <main style={{ maxWidth: 480, margin: '1rem auto', fontFamily: 'system-ui', textAlign: 'center' }}>
      <LogoutButton />
      <h1>Gate scanner</h1>
      <Scanner />
    </main>
  );
}
