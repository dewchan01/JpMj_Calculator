import { describe, expect, it } from 'vitest';
import { parseShareHistory } from './share-history-data';

describe('share history', () => {
  const now = Date.parse('2026-10-28T12:00:00Z');
  const entry = {
    id: 'a'.repeat(64),
    deletionSecret: 'b'.repeat(64),
    title: 'Sunday',
    gameCount: 4,
    createdAt: '2026-10-28T12:00:00Z',
    expiresAt: '2026-10-29T12:00:00Z',
  };
  it('retains valid entries until their server expiry and removes them at 24 hours', () => {
    expect(parseShareHistory(JSON.stringify([entry]), now)).toEqual([entry]);
    expect(parseShareHistory(JSON.stringify([entry]), now + 86400000)).toEqual([]);
  });
  it('rejects malformed entries and invalid credentials', () => {
    expect(parseShareHistory('broken', now)).toEqual([]);
    expect(
      parseShareHistory(
        JSON.stringify([
          null,
          {},
          { ...entry, id: 'short' },
          { ...entry, expiresAt: 'invalid' },
          { ...entry, deletionSecret: '' },
        ]),
        now,
      ),
    ).toEqual([]);
  });
});
