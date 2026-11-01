import {
  type LedgerEvent,
  type Match,
  roundState,
} from '../../../../../../../packages/mahjong-core/ledger';

/** Presentation only: deposits belong to the next hand; the stored ledger remains unchanged. */
export function historyEvents(match: Match | null): LedgerEvent[] {
  if (!match) return [];
  const rows: LedgerEvent[] = [];
  let deposits: LedgerEvent[] = [];
  for (const event of match.events) {
    if (event.type === 'riichiDeposit') {
      deposits.push(event);
      continue;
    }
    rows.push({
      ...event,
      payments: [...deposits.flatMap((deposit) => deposit.payments), ...event.payments],
    });
    deposits = [];
  }
  if (deposits.length) {
    rows.push({
      ...deposits.at(-1)!,
      before: roundState(match),
      payments: deposits.flatMap((deposit) => deposit.payments),
    });
  }
  return rows;
}
