import { describe, expect, it } from 'vitest';
import { analyzePlayer, analysisGroups } from './player-analysis';
import { leagueResemblance, mLeagueReference } from './m-league-reference';
import { presetRules, tableRules } from '../../../../../../../packages/mahjong-rules/index';
import {
  adjustFinalPoints,
  finalStandings,
} from '../../../../../../../packages/mahjong-core/final-results';
import { emptyLive } from '../../../../../../../packages/mahjong-core/live';
import { parseTiles, type WinEvent } from '../../../../../../../packages/mahjong-core/index';
import type { Match, LedgerEvent } from '../../../../../../../packages/mahjong-core/ledger';

const ids = ['a', 'b', 'c', 'd'];
function game(events: LedgerEvent[] = []): Match {
  return {
    id: 'analysis',
    schemaVersion: 1,
    name: 'Analysis',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
    playerCount: 4,
    rules: presetRules('custom', 4),
    ended: true,
    players: ids.map((id, index) => ({ id, name: ['Alice', 'Bob', 'Carol', 'Dana'][index] })),
    initialBalances: Object.fromEntries(ids.map((id) => [id, 25000])),
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
function event(
  id: string,
  state: 'dama' | 'riichi' | 'open',
  winners: WinEvent[] = [],
  amounts: number[] = [],
  others: Record<string, 'dama' | 'riichi' | 'open'> = {},
): LedgerEvent {
  const live = emptyLive();
  for (const player of ids) {
    const s = player === 'a' ? state : (others[player] ?? 'dama');
    live.players[player] = {
      riichi: s === 'riichi' ? 'riichi' : 'none',
      kita: [],
      melds:
        s === 'open'
          ? [{ id: 'pon', type: 'pon', tiles: parseTiles('111p'), fromPlayerId: 'd' }]
          : [],
    };
  }
  const wins = winners.map((w) => ({ ...w, riichi: live.players[w.winnerId].riichi === 'riichi' }));
  const payments = wins.flatMap((w, index) =>
    w.method === 'ron'
      ? [{ from: w.discarderId!, to: w.winnerId, amount: amounts[index], reason: 'Ron' }]
      : ids
          .filter((id) => id !== w.winnerId)
          .map((id) => ({ from: id, to: w.winnerId, amount: amounts[index] / 3, reason: 'Tsumo' })),
  );
  const e: LedgerEvent = {
    id,
    timestamp: '2026-01-01',
    type: wins.length > 1 ? 'multipleRon' : wins.length ? 'win' : 'exhaustiveDraw',
    liveBefore: live,
    payments,
    winnerIds: wins.map((w) => w.winnerId),
    win: wins.length === 1 ? wins[0] : undefined,
  };
  if (wins.length > 1)
    e.scoringInputs = wins.map((w) => ({
      rules: game().rules,
      players: game().players,
      dealerId: 'a',
      roundWind: 'east',
      hand: {
        playerId: w.winnerId,
        concealedTiles: [],
        melds: live.players[w.winnerId].melds,
        extractedNorthTiles: [],
      },
      win: w,
      honba: 0,
      riichiSticks: 0,
      doraIndicators: [],
      uraIndicators: [],
    }));
  if (!wins.length)
    e.drawInput = {
      rules: game().rules,
      players: game().players,
      dealerId: 'a',
      honba: 0,
      type: 'exhaustive',
      tenpaiIds: state === 'dama' ? [] : ['a'],
      nagashiIds: [],
      circumstancesConfirmed: true,
    };
  return e;
}
function richGame(): Match {
  return game([
    event('dama-win', 'dama', [win('a', 'ron', 'b')], [8000]),
    event('riichi-win', 'riichi', [win('a', 'tsumo')], [6000]),
    event('open-win', 'open', [win('a', 'ron', 'b')], [2000]),
    event('open-deal', 'open', [win('b', 'ron', 'a')], [4000], { b: 'riichi' }),
    event('open-draw', 'open'),
    event('dama-draw', 'dama'),
    event('riichi-draw', 'riichi'),
    event('multi', 'dama', [win('b', 'ron', 'a'), win('c', 'ron', 'a')], [5000, 2000], {
      c: 'open',
    }),
    event('riichi-deal', 'riichi', [win('b', 'ron', 'a')], [1000]),
  ]);
}
describe('player analysis', () => {
  it('calculates weighted state rates, draw Tenpai, receipts, and multi-Ron deal-ins', () => {
    const a = analyzePlayer([richGame()], 'Alice', 4);
    expect(a.hands).toHaveLength(9);
    for (const key of [
      'win',
      'deal',
      'open',
      'riichi',
      'winDama',
      'winRiichi',
      'winOpen',
      'dealDama',
      'dealRiichi',
      'dealOpen',
      'drawOpen',
      'drawRiichi',
    ])
      expect(a.metrics[key], key).toBeCloseTo(1 / 3);
    expect(a.metrics.ron).toBeCloseTo(2 / 9);
    expect(a.metrics.tsumo).toBeCloseTo(1 / 9);
    expect(a.metrics.averageWin).toBeCloseTo(16000 / 3);
    expect(a.metrics.averageRon).toBe(5000);
    expect(a.metrics.averageTsumo).toBe(6000);
    expect(a.metrics.averageDeal).toBe(4000);
    expect(a.metrics.averageDealDama).toBe(7000);
    expect(a.metrics.averageDealVsDama).toBe(3000);
    expect(a.metrics.averageDealVsOpen).toBe(2000);
    expect(a.metrics.averageDealVsRiichi).toBe(4000);
    expect(a.metrics.dealVsOpen).toBe(1);
    expect(a.metrics.dealVsRiichi).toBe(1);
    expect(a.metrics.tenpai).toBeCloseTo(2 / 3);
    expect(a.metrics.tenpaiDama).toBe(0);
    expect(a.metrics.tenpaiOpen).toBe(1);
    expect(a.distribution.reduce((sum, bin) => sum + bin.count, 0)).toBe(3);
  });
  it('uses unknowns for missing declarations, ignores corrections, and does not invent 4th place in 3P', () => {
    const legacy = game([
      { id: 'draw', timestamp: '2026-01-01', type: 'exhaustiveDraw', payments: [] },
      {
        id: 'correction',
        timestamp: '2026-01-02',
        type: 'scoreAdjustment',
        payments: [{ from: 'a', to: 'b', amount: 1000, reason: 'correction' }],
      },
    ]);
    const a = analyzePlayer([legacy], 'Alice', 4);
    expect(a.hands).toHaveLength(1);
    for (const key of [
      'open',
      'riichi',
      'tenpai',
      'averageWin',
      'winDama',
      'dealVsDama',
      'renchan',
      'stability',
    ])
      expect(a.metrics[key], key).toBeNull();
    const three = {
      ...legacy,
      playerCount: 3 as const,
      players: legacy.players.slice(0, 3),
      initialBalances: { a: 35000, b: 35000, c: 35000 },
      rules: presetRules('custom', 3),
    };
    const t = analyzePlayer([three], 'Alice', 3);
    expect(t.metrics.rank4).toBeNull();
    expect(t.metrics.avoid4).toBeNull();
    expect(t.histogram).toHaveLength(3);
  });
  it('preserves distinct currencies, calculates ranks/stability/chips, chemistry and seat totals', () => {
    const first = adjustFinalPoints(
      game(),
      { a: 40000, b: 30000, c: 20000, d: 10000 },
      'fix1',
      '2026-01-01',
    );
    const second = adjustFinalPoints(
      {
        ...game(),
        id: 'second',
        createdAt: '2026-01-02',
        rules: {
          ...game().rules,
          table: { ...tableRules(game().rules), currency: 'JPY', bettingRate: 1 },
        },
      },
      { a: 10000, b: 20000, c: 30000, d: 40000 },
      'fix2',
      '2026-01-02',
    );
    first.rules = {
      ...first.rules,
      table: { ...tableRules(first.rules), currency: 'USD', bettingRate: 1 },
    };
    first.events[0].chipDeltas = { a: 2, b: -2 };
    const a = analyzePlayer(
      [second, first, { ...first, id: 'unfinished', ended: false }],
      'Alice',
      4,
    );
    expect(a.games).toHaveLength(2);
    expect(a.metrics.averageRank).toBe(2.5);
    expect(a.metrics.variance).toBe(2.25);
    expect(a.metrics.stability).toBe(0);
    expect(a.metrics.totalPoints).toBe(0);
    expect(a.metrics.bestRaw).toBe(40000);
    expect(a.metrics.averagePoints).toBe(0);
    expect(a.metrics.bestPoints).toBe(15000);
    expect(a.metrics.totalChips).toBe(2);
    expect(a.metrics.averageChips).toBe(1);
    expect(a.metrics.averageScore).toBe(
      (finalStandings(first).find((r) => r.id === 'a')!.finalScore +
        finalStandings(second).find((r) => r.id === 'a')!.finalScore) /
        2,
    );
    expect(a.money.map((m) => m.currency).sort()).toEqual(['JPY', 'USD']);
    expect(a.chemistry.find((c) => c.name === 'Bob')).toMatchObject({
      games: 2,
      averageRank: 2.5,
      ahead: 0.5,
    });
    expect(a.seats[0].games).toBe(2);
    expect(a.seats.slice(1).every((s) => s.games === 0)).toBe(true);
  });
  it('treats concealed Kans as closed, and follows each hand’s dealer for seat analysis', () => {
    const first = event('ankan', 'dama', [win('b', 'tsumo')], [6000]);
    first.liveBefore!.players.a.melds = [{ id: 'kan', type: 'ankan', tiles: parseTiles('1111p') }];
    first.before = { dealerId: 'a', roundWind: 'east', handNumber: 1, honba: 0 };
    first.after = { ...first.before, dealerId: 'b', handNumber: 2 };
    const next = event('next', 'dama');
    next.before = { ...first.after };
    next.after = { ...next.before, dealerId: 'c' };
    const a = analyzePlayer([game([first, next])], 'Alice', 4);
    expect(a.hands[0].state).toBe('dama');
    expect(a.hands[1].seat).toBe(3);
    expect(a.metrics.dealerTsumo).toBe(1);
    expect(a.metrics.renchan).toBe(0);
  });
  it('counts actual additional dealer continuations rather than Honba or wins', () => {
    const first = event('repeat', 'dama');
    first.before = { dealerId: 'a', roundWind: 'east', handNumber: 1, honba: 0 };
    first.after = { ...first.before, honba: 1 };
    const second = event('pass', 'dama');
    second.before = first.after;
    second.after = { ...first.before, dealerId: 'b', handNumber: 2 };
    expect(analyzePlayer([game([first, second])], 'Alice', 4).metrics.renchan).toBe(1);
  });
  it('limits rank trend to 16 chronological games and compares the preceding block', () => {
    const games = Array.from({ length: 20 }, (_, index) => ({
      ...game(),
      id: String(index),
      createdAt: new Date(2026, 0, index + 1).toISOString(),
    }));
    const a = analyzePlayer(games.reverse(), 'Alice', 4);
    expect(a.recent).toHaveLength(16);
    expect(a.recent[0].match.id).toBe('4');
    expect(a.recent.at(-1)?.match.id).toBe('19');
    expect(a.trend.previousRank).not.toBeNull();
  });
  it('provides a value or explicit null for every requested grouped metric', () => {
    const a = analyzePlayer([richGame()], 'Alice', 4);
    for (const group of analysisGroups)
      for (const field of group.fields) expect(a.metrics[field.key], field.key).not.toBeUndefined();
  });
  it('gates league comparisons by data availability, and scores identical reference metrics at 100', () => {
    const a = analyzePlayer([richGame()], 'Alice', 4);
    expect(leagueResemblance(a)).toEqual([]);
    const ready = {
      ...a,
      hands: [...a.hands, ...a.hands, ...a.hands],
      metrics: {
        ...a.metrics,
        win: mLeagueReference.players[0].win,
        deal: mLeagueReference.players[0].deal,
        open: mLeagueReference.players[0].open,
        riichi: mLeagueReference.players[0].riichi,
        averageWin: mLeagueReference.players[0].averageWin,
      },
    };
    const result = leagueResemblance(ready);
    expect(result[0].name).toBe(mLeagueReference.players[0].name);
    expect(result[0].similarity).toBe(100);
    expect(leagueResemblance({ ...ready, count: 3 as const })).toEqual([]);
  });
});
