import { describe, expect, it } from 'vitest';
import { gamesCsv, parseGamesCsv } from './data-csv';
import { presetRules } from '../../../../../../../packages/mahjong-rules/index';
import type { Match } from '../../../../../../../packages/mahjong-core/ledger';

function sample(): Match {
  return {
    id: 'csv-game',
    schemaVersion: 1,
    name: '=SUM(1,2)\n"Sunday"',
    createdAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-01T12:00:00Z',
    playerCount: 3,
    rules: presetRules('custom', 3),
    players: [
      { id: 'a', name: "'Alice" },
      { id: 'b', name: 'Bob' },
      { id: 'c', name: 'Carol' },
    ],
    initialBalances: { a: 35000, b: 35000, c: 35000 },
    initialDealerId: 'a',
    dealerId: 'a',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    events: [
      {
        id: 'draw',
        type: 'exhaustiveDraw',
        timestamp: '2026-10-01T13:00:00Z',
        payments: [{ from: 'b', to: 'a', amount: 3000, reason: 'Noten' }],
      },
    ],
    ended: true,
  };
}
describe('game CSV', () => {
  it('round trips rules, history, names, quotes, multiline text and formula-like text', () => {
    const match = sample();
    const csv = gamesCsv([match]);
    expect(csv).toContain("'=SUM");
    expect(parseGamesCsv(csv).matches).toEqual([match]);
  });
  it('rejects JSON files and malformed CSV instead of importing partial games', () => {
    expect(() => parseGamesCsv(JSON.stringify(sample()))).toThrow('Invalid CSV file.');
    expect(() => parseGamesCsv(gamesCsv([sample()]).replace('"array"', '"unknown"'))).toThrow();
    expect(() =>
      parseGamesCsv('game_id,game_name,created_at,path,type,value\n"unfinished'),
    ).toThrow();
  });
  it('rejects duplicate paths and unsafe object keys', () => {
    const csv = gamesCsv([sample()]);
    expect(() => parseGamesCsv(csv + '"csv-game","x","x","/__proto__","object",""\r\n')).toThrow();
    expect(() => parseGamesCsv(csv + '"csv-game","x","x","/id","string","changed"\r\n')).toThrow();
  });
});
