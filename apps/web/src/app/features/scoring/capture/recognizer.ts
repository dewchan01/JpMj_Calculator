import { kindAt, type TileKind } from '../../../../../../../packages/mahjong-core/index';
export interface TilePrediction {
  box: { x: number; y: number; width: number; height: number };
  candidates: { tile: TileKind; isRed: boolean; confidence: number }[];
}
export interface TileRecognizer {
  recognize(
    input: Blob,
    options: { playerCount: 3 | 4; signal?: AbortSignal },
  ): Promise<{ modelName: string; modelVersion: string; predictions: TilePrediction[] }>;
}
/** Fixed demo data. This deliberately performs no image inference. */
export class MockTileRecognizer implements TileRecognizer {
  async recognize(
    _input: Blob,
    options: { playerCount: 3 | 4; signal?: AbortSignal },
  ): Promise<{ modelName: string; modelVersion: string; predictions: TilePrediction[] }> {
    const offset = options.playerCount === 3 ? 9 : 0;
    return {
      modelName: 'MOCK — fixed example, not AI',
      modelVersion: '1',
      predictions: [0, 1, 2].map((i) => ({
        box: { x: i / 3, y: 0.1, width: 0.3, height: 0.8 },
        candidates: [{ tile: kindAt(offset + i), isRed: false, confidence: 0.5 }],
      })),
    };
  }
}
