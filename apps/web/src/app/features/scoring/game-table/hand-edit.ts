import {
  appendEvent,
  balances,
  finishMatch,
  roundState,
  settleRound,
  type LedgerEvent,
  type Match,
} from '../../../../../../../packages/mahjong-core/ledger';
import { score, type ScoringInput } from '../../../../../../../packages/mahjong-scoring/index';
import {
  drawSettlement,
  multipleRon,
  type RoundSettlement,
} from '../../../../../../../packages/mahjong-scoring/rounds';
import { handChips } from '../../../../../../../packages/mahjong-scoring/chips';
import { emptyLive, clockAt } from '../../../../../../../packages/mahjong-core/live';

export function editableHand(event: LedgerEvent): boolean {
  return (
    ['win', 'multipleRon', 'exhaustiveDraw', 'abortiveDraw', 'nagashi'].includes(event.type) &&
    !!event.before
  );
}

export function handEditDraft(original: Match, eventId: string): Match {
  const index = original.events.findIndex((event) => event.id === eventId);
  const event = original.events[index];
  if (!event || !editableHand(event)) throw new Error('This record is not an editable hand.');
  return {
    ...structuredClone(original),
    ...event.before,
    ended: false,
    endReason: undefined,
    events: structuredClone(original.events.slice(0, index)),
    live: structuredClone(event.liveBefore ?? emptyLive()),
    liveUndo: [],
    clock: {
      elapsedMs: original.clock?.elapsedMs ?? 0,
      runningSince: new Date().toISOString(),
      handStartMs: original.clock?.elapsedMs ?? 0,
    },
  };
}

function replayHand(match: Match, previous: LedgerEvent): Match {
  if (match.ended) throw new Error('Edited hand ends the match before a later recorded hand.');
  const context = {
    dealerId: match.dealerId,
    roundWind: match.roundWind,
    honba: match.honba,
    riichiSticks: balances(match).table / 1000,
  };
  const stored = previous.scoringInputs ?? (previous.scoringInput ? [previous.scoringInput] : []);
  const inputs: ScoringInput[] = stored.map((input) => ({ ...structuredClone(input), ...context }));
  let outcome: RoundSettlement;
  const event = { ...structuredClone(previous) };
  if (previous.drawInput) {
    const draw = { ...previous.drawInput, dealerId: context.dealerId, honba: context.honba };
    outcome = drawSettlement(draw);
    event.drawInput = draw;
  } else if (inputs.length) {
    if (inputs[0].win.method === 'ron') outcome = multipleRon(inputs);
    else {
      const result = score(inputs[0]);
      outcome = {
        isValid: result.isValid,
        errors: result.errors,
        outcome: 'win',
        payments: result.payments,
        playerDeltas: result.playerDeltas,
        winnerIds: [inputs[0].win.winnerId],
        dealerRepeats: inputs[0].win.winnerId === match.dealerId,
        results: [result],
      };
    }
    const one = inputs.length === 1 ? inputs[0] : undefined;
    event.scoringInput = one;
    event.scoringInputs = inputs.length > 1 ? inputs : undefined;
    event.result = one ? outcome.results[0] : undefined;
    event.results = outcome.results;
    event.hand = one?.hand;
    event.win = one?.win;
    event.winnerIds = outcome.winnerIds;
    const chips = Object.fromEntries(match.players.map((player) => [player.id, 0]));
    outcome.winnerIds.forEach((id, index) => {
      const input = inputs.find((input) => input.win.winnerId === id);
      if (input && outcome.results[index])
        for (const [player, value] of Object.entries(handChips(input, outcome.results[index])))
          chips[player] += value;
    });
    event.chipDeltas = chips;
  } else throw new Error('A later hand is missing scoring data and cannot be recalculated.');
  if (!outcome.isValid) throw new Error(outcome.errors.join('\n'));
  event.winnerIds = outcome.winnerIds;
  event.results = outcome.results;
  return settleRound(match, event, outcome);
}

/** Replays the suffix atomically in memory; the caller saves only after every hand validates. */
export function finishHandEdit(
  original: Match,
  eventId: string,
  edited: Match,
  now = new Date().toISOString(),
): Match {
  const index = original.events.findIndex((event) => event.id === eventId);
  if (index < 0 || !editableHand(original.events[index]))
    throw new Error('This record is not an editable hand.');
  const replacement = edited.events.at(-1);
  if (!replacement || !editableHand(replacement))
    throw new Error('Only a settled hand can replace a record.');
  const { revisions, ...previous } = original.events[index];
  replacement.id = eventId;
  replacement.timestamp = original.events[index].timestamp;
  replacement.durationMs = original.events[index].durationMs;
  replacement.revisions = [
    ...(revisions ?? []),
    { timestamp: now, event: structuredClone(previous) },
  ];
  let current = edited;
  for (const event of original.events.slice(index + 1)) {
    if (editableHand(event)) current = replayHand(current, event);
    else if (event.type === 'matchEnd') {
      current = current.ended
        ? appendEvent(current, {
            ...event,
            before: roundState(current),
            after: roundState(current),
            payments: [],
          })
        : finishMatch(current, event.id, event.timestamp);
      current.events[current.events.length - 1] = {
        ...structuredClone(event),
        ...current.events[current.events.length - 1],
      };
    } else {
      if (current.ended && event.type === 'riichiDeposit')
        throw new Error('Edited hand ends the match before a later recorded hand.');
      if (event.type === 'riichiDeposit') {
        const book = balances(current);
        if (
          event.payments.some(
            (payment) => payment.from !== 'table' && book.players[payment.from] < payment.amount,
          )
        )
          throw new Error('Not enough points for a Riichi deposit.');
      }
      const before = roundState(current);
      current = appendEvent(current, { ...structuredClone(event), before, after: before });
    }
  }
  balances(current);
  return {
    ...current,
    live: structuredClone(original.live ?? emptyLive()),
    liveUndo: [],
    clock: original.clock
      ? clockAt(original.clock, !current.ended && !!original.clock.runningSince)
      : undefined,
    updatedAt: now,
  };
}
