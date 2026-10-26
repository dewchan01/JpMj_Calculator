import type { Match } from '../../../../../../../packages/mahjong-core/ledger';
export interface PlayerStatistics {
  id: string;
  name: string;
  hands: number;
  wins: number;
  dealIns: number;
  winRate: number | null;
  dealInRate: number | null;
  averageWin: number | null;
  averageDealIn: number | null;
  averageTsumo: number | null;
  averageRon: number | null;
  tsumoCount: number;
  ronCount: number;
  riichiRate: number | null;
  openRate: number | null;
  tenpaiRate: number | null;
  averageStreak: number | null;
}
export interface ScorePoint {
  label: string;
  balances: Record<string, number>;
}
const handTypes = new Set(['win', 'multipleRon', 'exhaustiveDraw', 'nagashi']);
export function matchStatistics(match: Match): {
  players: PlayerStatistics[];
  points: ScorePoint[];
} {
  const balances = { ...match.initialBalances };
  const points: ScorePoint[] = [{ label: 'Start', balances: { ...balances } }];
  const state = match.players.map((player) => ({
    ...player,
    hands: 0,
    wins: 0,
    dealIns: 0,
    winPoints: 0,
    dealPoints: 0,
    tsumoCount: 0,
    tsumoPoints: 0,
    ronCount: 0,
    ronPoints: 0,
    observed: 0,
    openObserved: 0,
    riichi: 0,
    open: 0,
    draws: 0,
    tenpai: 0,
    streak: 0,
    streaks: [] as number[],
  }));
  let hand = 0;
  const deposits = new Set<string>();
  for (const event of match.events) {
    for (const payment of event.payments) {
      if (payment.from !== 'table') balances[payment.from] -= payment.amount;
      if (payment.to !== 'table') balances[payment.to] += payment.amount;
      if (event.type === 'riichiDeposit' && payment.to === 'table') deposits.add(payment.from);
    }
    if (!handTypes.has(event.type)) {
      if (event.type === 'abortiveDraw') {
        deposits.clear();
        for (const player of state) {
          if (player.streak) player.streaks.push(player.streak);
          player.streak = 0;
        }
      }
      if (event.type === 'matchEnd') points.push({ label: 'End', balances: { ...balances } });
      continue;
    }
    hand++;
    points.push({ label: String(hand), balances: { ...balances } });
    const inputs = event.scoringInputs ?? (event.scoringInput ? [event.scoringInput] : []);
    const wins = inputs.length ? inputs.map((input) => input.win) : event.win ? [event.win] : [];
    const winners = new Set(event.winnerIds ?? wins.map((win) => win.winnerId));
    const discarders = new Set(
      wins.filter((win) => win.method === 'ron').map((win) => win.discarderId),
    );
    const handPayments = event.payments.filter(
      (payment) =>
        payment.reason !== 'Final Yakitori penalty' &&
        payment.reason !== 'Final table escrow award',
    );
    for (const player of state) {
      player.hands++;
      const input = inputs.find((input) => input.win.winnerId === player.id);
      const live = event.liveBefore?.players[player.id];
      const recordedWin = wins.find((win) => win.winnerId === player.id);
      const known = !!event.liveBefore || !!input || !!recordedWin || deposits.has(player.id);
      if (known) {
        player.observed++;
        if (
          deposits.has(player.id) ||
          (live && live.riichi !== 'none') ||
          input?.win.riichi ||
          input?.win.doubleRiichi ||
          recordedWin?.riichi ||
          recordedWin?.doubleRiichi
        )
          player.riichi++;
      }
      if (event.liveBefore || input || (event.hand && recordedWin)) {
        player.openObserved++;
        if (
          (live?.melds ?? input?.hand.melds ?? event.hand?.melds ?? []).some(
            (meld) => meld.type !== 'ankan',
          )
        )
          player.open++;
      }
      if (event.type === 'exhaustiveDraw' && event.drawInput) {
        player.draws++;
        if (event.drawInput.tenpaiIds.includes(player.id)) player.tenpai++;
      }
      if (winners.has(player.id)) {
        player.wins++;
        player.streak++;
        const received = handPayments
          .filter((payment) => payment.to === player.id)
          .reduce((sum, payment) => sum + payment.amount, 0);
        player.winPoints += received;
        const method = wins.find((win) => win.winnerId === player.id)?.method;
        if (method === 'tsumo') {
          player.tsumoCount++;
          player.tsumoPoints += received;
        }
        if (method === 'ron') {
          player.ronCount++;
          player.ronPoints += received;
        }
      } else if (player.streak) {
        player.streaks.push(player.streak);
        player.streak = 0;
      }
      if (discarders.has(player.id)) {
        player.dealIns++;
        player.dealPoints += handPayments
          .filter((payment) => payment.from === player.id && winners.has(payment.to))
          .reduce((sum, payment) => sum + payment.amount, 0);
      }
    }
    deposits.clear();
  }
  const ratio = (value: number, count: number) => (count ? value / count : null);
  return {
    points,
    players: state.map((player) => {
      if (player.streak) player.streaks.push(player.streak);
      return {
        id: player.id,
        name: player.name,
        hands: player.hands,
        wins: player.wins,
        dealIns: player.dealIns,
        winRate: ratio(player.wins, player.hands),
        dealInRate: ratio(player.dealIns, player.hands),
        averageWin: ratio(player.winPoints, player.wins),
        averageDealIn: ratio(player.dealPoints, player.dealIns),
        averageTsumo: ratio(player.tsumoPoints, player.tsumoCount),
        averageRon: ratio(player.ronPoints, player.ronCount),
        tsumoCount: player.tsumoCount,
        ronCount: player.ronCount,
        riichiRate: ratio(player.riichi, player.observed),
        openRate: ratio(player.open, player.openObserved),
        tenpaiRate: ratio(player.tenpai, player.draws),
        averageStreak: ratio(
          player.streaks.reduce((sum, count) => sum + count, 0),
          player.streaks.length,
        ),
      };
    }),
  };
}
