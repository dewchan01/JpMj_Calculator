import { finalStandings } from '../../../../../../../packages/mahjong-core/final-results';
import type { Match, LedgerEvent } from '../../../../../../../packages/mahjong-core/ledger';
import { tableRules } from '../../../../../../../packages/mahjong-rules/index';
import { playerIdentities, playerIdentity } from '../player-identity';

export type HandState = 'dama' | 'riichi' | 'open';
export interface HandSample {
  state: HandState | null;
  riichi: boolean | null;
  open: boolean | null;
  win: boolean | null;
  method?: 'ron' | 'tsumo';
  winScore: number | null;
  deal: boolean | null;
  dealScore: number | null;
  draw: boolean;
  tenpai: boolean | null;
  seat: number;
  dealer: boolean;
  dealerTsumo: boolean | null;
  repeats: boolean | null;
  opponents: Partial<Record<HandState, boolean>>;
  dealTo: Partial<Record<HandState, number>>;
  dealTargetKnown: boolean;
}
export interface GameSample {
  match: Match;
  playerId: string;
  rank: number;
  raw: number;
  net: number;
  score: number;
  chips: number;
  money: number;
  currency: string;
  seat: number;
}
export interface AnalysisMetric {
  key: string;
  label: string;
  format: 'number' | 'percent' | 'points' | 'money';
}
export const analysisGroups: { label: string; fields: AnalysisMetric[] }[] = [
  {
    label: 'Basic stats',
    fields: [
      ['games', 'Game count', 'number'],
      ['averageScore', 'Average score', 'number'],
      ['bestRaw', 'Best raw score', 'points'],
      ['totalPoints', 'Total points', 'points'],
      ['averagePoints', 'Average points', 'points'],
      ['bestPoints', 'Best points', 'points'],
      ['totalChips', 'Total chips', 'number'],
      ['averageChips', 'Average chips', 'number'],
    ].map(metric),
  },
  {
    label: 'Rank stats',
    fields: [
      ['averageRank', 'Average rank', 'number'],
      ['top2', 'Top 2 rate', 'percent'],
      ['bottom2', 'Bottom 2 rate', 'percent'],
      ['rank1', '1st rate', 'percent'],
      ['rank2', '2nd rate', 'percent'],
      ['rank3', '3rd rate', 'percent'],
      ['rank4', '4th rate', 'percent'],
      ['bust', 'Bust rate', 'percent'],
      ['avoid4', '4th avoidance rate', 'percent'],
    ].map(metric),
  },
  {
    label: 'Key rates',
    fields: [
      ['win', 'Win rate', 'percent'],
      ['deal', 'Deal-in rate', 'percent'],
      ['open', 'Open hand rate', 'percent'],
      ['riichi', 'Riichi rate', 'percent'],
      ['plus', 'Plus rate', 'percent'],
      ['minus', 'Minus rate', 'percent'],
    ].map(metric),
  },
  {
    label: 'Win states',
    fields: [
      ['ron', 'Ron rate', 'percent'],
      ['tsumo', 'Tsumo rate', 'percent'],
      ['winDama', 'Win rate (Dama)', 'percent'],
      ['winRiichi', 'Win rate (Riichi)', 'percent'],
      ['winOpen', 'Win rate (Open)', 'percent'],
    ].map(metric),
  },
  {
    label: 'Win score',
    fields: [
      ['averageWin', 'Average win score', 'points'],
      ['averageRon', 'Average Ron score', 'points'],
      ['averageTsumo', 'Average Tsumo score', 'points'],
      ['averageWinDama', 'Average win score (Dama)', 'points'],
      ['averageWinRiichi', 'Average win score (Riichi)', 'points'],
      ['averageWinOpen', 'Average win score (Open)', 'points'],
    ].map(metric),
  },
  {
    label: 'Deal-in stats',
    fields: [
      ['dealDama', 'Deal-in rate (Dama)', 'percent'],
      ['dealRiichi', 'Deal-in rate (Riichi)', 'percent'],
      ['dealOpen', 'Deal-in rate (Open)', 'percent'],
      ['dealVsDama', 'Deal-in rate (vs Dama)', 'percent'],
      ['dealVsRiichi', 'Deal-in rate (vs Riichi)', 'percent'],
      ['dealVsOpen', 'Deal-in rate (vs Open)', 'percent'],
    ].map(metric),
  },
  {
    label: 'Deal-in score',
    fields: [
      ['averageDeal', 'Average deal-in score', 'points'],
      ['averageDealDama', 'Average deal-in score (Dama)', 'points'],
      ['averageDealRiichi', 'Average deal-in score (Riichi)', 'points'],
      ['averageDealOpen', 'Average deal-in score (Open)', 'points'],
      ['averageDealVsDama', 'Average deal-in score (vs Dama)', 'points'],
      ['averageDealVsRiichi', 'Average deal-in score (vs Riichi)', 'points'],
      ['averageDealVsOpen', 'Average deal-in score (vs Open)', 'points'],
    ].map(metric),
  },
  {
    label: 'Meld stats',
    fields: [
      ['winOpen', 'Open win rate', 'percent'],
      ['dealOpen', 'Deal-in rate (Open)', 'percent'],
      ['drawOpen', 'Draw rate (Open)', 'percent'],
    ].map(metric),
  },
  {
    label: 'Riichi stats',
    fields: [
      ['winRiichi', 'Riichi win rate', 'percent'],
      ['dealRiichi', 'Deal-in rate (Riichi)', 'percent'],
      ['drawRiichi', 'Draw rate (Riichi)', 'percent'],
    ].map(metric),
  },
  {
    label: 'Dealer stats',
    fields: [
      ['renchan', 'Average Renchan', 'number'],
      ['dealerTsumo', 'Dealer Tsumo payment rate', 'percent'],
    ].map(metric),
  },
  {
    label: 'Tenpai stats',
    fields: [
      ['tenpai', 'Tenpai rate (Draw)', 'percent'],
      ['tenpaiDama', 'Tenpai rate (Dama draw)', 'percent'],
      ['tenpaiOpen', 'Tenpai rate (Open draw)', 'percent'],
    ].map(metric),
  },
];
function metric([key, label, format]: string[]): AnalysisMetric {
  return { key, label, format: format as AnalysisMetric['format'] };
}
const resolved = new Set(['win', 'multipleRon', 'exhaustiveDraw', 'nagashi']);
const states: HandState[] = ['dama', 'riichi', 'open'];
export const mean = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const ratio = (yes: number, total: number): number | null => (total ? yes / total : null);
const rate = (values: (boolean | null)[]): number | null => {
  const known = values.filter((value) => value !== null);
  return ratio(known.filter(Boolean).length, known.length);
};

