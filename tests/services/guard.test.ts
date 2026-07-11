import { describe, it, expect } from 'vitest';
import { matchesRole } from '@/lib/guard';

describe('matchesRole', () => {
  it('accepts exact role', () => expect(matchesRole({ userId: 'u', role: 'admin' }, 'admin')).toBe(true));
  it('rejects wrong role', () => expect(matchesRole({ userId: 'u', role: 'staff' }, 'admin')).toBe(false));
  it('rejects null user', () => expect(matchesRole(null, 'admin')).toBe(false));
});
