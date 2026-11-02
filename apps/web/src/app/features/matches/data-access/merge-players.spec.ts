import { describe, expect, it } from 'vitest';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';
import { mergePlayerRecords } from './merge-players';

const fixture = () =>
  ({
    id: 'game',
    updatedAt: 'old',
    players: [
      { id: 'p0', profileId: 'old', name: 'Old' },
      { id: 'p1', profileId: 'other', name: 'Other' },
    ],
    events: [
      {
        payments: [{ from: 'p1', to: 'p0', amount: 1000 }],
        scoringInput: {
          players: [{ id: 'p0', profileId: 'old', name: 'Old' }],
        },
      },
    ],
  }) as unknown as Match;
describe('mergePlayerRecords', () => {
  it('rewrites identity and snapshots without changing payments or original records', () => {
    const original = fixture();
    const [merged] = mergePlayerRecords([original], 'old', { id: 'retained', name: 'Kept' });
    expect(merged.players[0]).toEqual({ id: 'p0', profileId: 'retained', name: 'Kept' });
    expect(merged.events[0].scoringInput?.players[0].name).toBe('Kept');
    expect(merged.events[0].payments).toEqual(original.events[0].payments);
    expect(original.players[0].profileId).toBe('old');
  });
  it('rejects co-seated players and leaves original untouched', () => {
    const original = fixture();
    expect(() => mergePlayerRecords([original], 'old', { id: 'other', name: 'Other' })).toThrow(
      'same game',
    );
    expect(original.updatedAt).toBe('old');
  });
  it('supports match-local legacy identities and excludes unrelated games', () => {
    const match = fixture();
    delete match.players[0].profileId;
    expect(mergePlayerRecords([match], 'old', { id: 'kept', name: 'Kept' })).toEqual([]);
    expect(
      mergePlayerRecords([match], 'legacy:["game","p0"]', { id: 'kept', name: 'Kept' }),
    ).toHaveLength(1);
  });
});
