import { describe, expect, it } from 'vitest';
import { fixture } from '../mahjong-fixtures/index';
import { presetRules, tableRules } from '../mahjong-rules/index';
import { score, type ScoringInput } from './index';
import { multipleRon } from './rounds';
import { handChips } from './chips';

function manual(han = 3, fu = 40): ScoringInput {
  const input = fixture();
  input.rules = structuredClone(input.rules);
  input.hand.concealedTiles = [];
  input.win.winningTileId = '';
  input.manualScore = { han, fu };
  return input;
}
describe('player-confirmed Han/Fu scoring', () => {
  it('splits explicit Pao using the saved component/whole-hand policy and applies Honba once', () => {
    const input = manual();
    input.rules = presetRules('mahjong-soul', 4);
    input.honba = 1;
    input.manualScore = { han: 3, fu: 40, yakuman: 2, pao: { payerId: 'd', yakuman: 1 } };
    const result = score(input);
    expect(result.isValid).toBe(true);
    expect(result.playerDeltas).toEqual({ a: 0, b: 64300, c: -48000, d: -16300 });
    input.rules = presetRules('tenhou', 4);
    expect(score(input).playerDeltas).toEqual({ a: 0, b: 64300, c: -32000, d: -32300 });
    input.manualScore.pao!.payerId = 'b';
    expect(score(input).isValid).toBe(false);
  });
  it('settles a non-dealer Ron without tiles and includes Honba and escrow once', () => {
    const input = manual();
    input.honba = 2;
    input.riichiSticks = 1;
    input.win.riichi = true;
    expect(score(input)).toMatchObject({
      isValid: true,
      han: 3,
      fu: 40,
      winnerReceives: 6800,
      playerDeltas: { a: 0, b: 6800, c: -5800, d: 0 },
    });
    expect(multipleRon([input]).isValid).toBe(true);
  });
  it('uses dealer Tsumo payments and the saved Sanma payment rule', () => {
    const input = manual();
    input.hand.playerId = input.win.winnerId = 'a';
    input.win.method = 'tsumo';
    delete input.win.discarderId;
    expect(score(input)).toMatchObject({ isValid: true, winnerReceives: 7800 });
    input.players.pop();
    input.rules = presetRules('tenhou', 3);
    expect(score(input)).toMatchObject({ isValid: true, winnerReceives: 5200 });
  });
  it('respects Kiriage, counted Yakuman policy and explicit Yakuman multiples', () => {
    const input = manual(4, 30);
    input.rules = { ...input.rules, kiriage: false };
    expect(score(input).winnerReceives).toBe(7700);
    input.rules = { ...input.rules, kiriage: true };
    expect(score(input).winnerReceives).toBe(8000);
    input.rules = presetRules('m-league', 4);
    input.manualScore = { han: 13, fu: 40 };
    expect(score(input).winnerReceives).toBe(24000);
    input.manualScore.yakuman = 2;
    expect(score(input).winnerReceives).toBe(64000);
  });
  it.each([
    [0, 40],
    [2.5, 40],
    [3, 35],
    [1, 20],
    [1, 25],
  ])('rejects unsupported %s Han %s Fu', (han, fu) => {
    expect(score(manual(han, fu)).isValid).toBe(false);
  });
  it('validates seating even without tiles, and normal scoring still requires a full hand', () => {
    const input = manual();
    input.win.discarderId = input.win.winnerId;
    expect(score(input).isValid).toBe(false);
    delete input.manualScore;
    expect(score(input).errors.some((error) => error.includes('concealed tiles'))).toBe(true);
  });
  it('settles multiple Ron without inventing a physical winning tile', () => {
    const first = manual();
    const second = manual(2, 30);
    second.hand.playerId = second.win.winnerId = 'd';
    const outcome = multipleRon([first, second]);
    expect(outcome.isValid).toBe(true);
    expect(outcome.playerDeltas.c).toBe(-7200);
    expect(outcome.winnerIds).toHaveLength(2);
  });
  it('uses the entered chip count per payer without inferring hidden tile bonuses', () => {
    const input = manual();
    input.rules = { ...input.rules, table: { ...tableRules(input.rules), chipValue: 10 } };
    input.manualScore!.chips = 3;
    expect(handChips(input, score(input))).toMatchObject({ b: 3, c: -3 });
    input.win.method = 'tsumo';
    delete input.win.discarderId;
    expect(handChips(input, score(input))).toEqual({ a: -3, b: 9, c: -3, d: -3 });
  });
});
