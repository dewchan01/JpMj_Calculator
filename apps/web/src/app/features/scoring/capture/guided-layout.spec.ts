import { describe, expect, it } from 'vitest';
import { parseTiles } from '../../../../../../../packages/mahjong-core/index';
import { captureZones, guidedLayout, type CaptureZone } from './guided-layout';
import type { LocatedTile } from './recognition-layout';

function inside(notation: string, zone: CaptureZone, sideways = -1): LocatedTile[] {
  const tiles = parseTiles(notation, zone.id);
  const width = zone.box.width / (tiles.length + 1);
  return tiles.map((tile, i) => ({
    tile,
    prediction: {
      box: {
        x: zone.box.x + width * (i + 0.4),
        y: zone.box.y + zone.box.height * 0.25,
        width: width * 0.8,
        height: zone.box.height * 0.5,
      },
      orientation: i === sideways ? 'sideways' : 'upright',
      candidates: [{ tile: tile.kind, isRed: tile.isRed, confidence: 0.95 }],
    },
  }));
}

describe('guided photo zones', () => {
  it('keeps all four meld areas horizontal in landscape and portrait camera frames', () => {
    for (const aspect of [16 / 9, 4 / 3, 9 / 16]) {
      const melds = captureZones(['left', 'across', 'right', 'left'], false, aspect).filter(
        (zone) => zone.id.startsWith('meld-'),
      );
      expect(melds).toHaveLength(4);
      for (const zone of melds)
        expect((zone.box.width * aspect) / zone.box.height).toBeGreaterThanOrEqual(3.19);
      expect(melds[0].box.y).toBe(melds[1].box.y);
      expect(melds[2].box.y).toBeGreaterThan(melds[0].box.y);
    }
  });
  const zones = captureZones(['left', 'across', 'right', 'ankan'], true);
  it('uses explicit areas with a short hand, preserving source and red called tile', () => {
    const hand = inside('55p', zones[0]);
    const meld = inside('406p', zones[1], 1);
    const result = guidedLayout([...hand, ...meld], zones, 4, 'left');
    expect(result.needsReview).toBe(false);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({
      type: 'chi',
      fromPlayerId: 'left',
      confident: true,
      calledTileId: meld[1].tile.id,
    });
    expect(result.groups[0].tiles[1].isRed).toBe(true);
  });
  it('never promotes a sequence or triplet in the hand area', () => {
    expect(guidedLayout(inside('123m555p', zones[0]), zones, 4, 'left').groups).toEqual([]);
  });
  it('rejects Chi from a different player and prohibits Chi in Sanma', () => {
    const sequence = inside('123p', zones[2], 0);
    expect(guidedLayout(sequence, zones, 4, 'left')).toMatchObject({
      groups: [],
      needsReview: true,
    });
    expect(guidedLayout(inside('123p', zones[1], 0), zones, 3, 'left')).toMatchObject({
      groups: [],
      needsReview: true,
    });
  });
  it('recognizes an explicitly selected concealed Kan area without inventing a caller', () => {
    const result = guidedLayout(inside('0555p', zones[4]), zones, 3, 'left');
    expect(result.groups[0]).toMatchObject({ type: 'ankan', confident: true, calledTileId: '' });
    expect(result.groups[0].fromPlayerId).toBeUndefined();
  });
  it('does not turn the three remaining tiles of a boundary-crossing Kan into Pon', () => {
    const meld = inside('5555p', zones[1], 0);
    meld[3].prediction.box.x =
      zones[1].box.x + zones[1].box.width - meld[3].prediction.box.width / 2;
    expect(guidedLayout(meld, zones, 4, 'left')).toMatchObject({ groups: [], needsReview: true });
  });
  it('accepts only North in the Sanma North area and omits that area for four players', () => {
    const north = zones.find((zone) => zone.kind === 'kita')!;
    expect(guidedLayout(inside('44z', north), zones, 3, 'left').kita).toHaveLength(2);
    expect(guidedLayout(inside('1z', north), zones, 3, 'left')).toMatchObject({
      kita: [],
      needsReview: true,
    });
    expect(
      captureZones(['left', 'across', 'right', 'left'], false).some((zone) => zone.kind === 'kita'),
    ).toBe(false);
  });
});
