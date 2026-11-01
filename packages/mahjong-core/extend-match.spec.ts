import { describe, expect, it } from 'vitest';
import { presetRules, tableRules } from '../mahjong-rules/index';
import { appendEvent, balances, settleRound, type Match } from './ledger';
import { canExtendToSouth, extendToSouth } from './extend-match';
import type { LedgerEvent } from './ledger';

function winningEvent(id: string): LedgerEvent {
  const payments = [{ from: 'p1', to: 'p0', amount: 1000, reason: 'Ron' }];
  return {
    id,
    timestamp: 'old',
    type: 'win',
    payments,
    winnerIds: ['p0'],
    result: {
      isValid: true,
      errors: [],
      yaku: [],
      bonusHan: [],
      han: 1,
      fu: 30,
      fuBreakdown: [],
      payments,
      playerDeltas: { p0: 1000, p1: -1000 },
      winnerReceives: 1000,
    },
  };
}

function game(count: 3 | 4 = 4): Match {
  const rules = presetRules('mahjong-soul', count);
  const players = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  return {
    id: 'extend',
    schemaVersion: 1,
    name: 'East',
    createdAt: '',
    updatedAt: '',
    playerCount: count,
    rules,
    players,
    initialBalances: Object.fromEntries(
      players.map((p, i) => [
        p.id,
        rules.startingPoints + (i === 0 ? 15000 : i === 1 ? -15000 : 0),
      ]),
    ),
    initialDealerId: 'p0',
    dealerId: `p${count - 1}`,
    roundWind: 'east',
    handNumber: count,
    honba: 2,
    gameLength: 'east',
    events: [],
  };
}

describe('extending a completed East game', () => {
  for (const count of [3, 4] as const) {
    it(`${count}P advances to South 1 and retains hand payments and history`, () => {
      const base = game(count);
      const finished = settleRound(base, winningEvent('last'), {
        isValid: true,
        errors: [],
        outcome: 'win',
        payments: winningEvent('last').payments,
        playerDeltas: {},
        winnerIds: ['p0'],
        dealerRepeats: false,
        results: [],
      });
      expect(finished.ended).toBe(true);
      const extended = extendToSouth(finished, 'new');
      expect(extended).toMatchObject({
        gameLength: 'south',
        roundWind: 'south',
        handNumber: 1,
        dealerId: 'p0',
        honba: 0,
        ended: false,
        updatedAt: 'new',
      });
      expect(balances(extended)).toEqual(balances(finished));
      expect(extended.events.map((e) => e.id)).toEqual(['last']);
      expect(extended.events[0].revisions?.[0].event.after?.ended).toBe(true);
      expect(finished.ended).toBe(true);
      expect(canExtendToSouth(extended)).toBe(false);
    });
  }
  it('reverses final escrow and Yakitori penalties without deleting the draw', () => {
    let base = game();
    base = {
      ...base,
      rules: { ...base.rules, table: { ...tableRules(base.rules), yakitoriPenalty: 100 } },
    };
    base = appendEvent(base, {
      id: 'riichi',
      type: 'riichiDeposit',
      timestamp: '',
      payments: [{ from: 'p1', to: 'table', amount: 1000, reason: 'Riichi deposit' }],
    });
    const before = balances(base);
    const finished = settleRound(
      base,
      {
        id: 'draw',
        timestamp: '',
        type: 'exhaustiveDraw',
        payments: [],
        drawInput: {
          rules: base.rules,
          players: base.players,
          dealerId: base.dealerId,
          honba: 2,
          type: 'exhaustive',
          circumstancesConfirmed: true,
          tenpaiIds: ['p0'],
          nagashiIds: [],
        },
      },
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
    expect(balances(finished).table).toBe(0);
    const extended = extendToSouth(finished);
    expect(balances(extended)).toEqual(before);
    expect(extended.honba).toBe(3);
    expect(extended.events.map((e) => e.id)).toEqual(['riichi', 'draw']);
  });
  it('keeps East last dealer repeats instead of forcing South 1', () => {
    const base = { ...game(), dealerId: 'p0' };
    const finished = settleRound(base, winningEvent('win'), {
      isValid: true,
      errors: [],
      outcome: 'win',
      payments: winningEvent('win').payments,
      playerDeltas: {},
      winnerIds: ['p0'],
      dealerRepeats: true,
      results: [],
    });
    expect(finished.endReason).toBe('Dealer finish in first place');
    expect(extendToSouth(finished)).toMatchObject({
      ended: false,
      roundWind: 'east',
      handNumber: 4,
      honba: 3,
    });
  });
  it('rejects bankruptcy, manual endings and archives without the final hand state', () => {
    expect(canExtendToSouth({ ...game(), ended: true })).toBe(false);
    expect(() => extendToSouth({ ...game(), ended: true })).toThrow();
  });
});
