import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, createSession, verifySession } from '@/services/auth';

describe('auth', () => {
  it('hashes and verifies a password', async () => {
    const h = await hashPassword('secret123');
    expect(await verifyPassword('secret123', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });
  it('round-trips a session token', async () => {
    const token = await createSession({ userId: 'u1', role: 'admin' });
    const decoded = await verifySession(token);
    expect(decoded).toEqual({ userId: 'u1', role: 'admin' });
  });
  it('rejects a tampered token', async () => {
    expect(await verifySession('not.a.jwt')).toBeNull();
  });
});
