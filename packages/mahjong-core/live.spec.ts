import { describe, expect, it } from 'vitest';
import {
  clockAt,
  elapsedMs,
  declareRiichi,
  cancelRiichi,
  emptyLive,
  validateRevealed,
  initialLive,
  rememberLiveAction,
  undoLiveAction,
} from './live';
import { balances, finishMatch, undoLastEvent, type Match } from './ledger';
import { presetRules, tableRules } from '../mahjong-rules/index';
import { parseTiles } from './index';
function game(): Match {
  const base = presetRules('custom', 4);
  return {
    id: 'game',
    schemaVersion: 1,
    name: 'game',
    createdAt: '2026-10-25T10:00:00Z',
    updatedAt: '2026-10-25T10:00:00Z',
    playerCount: 4,
    rules: { ...base, table: { ...tableRules(base), yakitoriPenalty: 1000 } },
    players: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
    ],
    initialBalances: { a: 25000, b: 25000, c: 25000, d: 25000 },
    initialDealerId: 'a',
    dealerId: 'a',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    events: [],
    live: emptyLive(),
  };
}
describe('live match recording', () => {
  it('cancels only the selected current-hand declaration, preserving later actions and other deposits', () => {
    const a = declareRiichi(game(), 'a', true, 'a-riichi');
    const b = declareRiichi(a, 'b', false, 'b-riichi');
    b.live!.players.c = { melds: [], kita: parseTiles('4z'), riichi: 'none' };
    b.live!.calls = 1;
    const cancelled = cancelRiichi(b, 'a');
    expect(balances(cancelled).players.a).toBe(25000);
    expect(balances(cancelled).players.b).toBe(24000);
    expect(balances(cancelled).table).toBe(1000);
    expect(cancelled.live!.players.a.riichi).toBe('none');
    expect(cancelled.live!.players.b.riichi).toBe('riichi');
    expect(cancelled.live!.players.c).toEqual(b.live!.players.c);
    expect(cancelled.live!.calls).toBe(1);
    expect(undoLiveAction(cancelled).events).toEqual(b.events);
    expect(undoLiveAction(cancelled).live).toEqual(b.live);
    expect(() => cancelRiichi(cancelled, 'a')).toThrow();
    expect(declareRiichi(cancelled, 'a', false, 'a-again').live!.players.a.riichi).toBe('riichi');
    expect(() => cancelRiichi(finishMatch(b, 'end'), 'a')).toThrow();
  });
  it('undoes a declaration and subsequent edits in order, keeping the clock and restoring escrow', () => {
    const before = game();
    const declared = rememberLiveAction(before, declareRiichi(before, 'a', false, 'riichi'));
    const changed = rememberLiveAction(declared, {
      ...declared,
      live: { ...declared.live!, dora: '1z' },
    });
    const restored = undoLiveAction(JSON.parse(JSON.stringify(changed)) as Match);
    expect(restored.live).toEqual(declared.live);
    expect(balances(restored).table).toBe(1000);
    const undone = undoLiveAction(restored);
    expect(balances(undone)).toEqual(balances(before));
    expect(undone.live).toEqual(before.live);
    expect(undone.clock).toEqual(before.clock);
    expect(() => undoLiveAction(undone)).toThrow('No action to undo.');
    const settled = finishMatch(declared, 'end');
    expect(() => undoLiveAction(settled)).toThrow('No action to undo.');
  });
  it('restores current-hand declarations in old matches without recreating prior-hand Riichi', () => {
    const m = game();
    delete m.live;
    m.events = [
      {
        id: 'old',
        type: 'riichiDeposit',
        timestamp: m.createdAt,
        payments: [{ from: 'a', to: 'table', amount: 1000, reason: 'Riichi' }],
      },
      { id: 'draw', type: 'exhaustiveDraw', timestamp: m.createdAt, payments: [] },
      {
        id: 'current',
        type: 'riichiDeposit',
        timestamp: m.createdAt,
        payments: [{ from: 'b', to: 'table', amount: 1000, reason: 'Riichi' }],
      },
    ];
    expect(initialLive(m).players['a']).toBeUndefined();
    expect(initialLive(m).players['b'].riichi).toBe('riichi');
    expect(m.live).toBeUndefined();
  });
  it('keeps running time across reloads and excludes paused time', () => {
    const start = Date.parse('2026-10-25T10:00:00Z');
    const clock = { elapsedMs: 0, runningSince: new Date(start).toISOString(), handStartMs: 0 };
    const paused = clockAt(clock, false, start + 60000);
    expect(elapsedMs(JSON.parse(JSON.stringify(paused)), start + 600000)).toBe(60000);
    const resumed = clockAt(paused, true, start + 600000);
    expect(elapsedMs(resumed, start + 630000)).toBe(90000);
    expect(elapsedMs(clock, start - 1000)).toBe(0);
  });
  it('records Riichi once, takes escrow and stores a reversible live snapshot', () => {
    const m = game();
    const updated = declareRiichi(m, 'a', false, 'deposit');
    expect(balances(updated)).toEqual({
      players: { a: 24000, b: 25000, c: 25000, d: 25000 },
      table: 1000,
    });
    expect(updated.live?.players['a'].riichi).toBe('riichi');
    expect(() => declareRiichi(updated, 'a', false, 'twice')).toThrow('already deposited');
    expect(m.live?.players).toEqual({});
    expect(balances(undoLastEvent(updated)).players['a']).toBe(25000);
  });
  it('rejects open-hand Riichi, interrupted double Riichi and unfunded deposits', () => {
    const m = game();
    m.live = {
      ...emptyLive(),
      calls: 1,
      players: {
        a: {
          melds: [{ id: 'pon', type: 'pon', tiles: parseTiles('111z') }],
          kita: [],
          riichi: 'none',
        },
      },
    };
    expect(() => declareRiichi(m, 'a', false, 'e')).toThrow('closed hand');
    expect(() => declareRiichi(m, 'b', true, 'e')).toThrow('uninterrupted');
    const late = declareRiichi(m, 'b', true, 'late', undefined, {
      doubleBeforeRecordedCalls: true,
    });
    expect(late.live?.players.b.riichi).toBe('double');
    expect(late.live?.players.b.riichiCalls).toBe(0);
    expect(late.live?.calls).toBe(1);
    expect(() =>
      declareRiichi(m, 'a', true, 'late', undefined, { doubleBeforeRecordedCalls: true }),
    ).toThrow('closed hand');
    m.initialBalances['b'] = 500;
    expect(() => declareRiichi(m, 'b', false, 'e')).toThrow('Not enough');
  });
  it('manual ending applies final Yakitori and escrow exactly once and can be undone', () => {
    let m = game();
    m.events = [
      {
        id: 'winner',
        type: 'exhaustiveDraw',
        timestamp: m.createdAt,
        payments: [],
        winnerIds: ['a'],
      },
    ];
    m = declareRiichi(m, 'b', false, 'deposit');
    const ended = finishMatch(m, 'end');
    expect(ended.ended).toBe(true);
    expect(balances(ended)).toEqual({
      players: { a: 29000, b: 23000, c: 24000, d: 24000 },
      table: 0,
    });
    expect(() => finishMatch(ended, 'duplicate')).toThrow('already ended');
    expect(balances(undoLastEvent(ended))).toEqual(balances(m));
    expect(undoLastEvent(ended).ended).toBe(false);
  });
  it('includes every revealed player meld and both indicator sets in physical copy checks', () => {
    const m = game(),
      live = emptyLive();
    live.players['a'] = {
      melds: [{ id: 'pon', type: 'pon', tiles: parseTiles('111z') }],
      kita: [],
      riichi: 'none',
    };
    live.dora = '1z';
    live.ura = '1z';
    expect(() => validateRevealed(m, live)).toThrow('four physical');
  });
});
