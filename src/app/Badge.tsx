'use client';
import { useState } from 'react';

type Props = {
  fullName: string;
  qr: string;
  referenceCode: string;
  checkedIn: boolean;
};

export default function Badge({ fullName, qr, referenceCode, checkedIn }: Props) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div style={{ maxWidth: 420, margin: '3rem auto', textAlign: 'center', fontFamily: 'system-ui', padding: '0 1rem' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .badge-outer { perspective: none !important; height: auto !important; }
          .badge-inner {
            transform: none !important;
            position: static !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 24px !important;
          }
          .badge-face {
            position: static !important;
            transform: none !important;
            backface-visibility: visible !important;
          }
          .badge-face.back { break-before: page; }
        }
      `}</style>

      <div
        className="badge-outer"
        onClick={() => setFlipped((f) => !f)}
        role="button"
        aria-label="Flip ticket card"
        style={{ width: 320, height: 480, margin: '0 auto', perspective: 1200, cursor: 'pointer' }}
      >
        <div
          className="badge-inner"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transition: 'transform 0.6s',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div
            className="badge-face front"
            style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              borderRadius: 16,
              background: 'linear-gradient(160deg, #fbeee6 0%, #f3d9cd 100%)',
              border: '1px solid #d8b6a6',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'flex-start', padding: '2rem 1.5rem', color: '#4a2c22',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/kmc-logo.jpg"
              alt="Khadija Memorial College logo"
              style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', marginBottom: 16 }}
            />
            <p style={{ fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>Welcome to the</p>
            <h2 style={{ fontSize: 19, margin: '8px 0 0', lineHeight: 1.3 }}>
              11th Annual Speech &amp; Prize Giving Day &amp; Graduation Ceremony
            </h2>
            <div style={{ marginTop: 'auto', width: '100%' }}>
              <hr style={{ border: 'none', borderTop: '1px solid #d8b6a6', margin: '0 0 14px' }} />
              <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 2px', opacity: 0.7 }}>Access Level</p>
              <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>Guest</p>
              <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 2px', opacity: 0.7 }}>Issued by</p>
              <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 14px' }}>Khadija Memorial College</p>
              <p style={{ fontSize: 11, fontStyle: 'italic', opacity: 0.75, margin: 0 }}>A valid KMC access credential.</p>
            </div>
          </div>

          {/* Back */}
          <div
            className="badge-face back"
            style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: 16,
              background: '#3b1f18',
              border: '1px solid #5a3226',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'flex-start', padding: '1.75rem 1.25rem', color: '#f3e3da',
            }}
          >
            <h3 style={{ fontSize: 15, margin: '0 0 14px', fontWeight: 600 }}>{fullName}</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="Ticket QR code"
              style={{ width: 190, height: 190, background: '#fff', padding: 8, borderRadius: 8 }}
            />
            <p style={{ fontSize: 11, opacity: 0.65, margin: '10px 0 0' }}>If this code fails to scan, use:</p>
            <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1, margin: '2px 0 16px' }}>{referenceCode}</p>
            <div style={{ width: '100%', borderTop: '1px solid #5a3226', paddingTop: 14 }}>
              <p style={{ fontSize: 13, margin: '0 0 4px' }}><strong>Date:</strong> Saturday, August 15th 2026</p>
              <p style={{ fontSize: 13, margin: '0 0 4px' }}><strong>Time:</strong> 9:30am</p>
              <p style={{ fontSize: 13, margin: 0 }}><strong>Venue:</strong> African Anchor Event Hall, Ado Bayero Mall, Shoprite, Kano</p>
            </div>
            <p style={{ fontSize: 10.5, opacity: 0.7, marginTop: 12, lineHeight: 1.4 }}>
              This ticket is valid for one entry only. Please present it for scanning at the gate only.
            </p>
            {checkedIn && <p style={{ color: '#ffd27a', fontSize: 12, marginTop: 10 }}>Checked in.</p>}
          </div>
        </div>
      </div>

      <p className="no-print" style={{ fontSize: 12, color: '#888', marginTop: 16 }}>Tap the card to flip.</p>

      <button
        className="no-print"
        onClick={() => window.print()}
        style={{ marginTop: 8, padding: '8px 20px', fontSize: 14, cursor: 'pointer' }}
      >
        🖨️ Print ticket
      </button>
    </div>
  );
}
