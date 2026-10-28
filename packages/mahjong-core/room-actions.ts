import { balances, settleRound, type LedgerEvent, type Match } from './ledger';
import {
  declareRiichi,
  cancelRiichi,
  livePlayer,
  initialLive,
  rememberLiveAction,
  emptyLive,
  clockAt,
  elapsedMs,
  validateRevealed,
} from './live';
import { recordCall, type CallInput } from './record-call';
import { parseTiles } from './index';
import { score, type ScoringInput } from '../mahjong-scoring/index';
import { multipleRon, type RoundSettlement } from '../mahjong-scoring/rounds';
import { handChips } from '../mahjong-scoring/chips';

export interface RoomAction {
  id: string;
  seat: number;
  handKey: string;
  kind: 'riichi' | 'cancelRiichi' | 'call' | 'win';
  payload: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected';
  error: string;
  createdAt: number;
}

export function roomHandKey(match: Match): string {
  return [
    match.id,
    match.events.filter((event) => event.type !== 'riichiDeposit').at(-1)?.id ?? 'start',
    match.dealerId,
    match.roundWind,
    match.handNumber,
    match.honba,
    !!match.ended,
  ].join(':');
}

function actorFor(match: Match, action: RoomAction): string {
  if (action.handKey !== roomHandKey(match))
    throw new Error('The hand has changed. Refresh before declaring.');
  if (match.ended || (match.clock && !match.clock.runningSince))
    throw new Error('Resume the game before recording actions.');
  const actor = match.players[action.seat]?.id;
  if (!actor) throw new Error('Select a seated player in an ongoing match.');
  return actor;
}

export function applyRoomAction(
  match: Match,
  action: RoomAction,
  idFactory: () => string = () => crypto.randomUUID(),
): Match {
  const actor = actorFor(match, action);
  let updated: Match;
  switch (action.kind) {
    case 'riichi':
      updated = declareRiichi(
        match,
        actor,
        action.payload['double'] === true,
        action.id,
        undefined,
        { doubleBeforeRecordedCalls: action.payload['double'] === true },
      );
      break;
    case 'cancelRiichi':
      updated = cancelRiichi(match, actor);
      break;
    case 'call': {
      const p = action.payload;
      if (
        !['chi', 'pon', 'daiminkan', 'ankan', 'kakan', 'kita'].includes(String(p['type'])) ||
        typeof p['text'] !== 'string' ||
        p['text'].length > 40 ||
        typeof p['source'] !== 'string' ||
        typeof p['upgradeId'] !== 'string' ||
        !Number.isInteger(p['called'])
      )
        throw new Error('Invalid online request.');
      updated = recordCall(match, actor, p as unknown as CallInput, idFactory);
      break;
    }
    default:
      throw new Error('Winning declarations require host settlement.');
  }
  return { ...rememberLiveAction(match, updated), updatedAt: new Date().toISOString() };
}

/** Never trust a guest's rules, other seats, pot, recorded calls or computed payments. */
export function roomWinInput(match: Match, action: RoomAction): ScoringInput {
  const actor = actorFor(match, action);
  const supplied = action.payload['input'] as ScoringInput | undefined;
  if (
    !supplied?.hand ||
    !supplied.win ||
    !['ron', 'tsumo'].includes(supplied.win.method) ||
    supplied.win.winnerId !== actor ||
    supplied.hand.playerId !== actor
  )
    throw new Error('Declare only for your own seat.');
  const state = livePlayer(match, actor);
  const input: ScoringInput = {
    ...structuredClone(supplied),
    rules: match.rules,
    players: match.players,
    dealerId: match.dealerId,
    roundWind: match.roundWind,
    honba: match.honba,
    riichiSticks: balances(match).table / 1000,
    waremePlayerId: match.live?.waremePlayerId,
    hand: {
      playerId: actor,
      concealedTiles: supplied.manualScore ? [] : supplied.hand.concealedTiles,
      melds: state.melds,
      extractedNorthTiles: state.kita,
    },
    win: {
      ...supplied.win,
      winnerId: actor,
      riichi: state.riichi === 'riichi',
      doubleRiichi: state.riichi === 'double',
    },
    doraIndicators: parseTiles(match.live?.dora ?? '', 'dora'),
    uraIndicators: state.riichi === 'none' ? [] : supplied.uraIndicators,
    otherPlayerKans: Object.entries(initialLive(match).players)
      .filter(([id]) => id !== actor)
      .flatMap(([, player]) => player.melds)
      .filter((meld) => !['chi', 'pon'].includes(meld.type)).length,
  };
  if (!input.manualScore && !input.doraIndicators.length)
    throw new Error('Ask the host to enter Dora indicators first.');
  const live = initialLive(match);
  const discarder = live.players[input.win.discarderId ?? ''];
  if (input.win.method === 'ron' && discarder) {
    if (input.win.robbed === 'kita') discarder.kita.pop();
    else if (input.win.chankan)
      [...discarder.melds]
        .reverse()
        .find((meld) => meld.type === input.win.robbed)
        ?.tiles.pop();
  }
  validateRevealed(match, live, [...input.hand.concealedTiles, ...input.uraIndicators]);
  const result = score(input);
  if (!result.isValid) throw new Error(result.errors.join('\n'));
  return input;
}

export function settleRoomWins(
  match: Match,
  actions: RoomAction[],
  idFactory: () => string = () => crypto.randomUUID(),
): Match {
  if (!actions.length) throw new Error('Enter at least one winning hand.');
  const inputs = actions.map((action) => roomWinInput(match, action));
  const result = score(inputs[0]);
  const round: RoundSettlement =
    inputs[0].win.method === 'ron'
      ? multipleRon(inputs)
      : {
          isValid: inputs.length === 1 && result.isValid,
          errors: ['Tsumo must have exactly one winner.'],
          outcome: 'win',
          payments: result.payments,
          playerDeltas: result.playerDeltas,
          winnerIds: [inputs[0].win.winnerId],
          dealerRepeats: inputs[0].win.winnerId === match.dealerId,
          results: [result],
        };
  if (!round.isValid) throw new Error(round.errors.join('\n'));
  const chips = Object.fromEntries(match.players.map((player) => [player.id, 0]));
  round.winnerIds.forEach((id, index) => {
    const input = inputs.find((input) => input.win.winnerId === id);
    if (input)
      for (const [player, delta] of Object.entries(handChips(input, round.results[index])))
        chips[player] += delta;
  });
  const one = inputs.length === 1 ? inputs[0] : undefined;
  const event: LedgerEvent = {
    id: idFactory(),
    type: round.outcome !== 'win' ? round.outcome : one ? 'win' : 'multipleRon',
    timestamp: new Date().toISOString(),
    payments: round.payments,
    winnerIds: round.winnerIds,
    results: round.results,
    result: one ? round.results[0] : undefined,
    scoringInput: one,
    scoringInputs: one ? undefined : inputs,
    hand: one?.hand,
    win: one?.win,
    chipDeltas: chips,
    liveBefore: initialLive(match),
    durationMs: Math.max(0, elapsedMs(match.clock) - (match.clock?.handStartMs ?? 0)),
  };
  const updated = settleRound(match, event, round);
  const clock = clockAt(
    match.clock ?? { elapsedMs: 0, runningSince: null, handStartMs: 0 },
    !updated.ended,
  );
  clock.handStartMs = clock.elapsedMs;
  return { ...updated, live: emptyLive(), liveUndo: [], clock };
}
