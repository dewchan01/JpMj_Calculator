import { kindIndex, type Payment, type Player, type ScoreResult } from '../mahjong-core/index';
import {
  ruleSettings,
  tableRules,
  validateProfile,
  type RuleProfile,
} from '../mahjong-rules/index';
import { score, type ScoringInput } from './index';
import { paymentsFor } from './payments';

export interface RoundSettlement {
  isValid: boolean;
  errors: string[];
  outcome: 'win' | 'exhaustiveDraw' | 'abortiveDraw' | 'nagashi';
  payments: Payment[];
  playerDeltas: Record<string, number>;
  winnerIds: string[];
  dealerRepeats: boolean;
  results: ScoreResult[];
}
function settlement(
  players: Player[],
  outcome: RoundSettlement['outcome'],
  payments: Payment[],
  winnerIds: string[],
  dealerRepeats: boolean,
  results: ScoreResult[] = [],
  errors: string[] = [],
): RoundSettlement {
  const playerDeltas = Object.fromEntries(players.map((p) => [p.id, 0]));
  for (const p of payments) {
    if (p.from !== 'table') playerDeltas[p.from] -= p.amount;
    if (p.to !== 'table') playerDeltas[p.to] += p.amount;
  }
  return {
    isValid: !errors.length,
    errors,
    outcome,
    payments,
    playerDeltas,
    winnerIds,
    dealerRepeats,
    results,
  };
}
export function multipleRon(inputs: ScoringInput[]): RoundSettlement {
  const first = inputs[0];
  if (!first) return settlement([], 'win', [], [], false, [], ['Enter at least one winning hand.']);
  const fail = (error: string): RoundSettlement =>
    settlement(first.players, 'win', [], [], false, [], [error]);
  if (
    inputs.length >= first.players.length ||
    new Set(inputs.map((i) => i.win.winnerId)).size !== inputs.length
  )
    return fail('Winners must be distinct and exclude the discarder.');
  const context = (i: ScoringInput): string =>
    JSON.stringify([
      i.rules,
      i.players,
      i.dealerId,
      i.roundWind,
      i.honba,
      i.riichiSticks,
      i.waremePlayerId,
      i.win.discarderId,
      (i.otherPlayerKans ?? 0) +
        i.hand.melds.filter((m) => !['chi', 'pon'].includes(m.type)).length,
      i.doraIndicators.map((t) => [kindIndex(t.kind), t.isRed]),
    ]);
  if (inputs.some((i) => i.win.method !== 'ron' || context(i) !== context(first)))
    return fail('All Ron winners must share the same discarder, players, rules and round context.');
  const scored = inputs.map(score);
  if (scored.some((r) => !r.isValid))
    return settlement(
      first.players,
      'win',
      [],
      [],
      false,
      scored,
      scored.flatMap((r) => r.errors),
    );
  if (inputs.some((input) => !!input.manualScore !== !!first.manualScore))
    return fail('All Ron winners must use the same scoring mode.');
  const winningKinds = inputs.map((i) =>
    i.manualScore
      ? -1
      : kindIndex(i.hand.concealedTiles.find((t) => t.id === i.win.winningTileId)!.kind),
  );
  if (
    new Set(winningKinds).size !== 1 ||
    new Set(
      inputs.map((i) =>
        i.manualScore
          ? false
          : i.hand.concealedTiles.find((t) => t.id === i.win.winningTileId)!.isRed,
      ),
    ).size !== 1
  )
    return fail('All Ron winners must win on the same discarded tile.');
  const physical = inputs.flatMap((i) => [
    ...i.hand.concealedTiles.filter((t) => t.id !== i.win.winningTileId),
    ...i.hand.melds.flatMap((m) => m.tiles),
    ...i.hand.extractedNorthTiles,
  ]);
  physical.push(
    ...(first.manualScore
      ? []
      : [first.hand.concealedTiles.find((t) => t.id === first.win.winningTileId)!]),
    ...first.doraIndicators,
    ...(inputs.find((i) => i.uraIndicators.length)?.uraIndicators ?? []),
  );
  if (new Set(physical.map((t) => t.id)).size !== physical.length)
    return fail('Different hands must use distinct physical tile IDs.');
  const ura = inputs
    .filter((i) => i.uraIndicators.length)
    .map((i) => JSON.stringify(i.uraIndicators.map((t) => [kindIndex(t.kind), t.isRed])));
  if (new Set(ura).size > 1)
    return fail('All Riichi winners must use the same table Ura indicators.');
  const counts = Array<number>(34).fill(0);
  physical.forEach((t) => counts[kindIndex(t.kind)]++);
  if (counts.some((n) => n > 4))
    return fail('Combined winning hands and indicators exceed four physical copies of a tile.');
  const reds = Array<number>(34).fill(0);
  physical.filter((t) => t.isRed).forEach((t) => reds[kindIndex(t.kind)]++);
  if (
    reds.some((n) => n > 1) ||
    (ruleSettings(first.rules).redFives && [4, 13, 22].some((i) => counts[i] - reds[i] > 3))
  )
    return fail('Combined hands exceed the red/ordinary five inventory.');
  const settings = ruleSettings(first.rules);
  if (inputs.length === 3 && settings.multipleRon === 'triple-draw')
    return settlement(first.players, 'abortiveDraw', [], [], true);
  const ids = first.players.map((p) => p.id);
  const discarder = ids.indexOf(first.win.discarderId!);
  const ordered = [...inputs].sort(
    (a, b) =>
      ((ids.indexOf(a.win.winnerId) - discarder + ids.length) % ids.length) -
      ((ids.indexOf(b.win.winnerId) - discarder + ids.length) % ids.length),
  );
  const effective = settings.multipleRon === 'head-bump' ? ordered.slice(0, 1) : ordered;
  const results = effective.map((input, index) =>
    score({
      ...input,
      honba: index === 0 ? first.honba : 0,
      riichiSticks:
        tableRules(first.rules).riichiReceiver === 'split'
          ? 0
          : index === 0
            ? first.riichiSticks
            : 0,
    }),
  );
  if (results.some((r) => !r.isValid)) return fail('A winning hand could not be settled.');
  const payments = results.flatMap((result) => result.payments);
  if (tableRules(first.rules).riichiReceiver === 'split' && first.riichiSticks) {
    const units = first.riichiSticks * 10;
    effective.forEach((input, index) =>
      payments.push({
        from: 'table',
        to: input.win.winnerId,
        amount:
          (Math.floor(units / effective.length) + (index < units % effective.length ? 1 : 0)) * 100,
        reason: 'Riichi escrow award',
      }),
    );
  }
  return settlement(
    first.players,
    'win',
    payments,
    effective.map((i) => i.win.winnerId),
    effective.some((i) => i.win.winnerId === first.dealerId),
    results,
  );
}

