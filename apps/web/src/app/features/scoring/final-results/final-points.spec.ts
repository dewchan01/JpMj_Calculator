import { describe, expect, it } from 'vitest';
import {
  adjustFinalPoints,
  finalStandings,
} from '../../../../../../../packages/mahjong-core/final-results';
import {
  balances,
  undoLastEvent,
  type Match,
} from '../../../../../../../packages/mahjong-core/ledger';
import { presetRules } from '../../../../../../../packages/mahjong-rules/index';
import { matchStatistics } from './match-statistics';

function game(): Match {
  return {
    id: 'final',
    schemaVersion: 1,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    name: 'Final',
    playerCount: 3,
    rules: presetRules('mahjong-soul', 3),
    players: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
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
        id: 'hand',
        type: 'exhaustiveDraw',
        timestamp: '2026-01-01',
        payments: [{ from: 'a', to: 'b', amount: 3000, reason: 'draw' }],
      },
    ],
  };
}
describe('final point corrections', () => {
  it('preserves hands and totals, recalculates ranks, and adds an auditable correction', () => {
    const original = game();
    const corrected = adjustFinalPoints(
      original,
      { a: 50000, b: 30000, c: 25000 },
      'fix',
      '2026-01-02',
    );
    expect(balances(corrected).players).toEqual({ a: 50000, b: 30000, c: 25000 });
    expect(corrected.events[0]).toEqual(original.events[0]);
    expect(original.events).toHaveLength(1);
    expect(corrected.events.at(-1)?.type).toBe('scoreAdjustment');
    expect(undoLastEvent(corrected).ended).toBe(true);
    expect(balances(undoLastEvent(corrected)).players).toEqual(balances(original).players);
    expect(finalStandings(corrected)[0].id).toBe('a');
    const stats = matchStatistics(corrected);
    expect(stats.players[0].hands).toBe(1);
    expect(stats.points.at(-1)?.balances.a).toBe(50000);
  });
  it('rejects an ongoing match, noninteger points, unknown players and mismatched totals', () => {
    expect(() =>
      adjustFinalPoints({ ...game(), ended: false }, { a: 35000, b: 35000, c: 35000 }, 'x', 'now'),
    ).toThrow('completed');
    expect(() =>
      adjustFinalPoints(game(), { a: 35000.5, b: 34999.5, c: 35000 }, 'x', 'now'),
    ).toThrow('integer');
    expect(() => adjustFinalPoints(game(), { a: 35000, b: 35000, d: 35000 }, 'x', 'now')).toThrow(
      'integer',
    );
    expect(() => adjustFinalPoints(game(), { a: 35000, b: 35000, c: 35001 }, 'x', 'now')).toThrow(
      'total',
    );
  });
  it('does not append a correction when the points are unchanged', () => {
    const match = game();
    expect(adjustFinalPoints(match, balances(match).players, 'fix', '2026-01-02')).toBe(match);
  });
});
