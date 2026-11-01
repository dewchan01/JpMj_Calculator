import { describe, expect, it } from 'vitest';
import { presetRules, tableRules, validateProfile } from './index';
import { finalStandings } from '../mahjong-core/final-results';
import { settleRound, type Match } from '../mahjong-core/ledger';

describe('Mahjong Soul defaults', () => {
  for (const count of [3, 4] as const) {
    it(`${count}P separates settlement scores from the end threshold`, () => {
      const rules = presetRules('mahjong-soul', count);
      const table = tableRules(rules);
      expect(validateProfile(rules)).toEqual([]);
      expect(table.uma).toEqual(count === 3 ? [15, 0, -15] : [15, 5, -5, -15]);
      expect(table.returnPoints).toBe(rules.startingPoints);
      expect(table.endPoints).toBe(count === 3 ? 40000 : 30000);
      expect(table.notenPool).toBe(count === 3 ? 2000 : 3000);
      expect(table.honbaRon).toBe(count === 3 ? 200 : 300);
      const players = Array.from({ length: count }, (_, i) => ({ id: String(i), name: String(i) }));
      const match: Match = {
        id: 'test',
        schemaVersion: 1,
        name: 'test',
        createdAt: '',
        updatedAt: '',
        playerCount: count,
        rules,
        players,
        initialBalances: Object.fromEntries(players.map((p) => [p.id, rules.startingPoints])),
        initialDealerId: '0',
        dealerId: String(count - 1),
        roundWind: 'east',
        handNumber: count,
        honba: 0,
        gameLength: 'east',
        events: [],
      };
      expect(finalStandings(match).map((row) => row.oka)).toEqual(Array(count).fill(0));
      expect(finalStandings(match).map((row) => row.finalScore)).toEqual(table.uma);
      const settled = settleRound(
        match,
        { id: 'draw', timestamp: '', type: 'exhaustiveDraw', payments: [] },
        {
          isValid: true,
          errors: [],
          outcome: 'exhaustiveDraw',
          payments: [],
          playerDeltas: {},
          winnerIds: [],
          dealerRepeats: false,
          results: [],
        },
      );
      expect(settled.ended).not.toBe(true);
      expect(settled.roundWind).toBe('south');
    });
  }
  it('preserves legacy snapshots and explicit custom values', () => {
    const legacy = { ...presetRules('mahjong-soul', 3), version: 2 };
    expect(tableRules(legacy).uma).toEqual([0, 0, 0]);
    expect(tableRules(legacy).returnPoints).toBe(40000);
    const profile = presetRules('mahjong-soul', 3);
    expect(
      tableRules({ ...profile, table: { ...tableRules(profile), uma: [20, 0, -20] } }).uma,
    ).toEqual([20, 0, -20]);
  });
});
