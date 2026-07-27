import { describe, it, expect } from 'vitest';
import { generateQrToken, generateReferenceCode, generateQrDataUrl } from '@/services/tickets';

describe('ticket helpers', () => {
  it('generates unique 64-char hex tokens', () => {
    const a = generateQrToken(), b = generateQrToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
  it('generates high-entropy TICK-XXXXXX reference codes', () => {
    expect(generateReferenceCode()).toMatch(/^TICK-[A-Z2-9]{6}$/);
  });
  it('produces distinct codes at event scale (no collisions in 5000)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5000; i++) codes.add(generateReferenceCode());
    expect(codes.size).toBe(5000);
  });
  it('renders a PNG data url', async () => {
    const url = await generateQrDataUrl('abc');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });
  it('renders at 800px for a sharper/larger printed or projected code', async () => {
    const url = await generateQrDataUrl('abc');
    const png = Buffer.from(url.split(',')[1], 'base64');
    const width = png.readUInt32BE(16); // PNG IHDR: width is the first 4 bytes after the 16-byte header
    expect(width).toBe(800);
  });
});
