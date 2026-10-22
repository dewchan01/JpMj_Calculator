import { describe, expect, it } from 'vitest';
import { parseTiles, type Meld, type PlayerCount } from '../mahjong-core/index';
import {
  appendEvent,
  balances,
  roundState,
  settleRound,
  undoLastEvent,
  type Match,
  type LedgerEvent,
} from '../mahjong-core/ledger';
import { fixture } from '../mahjong-fixtures/index';
import { presetRules, ruleSettings, type RulePreset } from '../mahjong-rules/index';
import { score, type ScoringInput } from './index';
import { drawSettlement, multipleRon, type RoundSettlement } from './rounds';

function withRules(text: string, preset: RulePreset, count: PlayerCount = 4): ScoringInput {
  const input = fixture(text, count);
  input.rules = presetRules(preset, count);
  return input;
}
function meld(text: string, id: string, type: Meld['type'] = 'pon', from = 'a', order = 1): Meld {
  const tiles = parseTiles(text, id);
  return {
    id,
    type,
    tiles,
    ...(type === 'ankan' ? {} : { fromPlayerId: from, calledTileId: tiles[0].id }),
    callOrder: order,
  };
}
describe('rule presets and previously blocked Yakuman', () => {
  for (const preset of ['mahjong-soul', 'tenhou'] as const) {
    it.each(['kokushi', 'suuankou', 'chuuren'])(`${preset} %s special waits`, (kind) => {
      const input = withRules(
        kind === 'kokushi'
          ? '119m19p19s1234567z'
          : kind === 'suuankou'
            ? '222m333p444s11155z'
            : '11123455678999m',
        preset,
      );
      input.win.winningTileId =
        input.hand.concealedTiles[kind === 'kokushi' ? 0 : kind === 'suuankou' ? 13 : 6].id;
      const result = score(input);
      expect(result.errors).toEqual([]);
      expect(result.yaku[0].yakumanMultiplier).toBe(preset === 'mahjong-soul' ? 2 : 1);
      expect(result.winnerReceives).toBe(preset === 'mahjong-soul' ? 64000 : 32000);
    });
    it(`${preset} big four winds stacks with all honors`, () => {
      const input = withRules('11122233344455z', preset);
      const r = score(input);
      expect(r.errors).toEqual([]);
      expect(r.yaku.map((y) => y.id)).toEqual(['tsuuiisou', 'daisuushii']);
      expect(r.winnerReceives).toBe(preset === 'mahjong-soul' ? 96000 : 64000);
    });
    it(`${preset} four Kans without responsibility`, () => {
      const input = withRules('55p', preset);
      input.hand.melds = [
        meld('1111m', 'm', 'daiminkan'),
        meld('9999p', 'p', 'daiminkan', 'c', 2),
        meld('1111s', 's', 'daiminkan', 'd', 3),
        meld('2222z', 'z', 'daiminkan', 'a', 4),
      ];
      input.win.winningTileId = input.hand.concealedTiles[1].id;
      const result = score(input);
      expect(result.errors).toEqual([]);
      expect(result.yaku.map((y) => y.id)).toEqual(['suukantsu']);
      expect(result.winnerReceives).toBe(32000);
    });
    it(`${preset} Tenhou selects any initial-deal winning tile`, () => {
      const input = withRules('119m19p19s1234567z', preset);
      input.dealerId = 'b';
      input.win.method = 'tsumo';
      input.win.discarderId = undefined;
      input.win.tenhou = true;
      input.win.firstTurnUninterrupted = true;
      const r = score(input);
      expect(r.errors).toEqual([]);
      expect(r.yaku.map((y) => y.id)).toEqual(['tenhou', 'kokushi-13']);
      expect(r.winnerReceives).toBe(preset === 'mahjong-soul' ? 144000 : 96000);
    });
  }
  it('Chiihou is explicit, nondealer only, and rejects interrupted history', () => {
    const input = fixture();
    input.win.method = 'tsumo';
    input.win.discarderId = undefined;
    input.win.chiihou = true;
    input.win.firstTurnUninterrupted = true;
    expect(score(input).yaku.map((y) => y.id)).toEqual(['chiihou']);
    input.win.firstTurnUninterrupted = false;
    expect(score(input).isValid).toBe(false);
    input.win.firstTurnUninterrupted = true;
    input.dealerId = 'b';
    expect(score(input).isValid).toBe(false);
  });
  it('custom rules control stacking and red inventory', () => {
    const input = withRules('11122233344455z', 'custom');
    input.rules = {
      ...input.rules,
      settings: { ...ruleSettings(input.rules), stackYakuman: false },
    };
    expect(score(input).winnerReceives).toBe(64000);
    const reds = withRules('123m406m789p234s55p', 'custom');
    reds.rules = { ...reds.rules, settings: { ...ruleSettings(reds.rules), redFives: false } };
    expect(score(reds).errors).toContain('Red fives are disabled in this rule profile.');
  });
  it('Kita replacement Rinshan and later Riichi timing no longer blanket-rejected', () => {
    const input = withRules('123p456p789s234s55p', 'mahjong-soul', 3);
    input.hand.extractedNorthTiles = parseTiles('4z', 'kita');
    input.win.method = 'tsumo';
    input.win.discarderId = undefined;
    input.win.rinshan = true;
    input.win.replacement = 'kita';
    expect(score(input).errors).toEqual([]);
    expect(score(input).yaku.map((y) => y.id)).toContain('rinshan');
    input.win.rinshan = false;
    input.win.riichi = true;
    input.win.ippatsu = true;
    expect(score(input).isValid).toBe(true);
  });
  it('robbed Kita provides no Chankan yaku and needs another yaku', () => {
    const input = withRules('123p456p789s234s44z', 'mahjong-soul', 3);
    input.win.winningTileId = input.hand.concealedTiles.at(-1)!.id;
    input.win.robbed = 'kita';
    expect(score(input).isValid).toBe(false);
    input.win.riichi = true;
    expect(score(input).isValid).toBe(true);
    input.win.chankan = true;
    expect(score(input).isValid).toBe(false);
  });
  it('Ankan robbing follows the preset and only permits Kokushi', () => {
    const input = withRules('119m19p19s1234567z', 'mahjong-soul');
    input.win.robbed = 'ankan';
    input.win.chankan = true;
    expect(score(input).isValid).toBe(true);
    input.rules = presetRules('tenhou', 4);
    expect(score(input).isValid).toBe(false);
  });
  it('other-player Kans permit extra indicators with physical limits', () => {
    const input = fixture();
    input.doraIndicators = parseTiles('12z', 'dora');
    input.otherPlayerKans = 1;
    expect(score(input).isValid).toBe(true);
    input.otherPlayerKans = 0;
    expect(score(input).isValid).toBe(false);
  });
});
describe('responsibility payments', () => {
  function pao(preset: RulePreset, count: PlayerCount = 4): ScoringInput {
    const input = withRules('11122z', preset, count);
    input.hand.melds = [
      meld('555z', 'white', 'pon', 'a', 1),
      meld('666z', 'green', 'pon', 'a', 2),
      meld('777z', 'red', 'pon', count === 3 ? 'c' : 'd', 3),
    ];
    input.win.winningTileId = input.hand.concealedTiles.at(-1)!.id;
    return input;
  }
  it('Soul charges only Daisangen component; Tenhou includes all honors too', () => {
    const soul = pao('mahjong-soul');
    soul.honba = 1;
    const a = score(soul);
    expect(a.errors).toEqual([]);
    expect(a.playerDeltas).toEqual({ a: 0, b: 64300, c: -48000, d: -16300 });
    const tenhou = pao('tenhou');
    tenhou.honba = 1;
    expect(score(tenhou).playerDeltas).toEqual({ a: 0, b: 64300, c: -32000, d: -32300 });
  });
  it('responsible discarder is charged once', () => {
    const input = pao('mahjong-soul');
    input.win.discarderId = 'd';
    expect(score(input).playerDeltas).toEqual({ a: 0, b: 64000, c: 0, d: -64000 });
  });
  it('Tsumo and Sanma preserve actual shares', () => {
    const input = pao('mahjong-soul');
    input.win.method = 'tsumo';
    input.win.discarderId = undefined;
    expect(score(input).playerDeltas).toEqual({ a: -16000, b: 64000, c: -8000, d: -40000 });
    const sanma = pao('mahjong-soul', 3);
    sanma.win.method = 'tsumo';
    sanma.win.discarderId = undefined;
    expect(score(sanma).playerDeltas).toEqual({ a: -16000, b: 48000, c: -32000 });
  });
  it('requires call order, retains original provider after Kakan, and supports disabling Pao', () => {
    const input = pao('mahjong-soul');
    input.hand.melds[2].callOrder = undefined;
    expect(score(input).errors.join()).toContain('call-order');
    input.rules = { ...input.rules, settings: { ...ruleSettings(input.rules), pao: 'off' } };
    expect(score(input).isValid).toBe(true);
  });
});
function ronHands(preset: RulePreset): ScoringInput[] {
  return ['123456789m123p44z', '123456789p123s44z', '123456789s123m44z'].map((text, index) => {
    const input = withRules(text, preset);
    const id = ['a', 'b', 'c'][index];
    input.hand.concealedTiles = parseTiles(text, `winner-${id}`);
    input.hand.playerId = id;
    input.win.winnerId = id;
    input.win.discarderId = 'd';
    input.win.winningTileId = input.hand.concealedTiles.at(-1)!.id;
    input.win.riichi = true;
    input.honba = 2;
    input.riichiSticks = 2;
    return input;
  });
}
describe('multiple Ron', () => {
  it('double Ron awards honba and pot only to nearest winner', () => {
    const inputs = ronHands('mahjong-soul').slice(0, 2).reverse();
    const r = multipleRon(inputs);
    expect(r.errors).toEqual([]);
    expect(r.winnerIds).toEqual(['a', 'b']);
    expect(r.playerDeltas).toEqual({ a: 10300, b: 5200, c: 0, d: -13500 });
    expect(r.payments.filter((p) => p.from === 'table').length).toBe(1);
    expect(r.dealerRepeats).toBe(true);
  });
  it('triple Ron wins in Soul and aborts without touching escrow in Tenhou', () => {
    const soul = multipleRon(ronHands('mahjong-soul'));
    expect(soul.errors).toEqual([]);
    expect(soul.outcome).toBe('win');
    expect(soul.playerDeltas).toEqual({ a: 10300, b: 5200, c: 5200, d: -18700 });
    const tenhou = multipleRon(ronHands('tenhou'));
    expect(tenhou.errors).toEqual([]);
    expect(tenhou).toMatchObject({ outcome: 'abortiveDraw', payments: [], dealerRepeats: true });
  });
  it('head-bump retains the nearest winner only', () => {
    const inputs = ronHands('custom');
    for (const i of inputs)
      i.rules = { ...i.rules, settings: { ...ruleSettings(i.rules), multipleRon: 'head-bump' } };
    expect(multipleRon(inputs).winnerIds).toEqual(['a']);
  });
  it('rejects inconsistent discards and impossible combined inventories', () => {
    const inputs = ronHands('mahjong-soul');
    inputs[1].win.discarderId = 'c';
    expect(multipleRon(inputs).isValid).toBe(false);
    inputs[1] = structuredClone(inputs[0]);
    inputs[1].win.winnerId = 'b';
    inputs[1].hand.playerId = 'b';
    expect(multipleRon(inputs.slice(0, 2)).isValid).toBe(false);
  });
});
describe('draws and round progression', () => {
  function draw(
    count: PlayerCount,
    tenpaiIds: string[] = [],
    type: 'exhaustive' | 'abortive' | 'nagashi' = 'exhaustive',
  ) {
    return {
      rules: presetRules('mahjong-soul', count),
      players: fixture(undefined, count).players,
      dealerId: 'a',
      honba: 0,
      type,
      tenpaiIds,
      nagashiIds: [] as string[],
      circumstancesConfirmed: true,
      reason: 'nine-terminals' as const,
    };
  }
  for (const count of [3, 4] as const)
    for (let n = 0; n <= count; n++) {
      it(`${count}P draw with ${n} Tenpai`, () => {
        const input = draw(count, ['a', 'b', 'c', 'd'].slice(0, n));
        const r = drawSettlement(input);
        expect(r.errors).toEqual([]);
        expect(Object.values(r.playerDeltas).reduce((a, b) => a + b, 0)).toBe(0);
        const pool = count === 3 ? 2000 : 3000;
        for (const [id, delta] of Object.entries(r.playerDeltas))
          expect(delta).toBe(
            n === 0 || n === count
              ? 0
              : input.tenpaiIds.includes(id)
                ? pool / n
                : -pool / (count - n),
          );
      });
    }
  it('Nagashi replaces Noten, permits simultaneous payouts and retains pot', () => {
    const input = draw(4, ['a'], 'nagashi');
    input.nagashiIds = ['b', 'c'];
    const r = drawSettlement(input);
    expect(r.errors).toEqual([]);
    expect(r.dealerRepeats).toBe(true);
    expect(r.playerDeltas).toEqual({ a: -8000, b: 6000, c: 6000, d: -4000 });
    expect(r.payments.some((p) => p.from === 'table')).toBe(false);
  });
  it('validates abortive reasons and explicit confirmation', () => {
    const input = draw(3, [], 'abortive');
    expect(drawSettlement(input).dealerRepeats).toBe(true);
    input.circumstancesConfirmed = false;
    expect(drawSettlement(input).isValid).toBe(false);
    expect(
      drawSettlement({ ...input, circumstancesConfirmed: true, reason: 'four-winds' }).isValid,
    ).toBe(false);
    expect(drawSettlement({ ...draw(4, [], 'abortive'), reason: 'triple-ron' }).isValid).toBe(
      false,
    );
  });
  const match = (): Match => ({
    id: 'm',
    schemaVersion: 1,
    name: 'test',
    createdAt: '',
    updatedAt: '',
    rules: presetRules('mahjong-soul', 4),
    playerCount: 4,
    players: fixture().players,
    initialBalances: { a: 25000, b: 25000, c: 25000, d: 25000 },
    initialDealerId: 'a',
    dealerId: 'a',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    events: [],
    gameLength: 'south',
  });
  const event = (): LedgerEvent => ({
    id: 'event',
    timestamp: 'now',
    type: 'exhaustiveDraw',
    payments: [],
  });
  it('draws rotate or repeat and undo restores the previous round', () => {
    const m = match();
    const drawResult = drawSettlement(draw(4, ['b']));
    const next = settleRound(m, event(), drawResult);
    expect(roundState(next)).toMatchObject({ dealerId: 'b', handNumber: 2, honba: 1 });
    expect(roundState(undoLastEvent(next))).toEqual(roundState(m));
    expect(roundState(settleRound(m, event(), drawSettlement(draw(4, ['a']))))).toMatchObject({
      dealerId: 'a',
      handNumber: 1,
      honba: 1,
    });
  });
  it('nondealer win rotates, dealer win repeats, and point balances reconcile', () => {
    const input = fixture();
    const r = score(input);
    const outcome: RoundSettlement = {
      isValid: true,
      errors: [],
      outcome: 'win',
      payments: r.payments,
      playerDeltas: r.playerDeltas,
      winnerIds: ['b'],
      dealerRepeats: false,
      results: [r],
    };
    const next = settleRound(match(), { ...event(), type: 'win', result: r }, outcome);
    expect(roundState(next)).toMatchObject({ dealerId: 'b', handNumber: 2, honba: 0 });
    expect(balances(next).players.b).toBe(26000);
  });
  it('last regular hand extends when below target and ends when target is reached', () => {
    const m = match();
    m.gameLength = 'east';
    m.handNumber = 4;
    m.dealerId = 'd';
    const r = drawSettlement({ ...draw(4), dealerId: 'd' });
    expect(roundState(settleRound(m, event(), r))).toMatchObject({
      roundWind: 'south',
      handNumber: 1,
      ended: false,
    });
    m.initialBalances.a = 31000;
    expect(settleRound(m, event(), r).ended).toBe(true);
  });
  it('ending awards funded escrow to first place once and undo restores it', () => {
    let m = match();
    m.roundWind = 'south';
    m.handNumber = 4;
    m.dealerId = 'd';
    m.initialBalances.a = 31000;
    m = appendEvent(m, {
      id: 'deposit',
      timestamp: '',
      type: 'riichiDeposit',
      payments: [{ from: 'b', to: 'table', amount: 1000, reason: 'Riichi' }],
    });
    const next = settleRound(m, event(), drawSettlement({ ...draw(4), dealerId: 'd' }));
    expect(next.ended).toBe(true);
    expect(balances(next).table).toBe(0);
    expect(balances(next).players.a).toBe(32000);
    expect(balances(undoLastEvent(next)).table).toBe(1000);
    expect(() => settleRound(next, event(), drawSettlement(draw(4)))).toThrow('ended');
  });
});
