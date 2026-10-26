import { describe, expect, it } from 'vitest';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';
import { presetRules } from '../../../../../../../packages/mahjong-rules/index';
import { gameArchive, parseArchive } from './data-archive';

function sample(): Match {
  return {
    id: 'game',
    schemaVersion: 1,
    name: 'Game',
    createdAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-01T12:00:00Z',
    playerCount: 3,
    rules: { ...presetRules('custom', 3) },
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
    ended: true,
    events: [
      {
        id: 'event',
        type: 'exhaustiveDraw',
        timestamp: '2026-10-01T13:00:00Z',
        payments: [{ from: 'b', to: 'a', amount: 3000, reason: 'Noten' }],
      },
    ],
  };
}

describe('game archives', () => {
  it('round trips complete rules, players and ledger history', () => {
    const match = sample();
    expect(parseArchive(JSON.stringify(gameArchive([match]))).matches).toEqual([match]);
  });
  it('rejects malformed files, unsupported versions and duplicate game IDs', () => {
    for (const data of [
      '{',
      '{}',
      JSON.stringify({ ...gameArchive([]), version: 2 }),
      JSON.stringify(gameArchive([sample(), sample()])),
    ]) {
      expect(() => parseArchive(data)).toThrow('Invalid game archive.');
    }
  });
  it('rejects invalid rule snapshots, payments and missing player balances', () => {
    const badRules = sample();
    Object.assign(badRules.rules, { startingPoints: -1 });
    const badPayment = sample();
    badPayment.events[0].payments[0].from = 'missing';
    const missingBalance = sample();
    delete missingBalance.initialBalances.a;
    for (const game of [badRules, badPayment, missingBalance])
      expect(() => parseArchive(JSON.stringify(gameArchive([game])))).toThrow();
  });
});
