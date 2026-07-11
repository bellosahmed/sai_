import { describe, it, expect } from 'vitest';
import { generateQrToken, generateReferenceCode, generateQrDataUrl } from '@/services/tickets';

describe('ticket helpers', () => {
  it('generates unique 64-char hex tokens', () => {
    const a = generateQrToken(), b = generateQrToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
  it('generates TICK-#### reference codes', () => {
    expect(generateReferenceCode()).toMatch(/^TICK-\d{4}$/);
  });
  it('renders a PNG data url', async () => {
    const url = await generateQrDataUrl('abc');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });
});
