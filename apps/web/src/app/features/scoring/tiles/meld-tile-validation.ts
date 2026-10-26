import { kindIndex, type Tile } from '../../../../../../../packages/mahjong-core/index';

export type MeldEntryType = 'chi' | 'pon' | 'ankan' | 'daiminkan' | 'kakan' | 'kita';
export function meldTileError(tiles: Tile[], type: MeldEntryType, upgradeKind?: number): string {
  if (type === 'kakan')
    return tiles.length === 1 && kindIndex(tiles[0].kind) === upgradeKind
      ? ''
      : 'Choose a Pon and its matching fourth tile.';
  const indices = tiles.map((tile) => kindIndex(tile.kind)).sort((a, b) => a - b);
  if (type === 'chi')
    return indices.length === 3 &&
      indices[0] < 27 &&
      Math.floor(indices[0] / 9) === Math.floor(indices[2] / 9) &&
      indices[1] === indices[0] + 1 &&
      indices[2] === indices[0] + 2
      ? ''
      : 'Chi requires three consecutive suited tiles.';
  const required = type === 'pon' ? 3 : 4;
  if (tiles.length !== 1 && tiles.length !== required)
    return 'Choose one tile for automatic matching, or enter the complete set.';
  return indices.every((index) => index === indices[0])
    ? ''
    : 'Select a legal sequence or matching tiles.';
}
