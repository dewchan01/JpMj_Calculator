import { appendEvent, balances, roundState, type Match } from './ledger';
import { tableRules } from '../mahjong-rules/index';

export interface FinalStanding {
  id: string;
  name: string;
  rank: number;
  points: number;
  pointScore: number;
  uma: number;
  oka: number;
  finalScore: number;
  chips: number;
  scoreMoney: number;
  chipMoney: number;
  totalMoney: number;
}

/** Corrections remain auditable and never rewrite the recorded hands. */
export function adjustFinalPoints(
  match: Match,
  points: Record<string, number>,
  eventId: string,
  timestamp: string,
): Match {
  if (!match.ended) throw new Error('Only completed games can be edited.');
  const current = balances(match);
  const ids = match.players.map((player) => player.id);
  if (
    Object.keys(points).length !== ids.length ||
    ids.some((id) => !Number.isSafeInteger(points[id]))
  )
    throw new Error('Enter integer points for every player.');
  if (
    ids.reduce((sum, id) => sum + points[id], 0) !==
    ids.reduce((sum, id) => sum + current.players[id], 0)
  )
    throw new Error('Total points must match the table total.');
  const deltas = ids.map((id) => ({ id, value: points[id] - current.players[id] }));
  const payments = [];
  for (const payer of deltas.filter((delta) => delta.value < 0)) {
    for (const receiver of deltas.filter((delta) => delta.value > 0)) {
      const amount = Math.min(-payer.value, receiver.value);
      if (!amount) continue;
      payments.push({ from: payer.id, to: receiver.id, amount, reason: 'Final score correction' });
      payer.value += amount;
      receiver.value -= amount;
    }
  }
  if (!payments.length) return match;
  return appendEvent(match, {
    id: eventId,
    timestamp,
    type: 'scoreAdjustment',
    payments,
    before: roundState(match),
    after: roundState(match),
  });
}

/** Money is derived from the immutable rule snapshot; it never changes the points ledger. */
export function finalStandings(match: Match): FinalStanding[] {
  const table = tableRules(match.rules);
  const book = balances(match);
  const chips = Object.fromEntries(match.players.map((player) => [player.id, 0]));
  for (const event of match.events) {
    const delta = event.chipDeltas ?? {};
    if (
      Object.values(delta).some((value) => !Number.isSafeInteger(value)) ||
      Object.values(delta).reduce((a, b) => a + b, 0) !== 0 ||
      Object.keys(delta).some((id) => !(id in chips))
    )
      throw new Error('Chip balances must reconcile.');
    for (const [id, value] of Object.entries(delta)) chips[id] += value;
  }
  const initial = match.players.findIndex((player) => player.id === match.initialDealerId);
  const order = (id: string) =>
    (match.players.findIndex((player) => player.id === id) - initial + match.playerCount) %
    match.playerCount;
  const players = [...match.players].sort(
    (a, b) => book.players[b.id] - book.players[a.id] || order(a.id) - order(b.id),
  );
  const oka =
    (table.returnPoints * match.playerCount -
      Object.values(match.initialBalances).reduce((sum, value) => sum + value, 0)) /
    1000;
  const rows = players.map((player, index): FinalStanding => {
    const firstTie = players.findIndex(
      (other) => book.players[other.id] === book.players[player.id],
    );
    const tied = players.filter(
      (other) => book.players[other.id] === book.players[player.id],
    ).length;
    const share = table.tiedRanks === 'share';
    const uma = share
      ? table.uma.slice(firstTie, firstTie + tied).reduce((a, b) => a + b, 0) / tied
      : table.uma[index];
    const playerOka = share ? (firstTie === 0 ? oka / tied : 0) : index === 0 ? oka : 0;
    const raw = (book.players[player.id] - table.returnPoints) / 1000 + uma + playerOka;
    const finalScore =
      table.rounding === 'nearest'
        ? Math.round(raw)
        : table.rounding === 'floor'
          ? Math.floor(raw)
          : table.rounding === 'ceil'
            ? Math.ceil(raw)
            : raw;
    return {
      ...player,
      rank: (share ? firstTie : index) + 1,
      points: book.players[player.id],
      pointScore: (book.players[player.id] - table.returnPoints) / 1000,
      uma,
      oka: playerOka,
      finalScore,
      chips: chips[player.id],
      scoreMoney: 0,
      chipMoney: 0,
      totalMoney: 0,
    };
  });
  if (table.rounding !== 'none')
    rows[0].finalScore -= rows.reduce((sum, row) => sum + row.finalScore, 0);
  const cents = (value: number) => Math.round(value * 100);
  const allocate = (values: number[]) => {
    const rounded = values.map(cents);
    rounded[0] -= rounded.reduce((a, b) => a + b, 0);
    return rounded.map((value) => value / 100);
  };
  const scoreMoney = allocate(rows.map((row) => row.finalScore * table.bettingRate));
  const chipMoney = allocate(rows.map((row) => row.chips * table.chipValue));
  rows.forEach((row, index) => {
    row.scoreMoney = scoreMoney[index];
    row.chipMoney = chipMoney[index];
    row.totalMoney = (cents(row.scoreMoney) + cents(row.chipMoney)) / 100;
  });
  return rows;
}
