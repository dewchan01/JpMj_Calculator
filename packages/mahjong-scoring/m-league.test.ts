import { describe, expect, it } from 'vitest';
import { fixture } from '../mahjong-fixtures/index';
import { presetRules, ruleSettings } from '../mahjong-rules/index';
import { score } from './index';
import { basePoints } from './payments';
import { drawSettlement, multipleRon } from './rounds';
import { parseTiles } from '../mahjong-core/index';
import { settleRound, type Match } from '../mahjong-core/ledger';

const rules = presetRules('m-league', 4);

describe('M.League', () => {
  it('restricts the preset to four players and enables its scoring limits', () => {
    expect(() => presetRules('m-league', 3)).toThrow('four players');
    expect(ruleSettings(rules)).toMatchObject({
      doubleYakuman: false,
      stackYakuman: true,
      kazoe: 'sanbaiman',
      multipleRon: 'head-bump',
      kokushiAnkanRon: false,
      redFives: true,
    });
    expect(basePoints(4, 30, 0, rules.kiriage).base).toBe(2000);
    expect(basePoints(3, 60, 0, rules.kiriage).base).toBe(2000);
  });

  it('keeps special-wait Kokushi single and caps ordinary hands at Sanbaiman', () => {
    const input = fixture('119m19p19s1234567z');
    input.rules = rules;
    input.win.winningTileId = input.hand.concealedTiles[0].id;
    expect(score(input)).toMatchObject({ isValid: true, winnerReceives: 32000 });
    const counted = fixture('11223344556677m');
    counted.rules = rules;
    counted.win.doubleRiichi = true;
    counted.win.ippatsu = true;
    counted.doraIndicators = parseTiles('6m', 'dora');
    expect(score(counted)).toMatchObject({
      isValid: true,
      limitName: 'Sanbaiman',
      winnerReceives: 24000,
    });
  });

  it('selects the closest Ron claimant regardless of input order', () => {
    const inputs = ['123456789m123p44z', '123456789p123s44z'].map((text, index) => {
      const input = fixture(text);
      input.rules = rules;
      const winner = ['a', 'b'][index];
      input.hand.concealedTiles = parseTiles(text, winner);
      input.hand.playerId = winner;
      input.win.winnerId = winner;
      input.win.discarderId = 'd';
      input.win.winningTileId = input.hand.concealedTiles.at(-1)!.id;
      input.win.riichi = true;
      return input;
    });
    expect(multipleRon(inputs.reverse())).toMatchObject({ isValid: true, winnerIds: ['a'] });
  });

  it('rejects abortive and Nagashi draws', () => {
    for (const type of ['abortive', 'nagashi'] as const) {
      expect(
        drawSettlement({
          rules,
          players: fixture().players,
          dealerId: 'a',
          honba: 0,
          type,
          tenpaiIds: [],
          nagashiIds: [],
          circumstancesConfirmed: true,
          reason: 'nine-terminals',
        }).isValid,
      ).toBe(false);
    }
  });

  it('counts a double-wind pair once', () => {
    const input = fixture('123m456m789p234s11z');
    input.rules = rules;
    input.dealerId = 'b';
    input.win.riichi = true;
    const result = score(input);
    expect(result.isValid).toBe(true);
    expect(result.fuBreakdown.filter((item) => item.reason.includes('wind pair'))).toEqual([
      { reason: 'Seat wind pair', value: 2 },
    ]);
  });

  it('applies Pao when the fourth Kan is a Daiminkan', () => {
    const input = fixture('22p');
    input.rules = rules;
    input.hand.melds = ['1111m', '2222m', '3333s', '4444s'].map((text, index) => {
      const tiles = parseTiles(text, `kan-${index}`);
      return {
        id: `kan-${index}`,
        type: index === 3 ? 'daiminkan' : 'ankan',
        tiles,
        callOrder: index + 1,
        ...(index === 3 ? { fromPlayerId: 'd', calledTileId: tiles[0].id } : {}),
      };
    });
    input.win.winningTileId = input.hand.concealedTiles[0].id;
    input.doraIndicators = parseTiles('789m89p', 'dora');
    input.honba = 1;
    const result = score(input);
    expect(result.errors).toEqual([]);
    expect(
      result.payments.some(
        (payment) => payment.from === 'd' && payment.reason.includes('Responsibility'),
      ),
    ).toBe(true);
  });

  it('continues through negative balances and dealer repeats, then ends without extension', () => {
    const match: Match = {
      id: 'm',
      schemaVersion: 1,
      name: 'M',
      createdAt: '',
      updatedAt: '',
      rules,
      playerCount: 4,
      players: fixture().players,
      initialBalances: { a: 100, b: 39900, c: 30000, d: 30000 },
      initialDealerId: 'a',
      dealerId: 'a',
      roundWind: 'south',
      handNumber: 4,
      honba: 0,
      events: [],
      gameLength: 'south',
    };
    const draw = drawSettlement({
      rules,
      players: match.players,
      dealerId: 'a',
      honba: 0,
      type: 'exhaustive',
      tenpaiIds: ['b'],
      nagashiIds: [],
      circumstancesConfirmed: true,
    });
    const event = { id: 'e', timestamp: 'now', type: 'exhaustiveDraw' as const, payments: [] };
    expect(settleRound({ ...match, roundWind: 'east', handNumber: 1 }, event, draw).ended).toBe(
      false,
    );
    expect(settleRound(match, event, draw).ended).toBe(true);
    const repeat = { ...draw, dealerRepeats: true };
    expect(settleRound(match, event, repeat).ended).toBe(false);
  });
});
