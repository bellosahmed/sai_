import { randomBytes, randomInt } from 'node:crypto';
import QRCode from 'qrcode';

export function generateQrToken(): string {
  return randomBytes(32).toString('hex');
}

// Unambiguous alphabet (no 0/O/1/I) — 32 symbols. Six chars ≈ 1.07e9 codes,
// so collisions across a few hundred tickets are astronomically unlikely.
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateReferenceCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += REF_ALPHABET[randomInt(0, REF_ALPHABET.length)];
  return `TICK-${code}`;
}
export function generateQrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 2, width: 320 });
}
