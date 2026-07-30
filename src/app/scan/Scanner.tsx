'use client';
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Badge from '../Badge';

type Result = {
  status: string;
  fullName?: string;
  checkedInAt?: string;
  referenceCode?: string;
  ticketNumber?: number;
  qr?: string;
};

export default function Scanner() {
  const [result, setResult] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const [manualCode, setManualCode] = useState('');
  const busy = useRef(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  async function submitCheckIn(body: { qrToken: string } | { referenceCode: string }) {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch('/api/checkin', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      setResult(data);
      if (data.status === 'ok') setCount((c) => c + 1);
      // Freeze the camera on a decisive result so the gate can read the badge.
      if (['ok', 'already_used', 'invalid'].includes(data.status)) {
        try { scannerRef.current?.pause(true); } catch { /* not scanning */ }
      }
    } finally {
      setTimeout(() => { busy.current = false; }, 1200);
    }
  }

  const divId = 'qr-reader';
  useEffect(() => {
    const scanner = new Html5Qrcode(divId);
    scannerRef.current = scanner;
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      (decoded) => { void submitCheckIn({ qrToken: decoded }); },
      () => {}
    ).catch(() => setResult({ status: 'camera_error' }));
    return () => { scanner.stop().catch(() => {}); };
  }, []);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    void submitCheckIn({ referenceCode: code });
    setManualCode('');
  }

  function scanNext() {
    setResult(null);
    try { scannerRef.current?.resume(); } catch { /* wasn't paused */ }
  }

  // A decisive result takes over the screen with the full welcome badge.
  const showCard = result != null && ['ok', 'already_used', 'invalid'].includes(result.status);
  const granted = result?.status === 'ok';
  const used = result?.status === 'already_used';
  const banner = granted
    ? { color: '#0a7d34', bg: '#e5f6ec', text: '✅ ACCESS GRANTED' }
    : used
      ? { color: '#8a6100', bg: '#fdf3d8', text: '⚠️ ALREADY SCANNED' }
      : { color: '#b3160f', bg: '#fce4e2', text: '❌ INVALID TICKET' };

  const cameraError = result?.status === 'camera_error';

  return (
    <div>
      {/* Result view: full welcome badge + status banner. */}
      {showCard && result && (
        <div>
          <div
            style={{
              background: banner.bg, color: banner.color, borderRadius: 12,
              padding: '18px 16px', fontSize: 26, fontWeight: 800, letterSpacing: 0.5,
            }}
          >
            {banner.text}
            {typeof result.ticketNumber === 'number' && (
              <div style={{ fontSize: 34, fontWeight: 900, marginTop: 4 }}>#{result.ticketNumber}</div>
            )}
            {result.fullName && (
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>{result.fullName}</div>
            )}
            {used && result.checkedInAt && (
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 6, opacity: 0.9 }}>
                Checked in at {new Date(result.checkedInAt).toLocaleString()}
              </div>
            )}
          </div>

          {(granted || used) && result.qr && result.referenceCode && result.fullName && (
            <Badge
              fullName={result.fullName}
              qr={result.qr}
              referenceCode={result.referenceCode}
              checkedIn
            />
          )}

          <button
            onClick={scanNext}
            style={{
              marginTop: 20, padding: '14px 28px', fontSize: 18, fontWeight: 700,
              cursor: 'pointer', borderRadius: 10, border: 'none',
              background: '#3b1f18', color: '#f3e3da',
            }}
          >
            Scan next guest
          </button>

          <p style={{ marginTop: 16 }}>Checked in this session: {count}</p>
        </div>
      )}

      {/* Camera view: kept mounted (hidden while a result card is up) so the
          paused scanner can resume without re-initialising the camera. */}
      <div style={{ display: showCard ? 'none' : 'block' }}>
        <div id={divId} style={{ width: '100%' }} />
        <p style={{ color: cameraError ? 'crimson' : '#555', fontSize: 20, fontWeight: 700 }}>
          {cameraError ? 'Camera unavailable — use manual entry below' : 'Point at a QR code'}
        </p>

        <form onSubmit={submitManual} style={{ margin: '1rem 0', display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 14, color: '#555' }}>QR not working? Enter the ticket code:</label>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. TICK-ABC123"
              autoCapitalize="characters"
              autoCorrect="off"
              style={{ padding: 8, fontSize: 16, textTransform: 'uppercase' }}
            />
            <button type="submit">Check in</button>
          </div>
        </form>

        <p>Checked in this session: {count}</p>
      </div>
    </div>
  );
}
