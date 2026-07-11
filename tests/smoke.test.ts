import { describe, it, expect } from 'vitest';
import { env } from '@/lib/env';

describe('smoke', () => {
  it('loads validated env', () => {
    expect(typeof env.DATABASE_URL).toBe('string');
    expect(typeof env.SESSION_SECRET).toBe('string');
  });
});
