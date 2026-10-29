import { describe, expect, it } from 'vitest';
import { fixture } from '../../../../../../../packages/mahjong-fixtures';
import { score } from '../../../../../../../packages/mahjong-scoring';
import type { LedgerEvent } from '../../../../../../../packages/mahjong-core/ledger';
import { historyResults } from './history-results';
import { ruleSettings } from '../../../../../../../packages/mahjong-rules';

describe('history results', () => {
  const input = fixture();
  const result = score(input);
  const event: LedgerEvent = {
    id: 'win',
    timestamp: '2026-10-29',
    type: 'win',
    payments: [],
    scoringInput: input,
    result,
    win: input.win,
    hand: input.hand,
  };
  it('renders mirrored legacy and multi-winner fields once', () => {
    const entries = historyResults(
      { ...event, scoringInputs: [input], results: [result] },
      input.rules,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].winnerId).toBe(input.win.winnerId);
    expect(entries[0].hand).toBe(input.hand);
    expect(historyResults({ ...event, results: [] }, input.rules)).toHaveLength(1);
  });
  it.each([
    [5, 'Mangan'],
    [6, 'Haneman'],
    [8, 'Baiman'],
    [11, 'Sanbaiman'],
    [13, 'Counted Yakuman'],
  ] as const)('labels a legacy %i Han result without rewriting it', (han, expected) => {
    const legacy = { ...result, isValid: true, han, fu: 30, limitName: undefined, yaku: [] };
    expect(historyResults({ ...event, result: legacy }, input.rules)[0].limitName).toBe(expected);
    expect(legacy.limitName).toBeUndefined();
  });
  it('keeps independent winners and their saved limits', () => {
    const entries = historyResults(
      {
        ...event,
        scoringInput: undefined,
        win: undefined,
        winnerIds: ['a', 'b'],
        results: [
          { ...result, limitName: 'Mangan' },
          { ...result, limitName: 'Baiman' },
        ],
      },
      input.rules,
    );
    expect(entries.map(({ winnerId, limitName }) => ({ winnerId, limitName }))).toEqual([
      { winnerId: 'a', limitName: 'Mangan' },
      { winnerId: 'b', limitName: 'Baiman' },
    ]);
  });
  it('respects recorded Kiriage and counted-Yakuman caps for missing limits', () => {
    const legacy = { ...result, isValid: true, han: 4, fu: 30, limitName: undefined, yaku: [] };
    const record = { ...event, scoringInput: undefined, result: legacy };
    expect(historyResults(record, { ...input.rules, kiriage: false })[0].limitName).toBeUndefined();
    expect(historyResults(record, { ...input.rules, kiriage: true })[0].limitName).toBe('Mangan');
    expect(
      historyResults(
        { ...record, result: { ...legacy, han: 13 } },
        {
          ...input.rules,
          settings: { ...ruleSettings(input.rules), kazoe: 'sanbaiman' },
        },
      )[0].limitName,
    ).toBe('Sanbaiman');
  });
});
