import { balances, type Match } from './ledger';
import { emptyLive } from './live';

const handTypes = ['win', 'multipleRon', 'exhaustiveDraw', 'abortiveDraw', 'nagashi'];
function lastHandIndex(match: Match): number {
  for (let index = match.events.length - 1; index >= 0; index--)
    if (
      handTypes.includes(match.events[index].type) ||
      match.events[index].chombo?.progression === 'draw'
    )
      return index;
  return -1;
}
export function canRestartLastHand(match: Match): boolean {
  return !!(match.ended && match.events[lastHandIndex(match)]?.before);
}
export function restartLastHand(match: Match, timestamp = new Date().toISOString()): Match {
  if (!canRestartLastHand(match))
    throw new Error('The last hand cannot be restarted without its recorded starting state.');
  const index = lastHandIndex(match);
  const hand = match.events[index];
  let start = index;
  while (start > 0) {
    const previous = match.events[start - 1];
    if (
      handTypes.includes(previous.type) ||
      previous.chombo?.progression === 'draw' ||
      previous.chombo?.progression === 'repeat'
    )
      break;
    start--;
  }
  const removedDuration = match.events
    .slice(start)
    .reduce((sum, event) => sum + (event.durationMs ?? 0), 0);
  const elapsed = Math.max(
    0,
    (match.clock?.elapsedMs ??
      match.events.reduce((sum, event) => sum + (event.durationMs ?? 0), 0)) - removedDuration,
  );
  const updated: Match = {
    ...structuredClone(match),
    ...hand.before!,
    ended: false,
    endReason: undefined,
    events: structuredClone(match.events.slice(0, start)),
    live: emptyLive(),
    liveUndo: [],
    updatedAt: timestamp,
    clock: { elapsedMs: elapsed, handStartMs: elapsed, runningSince: timestamp },
  };
  balances(updated);
  return updated;
}
