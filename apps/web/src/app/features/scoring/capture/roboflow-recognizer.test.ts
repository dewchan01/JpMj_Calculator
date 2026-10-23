import { describe, expect, it, vi, afterEach } from 'vitest';
import { roboflowPredictions, RoboflowRecognizer } from './roboflow-recognizer';
import { tileLabel } from '../../../../../../../packages/mahjong-core/index';

const sdk = vi.hoisted(() => ({ startWorker: vi.fn(), infer: vi.fn(), stopWorker: vi.fn() }));
vi.mock('inferencejs', () => ({
  InferenceEngine: class {
    startWorker = sdk.startWorker;
    infer = sdk.infer;
    stopWorker = sdk.stopWorker;
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Roboflow browser adapter', () => {
  it('retains dimensions when the SDK transfers and detaches the bitmap', async () => {
    const bitmap = { width: 100, height: 100, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    sdk.startWorker.mockResolvedValue('worker');
    sdk.stopWorker.mockResolvedValue(true);
    sdk.infer.mockImplementation(async () => {
      bitmap.width = 0;
      bitmap.height = 0;
      return [{ class: 'RD', confidence: 0.9, bbox: { x: 50, y: 50, width: 20, height: 40 } }];
    });
    const result = await new RoboflowRecognizer(
      { model: 'test', version: 1, publishableApiKey: 'public-test', classMap: { RD: '7z' } },
      30000,
    ).recognize(new Blob(['test']), { playerCount: 4 });
    expect(result.predictions[0].box).toEqual({ x: 0.4, y: 0.3, width: 0.2, height: 0.4 });
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(sdk.stopWorker).toHaveBeenCalledWith('worker');
  });
  it('maps configured class names and rejects unknown flowers rather than guessing', () => {
    const predictions = roboflowPredictions(
      [{ class: 'RD', confidence: 0.9, bbox: { x: 50, y: 50, width: 20, height: 40 } }],
      100,
      100,
      { RD: '7z' },
    );
    expect(tileLabel({ id: '', kind: predictions[0].candidates[0].tile, isRed: false })).toBe('C');
    expect(predictions[0].box.x).toBe(0.4);
    expect(() =>
      roboflowPredictions(
        [{ class: '1F', confidence: 0.9, bbox: { x: 50, y: 50, width: 20, height: 40 } }],
        100,
        100,
        {},
      ),
    ).toThrow();
  });
  it('requires a publishable key before loading the SDK', async () => {
    await expect(
      new RoboflowRecognizer(
        { model: 'test', version: 1, publishableApiKey: '', classMap: {} },
        30000,
      ).recognize(new Blob(['test']), { playerCount: 4 }),
    ).rejects.toThrow('Publishable API Key');
  });
});
