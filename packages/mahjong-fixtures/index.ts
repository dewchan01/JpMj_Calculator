import { parseTiles } from '../mahjong-core/index';
import { rankedRules } from '../mahjong-rules/index';
import type { ScoringInput } from '../mahjong-scoring/types';
export function fixture(notation = '123m456m789p234s55p', playerCount: 3 | 4 = 4): ScoringInput {
  const tiles = parseTiles(notation);
  return {
    rules: rankedRules(playerCount),
    players: ['a', 'b', 'c', 'd'].slice(0, playerCount).map((id) => ({ id, name: id })),
    dealerId: 'a',
    roundWind: 'east',
    honba: 0,
    riichiSticks: 0,
    hand: { playerId: 'b', concealedTiles: tiles, melds: [], extractedNorthTiles: [] },
    win: {
      winnerId: 'b',
      method: 'ron',
      discarderId: 'c',
      winningTileId: tiles[Math.max(0, tiles.length - 3)]?.id ?? '',
      riichi: false,
      doubleRiichi: false,
      ippatsu: false,
      rinshan: false,
      chankan: false,
      haitei: false,
      houtei: false,
      tenhou: false,
      chiihou: false,
    },
    doraIndicators: [],
    uraIndicators: [],
  };
}
