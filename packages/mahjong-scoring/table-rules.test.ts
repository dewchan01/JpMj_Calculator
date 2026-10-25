import { describe, expect, it } from 'vitest';
import { presetRules, tableRules, validateProfile, type TableRules } from '../mahjong-rules/index';
import { fixture } from '../mahjong-fixtures/index';
import { parseTiles } from '../mahjong-core/index';
import {
  balances,
  settleRound,
  undoLastEvent,
  type Match,
  type LedgerEvent,
} from '../mahjong-core/ledger';
import { finalStandings } from '../mahjong-core/final-results';
import { paymentsFor } from './payments';
import { drawSettlement, multipleRon, type RoundSettlement } from './rounds';
import { score } from './index';
import { handChips } from './chips';

function rules(count: 3 | 4 = 4, patch: Partial<TableRules> = {}) {
  const profile = presetRules('custom', count);
  return { ...profile, table: { ...tableRules(profile), ...patch } };
}
function match(patch: Partial<TableRules> = {}): Match {
  return {
    id: 'm',
    schemaVersion: 1,
    name: 'test',
    createdAt: '',
    updatedAt: '',
    playerCount: 4,
    rules: rules(4, patch),
    players: fixture().players,
    initialBalances: { a: 25000, b: 25000, c: 25000, d: 25000 },
    initialDealerId: 'a',
    dealerId: 'd',
    events: [],
    roundWind: 'south',
    handNumber: 4,
    honba: 0,
    gameLength: 'south',
  };
}
const event = (): LedgerEvent => ({
  id: 'e',
  timestamp: 'now',
  type: 'exhaustiveDraw',
  payments: [],
});
const outcome = (patch: Partial<RoundSettlement> = {}): RoundSettlement => ({
  isValid: true,
  errors: [],
  outcome: 'exhaustiveDraw',
  payments: [],
  playerDeltas: {},
  winnerIds: [],
  dealerRepeats: false,
  results: [],
  ...patch,
});

describe('configurable payments', () => {
  it('splits one funded Riichi stick once across three effective winners', () => {
    const inputs = ['123456789m123p44z', '123456789p123s44z', '123456789s123m44z'].map(
      (text, index) => {
        const input = fixture(text);
        input.rules = rules(4, { riichiReceiver: 'split' });
        const id = ['a', 'b', 'c'][index];
        input.hand.concealedTiles = parseTiles(text, 'hand-' + id);
        input.hand.playerId = id;
        input.win.winnerId = id;
        input.win.discarderId = 'd';
        input.win.winningTileId = input.hand.concealedTiles.at(-1)!.id;
        input.win.riichi = true;
        input.riichiSticks = 1;
        return input;
      },
    );
    const result = multipleRon(inputs);
    expect(result.errors).toEqual([]);
    expect(
      result.payments
        .filter((payment) => payment.from === 'table')
        .map((payment) => [payment.to, payment.amount]),
    ).toEqual([
      ['a', 400],
      ['b', 300],
      ['c', 300],
    ]);
  });
  it.each([
    ['loss', [4000, 2000]],
    ['no-loss', [5000, 3000]],
    ['equal', [4000, 4000]],
    ['equal-dealer', [4000, 4000]],
  ] as const)('3P %s uses the advertised Mangan shares', (mode, expected) => {
    const input = fixture(undefined, 3);
    input.rules = rules(3, { tsumoMode: mode });
    input.win.method = 'tsumo';
    input.win.discarderId = undefined;
    expect(paymentsFor(2000, input).map((payment) => payment.amount)).toEqual(expected);
    input.dealerId = input.win.winnerId;
    expect(paymentsFor(2000, input).map((payment) => payment.amount)).toEqual(
      mode === 'loss' || mode === 'equal' ? [4000, 4000] : [6000, 6000],
    );
  });
  it('applies Honba then Wareme then 1,000 rounding, without multiplying escrow', () => {
    const input = fixture();
    input.rules = rules(4, { honbaRon: 500, paymentUnit: 1000, waremeMultiplier: 2 });
    input.honba = 1;
    input.riichiSticks = 1;
    input.waremePlayerId = input.win.discarderId;
    expect(paymentsFor(240, input).map((payment) => payment.amount)).toEqual([3000, 1000]);
    input.waremePlayerId = 'd';
    expect(paymentsFor(240, input).map((payment) => payment.amount)).toEqual([2000, 1000]);
  });
  it('rejects missing Wareme declaration and invalid amounts', () => {
    const input = fixture();
    input.rules = rules(4, { waremeMultiplier: 2 });
    expect(score(input).errors).toContain('Select the Wareme player for this hand.');
    expect(validateProfile(rules(4, { uma: [20, 10, 0, -20] }))).not.toEqual([]);
    expect(validateProfile(rules(4, { notenPool: 1000 }))).not.toEqual([]);
    expect(validateProfile(rules(3, { notenPool: 4000 }))).toEqual([]);
  });
  it('uses the configured Noten pool and conserves points', () => {
    const input = fixture();
    const result = drawSettlement({
      rules: rules(4, { notenPool: 6000 }),
      players: input.players,
      dealerId: 'a',
      honba: 0,
      type: 'exhaustive',
      tenpaiIds: ['a'],
      nagashiIds: [],
      circumstancesConfirmed: true,
    });
    expect(result.playerDeltas).toEqual({ a: 6000, b: -2000, c: -2000, d: -2000 });
  });
});

