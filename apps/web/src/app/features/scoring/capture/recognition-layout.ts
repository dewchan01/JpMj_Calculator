import { kindIndex, type Tile } from '../../../../../../../packages/mahjong-core/index';
import type { TilePrediction } from './recognizer';

export type CaptureMeldType = 'chi' | 'pon' | 'daiminkan' | 'ankan';
export interface CaptureGroup {
  id: string;
  tiles: Tile[];
  type: CaptureMeldType;
  calledTileId: string;
  confident: boolean;
  fromPlayerId?: string;
}
export interface ReviewedCapture {
  tiles: Tile[];
  groups: Array<CaptureGroup & { fromPlayerId: string }>;
  kita?: Tile[];
}
export interface LocatedTile {
  tile: Tile;
  prediction: TilePrediction;
}

/** Conservative layout suggestions. A shape alone never establishes an open meld. */
export function recognizeLayout(located: LocatedTile[], playerCount: 3 | 4): CaptureGroup[] {
  if (located.length > 30) return [];
  const remaining = new Set(located);
  const clusters: LocatedTile[][] = [];
  const neighbors = (a: LocatedTile, b: LocatedTile) => {
    const x = a.prediction.box,
      y = b.prediction.box;
    const overlap = Math.min(x.y + x.height, y.y + y.height) - Math.max(x.y, y.y);
    const gap = Math.max(x.x, y.x) - Math.min(x.x + x.width, y.x + y.width);
    return overlap > Math.min(x.height, y.height) * 0.45 && gap < Math.min(x.width, y.width) * 0.65;
  };
  while (remaining.size) {
    const first = remaining.values().next().value!;
    const cluster = [first];
    remaining.delete(first);
    for (let i = 0; i < cluster.length; i++)
      for (const tile of remaining)
        if (neighbors(cluster[i], tile)) {
          cluster.push(tile);
          remaining.delete(tile);
        }
    clusters.push(cluster.sort((a, b) => a.prediction.box.x - b.prediction.box.x));
  }
  // Without a clear concealed-hand region, keep everything in the hand for manual review.
  const hand = [...clusters].sort((a, b) => b.length - a.length)[0];
  if (!hand || hand.length < 5) return [];
  const groups: CaptureGroup[] = [];
  for (const cluster of clusters) {
    if (cluster === hand || ![3, 4].includes(cluster.length)) continue;
    const tiles = cluster.map((item) => item.tile);
    const kinds = tiles.map((tile) => kindIndex(tile.kind)).sort((a, b) => a - b);
    const matching = kinds.every((kind) => kind === kinds[0]);
    const sequence =
      cluster.length === 3 &&
      kinds[0] < 27 &&
      Math.floor(kinds[0] / 9) === Math.floor(kinds[2] / 9) &&
      kinds[1] === kinds[0] + 1 &&
      kinds[2] === kinds[0] + 2;
    if (!matching && !(sequence && playerCount === 4)) continue;
    const sideways = cluster.filter((item) => item.prediction.orientation === 'sideways');
    const stacked = cluster.some((a, index) =>
      cluster.slice(index + 1).some((b) => {
        const x = a.prediction.box,
          y = b.prediction.box;
        return (
          Math.min(x.x + x.width, y.x + y.width) - Math.max(x.x, y.x) >
          Math.min(x.width, y.width) * 0.3
        );
      }),
    );
    const confident =
      sideways.length === 1 &&
      !stacked &&
      cluster.every(
        (item) =>
          item.prediction.candidates[0].confidence >= 0.85 &&
          item.prediction.orientation !== 'unknown' &&
          !!item.prediction.orientation,
      );
    groups.push({
      id: tiles
        .map((tile) => tile.id)
        .sort()
        .join(':'),
      tiles,
      type: sequence ? 'chi' : tiles.length === 3 ? 'pon' : sideways.length ? 'daiminkan' : 'ankan',
      calledTileId: sideways.length === 1 ? sideways[0].tile.id : '',
      confident,
    });
  }
  return groups.slice(0, 4);
}
