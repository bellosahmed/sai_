import { randomBytes, randomInt } from 'node:crypto';
import QRCode from 'qrcode';

export function generateQrToken(): string {
  return randomBytes(32).toString('hex');
}
export function generateReferenceCode(): string {
  return `TICK-${randomInt(0, 10000).toString().padStart(4, '0')}`;
}
export function generateQrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 2, width: 320 });
}