export type AbortiveReason =
  'nine-terminals' | 'four-winds' | 'four-riichi' | 'four-kans' | 'triple-ron';
export interface DrawInput {
  rules: RuleProfile;
  players: Player[];
  dealerId: string;
  honba: number;
  type: 'exhaustive' | 'abortive' | 'nagashi';
  tenpaiIds: string[];
  nagashiIds: string[];
  reason?: AbortiveReason;
  circumstancesConfirmed: boolean;
}
export function drawSettlement(input: DrawInput): RoundSettlement {
  const { rules, players, tenpaiIds, nagashiIds } = input;
  const ids = players.map((p) => p.id);
  const outcome =
    input.type === 'abortive'
      ? 'abortiveDraw'
      : input.type === 'nagashi'
        ? 'nagashi'
        : 'exhaustiveDraw';
  const fail = (message: string): RoundSettlement =>
    settlement(players, outcome, [], [], false, [], [message]);
  if (validateProfile(rules).length) return fail(validateProfile(rules)[0]);
  if (rules.preset === 'm-league' && input.type !== 'exhaustive')
    return fail('M.League allows exhaustive draws only; no abortive draws or Nagashi Mangan.');
  if (!input.circumstancesConfirmed)
    return fail('Confirm the draw circumstances and declared Tenpai/Nagashi status.');
  if (
    players.length !== rules.playerCount ||
    new Set(ids).size !== ids.length ||
    !ids.includes(input.dealerId) ||
    !Number.isInteger(input.honba) ||
    input.honba < 0 ||
    input.honba > 100
  )
    return fail('Invalid draw players, dealer or honba.');
  if (
    [tenpaiIds, nagashiIds].some(
      (list) => new Set(list).size !== list.length || list.some((id) => !ids.includes(id)),
    )
  )
    return fail('Draw selections must identify distinct seated players.');
  if (input.type === 'abortive') {
    if (
      !input.reason ||
      !['nine-terminals', 'four-winds', 'four-riichi', 'four-kans', 'triple-ron'].includes(
        input.reason,
      )
    )
      return fail('Select an abortive draw reason.');
    if (
      rules.playerCount === 3 &&
      ['four-winds', 'four-riichi', 'triple-ron'].includes(input.reason)
    )
      return fail('This abortive draw requires four players.');
    if (input.reason === 'triple-ron' && ruleSettings(rules).multipleRon !== 'triple-draw')
      return fail('This profile settles triple Ron as wins, not an abortive draw.');
    return settlement(players, outcome, [], [], true);
  }
  const payments: Payment[] = [];
  if (input.type === 'nagashi') {
    if (!nagashiIds.length) return fail('Select at least one eligible Nagashi Mangan player.');
    for (const winner of nagashiIds) {
      payments.push(
        ...paymentsFor(2000, {
          rules,
          players,
          dealerId: input.dealerId,
          honba: input.honba,
          riichiSticks: 0,
          win: { winnerId: winner, method: 'tsumo' },
        }).map((p) => ({ ...p, reason: 'Nagashi Mangan + honba' })),
      );
    }
  } else if (tenpaiIds.length && tenpaiIds.length < players.length) {
    const pool = tableRules(rules).notenPool;
    const owing = ids
      .filter((id) => !tenpaiIds.includes(id))
      .map((id) => ({ id, amount: pool / (players.length - tenpaiIds.length) }));
    const receiving = tenpaiIds.map((id) => ({ id, amount: pool / tenpaiIds.length }));
    for (const from of owing)
      for (const to of receiving) {
        const amount = Math.min(from.amount, to.amount);
        if (amount)
          payments.push({ from: from.id, to: to.id, amount, reason: 'Tenpai / Noten transfer' });
        from.amount -= amount;
        to.amount -= amount;
      }
  }
  return settlement(
    players,
    outcome,
    payments,
    input.type === 'nagashi' ? nagashiIds : [],
    tenpaiIds.includes(input.dealerId),
  );
}
