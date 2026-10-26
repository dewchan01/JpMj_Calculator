import { describe, expect, it } from 'vitest';
import { fixture } from '../../../../../../../packages/mahjong-fixtures/index';
import {
  balances,
  settleRound,
  finishMatch,
  type Match,
} from '../../../../../../../packages/mahjong-core/ledger';
import {
  drawSettlement,
  multipleRon,
  type DrawInput,
} from '../../../../../../../packages/mahjong-scoring/rounds';
import { emptyLive, declareRiichi } from '../../../../../../../packages/mahjong-core/live';
import { handEditDraft, finishHandEdit } from './hand-edit';
import { score } from '../../../../../../../packages/mahjong-scoring/index';
import { parseTiles } from '../../../../../../../packages/mahjong-core/index';

function game(): Match {
  const input = fixture();
  return {
    id: 'game',
    schemaVersion: 1,
    name: 'Test',
    createdAt: '2026-10-26',
    updatedAt: 'before',
    rules: input.rules,
    players: input.players,
    playerCount: 4,
    initialBalances: { a: 25000, b: 25000, c: 25000, d: 25000 },
    initialDealerId: 'a',
    dealerId: 'a',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    gameLength: 'south',
    events: [],
    live: emptyLive(),
  };
}
function draw(match: Match, id: string, tenpaiIds: string[]): Match {
  const input: DrawInput = {
    rules: match.rules,
    players: match.players,
    dealerId: match.dealerId,
    honba: match.honba,
    type: 'exhaustive',
    tenpaiIds,
    nagashiIds: [],
    circumstancesConfirmed: true,
  };
  return settleRound(
    match,
    {
      id,
      type: 'exhaustiveDraw',
      timestamp: id,
      payments: [],
      drawInput: input,
      liveBefore: match.live,
      durationMs: 1234,
    },
    drawSettlement(input),
  );
}
function win(match: Match, id: string): Match {
  const input = {
    ...fixture(),
    rules: match.rules,
    honba: match.honba,
    dealerId: match.dealerId,
    riichiSticks: balances(match).table / 1000,
  };
  const outcome = multipleRon([input]);
  expect(outcome.isValid).toBe(true);
  return settleRound(
    match,
    {
      id,
      type: 'win',
      timestamp: id,
      payments: outcome.payments,
      scoringInput: input,
      hand: input.hand,
      win: input.win,
      result: outcome.results[0],
      winnerIds: outcome.winnerIds,
      liveBefore: match.live,
    },
    outcome,
  );
}
describe('editing historical hands', () => {
  it('replays later Tsumo payments using the changed dealer and preserves unique physical tile IDs for multiple Ron', () => {
    const first = draw(game(), 'first', ['a']);
    const input = fixture();
    input.honba = first.honba;
    input.win.method = 'tsumo';
    delete input.win.discarderId;
    const result = score(input);
    expect(result.isValid).toBe(true);
    const outcome = {
      isValid: true,
      errors: [],
      outcome: 'win' as const,
      payments: result.payments,
      playerDeltas: result.playerDeltas,
      winnerIds: ['b'],
      dealerRepeats: false,
      results: [result],
    };
    const original = settleRound(
      first,
      {
        id: 'tsumo',
        type: 'win',
        timestamp: 'tsumo',
        payments: result.payments,
        scoringInput: input,
        result,
        win: input.win,
        hand: input.hand,
      },
      outcome,
    );
    const rebuilt = finishHandEdit(
      original,
      'first',
      draw(handEditDraft(original, 'first'), 'new', []),
    );
    expect(rebuilt.events[1].scoringInput?.dealerId).toBe('b');
    expect(rebuilt.events[1].payments).not.toEqual(original.events[1].payments);
    const inputs = [fixture(), fixture()].map((entry, index) => {
      const tiles = parseTiles(
        index ? '123m456m789p234s66p' : '123m456m789p234s55p',
        'winner-' + index,
      );
      return {
        ...entry,
        honba: first.honba,
        hand: { ...entry.hand, playerId: index ? 'a' : 'b', concealedTiles: tiles },
        win: { ...entry.win, winnerId: index ? 'a' : 'b', winningTileId: tiles[11].id },
      };
    });
    const multiple = multipleRon(inputs);
    expect(multiple.isValid).toBe(true);
    const multiMatch = settleRound(
      first,
      {
        id: 'multi',
        type: 'multipleRon',
        timestamp: 'multi',
        payments: multiple.payments,
        scoringInputs: inputs,
        winnerIds: multiple.winnerIds,
        results: multiple.results,
      },
      multiple,
    );
    const replayed = finishHandEdit(
      multiMatch,
      'first',
      draw(handEditDraft(multiMatch, 'first'), 'new', []),
    );
    expect(replayed.events[1].results).toHaveLength(2);
    expect(replayed.events[1].scoringInputs?.every((entry) => entry.dealerId === 'b')).toBe(true);
  });
  it('replays later draws and changes their dealer, balances and round context', () => {
    const original = draw(draw(game(), 'first', ['a']), 'second', ['a']);
    const saved = structuredClone(original);
    const result = finishHandEdit(
      original,
      'first',
      draw(handEditDraft(original, 'first'), 'replacement', []),
      'edit-time',
    );
    expect(original).toEqual(saved);
    expect(result.events.map((event) => event.id)).toEqual(['first', 'second']);
    expect(result.events[1].before?.dealerId).toBe('b');
    expect(result.dealerId).toBe('c');
    expect(result.handNumber).toBe(3);
    expect(balances(result).players.a).toBe(28000);
    expect(result.events[0].revisions?.[0].event).toEqual(saved.events[0]);
    expect(result.events[0].durationMs).toBe(1234);
  });
  it('recalculates later Ron payments, Honba, escrow and manual match ending', () => {
    const original = finishMatch(
      win(declareRiichi(draw(game(), 'first', ['a']), 'b', false, 'deposit'), 'second'),
      'end',
    );
    const result = finishHandEdit(
      original,
      'first',
      draw(handEditDraft(original, 'first'), 'new', []),
    );
    expect(result.events[2].scoringInput?.dealerId).toBe('b');
    expect(result.events[2].scoringInput?.riichiSticks).toBe(1);
    expect(result.events[2].payments).not.toEqual(original.events[2].payments);
    expect(balances(result).table).toBe(0);
    expect(result.ended).toBe(true);
    expect(result.events.at(-1)?.id).toBe('end');
  });
  it('supports replacing a draw with a fully scored winning hand', () => {
    const original = draw(draw(game(), 'first', []), 'second', []);
    const result = finishHandEdit(original, 'first', win(handEditDraft(original, 'first'), 'new'));
    expect(result.events[0].type).toBe('win');
    expect(result.events[0].result?.isValid).toBe(true);
    expect(balances(result).players.b).toBeGreaterThan(25000);
  });
  it('rejects missing later scoring data without changing the original', () => {
    const original = draw(draw(game(), 'first', []), 'second', []);
    delete original.events[1].drawInput;
    const snapshot = structuredClone(original);
    expect(() =>
      finishHandEdit(original, 'first', draw(handEditDraft(original, 'first'), 'new', ['a'])),
    ).toThrow('missing scoring data');
    expect(original).toEqual(snapshot);
  });
  it('rejects an edit that would end the game before existing later hands', () => {
    const original = draw(draw(game(), 'first', []), 'second', []);
    const edited = draw(handEditDraft(original, 'first'), 'new', []);
    edited.ended = true;
    expect(() => finishHandEdit(original, 'first', edited)).toThrow('before a later recorded hand');
  });
});
