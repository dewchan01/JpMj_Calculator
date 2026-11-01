import { appendEvent, roundState, settleRound, type Match, type LedgerEvent } from './ledger';
import { paymentsFor } from '../mahjong-scoring/payments';
import { drawSettlement } from '../mahjong-scoring/rounds';
import { emptyLive } from './live';

export type ChomboInput = NonNullable<LedgerEvent['chombo']>;
export function recordChombo(
  match: Match,
  input: ChomboInput,
  id: string,
  timestamp: string,
): Match {
  const ids = match.players.map((player) => player.id);
  if (
    match.ended ||
    !ids.includes(input.payerId) ||
    !input.recipientIds.length ||
    new Set(input.recipientIds).size !== input.recipientIds.length ||
    input.recipientIds.some((player) => !ids.includes(player) || player === input.payerId) ||
    !['mangan', 'baiman', 'other'].includes(input.payment) ||
    !['continue', 'draw', 'repeat'].includes(input.progression) ||
    !Number.isSafeInteger(input.amount) ||
    input.amount < 0 ||
    input.amount > 100000 ||
    input.amount % 100
  )
    throw new Error('Choose a payer, recipients and valid penalty payment.');
  const payments =
    input.payment === 'other'
      ? input.recipientIds.map((to) => ({
          from: input.payerId,
          to,
          amount: input.amount,
          reason: 'Chombo penalty',
        }))
      : paymentsFor(input.payment === 'mangan' ? 2000 : 4000, {
          rules: match.rules,
          players: match.players,
          dealerId: match.dealerId,
          honba: 0,
          riichiSticks: 0,
          win: { method: 'tsumo', winnerId: input.payerId },
        })
          .filter((payment) => input.recipientIds.includes(payment.from))
          .map((payment) => ({
            from: input.payerId,
            to: payment.from,
            amount: payment.amount,
            reason: 'Chombo penalty',
          }));
  const event: LedgerEvent = {
    id,
    timestamp,
    type: 'scoreAdjustment',
    chombo: structuredClone(input),
    payments,
    before: roundState(match),
    after: roundState(match),
    liveBefore: structuredClone(match.live ?? emptyLive()),
  };
  if (input.progression === 'repeat') {
    const handStart = match.events
      .map(
        (entry) =>
          !!entry.after &&
          entry.type !== 'riichiDeposit' &&
          entry.chombo?.progression !== 'continue',
      )
      .lastIndexOf(true);
    for (const entry of match.events
      .slice(handStart + 1)
      .filter((entry) => entry.type === 'riichiDeposit'))
      for (const payment of entry.payments.filter((payment) => payment.to === 'table'))
        payments.push({
          from: 'table',
          to: payment.from,
          amount: payment.amount,
          reason: 'Chombo Riichi refund',
        });
  }
  if (input.progression === 'draw') {
    const drawInput = {
      rules: match.rules,
      players: match.players,
      dealerId: match.dealerId,
      honba: match.honba,
      type: 'exhaustive' as const,
      tenpaiIds: input.tenpaiIds,
      nagashiIds: [],
      circumstancesConfirmed: true,
    };
    const outcome = drawSettlement(drawInput);
    if (!outcome.isValid) throw new Error(outcome.errors.join('\n'));
    outcome.payments = [...payments, ...outcome.payments];
    return {
      ...settleRound(match, { ...event, drawInput }, outcome),
      live: emptyLive(),
      liveUndo: [],
    };
  }
  return {
    ...appendEvent(match, event),
    ...(input.progression === 'repeat' ? { live: emptyLive(), liveUndo: [] } : {}),
  };
}
