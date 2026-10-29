import { describe, expect, it } from 'vitest';
import { parseTiles } from '../../../../../../../packages/mahjong-core/index';
import { detectionPredictions } from './api-recognizer';
import { recognizeLayout, type LocatedTile } from './recognition-layout';

function row(notation: string, x: number, y: number, sideways = -1): LocatedTile[] {
  const tiles = parseTiles(notation, `${x}-${y}`);
  let offset = x;
  return tiles.map((tile, index) => {
    const width = index === sideways ? 60 : 40;
    const height = index === sideways ? 40 : 60;
    const label =
      tile.kind.type === 'suited'
        ? `${tile.isRed ? 0 : tile.kind.rank}${{ man: 'm', pin: 'p', sou: 's' }[tile.kind.suit]}`
        : '1z';
    const prediction = detectionPredictions({
      image: { width: 1200, height: 600 },
      predictions: [{ class: label, confidence: 0.95, x: offset + width / 2, y, width, height }],
    })[0];
    offset += width + 5;
    return { tile, prediction };
  });
}
const hand = () => row('123m456p11z', 20, 100);

describe('photographed hand layout', () => {
  it('keeps sequences and triplets inside a continuous concealed hand', () => {
    expect(recognizeLayout(row('123m555p789s11z', 20, 100), 4)).toEqual([]);
  });
  it('requires a distinct hand region instead of treating every three tiles as calls', () => {
    expect(recognizeLayout(row('555p', 800, 100, 0), 4)).toEqual([]);
  });
  it('uses pixel orientation, separation and shape to suggest Chi and preserves called/red IDs', () => {
    const meld = row('406p', 800, 100, 1);
    expect(meld[1].prediction.orientation).toBe('sideways');
    const groups = recognizeLayout([...hand(), ...meld], 4);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      type: 'chi',
      confident: true,
      calledTileId: meld[1].tile.id,
    });
    expect(groups[0].tiles[1].isRed).toBe(true);
    expect(recognizeLayout([...hand(), ...meld], 3)).toEqual([]);
  });
  it('distinguishes Pon and four matching Kan tiles in another row', () => {
    expect(recognizeLayout([...hand(), ...row('555p', 20, 350, 0)], 4)[0]).toMatchObject({
      type: 'pon',
      confident: true,
    });
    expect(recognizeLayout([...hand(), ...row('0555p', 20, 350, 0)], 4)[0]).toMatchObject({
      type: 'daiminkan',
      confident: true,
    });
  });
  it('does not automatically promote isolated upright groups or low-confidence tiles', () => {
    expect(recognizeLayout([...hand(), ...row('555p', 800, 100)], 4)[0].confident).toBe(false);
    expect(recognizeLayout([...hand(), ...row('5555p', 800, 100)], 4)[0]).toMatchObject({
      type: 'ankan',
      confident: false,
    });
    const meld = row('555p', 800, 100, 0);
    meld[1].prediction.candidates[0].confidence = 0.5;
    expect(recognizeLayout([...hand(), ...meld], 4)[0].confident).toBe(false);
  });
  it('marks overlapping/stacked tiles uncertain rather than claiming an added Kan', () => {
    const meld = row('5555p', 800, 100, 0);
    meld[3].prediction.box.x = meld[1].prediction.box.x;
    const result = recognizeLayout([...hand(), ...meld], 4);
    expect(result[0].confident).toBe(false);
  });
});
