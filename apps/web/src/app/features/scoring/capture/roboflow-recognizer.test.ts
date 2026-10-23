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
  it('normalizes riichi labels, preserves red fives and excludes only configured classes', () => {
    const detections = ['0m', '0p', '0s', '5z', '7z', '0z'].map((label, index) => ({
      class: label,
      confidence: 0.95,
      bbox: { x: 10 + index * 15, y: 50, width: 10, height: 30 },
    }));
    const predictions = roboflowPredictions(detections, 100, 100, {}, ['0z']);
    expect(predictions).toHaveLength(5);
    expect(predictions.slice(0, 3).every((prediction) => prediction.candidates[0].isRed)).toBe(
      true,
    );
    expect(predictions[3].candidates[0].tile).toEqual({ type: 'dragon', dragon: 'white' });
    expect(() => roboflowPredictions(detections, 100, 100, {})).toThrow();
    expect(() =>
      roboflowPredictions([{ ...detections[0], class: 'unknown' }], 100, 100, {}, ['0z']),
    ).toThrow();
  });
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
    expect(result.modelName).toBe('test');
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(sdk.stopWorker).not.toHaveBeenCalled();
  });
  it('reuses a warm model and serializes images without starting another worker', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockImplementation(async () => ({ width: 100, height: 100, close: vi.fn() })),
    );
    sdk.startWorker.mockResolvedValue('warm-worker');
    let release!: (value: unknown[]) => void;
    sdk.infer
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue([]);
    const recognizer = new RoboflowRecognizer(
      { model: 'test', version: 1, publishableApiKey: 'public-test', classMap: {} },
      30000,
    );
    const first = recognizer.recognize(new Blob(), { playerCount: 4 });
    const second = recognizer.recognize(new Blob(), { playerCount: 4 });
    await vi.waitFor(() => expect(sdk.infer).toHaveBeenCalledTimes(1));
    release([]);
    await Promise.all([first, second]);
    expect(sdk.startWorker).toHaveBeenCalledTimes(1);
    expect(sdk.infer).toHaveBeenCalledTimes(2);
    expect(sdk.stopWorker).not.toHaveBeenCalled();
    recognizer.dispose();
    await vi.waitFor(() => expect(sdk.stopWorker).toHaveBeenCalledWith('warm-worker'));
  });
  it('cleans up a cancelled startup and allows a fresh model on retry', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockImplementation(async () => ({ width: 100, height: 100, close: vi.fn() })),
    );
    let ready!: (worker: string) => void;
    sdk.startWorker
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            ready = resolve;
          }),
      )
      .mockResolvedValue('retry-worker');
    sdk.infer.mockResolvedValue([]);
    const recognizer = new RoboflowRecognizer(
      { model: 'test', version: 1, publishableApiKey: 'public-test', classMap: {} },
      30000,
    );
    const controller = new AbortController();
    const pending = recognizer.recognize(new Blob(), { playerCount: 4, signal: controller.signal });
    const rejected = expect(pending).rejects.toThrow('cancelled');
    await vi.waitFor(() => expect(sdk.startWorker).toHaveBeenCalledTimes(1));
    controller.abort();
    await rejected;
    ready('cancelled-worker');
    await vi.waitFor(() => expect(sdk.stopWorker).toHaveBeenCalledWith('cancelled-worker'));
    await expect(recognizer.recognize(new Blob(), { playerCount: 4 })).resolves.toMatchObject({
      predictions: [],
    });
    expect(sdk.startWorker).toHaveBeenCalledTimes(2);
    recognizer.dispose();
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
