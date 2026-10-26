import { describe, expect, it } from 'vitest';
import { kindIndex, parseTiles } from '../mahjong-core/index';
import { appendEvent, balances, undoLastEvent } from '../mahjong-core/ledger';
import type { Match } from '../mahjong-core/ledger';
import { fixture } from '../mahjong-fixtures/index';
import { nextDora, rankedRules } from '../mahjong-rules/index';
import { score, basePoints, paymentsFor } from './index';
import { enumerateForms } from './forms';

describe('integer limits and payments', () => {
  it.each([
    [3, 40, 1280],
    [5, 30, 2000],
    [6, 30, 3000],
    [8, 30, 4000],
    [11, 30, 6000],
    [13, 30, 8000],
    [100000, 30, 8000],
  ])('%i han %i fu => base %i', (han, fu, expected) =>
    expect(basePoints(han, fu, 0).base).toBe(expected),
  );
  for (const [han, fu, base] of [
    [3, 40, 1280],
    [5, 30, 2000],
    [6, 30, 3000],
    [8, 30, 4000],
    [11, 30, 6000],
    [13, 30, 8000],
  ]) {
    for (const dealer of [true, false])
      for (const method of ['ron', 'tsumo'] as const) {
        it(`${han} han ${fu} fu ${dealer ? 'dealer' : 'nondealer'} ${method}`, () => {
          const input = fixture();
          input.dealerId = dealer ? 'b' : 'a';
          input.win.method = method;
          const payments = paymentsFor(basePoints(han, fu, 0).base, input);
          const ceil = (v: number): number => Math.ceil(v / 100) * 100;
          expect(payments.map((p) => [p.from, p.amount])).toEqual(
            method === 'ron'
              ? [['c', ceil(base * (dealer ? 6 : 4))]]
              : [
                  ['a', ceil(base * 2)],
                  ['c', ceil(base * (dealer ? 2 : 1))],
                  ['d', ceil(base * (dealer ? 2 : 1))],
                ],
          );
        });
      }
  }
  it('Sanma nondealer Mangan Tsumo pays 4000 + 2000', () => {
    const input = fixture('123p456p789s234s55p', 3);
    input.win.method = 'tsumo';
    input.win.discarderId = undefined;
    expect(paymentsFor(2000, input).map((p) => p.amount)).toEqual([4000, 2000]);
    input.honba = 2;
    expect(paymentsFor(2000, input).map((p) => p.amount)).toEqual([4200, 2200]);
    input.rules = { ...input.rules, tsumo: 'north-bisection' };
    expect(paymentsFor(2000, input).map((p) => p.amount)).toEqual([5200, 3200]);
  });
  it('Sanma dealer Tsumo and Ron honba', () => {
    const input = fixture('123p456p789s234s55p', 3);
    input.dealerId = 'b';
    input.honba = 1;
    expect(paymentsFor(2000, input).map((p) => p.amount)).toEqual([12200]);
    input.win.method = 'tsumo';
    expect(paymentsFor(2000, input).map((p) => p.amount)).toEqual([4100, 4100]);
  });
  it('kiriage is optional', () => {
    expect(basePoints(4, 30, 0).base).toBe(1920);
    expect(basePoints(4, 30, 0, true).base).toBe(2000);
  });
});
describe('winning forms, Yaku and Fu', () => {
  it.each([
    ['223344m456p678s55p', ['riichi', 'tanyao', 'iipeikou'], 3, 40, 5200],
    ['123m123p123s789s55p', ['pinfu', 'sanshoku-doujun'], 3, 30, 3900],
    ['123456789m234p55s', ['pinfu', 'ittsu'], 3, 30, 3900],
    ['123m789p123s11122z', ['round-wind', 'chanta'], 3, 40, 5200],
    ['123m789m123p789s11p', ['pinfu', 'junchan'], 4, 30, 7700],
    ['123456789m11122z', ['round-wind', 'ittsu', 'honitsu'], 6, 40, 12000],
    ['123456789m11222m', ['ittsu', 'chinitsu'], 8, 40, 16000],
    ['222m333p444s11155z', ['round-wind', 'toitoi', 'sanankou'], 5, 50, 8000],
    ['123m111p55566677z', ['dragon-31', 'dragon-32', 'shousangen', 'chanta'], 6, 60, 12000],
    ['111m999p111s22255z', ['seat-wind', 'toitoi', 'sanankou', 'honroutou'], 7, 60, 12000],
  ] as const)('golden Yaku/Fu fixture %s', (notation, expectedYaku, han, fu, payment) => {
    const input = fixture(notation);
    if (notation === '223344m456p678s55p') {
      input.win.riichi = true;
      input.win.winningTileId = input.hand.concealedTiles[2].id;
    }
    const result = score(input);
    expect(result.errors).toEqual([]);
    expect(result.yaku.map((y) => y.id).sort()).toEqual([...expectedYaku].sort());
    expect(result).toMatchObject({ isValid: true, han, fu, winnerReceives: payment });
    expect(result.payments).toEqual([
      { from: 'c', to: 'b', amount: payment, reason: 'Ron + honba' },
    ]);
  });
  it('dealer 3 Han 40 Fu Ron is 7700', () => {
    const input = fixture('223344m456p678s55p');
    input.win.riichi = true;
    input.win.winningTileId = input.hand.concealedTiles[2].id;
    input.dealerId = 'b';
    expect(score(input)).toMatchObject({ han: 3, fu: 40, winnerReceives: 7700 });
  });
  it.each([
    ['22233344466688s', 'ryuuiisou'],
    ['11122255566677z', 'tsuuiisou'],
    ['123m55566677711z', 'daisangen'],
    ['11122233344z111p', 'shousuushii'],
    ['111999m111999p11s', 'chinroutou'],
    ['11123455678999m', 'chuuren'],
  ])('single Yakuman %s', (notation, id) => {
    const result = score(fixture(notation));
    expect(result.errors).toEqual([]);
    expect(result.yaku.map((y) => y.id)).toEqual([id]);
    expect(result).toMatchObject({ limitName: 'Yakuman', winnerReceives: 32000, bonusHan: [] });
  });
  it('four concealed triplets Tsumo', () => {
    const input = fixture('222m333p444s11155z');
    input.win.method = 'tsumo';
    input.win.discarderId = undefined;
    expect(score(input).yaku.map((y) => y.id)).toEqual(['suuankou']);
  });
  it('Pinfu Ron / Tsumo', () => {
    const input = fixture();
    expect(score(input)).toMatchObject({ isValid: true, han: 1, fu: 30, winnerReceives: 1000 });
    input.win.method = 'tsumo';
    input.win.discarderId = undefined;
    expect(score(input)).toMatchObject({ isValid: true, han: 2, fu: 20, winnerReceives: 1500 });
  });
  it('Riichi Ippatsu Pinfu Ron is 3 han 30 fu', () => {
    const input = fixture();
    input.win.riichi = true;
    input.win.ippatsu = true;
    expect(score(input)).toMatchObject({ isValid: true, han: 3, fu: 30, winnerReceives: 3900 });
  });
  it('Chiitoitsu is fixed 25 fu', () => {
    const result = score(fixture('11m99m22p88p33s77s11z'));
    expect(result).toMatchObject({ isValid: true, fu: 25, han: 2, winnerReceives: 1600 });
  });
  it('double wind pair adds 4 fu', () => {
    const input = fixture('123m456m789p234s11z');
    input.hand.playerId = 'a';
    input.win.winnerId = 'a';
    input.win.riichi = true;
    const result = score(input);
    expect(result.fu).toBe(40);
    expect(
      result.fuBreakdown.filter((f) => /wind pair/.test(f.reason)).map((f) => f.value),
    ).toEqual([2, 2]);
  });
  it('Dora alone cannot supply Yaku', () => {
    const input = fixture('123m456m789p234s55p');
    input.win.winningTileId = input.hand.concealedTiles[0].id;
    // Edge/closed wait removes Pinfu.
    input.win.winningTileId = input.hand.concealedTiles[1].id;
    input.doraIndicators = parseTiles('4p', 'indicator');
    expect(score(input).errors.join()).toContain('No Yaku');
  });
  it('red and ura bonuses are separate', () => {
    const input = fixture('123m406m789p234s55p');
    input.win.riichi = true;
    input.doraIndicators = parseTiles('4p', 'dora');
    input.uraIndicators = parseTiles('3s', 'ura');
    expect(score(input).bonusHan).toEqual([
      { source: 'Dora (including Kan indicators)', count: 2 },
      { source: 'Ura dora', count: 1 },
      { source: 'Red fives (Aka)', count: 1 },
    ]);
  });
  it('enumerates ambiguous forms and selects best payment', () => {
    const input = fixture('11223344556677p');
    input.win.riichi = true;
    expect(enumerateForms(input.hand).length).toBeGreaterThan(2);
    const result = score(input);
    expect(result.isValid).toBe(true);
    expect(result.yaku.some((y) => y.id === 'ryanpeikou')).toBe(true);
    expect(result.winnerReceives).toBeGreaterThanOrEqual(16000);
  });
  it('standard Kokushi has one Yakuman', () => {
    const input = fixture('119m19p19s1234567z');
    input.win.winningTileId = input.hand.concealedTiles.at(-1)!.id;
    expect(score(input)).toMatchObject({
      isValid: true,
      limitName: 'Yakuman',
      winnerReceives: 32000,
    });
  });
  it('Kita remains outside hand and receives North dora too', () => {
    const input = fixture('123p456p789s234s55p', 3);
    input.hand.extractedNorthTiles = parseTiles('4z', 'kita');
    input.doraIndicators = parseTiles('3z', 'dora');
    expect(score(input).bonusHan.map((b) => b.count)).toEqual([1, 1]);
  });
  it('open/closed Kan Fu differ', () => {
    const input = fixture('123p789p234s55p');
    const tiles = parseTiles('1111z', 'kan');
    input.hand.melds = [{ id: 'kan', type: 'ankan', tiles }];
    input.win.winningTileId = input.hand.concealedTiles[7].id;
    expect(score(input).fuBreakdown.find((f) => /kan/.test(f.reason))?.value).toBe(32);
    input.hand.melds[0] = {
      id: 'kan',
      type: 'daiminkan',
      tiles,
      fromPlayerId: 'a',
      calledTileId: tiles[0].id,
    };
    expect(score(input).fuBreakdown.find((f) => /kan/.test(f.reason))?.value).toBe(16);
  });
});
describe('validation and rules', () => {
  it.each(['11111m234p567s11z', '123m456p789s11z', '123m456p789s11223z'])(
    'rejects invalid hand %s',
    (text) => expect(score(fixture(text)).isValid).toBe(false),
  );
  it('rejects prohibited Sanma tiles and Chi', () => {
    expect(score(fixture(undefined, 3)).errors.join()).toContain('Sanma excludes');
    const input = fixture('456p789s234s55p', 3);
    const tiles = parseTiles('123p', 'meld');
    input.hand.melds = [
      { id: 'm', type: 'chi', tiles, fromPlayerId: 'a', calledTileId: tiles[0].id },
    ];
    expect(score(input).errors.join()).toContain('Chi is prohibited');
  });
  it('rejects duplicate IDs', () => {
    const input = fixture();
    input.hand.concealedTiles[1].id = input.hand.concealedTiles[0].id;
    expect(score(input).errors.join()).toContain('unique ID');
  });
  it('rejects self-source and fabricated Kakan', () => {
    const input = fixture('123p789p234s55p');
    const tiles = parseTiles('1111z', 'kan');
    input.hand.melds = [
      { id: 'm', type: 'kakan', tiles, fromPlayerId: 'b', calledTileId: tiles[0].id },
    ];
    expect(score(input).errors.join()).toContain('another seated source');
    expect(score(input).errors.join()).toContain('original Pon');
  });
  it('rejects contradictory timing', () => {
    const input = fixture();
    input.win.haitei = true;
    expect(score(input).isValid).toBe(false);
  });
  it('cycles Dora correctly including Sanma manzu', () => {
    expect([0, 8, 26, 30, 33].map((i) => nextDora(i, 3))).toEqual([8, 0, 18, 27, 31]);
    expect(parseTiles('05m1234567z').map((t) => kindIndex(t.kind))).toEqual([
      4, 4, 27, 28, 29, 30, 31, 32, 33,
    ]);
  });
});
describe('ledger', () => {
  const makeMatch = (): Match => ({
    id: 'match',
    schemaVersion: 1,
    createdAt: '',
    updatedAt: '',
    name: 'test',
    playerCount: 4,
    rules: rankedRules(4),
    players: fixture().players,
    initialBalances: { a: 25000, b: 25000, c: 25000, d: 25000 },
    dealerId: 'a',
    initialDealerId: 'a',
    events: [],
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
  });
  it('funds escrow once, awards it once, undoes and replays', () => {
    let match = appendEvent(makeMatch(), {
      id: 'deposit',
      timestamp: '',
      type: 'riichiDeposit',
      payments: [{ from: 'c', to: 'table', amount: 1000, reason: 'Riichi' }],
    });
    const input = fixture();
    input.riichiSticks = 1;
    const result = score(input);
    const event = {
      id: 'win',
      timestamp: '',
      type: 'win' as const,
      payments: result.payments,
      result,
    };
    match = appendEvent(match, event);
    expect(balances(match)).toEqual({
      players: { a: 25000, b: 27000, c: 23000, d: 25000 },
      table: 0,
    });
    expect(() => appendEvent(match, event)).toThrow('already settled');
    const undone = undoLastEvent(match);
    expect(balances(undone).table).toBe(1000);
    expect(balances(appendEvent(undone, event))).toEqual(balances(match));
  });
  it('rejects unfunded pot', () => {
    const input = fixture();
    input.riichiSticks = 1;
    const result = score(input);
    expect(() =>
      appendEvent(makeMatch(), {
        id: 'win',
        timestamp: '',
        type: 'win',
        result,
        payments: result.payments,
      }),
    ).toThrow('unfunded');
  });
});
