import { describe, expect, it } from 'vitest';
import { appendEvent, balances, finishMatch, settleRound, type Match } from './ledger';
import { restartLastHand, canRestartLastHand } from './restart-hand';
import { presetRules } from '../mahjong-rules/index';

function game(): Match {
  return {
    id: 'replay',
    schemaVersion: 1,
    name: 'test',
    createdAt: '',
    updatedAt: '',
    playerCount: 3,
    rules: presetRules('mahjong-soul', 3),
    players: ['a', 'b', 'c'].map((id) => ({ id, name: id })),
    initialBalances: { a: 35000, b: 35000, c: 35000 },
    initialDealerId: 'a',
    dealerId: 'a',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    gameLength: 'east',
    events: [],
    clock: { elapsedMs: 120000, handStartMs: 0, runningSince: null },
  };
}
describe('replay last hand', () => {
  it('retains earlier hands and carried sticks, removes last-hand deposits and terminal awards', () => {
    let m = game();
    m = appendEvent(m, {
      id: 'old-riichi',
      type: 'riichiDeposit',
      timestamp: '',
      payments: [{ from: 'a', to: 'table', amount: 1000, reason: 'Riichi deposit' }],
    });
    m = settleRound(
      m,
      { id: 'first', type: 'exhaustiveDraw', timestamp: '', durationMs: 60000, payments: [] },
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
    const start = structuredClone(m);
    m = appendEvent(m, {
      id: 'new-riichi',
      type: 'riichiDeposit',
      timestamp: '',
      payments: [{ from: 'b', to: 'table', amount: 1000, reason: 'Riichi deposit' }],
    });
    m = settleRound(
      m,
      { id: 'second', type: 'exhaustiveDraw', timestamp: '', durationMs: 60000, payments: [] },
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
    m = finishMatch(m, 'end');
    const result = restartLastHand(m, '2026-11-02T00:00:00.000Z');
    expect(result.events.map((e) => e.id)).toEqual(['old-riichi', 'first']);
    expect(balances(result)).toEqual(balances(start));
    expect(result).toMatchObject({
      ended: false,
      dealerId: 'b',
      roundWind: 'east',
      handNumber: 2,
      honba: 1,
    });
    expect(result.clock?.elapsedMs).toBe(60000);
    expect(result.live?.players).toEqual({});
    expect(m.ended).toBe(true);
  });
  it('does not restart unfinished games or result-only archives', () => {
    expect(canRestartLastHand(game())).toBe(false);
    expect(() => restartLastHand({ ...game(), ended: true })).toThrow();
  });
});
