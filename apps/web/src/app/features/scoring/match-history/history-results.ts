import type { LedgerEvent } from '../../../../../../../packages/mahjong-core/ledger';
import { ruleSettings, type RuleProfile } from '../../../../../../../packages/mahjong-rules';
import { basePoints } from '../../../../../../../packages/mahjong-scoring/payments';

/** Prefer the multi-winner representation; single-winner fields may mirror its first entry. */
export function historyResults(event: LedgerEvent, rules: RuleProfile) {
  const results = event.results?.length ? event.results : event.result ? [event.result] : [];
  const inputs = event.scoringInputs?.length
    ? event.scoringInputs
    : event.scoringInput
      ? [event.scoringInput]
      : [];
  return results.map((result, index) => {
    const input = inputs[index];
    const profile = input?.rules ?? rules;
    const yakuman =
      input?.manualScore?.yakuman ??
      result.yaku.reduce((total, yaku) => total + (yaku.yakumanMultiplier ?? 0), 0);
    const limitName =
      result.limitName ??
      (result.isValid
        ? !yakuman && result.han >= 13 && ruleSettings(profile).kazoe === 'sanbaiman'
          ? 'Sanbaiman'
          : basePoints(result.han, result.fu, yakuman, profile.kiriage).limitName
        : undefined);
    return {
      result,
      limitName,
      win: input?.win ?? (index === 0 ? event.win : undefined),
      hand: input?.hand ?? (index === 0 ? event.hand : undefined),
      winnerId:
        input?.win.winnerId ??
        event.winnerIds?.[index] ??
        (index === 0 ? event.win?.winnerId : undefined),
    };
  });
}
