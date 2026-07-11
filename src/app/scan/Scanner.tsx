'use client';
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type Result = { status: string; fullName?: string; checkedInAt?: string; referenceCode?: string };
export default function Scanner() {
  const [result, setResult] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const busy = useRef(false);
  const divId = 'qr-reader';

  useEffect(() => {
    const scanner = new Html5Qrcode(divId);
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      async (decoded) => {
        if (busy.current) return;
        busy.current = true;
        try {
          const res = await fetch('/api/checkin', { method: 'POST', body: JSON.stringify({ qrToken: decoded }) });
          const body = await res.json();
          setResult(body);
          if (body.status === 'ok') setCount((c) => c + 1);
        } finally {
          setTimeout(() => { busy.current = false; }, 1500);
        }
      },
      () => {}
    ).catch(() => setResult({ status: 'camera_error' }));
    return () => { scanner.stop().catch(() => {}); };
  }, []);

  const color = result?.status === 'ok' ? 'green' : result?.status === 'already_used' ? '#b8860b' : 'crimson';
  const label =
    result?.status === 'ok' ? `✅ ${result.fullName}` :
    result?.status === 'already_used' ? `⚠️ Already used — ${result.fullName}` :
    result?.status === 'invalid' ? '❌ Invalid ticket' :
    result?.status === 'camera_error' ? 'Camera unavailable' : 'Point at a QR code';

  return (
    <div>
      <div id={divId} style={{ width: '100%' }} />
      <p style={{ color, fontSize: 24, fontWeight: 700 }}>{label}</p>
      <p>Checked in this session: {count}</p>
    </div>
  );
}
