import { describe, expect, it } from 'vitest';
import { matchStatistics } from './match-statistics';
import { presetRules } from '../../../../../../../packages/mahjong-rules/index';
import type { LedgerEvent, Match } from '../../../../../../../packages/mahjong-core/ledger';
import type { WinEvent } from '../../../../../../../packages/mahjong-core/index';
import { emptyLive } from '../../../../../../../packages/mahjong-core/live';
import { statisticText } from './statistics-image';
import { parseTiles } from '../../../../../../../packages/mahjong-core/index';

const rules = presetRules('mahjong-soul', 3);
function match(events: LedgerEvent[]): Match {
  return {
    id: 'stats',
    schemaVersion: 1,
    name: 'Statistics',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
    rules,
    playerCount: 3,
    players: [
      { id: 'a', name: 'Alice' },
      { id: 'b', name: 'Bob' },
      { id: 'c', name: 'Cara' },
    ],
    initialBalances: { a: 35000, b: 35000, c: 35000 },
    initialDealerId: 'a',
    dealerId: 'a',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    events,
  };
}
function win(winnerId: string, method: 'ron' | 'tsumo', discarderId?: string): WinEvent {
  return {
    winnerId,
    method,
    discarderId,
    winningTileId: 'tile',
    riichi: false,
    doubleRiichi: false,
    ippatsu: false,
    rinshan: false,
    chankan: false,
    haitei: false,
    houtei: false,
    tenhou: false,
    chiihou: false,
  };
}
function event(id: string, winner: string, amount: number): LedgerEvent {
  return {
    id,
    timestamp: '2026-01-01',
    type: 'win',
    win: win(winner, 'ron', 'b'),
    winnerIds: [winner],
    payments: [{ from: 'b', to: winner, amount, reason: 'Ron' }],
    liveBefore: emptyLive(),
  };
}
describe('match statistics', () => {
  it('counts completed hands rather than deposits, tracks streaks, draw Tenpai and exact score history', () => {
    const first = event('one', 'a', 8000);
    first.liveBefore!.players.a = { riichi: 'riichi', melds: [], kita: [] };
    const second = event('two', 'a', 4000);
    second.win = win('a', 'tsumo');
    second.payments = [
      { from: 'b', to: 'a', amount: 2000, reason: 'Tsumo' },
      { from: 'c', to: 'a', amount: 2000, reason: 'Tsumo' },
    ];
    const draw: LedgerEvent = {
      id: 'draw',
      timestamp: '2026-01-01',
      type: 'exhaustiveDraw',
      payments: [],
      liveBefore: emptyLive(),
      drawInput: {
        rules,
        players: match([]).players,
        dealerId: 'a',
        honba: 0,
        type: 'exhaustive',
        tenpaiIds: ['c'],
        nagashiIds: [],
        circumstancesConfirmed: true,
      },
    };
    const data = matchStatistics(match([first, second, draw, event('three', 'a', 2000)]));
    const alice = data.players[0];
    expect(alice.hands).toBe(4);
    expect(alice.winRate).toBe(0.75);
    expect(alice.averageWin).toBeCloseTo(14000 / 3);
    expect(alice.averageStreak).toBe(1.5);
    expect(alice.averageTsumo).toBe(4000);
    expect(alice.averageRon).toBe(5000);
    expect(alice.riichiRate).toBe(0.25);
    expect(data.players[1].dealInRate).toBe(0.5);
    expect(data.players[1].averageDealIn).toBe(5000);
    expect(data.players[2].tenpaiRate).toBe(1);
    expect(data.points.at(-1)?.balances).toEqual({ a: 49000, b: 23000, c: 33000 });
  });
  it('does not invent declarations or draw Tenpai for legacy records', () => {
    const legacy = event('legacy', 'a', 8000);
    delete legacy.liveBefore;
    const data = matchStatistics(match([legacy]));
    expect(data.players[1].riichiRate).toBeNull();
    expect(data.players[0].openRate).toBeNull();
    expect(data.players[0].tenpaiRate).toBeNull();
    expect(data.players[0].averageStreak).toBe(1);
  });
  it('includes deposits in balances but excludes deposit and abortive events from rate denominators', () => {
    const deposit: LedgerEvent = {
      id: 'deposit',
      timestamp: '2026-01-01',
      type: 'riichiDeposit',
      payments: [{ from: 'a', to: 'table', amount: 1000, reason: 'Riichi' }],
    };
    const outcome = event('win', 'a', 8000);
    outcome.payments.push({ from: 'table', to: 'a', amount: 1000, reason: 'Riichi pot' });
    const data = matchStatistics(
      match([
        deposit,
        { id: 'abort', timestamp: '2026-01-01', type: 'abortiveDraw', payments: [] },
        outcome,
      ]),
    );
    expect(data.players[0].hands).toBe(1);
    expect(data.players[0].averageWin).toBe(9000);
    expect(data.points.at(-1)?.balances.a).toBe(43000);
    const interrupted = matchStatistics(
      match([
        event('first', 'a', 1000),
        { id: 'abort', timestamp: '2026-01-01', type: 'abortiveDraw', payments: [] },
        event('second', 'a', 1000),
      ]),
    );
    expect(interrupted.players[0].averageStreak).toBe(1);
  });
  it('shows unavailable averages when no hand has been played', () => {
    const data = matchStatistics(match([]));
    expect(data.players[0].winRate).toBeNull();
    expect(data.players[0].averageWin).toBeNull();
    expect(data.points).toHaveLength(1);
  });
  it('distinguishes open melds from concealed Kan and preserves missing-data formatting', () => {
    const closed = event('closed', 'a', 1000);
    closed.liveBefore!.players.c = {
      riichi: 'none',
      kita: [],
      melds: [{ id: 'kan', type: 'ankan', tiles: parseTiles('1111p') }],
    };
    const open = event('open', 'a', 1000);
    open.liveBefore!.players.c = {
      riichi: 'none',
      kita: [],
      melds: [{ id: 'pon', type: 'pon', tiles: parseTiles('222p'), fromPlayerId: 'b' }],
    };
    expect(matchStatistics(match([closed, open])).players[2].openRate).toBe(0.5);
    expect(statisticText(null, 'points', 'en')).toBe('\u2014');
    expect(statisticText(0.125, 'percent', 'en')).toBe('12.5%');
  });
  it('counts a multiple Ron deal-in once and excludes final penalties from hand averages', () => {
    const source = match([]);
    const input = (id: string) => ({
      rules,
      players: source.players,
      dealerId: 'a',
      roundWind: 'east' as const,
      hand: { playerId: id, concealedTiles: [], melds: [], extractedNorthTiles: [] },
      win: win(id, 'ron', 'b'),
      honba: 0,
      riichiSticks: 0,
      doraIndicators: [],
      uraIndicators: [],
    });
    const multi: LedgerEvent = {
      id: 'multi',
      timestamp: '2026-01-01',
      type: 'multipleRon',
      winnerIds: ['a', 'c'],
      scoringInputs: [input('a'), input('c')],
      payments: [
        { from: 'b', to: 'a', amount: 8000, reason: 'Ron' },
        { from: 'b', to: 'c', amount: 4000, reason: 'Ron' },
        { from: 'b', to: 'a', amount: 1000, reason: 'Final Yakitori penalty' },
      ],
    };
    const data = matchStatistics(match([multi]));
    expect(data.players[1].dealIns).toBe(1);
    expect(data.players[1].averageDealIn).toBe(12000);
    expect(data.players[0].averageWin).toBe(8000);
    expect(data.points.at(-1)?.balances.b).toBe(22000);
  });
});
