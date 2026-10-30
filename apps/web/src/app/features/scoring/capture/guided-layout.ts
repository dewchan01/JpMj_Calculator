import { kindIndex, type Tile } from '../../../../../../../packages/mahjong-core/index';
import type { CaptureGroup, LocatedTile } from './recognition-layout';

export interface CaptureZone {
  id: string;
  kind: 'hand' | 'meld' | 'ankan' | 'kita';
  fromPlayerId?: string;
  box: { x: number; y: number; width: number; height: number };
}
export interface GuidedPhoto {
  file: File;
  zones: CaptureZone[];
}

/** Coordinates refer to the uncropped video frame, exactly as used for detection. */
export function captureZones(sources: string[], sanma: boolean, aspect = 4 / 3): CaptureZone[] {
  return [
    { id: 'hand', kind: 'hand', box: { x: 0.02, y: 0.04, width: 0.96, height: 0.3 } },
    ...sources.slice(0, 4).map((source, index): CaptureZone => ({
      id: `meld-${index}`,
      kind: source === 'ankan' ? 'ankan' : 'meld',
      ...(source === 'ankan' ? {} : { fromPlayerId: source }),
      box: {
        x: 0.02 + (index % 2) * 0.49,
        y: 0.4 + Math.floor(index / 2) * 0.18,
        width: 0.47,
        height: Math.min(0.16, (0.47 * aspect) / 3.2),
      },
    })),
    {
      id: 'ankan',
      kind: 'ankan',
      box: { x: 0.02, y: 0.76, width: sanma ? 0.68 : 0.96, height: 0.2 },
    },
    ...(sanma
      ? [{ id: 'kita', kind: 'kita' as const, box: { x: 0.74, y: 0.76, width: 0.24, height: 0.2 } }]
      : []),
  ];
}

export function guidedLayout(
  located: LocatedTile[],
  zones: CaptureZone[],
  playerCount: 3 | 4,
  precedingId: string,
) {
  const assigned = new Map<string, LocatedTile[]>();
  const blocked = new Set<string>();
  let needsReview = false;
  for (const item of located) {
    const tile = item.prediction.box;
    const matches = zones.filter(({ box }) => {
      const centerX = tile.x + tile.width / 2,
        centerY = tile.y + tile.height / 2;
      const overlapX = Math.max(
        0,
        Math.min(tile.x + tile.width, box.x + box.width) - Math.max(tile.x, box.x),
      );
      const overlapY = Math.max(
        0,
        Math.min(tile.y + tile.height, box.y + box.height) - Math.max(tile.y, box.y),
      );
      return (
        centerX > box.x &&
        centerX < box.x + box.width &&
        centerY > box.y &&
        centerY < box.y + box.height &&
        overlapX * overlapY >= tile.width * tile.height * 0.85
      );
    });
    if (matches.length !== 1) {
      needsReview = true;
      for (const zone of zones) {
        const box = zone.box;
        if (
          Math.min(tile.x + tile.width, box.x + box.width) > Math.max(tile.x, box.x) &&
          Math.min(tile.y + tile.height, box.y + box.height) > Math.max(tile.y, box.y)
        )
          blocked.add(zone.id);
      }
      continue;
    }
    const zone = matches[0];
    assigned.set(zone.id, [...(assigned.get(zone.id) ?? []), item]);
  }
  const groups: CaptureGroup[] = [];
  let kita: Tile[] = [];
  for (const zone of zones) {
    const items = (assigned.get(zone.id) ?? []).sort(
      (a, b) => a.prediction.box.x - b.prediction.box.x,
    );
    if (!items.length || zone.kind === 'hand') continue;
    if (blocked.has(zone.id)) continue;
    const kinds = items.map((item) => kindIndex(item.tile.kind)).sort((a, b) => a - b);
    if (zone.kind === 'kita') {
      if (
        playerCount === 3 &&
        items.length <= 4 &&
        kinds.every((kind) => kind === 30) &&
        items.every((item) => item.prediction.candidates[0].confidence >= 0.85)
      )
        kita = items.map((item) => item.tile);
      else needsReview = true;
      continue;
    }
    const matching = kinds.every((kind) => kind === kinds[0]);
    const chi =
      items.length === 3 &&
      kinds[0] < 27 &&
      Math.floor(kinds[0] / 9) === Math.floor(kinds[2] / 9) &&
      kinds[1] === kinds[0] + 1 &&
      kinds[2] === kinds[0] + 2;
    if (
      zone.kind === 'ankan'
        ? items.length !== 4 || !matching
        : !zone.fromPlayerId ||
          ![3, 4].includes(items.length) ||
          (!matching && !(chi && playerCount === 4 && zone.fromPlayerId === precedingId))
    ) {
      needsReview = true;
      continue;
    }
    const sideways = items.filter((item) => item.prediction.orientation === 'sideways');
    const tiles = items.map((item) => item.tile);
    groups.push({
      id: `${zone.id}:${tiles.map((tile) => tile.id).join(':')}`,
      tiles,
      type:
        zone.kind === 'ankan' ? 'ankan' : chi ? 'chi' : items.length === 3 ? 'pon' : 'daiminkan',
      fromPlayerId: zone.fromPlayerId,
      calledTileId: sideways.length === 1 ? sideways[0].tile.id : '',
      confident: items.every((item) => item.prediction.candidates[0].confidence >= 0.85),
    });
  }
  if (groups.length > 4) needsReview = true;
  return { groups, kita, needsReview };
}
