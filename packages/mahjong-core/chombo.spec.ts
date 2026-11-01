import { describe, expect, it } from 'vitest';
import { recordChombo, type ChomboInput } from './chombo';
import { appendEvent, balances, undoLastEvent, type Match } from './ledger';
import { presetRules } from '../mahjong-rules/index';

function game(count: 3 | 4 = 4): Match {
  const rules = presetRules('mahjong-soul', count);
  const players = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  return {
    id: 'chombo',
    schemaVersion: 1,
    name: 'test',
    createdAt: '',
    updatedAt: '',
    playerCount: count,
    rules,
    players,
    initialBalances: Object.fromEntries(players.map((p) => [p.id, rules.startingPoints])),
    initialDealerId: 'p0',
    dealerId: 'p0',
    roundWind: 'east',
    handNumber: 1,
    honba: 2,
    gameLength: 'east',
    events: [],
    live: { players: {}, dora: '1z', ura: '', calls: 0 },
  };
}
const input = (patch: Partial<ChomboInput> = {}): ChomboInput => ({
  payerId: 'p1',
  recipientIds: ['p0', 'p2', 'p3'],
  payment: 'mangan',
  amount: 1000,
  progression: 'continue',
  tenpaiIds: [],
  ...patch,
});
describe('Chombo settlement', () => {
  it('reverses non-dealer Mangan Tsumo without Honba and preserves the live hand', () => {
    const m = game();
    const result = recordChombo(m, input(), 'c', 'now');
    expect(result.events[0].payments.map((p) => [p.from, p.to, p.amount])).toEqual([
      ['p1', 'p0', 4000],
      ['p1', 'p2', 2000],
      ['p1', 'p3', 2000],
    ]);
    expect(result.live).toEqual(m.live);
    expect(result.handNumber).toBe(1);
    expect(result.honba).toBe(2);
    expect(balances(undoLastEvent(result))).toEqual(balances(m));
  });
  it('supports dealer Baiman, selected recipients and three players', () => {
    const m = game(3);
    const result = recordChombo(
      m,
      input({ payerId: 'p0', recipientIds: ['p2'], payment: 'baiman' }),
      'c',
      'now',
    );
    expect(result.events[0].payments).toEqual([
      { from: 'p0', to: 'p2', amount: 8000, reason: 'Chombo penalty' },
    ]);
  });
  it('replays the hand and refunds only current-hand Riichi', () => {
    let m = game();
    m = appendEvent(m, {
      id: 'r',
      type: 'riichiDeposit',
      timestamp: '',
      payments: [{ from: 'p2', to: 'table', amount: 1000, reason: 'Riichi deposit' }],
    });
    const result = recordChombo(
      m,
      input({ payment: 'other', amount: 500, progression: 'repeat' }),
      'c',
      'now',
    );
    expect(balances(result).table).toBe(0);
    expect(result.live?.dora).toBe('');
    expect(result.honba).toBe(2);
    expect(result.dealerId).toBe('p0');
    expect(balances(undoLastEvent(result))).toEqual(balances(m));
  });
  it('draw processing applies Noten transfers and advances the dealer', () => {
    const result = recordChombo(
      game(),
      input({ payment: 'other', amount: 100, progression: 'draw', tenpaiIds: ['p2'] }),
      'c',
      'now',
    );
    expect(result.handNumber).toBe(2);
    expect(result.honba).toBe(3);
    expect(result.dealerId).toBe('p1');
    expect(
      result.events[0].payments.filter((p) => p.reason === 'Tenpai / Noten transfer'),
    ).toHaveLength(3);
  });
  it('rejects self-payments, invalid amounts and duplicate recipients', () => {
    for (const patch of [
      { recipientIds: ['p1'] },
      { recipientIds: ['p0', 'p0'] },
      { amount: 101 },
      { recipientIds: [] },
    ])
      expect(() => recordChombo(game(), input(patch), 'c', 'now')).toThrow();
  });
});
