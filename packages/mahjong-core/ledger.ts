import type { Payment, PlayerCount, ScoreResult, WinEvent, Hand, Wind } from './index';
import type { RuleProfile } from '../mahjong-rules/index';
import type { ScoringInput } from '../mahjong-scoring/types';
import type { DrawInput, RoundSettlement } from '../mahjong-scoring/rounds';
export interface RoundState {
  dealerId: string;
  roundWind: Wind;
  handNumber: number;
  honba: number;
  ended?: boolean;
  endReason?: string;
}
export interface LedgerEvent {
  id: string;
  timestamp: string;
  type: 'win' | 'multipleRon' | 'exhaustiveDraw' | 'abortiveDraw' | 'nagashi' | 'riichiDeposit';
  payments: Payment[];
  result?: ScoreResult;
  hand?: Hand;
  win?: WinEvent;
  roundWind?: Wind;
  scoringInput?: ScoringInput;
  scoringInputs?: ScoringInput[];
  results?: ScoreResult[];
  drawInput?: DrawInput;
  before?: RoundState;
  after?: RoundState;
  winnerIds?: string[];
}
export interface Match {
  id: string;
  schemaVersion: 1;
  createdAt: string;
  updatedAt: string;
  name: string;
  playerCount: PlayerCount;
  rules: RuleProfile;
  players: { id: string; name: string }[];
  initialBalances: Record<string, number>;
  initialDealerId: string;
  dealerId: string;
  events: LedgerEvent[];
  roundWind: Wind;
  handNumber: number;
  honba: number;
  gameLength?: 'east' | 'south';
  ended?: boolean;
  endReason?: string;
}
export function balances(match: Match): { players: Record<string, number>; table: number } {
  const players = { ...match.initialBalances };
  let table = 0;
  const seen = new Set<string>();
  for (const event of match.events) {
    if (seen.has(event.id)) throw new Error('Duplicate settlement event.');
    seen.add(event.id);
    for (const p of event.payments) {
      if (!Number.isSafeInteger(p.amount) || p.amount < 0)
        throw new Error('Payment must be nonnegative integer points.');
      if ((p.from !== 'table' && !(p.from in players)) || (p.to !== 'table' && !(p.to in players)))
        throw new Error('Unknown ledger account.');
      if (p.from === 'table') table -= p.amount;
      else players[p.from] -= p.amount;
      if (p.to === 'table') table += p.amount;
      else players[p.to] += p.amount;
      if (table < 0) throw new Error('Cannot award an unfunded riichi pot. Record deposits first.');
    }
  }
  if (
    Object.values(players).reduce((n, x) => n + x, 0) + table !==
    Object.values(match.initialBalances).reduce((n, x) => n + x, 0)
  )
    throw new Error('Ledger does not reconcile.');
  return { players, table };
}
export function appendEvent(match: Match, event: LedgerEvent): Match {
  if (match.events.some((e) => e.id === event.id))
    throw new Error('This event is already settled.');
  if (event.type === 'win' && (!event.result?.isValid || !event.payments.length))
    throw new Error('Only a validated win can be settled.');
  const updated = {
    ...match,
    ...event.after,
    events: [...match.events, event],
    updatedAt: event.timestamp,
  };
  balances(updated);
  return updated;
}
export function undoLastEvent(match: Match): Match {
  const last = match.events.at(-1);
  const updated = {
    ...match,
    ...last?.before,
    ended: last?.before?.ended ?? false,
    endReason: last?.before?.endReason,
    events: match.events.slice(0, -1),
    updatedAt: new Date().toISOString(),
  };
  balances(updated);
  return updated;
}
export function roundState(match: Match): RoundState {
  return {
    dealerId: match.dealerId,
    roundWind: match.roundWind,
    handNumber: match.handNumber,
    honba: match.honba,
    ended: match.ended ?? false,
    endReason: match.endReason,
  };
}
/** Settlement, progression and any final escrow award are one reversible ledger event. */
export function settleRound(
  match: Match,
  event: LedgerEvent,
  outcome: RoundSettlement,
  current = roundState(match),
): Match {
  if (match.ended) throw new Error('This match has ended. Undo its last event to reopen it.');
  if (!outcome.isValid) throw new Error('Invalid round settlement.');
  if (
    !match.players.some((p) => p.id === current.dealerId) ||
    !['east', 'south', 'west', 'north'].includes(current.roundWind) ||
    !Number.isInteger(current.handNumber) ||
    current.handNumber < 1 ||
    current.handNumber > match.playerCount ||
    !Number.isInteger(current.honba) ||
    current.honba < 0 ||
    current.honba > 100
  )
    throw new Error('Enter a valid dealer, round, hand number and honba.');
  const before = roundState(match);
  const after = { ...current, ended: false, endReason: undefined as string | undefined };
  const pending = { ...event, payments: [...outcome.payments], before, after };
  const scored = appendEvent(match, pending);
  const book = balances(scored);
  const target = match.playerCount === 3 ? 40000 : 30000;
  const winds: Wind[] = ['east', 'south', 'west', 'north'];
  const index = winds.indexOf(current.roundWind);
  const lastRegular = match.gameLength === 'east' ? 0 : 1;
  const isAllLast = index >= lastRegular && current.handNumber === match.playerCount;
  const leader = [...match.players].sort(
    (a, b) =>
      book.players[b.id] - book.players[a.id] ||
      match.players.indexOf(a) - match.players.indexOf(b),
  )[0].id;
  const threshold = Object.values(book.players).some((value) => value >= target);
  if (match.rules.preset === 'm-league') {
    // No bankruptcy, extension or first-place dealer finish in the league format.
    if (index >= 1 && current.handNumber === 4 && !outcome.dealerRepeats) {
      after.ended = true;
      after.endReason = 'Match complete';
    }
  } else if (Object.values(book.players).some((value) => value < 0)) {
    after.ended = true;
    after.endReason = 'Bankruptcy';
  } else if (
    (isAllLast || index > lastRegular) &&
    outcome.dealerRepeats &&
    outcome.outcome !== 'abortiveDraw' &&
    leader === current.dealerId &&
    book.players[leader] >= target
  ) {
    after.ended = true;
    after.endReason = 'Dealer finish in first place';
  } else if (
    !outcome.dealerRepeats &&
    ((index > lastRegular && threshold) ||
      (isAllLast && threshold) ||
      (index > lastRegular && current.handNumber === match.playerCount))
  ) {
    after.ended = true;
    after.endReason = 'Match complete';
  }
  if (!after.ended && outcome.dealerRepeats) after.honba = current.honba + 1;
  else if (!after.ended) {
    after.dealerId =
      match.players[
        (match.players.findIndex((p) => p.id === current.dealerId) + 1) % match.playerCount
      ].id;
    after.honba = outcome.outcome === 'win' ? 0 : current.honba + 1;
    after.handNumber = (current.handNumber % match.playerCount) + 1;
    if (current.handNumber === match.playerCount) after.roundWind = winds[Math.min(index + 1, 3)];
  }
  if (after.ended && book.table && match.rules.preset === 'm-league') {
    const leaders = match.players.filter(
      (player) => book.players[player.id] === book.players[leader],
    );
    leaders.forEach((player, index) =>
      pending.payments.push({
        from: 'table',
        to: player.id,
        amount:
          leaders.length === 3
            ? book.table * (index === 0 ? 0.4 : 0.3)
            : book.table / leaders.length,
        reason: 'Final table escrow award',
      }),
    );
  } else if (after.ended && book.table)
    pending.payments.push({
      from: 'table',
      to: leader,
      amount: book.table,
      reason: 'Final table escrow award',
    });
  return appendEvent(match, pending);
}
