import { describe, expect, it } from 'vitest';
import { kindIndex, parseTiles } from '../../../../../../../packages/mahjong-core/index';
import { meldTileError } from './meld-tile-validation';

describe('meld entry guidance', () => {
  it('accepts one tile or a complete matching pon/kan, including a red five', () => {
    expect(meldTileError(parseTiles('0p'), 'pon')).toBe('');
    expect(meldTileError(parseTiles('555p'), 'pon')).toBe('');
    expect(meldTileError(parseTiles('0555p'), 'ankan')).toBe('');
    expect(meldTileError(parseTiles('5p'), 'daiminkan')).toBe('');
    expect(meldTileError(parseTiles('55p'), 'pon')).not.toBe('');
    expect(meldTileError(parseTiles('555p'), 'ankan')).not.toBe('');
  });
  it('requires the full suited sequence for chi and the matching fourth tile for kakan', () => {
    expect(meldTileError(parseTiles('234p'), 'chi')).toBe('');
    expect(meldTileError(parseTiles('2p'), 'chi')).not.toBe('');
    expect(meldTileError(parseTiles('123z'), 'chi')).not.toBe('');
    expect(meldTileError(parseTiles('5p'), 'kakan', kindIndex(parseTiles('0p')[0].kind))).toBe('');
    expect(meldTileError(parseTiles('6p'), 'kakan', kindIndex(parseTiles('5p')[0].kind))).not.toBe(
      '',
    );
  });
});
