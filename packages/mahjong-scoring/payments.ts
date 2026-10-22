import { kindIndex, type Payment, type ScoreResult } from '../mahjong-core/index';
import { ruleSettings } from '../mahjong-rules/index';
import type { ScoringInput } from './types';
export const ceil100 = (points: number): number => Math.ceil(points / 100) * 100;
export type PaymentContext = Pick<
  ScoringInput,
  'rules' | 'players' | 'dealerId' | 'honba' | 'riichiSticks'
> & { win: Pick<ScoringInput['win'], 'method' | 'winnerId' | 'discarderId'> };
export function basePoints(
  han: number,
  fu: number,
  yakuman: number,
  kiriage = false,
): { base: number; limitName?: string } {
  if (yakuman)
    return { base: 8000 * yakuman, limitName: yakuman === 1 ? 'Yakuman' : `${yakuman}× Yakuman` };
  if (han >= 13) return { base: 8000, limitName: 'Counted Yakuman' };
  if (han >= 11) return { base: 6000, limitName: 'Sanbaiman' };
  if (han >= 8) return { base: 4000, limitName: 'Baiman' };
  if (han >= 6) return { base: 3000, limitName: 'Haneman' };
  const raw = fu * 2 ** (han + 2);
  if (han >= 5 || raw >= 2000 || (kiriage && raw === 1920))
    return { base: 2000, limitName: 'Mangan' };
  return { base: raw };
}
export function paymentsFor(base: number, input: PaymentContext): Payment[] {
  const { win, rules, players, dealerId, honba, riichiSticks } = input;
  const dealer = win.winnerId === dealerId;
  const payments: Payment[] = [];
  if (win.method === 'ron') {
    payments.push({
      from: win.discarderId!,
      to: win.winnerId,
      amount: ceil100(base * (dealer ? 6 : 4)) + honba * (rules.playerCount === 3 ? 200 : 300),
      reason: 'Ron + honba',
    });
  } else {
    for (const p of players.filter((p) => p.id !== win.winnerId)) {
      let share = base * (dealer || p.id === dealerId ? 2 : 1);
      // Explicit house-rule alternative: split the missing non-dealer share before rounding.
      if (rules.playerCount === 3 && rules.tsumo === 'north-bisection')
        share += base * (dealer ? 1 : 0.5);
      payments.push({
        from: p.id,
        to: win.winnerId,
        amount: ceil100(share) + honba * 100,
        reason: 'Tsumo + honba',
      });
    }
  }
  if (riichiSticks)
    payments.push({
      from: 'table',
      to: win.winnerId,
      amount: riichiSticks * 1000,
      reason: 'Riichi escrow award',
    });
  return payments;
}

export function responsibilityPayments(
  yaku: ScoreResult['yaku'],
  base: number,
  input: ScoringInput,
): Payment[] | string | null {
  const settings = ruleSettings(input.rules);
  if (settings.pao === 'off') return null;
  for (const [id, needed, isRelevant] of [
    ['daisangen', 3, (i: number) => i >= 31],
    ['daisuushii', 4, (i: number) => i >= 27 && i <= 30],
    ['suukantsu', 4, () => true],
  ] as const) {
    const item = yaku.find((y) => y.id === id);
    if (!item) continue;
    const league = input.rules.preset === 'm-league';
    if (id === 'suukantsu' && !league) continue;
    const calls = input.hand.melds.filter(
      (m) =>
        (league || m.type !== 'ankan') &&
        (id !== 'suukantsu' || ['ankan', 'daiminkan', 'kakan'].includes(m.type)) &&
        isRelevant(kindIndex(m.tiles[0].kind)),
    );
    if (calls.length !== needed) continue;
    const orders = calls.map((m) => m.callOrder);
    if (orders.some((n) => !Number.isInteger(n) || n! < 1) || new Set(orders).size !== calls.length)
      return 'Set distinct original call-order numbers for the exposed Yakuman sets to determine responsibility.';
    const last = [...calls].sort((a, b) => b.callOrder! - a.callOrder!)[0];
    if (last.type === 'ankan' || (id === 'suukantsu' && last.type !== 'daiminkan')) continue;
    const payer = last.fromPlayerId!;
    const responsibleBase =
      settings.pao === 'whole-hand' ? base : Math.min(base, (item.yakumanMultiplier ?? 1) * 8000);
    const clean = { ...input, honba: 0, riichiSticks: 0 };
    const payments = base > responsibleBase ? paymentsFor(base - responsibleBase, clean) : [];
    const amount = paymentsFor(responsibleBase, clean).reduce((sum, p) => sum + p.amount, 0);
    const add = (from: string, amount: number, reason: string): void => {
      if (amount) payments.push({ from, to: input.win.winnerId, amount, reason });
    };
    if (input.win.method === 'ron' && input.win.discarderId !== payer) {
      add(input.win.discarderId!, amount / 2, 'Ron: half of responsibility share');
      add(payer, amount / 2, 'Responsibility: half of Ron');
    } else add(payer, amount, 'Responsibility payment');
    add(payer, input.honba * (input.rules.playerCount === 3 ? 200 : 300), 'Responsibility: honba');
    if (input.riichiSticks)
      payments.push({
        from: 'table',
        to: input.win.winnerId,
        amount: input.riichiSticks * 1000,
        reason: 'Riichi escrow award',
      });
    return payments;
  }
  return null;
}