function declarations(event: LedgerEvent, id: string, deposits: Set<string>) {
  const inputs = event.scoringInputs ?? (event.scoringInput ? [event.scoringInput] : []);
  const input = inputs.find((input) => input.win.winnerId === id);
  const win = input?.win ?? (event.win?.winnerId === id ? event.win : undefined);
  const live = event.liveBefore?.players[id];
  const melds =
    live?.melds ??
    input?.hand.melds ??
    (event.win?.winnerId === id ? event.hand?.melds : undefined);
  const riichi =
    deposits.has(id) || (live && live.riichi !== 'none') || win?.riichi || win?.doubleRiichi
      ? true
      : event.liveBefore || win
        ? false
        : null;
  const open = melds
    ? melds.some((meld) => meld.type !== 'ankan')
    : event.liveBefore
      ? false
      : null;
  const state: HandState | null = riichi
    ? 'riichi'
    : open
      ? 'open'
      : riichi === false && open === false
        ? 'dama'
        : null;
  return { riichi, open, state, win };
}

export function handSamples(match: Match, id: string): HandSample[] {
  const samples: HandSample[] = [];
  const deposits = new Set<string>();
  let dealerId: string | undefined = match.initialDealerId;
  for (const event of match.events) {
    if (event.type === 'riichiDeposit') {
      event.payments
        .filter((payment) => payment.to === 'table')
        .forEach((payment) => deposits.add(payment.from));
      continue;
    }
    if (!resolved.has(event.type)) {
      if (event.type === 'abortiveDraw') deposits.clear();
      continue;
    }
    const dealer =
      event.before?.dealerId ??
      event.scoringInput?.dealerId ??
      event.drawInput?.dealerId ??
      dealerId;
    const index = match.players.findIndex((player) => player.id === id);
    const dealerIndex = match.players.findIndex((player) => player.id === dealer);
    const self = declarations(event, id, deposits);
    const inputs = event.scoringInputs ?? (event.scoringInput ? [event.scoringInput] : []);
    const wins = inputs.length ? inputs.map((input) => input.win) : event.win ? [event.win] : [];
    const winners = new Set(event.winnerIds ?? wins.map((win) => win.winnerId));
    const won = winners.has(id);
    const method = wins.find((win) => win.winnerId === id)?.method;
    const winKnown = winners.size > 0 || event.type === 'exhaustiveDraw';
    const dealKnown =
      event.type === 'exhaustiveDraw' ||
      event.type === 'nagashi' ||
      (wins.length > 0 && wins.every((win) => win.method === 'tsumo' || !!win.discarderId));
    const deal = wins.some((win) => win.method === 'ron' && win.discarderId === id);
    const payments = event.payments.filter(
      (payment) => !['Final Yakitori penalty', 'Final table escrow award'].includes(payment.reason),
    );
    const incoming = payments
      .filter((payment) => payment.to === id)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const outgoing = payments
      .filter((payment) => payment.from === id && winners.has(payment.to))
      .reduce((sum, payment) => sum + payment.amount, 0);
    const opponents: HandSample['opponents'] = {};
    const dealTo: HandSample['dealTo'] = {};
    for (const opponent of match.players.filter((player) => player.id !== id)) {
      const state = declarations(event, opponent.id, deposits).state;
      if (!state) continue;
      opponents[state] = true;
      if (
        wins.some(
          (win) => win.method === 'ron' && win.discarderId === id && win.winnerId === opponent.id,
        )
      )
        dealTo[state] =
          (dealTo[state] ?? 0) +
          payments
            .filter((payment) => payment.from === id && payment.to === opponent.id)
            .reduce((sum, payment) => sum + payment.amount, 0);
    }
    samples.push({
      state: self.state,
      riichi: self.riichi,
      open: self.open,
      win: winKnown ? won : null,
      method,
      winScore: won && incoming > 0 ? incoming : null,
      deal: dealKnown ? deal : null,
      dealScore: deal && outgoing > 0 ? outgoing : null,
      draw: event.type === 'exhaustiveDraw',
      tenpai:
        event.type === 'exhaustiveDraw' && event.drawInput
          ? event.drawInput.tenpaiIds.includes(id)
          : null,
      dealer: dealer === id,
      seat: dealerIndex < 0 ? -1 : (index - dealerIndex + match.playerCount) % match.playerCount,
      dealerTsumo: dealKnown
        ? wins.some((win) => win.method === 'tsumo' && win.winnerId !== id)
        : null,
      repeats:
        event.before && event.after
          ? event.before.dealerId === event.after.dealerId && !event.after.ended
          : null,
      opponents,
      dealTo,
      dealTargetKnown: wins
        .filter((win) => win.method === 'ron' && win.discarderId === id)
        .every((win) => declarations(event, win.winnerId, deposits).state !== null),
    });
    dealerId = event.after?.dealerId;
    deposits.clear();
  }
  return samples;
}

