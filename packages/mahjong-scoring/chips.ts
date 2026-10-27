import type { ScoreResult } from '../mahjong-core/index';
import { kindIndex } from '../mahjong-core/index';
import type { ScoringInput } from './types';
import { nextDora, tableRules } from '../mahjong-rules/index';

export function handChips(input: ScoringInput, result: ScoreResult): Record<string, number> {
  const delta = Object.fromEntries(input.players.map((player) => [player.id, 0]));
  const table = tableRules(input.rules);
  if (!table.chipValue || !result.isValid) return delta;
  const closed = input.hand.melds.every((meld) => meld.type === 'ankan');
  const yakuman = result.yaku.reduce((sum, yaku) => sum + (yaku.yakumanMultiplier ?? 0), 0);
  const tileBonus = closed || table.chipsOnOpenHands;
  const tiles = [...input.hand.concealedTiles, ...input.hand.melds.flatMap((meld) => meld.tiles)];
  const reds = tiles.filter((tile) => tile.isRed).length;
  const ura =
    input.win.riichi || input.win.doubleRiichi
      ? input.uraIndicators.reduce(
          (sum, indicator) =>
            sum +
            tiles.filter(
              (tile) =>
                kindIndex(tile.kind) ===
                nextDora(kindIndex(indicator.kind), input.rules.playerCount),
            ).length,
          0,
        )
      : 0;
  const count = input.manualScore
    ? (input.manualScore.chips ?? 0)
    : yakuman * table.chipYakuman +
      (input.win.ippatsu && closed && (input.win.riichi || input.win.doubleRiichi)
        ? table.chipIppatsu
        : 0) +
      (tileBonus ? reds * table.chipRed + ura * table.chipUra : 0);
  const payers =
    input.win.method === 'ron'
      ? [input.win.discarderId!]
      : input.players
          .filter((player) => player.id !== input.win.winnerId)
          .map((player) => player.id);
  for (const payer of payers) {
    delta[payer] -= count;
    delta[input.win.winnerId] += count;
  }
  return delta;
}