describe('game progress and final results', () => {
  it('disables extension without requiring a target score and preserves defaults', () => {
    expect(settleRound(match(), event(), outcome()).ended).toBeFalsy();
    expect(settleRound(match({ extension: 'none' }), event(), outcome()).ended).toBe(true);
  });
  it.each(['negative', 'nonpositive', 'off'] as const)(
    'uses %s bankruptcy ending',
    (bankruptcy) => {
      const m = {
        ...match({ bankruptcy }),
        roundWind: 'east' as const,
        handNumber: 1,
        initialBalances: { a: 1000, b: 33000, c: 33000, d: 33000 },
      };
      const updated = settleRound(
        m,
        event(),
        outcome({ payments: [{ from: 'a', to: 'b', amount: 1000, reason: 'test' }] }),
      );
      expect(updated.ended).toBe(bankruptcy === 'nonpositive');
    },
  );
  it('can pass the dealer after a dealer win', () => {
    const m = { ...match({ dealerPassAfterWin: true }), roundWind: 'east' as const, handNumber: 1 };
    const updated = settleRound(
      m,
      event(),
      outcome({ outcome: 'win', dealerRepeats: true, winnerIds: ['d'] }),
    );
    expect(updated.dealerId).toBe('a');
    expect(updated.handNumber).toBe(2);
    expect(updated.honba).toBe(0);
  });
  it('settles Yakitori once and undo restores its points and game state', () => {
    const m = match({ extension: 'none', yakitoriPenalty: 1000 });
    m.events = [{ ...event(), id: 'earlier', winnerIds: ['a', 'b', 'c'] }];
    const updated = settleRound(m, event(), outcome());
    expect(balances(updated).players).toEqual({ a: 26000, b: 26000, c: 26000, d: 22000 });
    expect(balances(undoLastEvent(updated)).players).toEqual(m.initialBalances);
    expect(undoLastEvent(updated).ended).toBe(false);
  });
  it('shares tied Uma and Oka, preserves zero-sum money and uses net chips', () => {
    const m = match({ tiedRanks: 'share', uma: [20, 10, -10, -20], bettingRate: 2, chipValue: 5 });
    m.initialBalances = { a: 35000, b: 35000, c: 20000, d: 10000 };
    m.events = [{ ...event(), chipDeltas: { a: 2, b: -1, c: -1, d: 0 } }];
    const rows = finalStandings(m);
    expect(rows.map((row) => row.rank)).toEqual([1, 1, 3, 4]);
    expect(rows[0]).toMatchObject({ uma: 15, oka: 10, finalScore: 30, chips: 2, totalMoney: 70 });
    expect(rows[1]).toMatchObject({ uma: 15, oka: 10, finalScore: 30, chips: -1, totalMoney: 55 });
    expect(rows.reduce((sum, row) => sum + row.totalMoney, 0)).toBe(0);
  });
  it.each(['nearest', 'floor', 'ceil'] as const)(
    'keeps %s-rounded final scores and money balanced',
    (rounding) => {
      const m = match({ rounding, bettingRate: 1.23 });
      m.initialBalances = { a: 30100, b: 29900, c: 20100, d: 19900 };
      const rows = finalStandings(m);
      expect(rows.reduce((sum, row) => sum + row.finalScore, 0)).toBe(0);
      expect(Math.abs(rows.reduce((sum, row) => sum + row.totalMoney, 0))).toBeLessThan(0.00001);
    },
  );
  it('calculates 3P standings with exactly three Uma values', () => {
    const m: Match = {
      ...match(),
      playerCount: 3,
      rules: rules(3, { uma: [20, 0, -20], bettingRate: 1 }),
      players: fixture(undefined, 3).players,
      initialBalances: { a: 45000, b: 35000, c: 25000 },
      dealerId: 'a',
    };
    expect(finalStandings(m).map((row) => row.finalScore)).toEqual([40, -5, -35]);
  });
});

it('chip rules award red, Ura and Ippatsu independently of table points', () => {
  const input = fixture('123m456m789p234s50p');
  input.rules = rules(4, { chipValue: 5, chipRed: 2, chipUra: 1, chipIppatsu: 3 });
  input.win.riichi = true;
  input.win.ippatsu = true;
  input.uraIndicators = parseTiles('4p', 'ura');
  input.doraIndicators = parseTiles('1z', 'dora');
  const result = score(input);
  expect(result.errors).toEqual([]);
  expect(handChips(input, result)).toEqual({ a: 0, b: 7, c: -7, d: 0 });
  input.win.method = 'tsumo';
  expect(handChips(input, result)).toEqual({ a: -7, b: 21, c: -7, d: -7 });
});
