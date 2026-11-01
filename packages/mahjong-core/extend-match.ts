import { settleRound, type Match, type LedgerEvent } from './ledger';
import { emptyLive } from './live';

export function canExtendToSouth(match: Match): boolean {
  const last = match.events.at(-1);
  return !!(
    match.ended &&
    match.gameLength === 'east' &&
    last?.before &&
    last.after?.ended &&
    ['Match complete', 'Dealer finish in first place'].includes(last.after.endReason ?? '') &&
    last.before.roundWind === 'east' &&
    last.before.handNumber === match.playerCount &&
    (['win', 'multipleRon'].includes(last.type) ||
      (['exhaustiveDraw', 'nagashi'].includes(last.type) && last.drawInput))
  );
}

/** Replay the final hand under the longer schedule, excluding only end-of-match payments. */
export function extendToSouth(match: Match, timestamp = new Date().toISOString()): Match {
  if (!canExtendToSouth(match)) throw new Error('This match cannot be extended to South.');
  const original = match.events.at(-1)!;
  const before = original.before!;
  const payments = original.payments.filter(
    (payment) => !['Final Yakitori penalty', 'Final table escrow award'].includes(payment.reason),
  );
  const winnerIds = original.winnerIds ?? (original.win ? [original.win.winnerId] : []);
  const win = original.type === 'win' || original.type === 'multipleRon';
  const previous = structuredClone(original);
  delete previous.revisions;
  const event: LedgerEvent = {
    ...structuredClone(original),
    payments,
    after: undefined,
    revisions: [...(original.revisions ?? []), { timestamp, event: previous }],
  };
  const base: Match = {
    ...match,
    ...before,
    ended: false,
    endReason: undefined,
    gameLength: 'south',
    events: match.events.slice(0, -1),
  };
  const updated = settleRound(
    base,
    event,
    {
      isValid: true,
      errors: [],
      outcome: win ? 'win' : (original.type as 'exhaustiveDraw' | 'nagashi'),
      payments,
      playerDeltas: {},
      winnerIds,
      dealerRepeats: win
        ? winnerIds.includes(before.dealerId)
        : !!original.drawInput?.tenpaiIds.includes(before.dealerId),
      results: original.results ?? (original.result ? [original.result] : []),
    },
    before,
  );
  return { ...updated, updatedAt: timestamp, live: emptyLive(), liveUndo: [] };
}
