import { kindIndex, parseTiles, type Meld, type Tile } from './index';
import { appendEvent, balances, type Match } from './ledger';
import { tableRules, ruleSettings } from '../mahjong-rules/index';

export interface GameClock {
  elapsedMs: number;
  runningSince: string | null;
  handStartMs: number;
}
export interface LivePlayer {
  melds: Meld[];
  kita: Tile[];
  riichi: 'none' | 'riichi' | 'double';
  riichiCalls?: number;
}
export interface LiveHand {
  players: Record<string, LivePlayer>;
  dora: string;
  ura: string;
  calls: number;
  waremePlayerId?: string;
  actions?: { type: string; playerId?: string; timestamp: string; elapsedMs: number }[];
}
export function emptyLive(): LiveHand {
  return { players: {}, dora: '', ura: '', calls: 0 };
}
/** Remember only this hand's edits; never rewind the clock or settled hands. */
export function rememberLiveAction(previous: Match, updated: Match): Match {
  return {
    ...updated,
    liveUndo: [
      ...(previous.liveUndo ?? []),
      {
        live: structuredClone(initialLive(previous)),
        eventCount: previous.events.length,
        events: structuredClone(previous.events),
      },
    ].slice(-30),
  };
}
export function undoLiveAction(match: Match): Match {
  const previous = match.liveUndo?.at(-1);
  if (!previous || match.ended) throw new Error('No action to undo.');
  if (
    previous.events &&
    JSON.stringify(previous.events.filter((e) => e.type !== 'riichiDeposit').map((e) => e.id)) !==
      JSON.stringify(match.events.filter((e) => e.type !== 'riichiDeposit').map((e) => e.id))
  )
    throw new Error('No action to undo.');
  if (match.events.slice(previous.eventCount).some((e) => e.type !== 'riichiDeposit'))
    throw new Error('No action to undo.');
  return {
    ...match,
    live: structuredClone(previous.live),
    events: previous.events
      ? structuredClone(previous.events)
      : match.events.slice(0, previous.eventCount),
    liveUndo: match.liveUndo!.slice(0, -1),
  };
}
export function initialLive(match: Match): LiveHand {
  if (match.live) return structuredClone(match.live);
  const live = emptyLive();
  let last = -1;
  match.events.forEach((event, index) => {
    if (event.type !== 'riichiDeposit') last = index;
  });
  for (const event of match.events.slice(last + 1))
    for (const payment of event.payments) {
      if (payment.to === 'table' && match.players.some((p) => p.id === payment.from))
        live.players[payment.from] = { melds: [], kita: [], riichi: 'riichi', riichiCalls: 0 };
    }
  return live;
}
export function livePlayer(match: Match, id: string): LivePlayer {
  return match.live?.players[id] ?? { melds: [], kita: [], riichi: 'none' };
}
export function elapsedMs(clock: GameClock | undefined, now = Date.now()): number {
  return clock
    ? clock.elapsedMs + (clock.runningSince ? Math.max(0, now - Date.parse(clock.runningSince)) : 0)
    : 0;
}
export function clockAt(clock: GameClock, running: boolean, now = Date.now()): GameClock {
  return {
    ...clock,
    elapsedMs: elapsedMs(clock, now),
    runningSince: running ? new Date(now).toISOString() : null,
  };
}
export function declareRiichi(
  match: Match,
  playerId: string,
  double: boolean,
  eventId: string,
  now = new Date().toISOString(),
): Match {
  if (match.ended || !match.players.some((p) => p.id === playerId))
    throw new Error('Select a seated player in an ongoing match.');
  const state = livePlayer(match, playerId);
  let last = -1;
  match.events.forEach((event, index) => {
    if (event.type !== 'riichiDeposit') last = index;
  });
  if (
    state.riichi !== 'none' ||
    match.events.slice(last + 1).some((e) => e.payments.some((p) => p.from === playerId))
  )
    throw new Error('This player has already deposited in the current hand.');
  if (state.melds.some((m) => m.type !== 'ankan'))
    throw new Error('Riichi/Ippatsu require a closed hand.');
  if (double && (match.live?.calls ?? 0))
    throw new Error('Double Riichi requires an uninterrupted first turn.');
  if (!tableRules(match.rules).allowNegativeRiichi && balances(match).players[playerId] < 1000)
    throw new Error('Not enough points for a Riichi deposit.');
  const updated = appendEvent(match, {
    id: eventId,
    type: 'riichiDeposit',
    timestamp: now,
    liveBefore: structuredClone(match.live ?? emptyLive()),
    payments: [{ from: playerId, to: 'table', amount: 1000, reason: 'Riichi deposit' }],
  });
  updated.live = {
    ...(match.live ?? emptyLive()),
    players: {
      ...match.live?.players,
      [playerId]: {
        ...state,
        riichi: double ? 'double' : 'riichi',
        riichiCalls: match.live?.calls ?? 0,
      },
    },
    actions: [
      ...(match.live?.actions ?? []),
      {
        type: double ? 'Double Riichi' : 'Riichi',
        playerId,
        timestamp: now,
        elapsedMs: elapsedMs(match.clock, Date.parse(now)),
      },
    ],
  };
  return updated;
}
export function cancelRiichi(match: Match, playerId: string): Match {
  const state = livePlayer(match, playerId);
  if (match.ended || state.riichi === 'none') throw new Error('No Riichi declaration to cancel.');
  let lastSettlement = -1;
  match.events.forEach((event, index) => {
    if (event.type !== 'riichiDeposit') lastSettlement = index;
  });
  const deposit = match.events.findIndex(
    (event, index) =>
      index > lastSettlement &&
      event.type === 'riichiDeposit' &&
      event.payments.some(
        (payment) => payment.from === playerId && payment.to === 'table' && payment.amount === 1000,
      ),
  );
  if (deposit < 0) throw new Error('No Riichi declaration to cancel.');
  const live = structuredClone(initialLive(match));
  live.players[playerId] = { ...state, riichi: 'none', riichiCalls: undefined };
  live.actions = live.actions?.filter(
    (action) => action.playerId !== playerId || !['Riichi', 'Double Riichi'].includes(action.type),
  );
  // Earlier snapshots include the removed deposit; retain only the reversible cancellation.
  return rememberLiveAction(
    { ...match, liveUndo: [] },
    {
      ...match,
      live,
      events: match.events.filter((_, index) => index !== deposit),
    },
  );
}
/** Validate revealed physical tiles before recording a call, independently of a completed hand. */
export function validateRevealed(match: Match, live: LiveHand, concealed: Tile[] = []): void {
  const counts = Array<number>(34).fill(0),
    reds = Array<number>(34).fill(0);
  for (const state of Object.values(live.players)) {
    if (state.melds.length > 4) throw new Error('A hand can contain at most four melds.');
    for (const tile of [...state.melds.flatMap((m) => m.tiles), ...state.kita]) {
      const i = kindIndex(tile.kind);
      counts[i]++;
      if (tile.isRed) reds[i]++;
      if (match.playerCount === 3 && i >= 1 && i <= 7)
        throw new Error('Sanma excludes 2m–8m, including red 5m.');
    }
  }
  for (const tile of [
    ...parseTiles(live.dora, 'dora'),
    ...parseTiles(live.ura, 'ura'),
    ...concealed,
  ]) {
    const i = kindIndex(tile.kind);
    counts[i]++;
    if (tile.isRed) reds[i]++;
    if (match.playerCount === 3 && i >= 1 && i <= 7)
      throw new Error('Sanma excludes 2m–8m, including red 5m.');
  }
  if (counts.some((n) => n > 4) || reds.some((n) => n > 1))
    throw new Error(
      'A tile kind cannot have more than four physical copies, including indicators and Kita.',
    );
  if (!ruleSettings(match.rules).redFives && reds.some(Boolean))
    throw new Error('Red fives are disabled in this rule profile.');
  if (
    ruleSettings(match.rules).redFives &&
    [4, 13, 22].some((i) => (match.playerCount === 4 || i !== 4) && counts[i] - reds[i] > 3)
  )
    throw new Error('Each suit has three ordinary fives and one red five.');
}
