'use client';
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type Result = { status: string; fullName?: string; checkedInAt?: string; referenceCode?: string };
export default function Scanner() {
  const [result, setResult] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const [manualCode, setManualCode] = useState('');
  const busy = useRef(false);

  async function submitCheckIn(body: { qrToken: string } | { referenceCode: string }) {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch('/api/checkin', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      setResult(data);
      if (data.status === 'ok') setCount((c) => c + 1);
    } finally {
      setTimeout(() => { busy.current = false; }, 1200);
    }
  }

  const divId = 'qr-reader';
  useEffect(() => {
    const scanner = new Html5Qrcode(divId);
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

  const color = result?.status === 'ok' ? 'green' : result?.status === 'already_used' ? '#b8860b' : 'crimson';
  const label =
    result?.status === 'ok' ? `✅ ${result.fullName}` :
    result?.status === 'already_used' ? `⚠️ Already used — ${result.fullName}` :
    result?.status === 'invalid' ? '❌ Invalid ticket' :
    result?.status === 'camera_error' ? 'Camera unavailable — use manual entry below' : 'Point at a QR code';

  return (
    <div>
      <div id={divId} style={{ width: '100%' }} />
      <p style={{ color, fontSize: 24, fontWeight: 700 }}>{label}</p>

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
  );
}