export function analyzePlayer(matches: Match[], identity: string, count: 3 | 4) {
  const identities = playerIdentities(matches);
  const name = identities.find((player) => player.id === identity)?.name ?? identity;
  const games: GameSample[] = [];
  const hands: HandSample[] = [];
  for (const match of matches
    .filter((match) => match.ended && match.playerCount === count)
    .sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id),
    )) {
    const player = match.players.find((player) => playerIdentity(match, player) === identity);
    if (!player) continue;
    const standing = finalStandings(match).find((row) => row.id === player.id)!;
    games.push({
      match,
      playerId: player.id,
      rank: standing.rank,
      raw: standing.points,
      net: standing.points - match.initialBalances[player.id],
      score: standing.finalScore,
      chips: standing.chips,
      money: standing.totalMoney,
      currency: tableRules(match.rules).currency,
      seat:
        (match.players.indexOf(player) -
          match.players.findIndex((player) => player.id === match.initialDealerId) +
          count) %
        count,
    });
    hands.push(...handSamples(match, player.id));
  }
  const n = games.length;
  const sum = (key: 'net' | 'score' | 'chips') =>
    games.reduce((total, game) => total + game[key], 0);
  const averageRank = mean(games.map((game) => game.rank));
  const variance = mean(games.map((game) => (game.rank - (averageRank ?? 0)) ** 2));
  const metrics: Record<string, number | null> = {
    games: n,
    averageScore: mean(games.map((game) => game.score)),
    bestRaw: n ? Math.max(...games.map((game) => game.raw)) : null,
    totalPoints: sum('net'),
    averagePoints: ratio(sum('net'), n),
    bestPoints: n ? Math.max(...games.map((game) => game.net)) : null,
    totalChips: sum('chips'),
    averageChips: ratio(sum('chips'), n),
    averageRank,
    top2: rate(games.map((game) => game.rank <= 2)),
    bottom2: rate(games.map((game) => game.rank > count - 2)),
    bust: rate(games.map((game) => game.raw < 0)),
    avoid4: count === 4 ? rate(games.map((game) => game.rank !== 4)) : null,
    plus: rate(games.map((game) => game.score > 0)),
    minus: rate(games.map((game) => game.score < 0)),
    win: rate(hands.map((hand) => hand.win)),
    deal: rate(hands.map((hand) => hand.deal)),
    open: rate(hands.map((hand) => hand.open)),
    riichi: rate(hands.map((hand) => hand.riichi)),
    ron: rate(
      hands.map((hand) =>
        hand.win === null ? null : hand.method ? hand.method === 'ron' : hand.win ? null : false,
      ),
    ),
    tsumo: rate(
      hands.map((hand) =>
        hand.win === null ? null : hand.method ? hand.method === 'tsumo' : hand.win ? null : false,
      ),
    ),
    averageWin: mean(hands.flatMap((hand) => (hand.winScore === null ? [] : [hand.winScore]))),
    averageRon: mean(
      hands.flatMap((hand) =>
        hand.method === 'ron' && hand.winScore !== null ? [hand.winScore] : [],
      ),
    ),
    averageTsumo: mean(
      hands.flatMap((hand) =>
        hand.method === 'tsumo' && hand.winScore !== null ? [hand.winScore] : [],
      ),
    ),
    averageDeal: mean(hands.flatMap((hand) => (hand.dealScore === null ? [] : [hand.dealScore]))),
    tenpai: rate(hands.map((hand) => hand.tenpai)),
    dealerTsumo: rate(hands.filter((hand) => hand.dealer).map((hand) => hand.dealerTsumo)),
    variance,
    stability:
      n < 2 || variance === null
        ? null
        : Math.max(0, 100 * (1 - variance / ((count - 1) ** 2 / 4))),
  };
  for (let rank = 1; rank <= 4; rank++)
    metrics['rank' + rank] = rank > count ? null : rate(games.map((game) => game.rank === rank));
  for (const state of states) {
    const suffix = state[0].toUpperCase() + state.slice(1);
    const own = hands.filter((hand) => hand.state === state);
    metrics['win' + suffix] = rate(own.map((hand) => hand.win));
    metrics['deal' + suffix] = rate(own.map((hand) => hand.deal));
    metrics['draw' + suffix] = rate(own.map((hand) => hand.draw));
    metrics['averageWin' + suffix] = mean(
      own.flatMap((hand) => (hand.winScore === null ? [] : [hand.winScore])),
    );
    metrics['averageDeal' + suffix] = mean(
      own.flatMap((hand) => (hand.dealScore === null ? [] : [hand.dealScore])),
    );
    metrics['tenpai' + suffix] = rate(own.map((hand) => hand.tenpai));
    const exposed = hands.filter((hand) => hand.opponents[state]);
    metrics['dealVs' + suffix] = rate(
      exposed.map((hand) =>
        hand.deal === null
          ? null
          : hand.dealTo[state] !== undefined
            ? true
            : !hand.dealTargetKnown
              ? null
              : false,
      ),
    );
    metrics['averageDealVs' + suffix] = mean(
      hands.flatMap((hand) => (hand.dealTo[state] === undefined ? [] : [hand.dealTo[state]!])),
    );
  }
  const runs: number[] = [];
  for (const game of games) {
    let currentDealer = '';
    let repeats = 0;
    let observed = false;
    for (const event of game.match.events.filter(
      (event) => resolved.has(event.type) || event.type === 'abortiveDraw',
    )) {
      if (!event.before || !event.after) continue;
      if (event.before.dealerId !== game.playerId) continue;
      if (currentDealer && currentDealer !== event.before.dealerId) {
        runs.push(repeats);
        repeats = 0;
      }
      currentDealer = event.before.dealerId;
      observed = true;
      if (event.after.dealerId === game.playerId && !event.after.ended) repeats++;
      else {
        runs.push(repeats);
        repeats = 0;
        observed = false;
        currentDealer = '';
      }
    }
    if (observed) runs.push(repeats);
  }
  metrics.renchan = mean(runs);
  const money = [...new Set(games.map((game) => game.currency))].map((currency) => {
    const values = games.filter((game) => game.currency === currency).map((game) => game.money);
    return {
      currency,
      games: values.length,
      total: values.reduce((a, b) => a + b, 0),
      average: mean(values)!,
    };
  });
  const chemistry = [
    ...new Set(
      games.flatMap((game) =>
        game.match.players.map((player) => playerIdentity(game.match, player)),
      ),
    ),
  ]
    .filter((other) => other !== identity)
    .map((other) => {
      const shared = games.filter((game) =>
        game.match.players.some((player) => playerIdentity(game.match, player) === other),
      );
      return {
        id: other,
        name: identities.find((player) => player.id === other)?.name ?? other,
        games: shared.length,
        averageRank: mean(shared.map((game) => game.rank)),
        averageScore: mean(shared.map((game) => game.score)),
        ahead: rate(
          shared.map(
            (game) =>
              game.rank <
              finalStandings(game.match).find(
                (row) =>
                  row.id ===
                  game.match.players.find((player) => playerIdentity(game.match, player) === other)!
                    .id,
              )!.rank,
          ),
        ),
      };
    })
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
  const seats = Array.from({ length: count }, (_, seat) => {
    const seated = games.filter((game) => game.seat === seat);
    const seatedHands = hands.filter((hand) => hand.seat === seat);
    return {
      seat,
      games: seated.length,
      averageRank: mean(seated.map((game) => game.rank)),
      hands: seatedHands.length,
      winRate: rate(seatedHands.map((hand) => hand.win)),
      dealRate: rate(seatedHands.map((hand) => hand.deal)),
    };
  });
  const histogram = Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    count: games.filter((game) => game.rank === index + 1).length,
  }));
  const limits = [2000, 4000, 8000, 12000, 18000, Infinity];
  const distribution = limits.map((limit, index) => ({
    lower: index ? limits[index - 1] : 0,
    upper: limit,
    count: hands.filter(
      (hand) =>
        hand.winScore !== null &&
        hand.winScore >= (index ? limits[index - 1] : 0) &&
        hand.winScore < limit,
    ).length,
  }));
  const recent = games.slice(-16);
  const previous = games.slice(-32, -16);
  const trend = {
    recentRank: mean(recent.map((game) => game.rank)),
    previousRank: mean(previous.map((game) => game.rank)),
    recentScore: mean(recent.map((game) => game.score)),
    previousScore: mean(previous.map((game) => game.score)),
  };
  return {
    name,
    count,
    games,
    hands,
    metrics,
    money,
    chemistry,
    seats,
    histogram,
    distribution,
    recent,
    trend,
  };
}
export type PlayerAnalysis = ReturnType<typeof analyzePlayer>;
