import { describe, expect, it } from 'vitest';
import type { Match } from '../../../../../../packages/mahjong-core/ledger';
import { presetRules, tableRules } from '../../../../../../packages/mahjong-rules/index';
import { durationMinutes, filterMatches, playerRecords } from './record-stats';

export function sample(id = 'first', currency = 'USD'): Match {
  const base = presetRules('custom', 3);
  const rules = { ...base, table: { ...tableRules(base), bettingRate: 2, currency: 'USD' } };
  rules.table.currency = currency;
  return {
    id,
    schemaVersion: 1,
    name: id,
    createdAt: '2026-10-01T12:00:00',
    updatedAt: '2026-10-10T12:00:00',
    rules,
    playerCount: 3,
    players: [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
      { id: 'c', name: 'Carol' },
    ],
    initialBalances: { a: 35000, b: 35000, c: 35000 },
    initialDealerId: 'a',
    dealerId: 'a',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    gameLength: 'east',
    ended: true,
    events: [
      {
        id: 'event',
        timestamp: '2026-10-01T13:30:00',
        type: 'exhaustiveDraw',
        payments: [{ from: 'b', to: 'a', amount: 6000, reason: 'test' }],
      },
    ],
  };
}
describe('record statistics', () => {
  it('filters inclusive local creation dates, mode and participant together', () => {
    const game = sample();
    const filter = { from: '2026-10-01', to: '2026-10-01', mode: '3-east', participant: 'Alice' };
    expect(filterMatches([game], filter)).toEqual([game]);
    expect(filterMatches([game], { ...filter, from: '2026-10-02' })).toEqual([]);
    expect(filterMatches([game], { ...filter, mode: '4-east' })).toEqual([]);
    expect(filterMatches([game], { ...filter, participant: 'Al' })).toEqual([]);
  });
  it('uses the last event rather than a later edit for duration', () => {
    expect(durationMinutes(sample())).toBe(90);
    expect(durationMinutes({ ...sample(), events: [] })).toBe(0);
  });
  it('excludes unfinished tables, combines names across games and separates currencies', () => {
    const second = sample('second', 'JPY');
    second.players[0].id = 'different-local-id';
    second.initialBalances = { 'different-local-id': 35000, b: 35000, c: 35000 };
    second.initialDealerId = 'different-local-id';
    second.events[0].payments[0].to = 'different-local-id';
    const rows = playerRecords([sample(), second, { ...sample('ongoing'), ended: false }]);
    const alice = rows.find((p) => p.name === 'Alice')!;
    expect(alice.games).toBe(2);
    expect(alice.averageRank).toBe(1);
    expect(alice.points).toBe(12000);
    expect(Object.keys(alice.money).sort()).toEqual(['JPY', 'USD']);
    expect(rows.reduce((sum, p) => sum + p.points, 0)).toBe(0);
    expect(rows.reduce((sum, p) => sum + p.score, 0)).toBe(0);
    expect(rows.reduce((sum, p) => sum + p.money['USD'], 0)).toBe(0);
  });
});
