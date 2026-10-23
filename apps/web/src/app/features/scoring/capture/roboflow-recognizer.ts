import { detectionPredictions } from './api-recognizer';
import { type TileRecognizer } from './recognizer';

export interface RoboflowSettings {
  model: string;
  version: number;
  publishableApiKey: string;
  classMap: Record<string, string>;
}

export function roboflowPredictions(
  value: unknown,
  width: number,
  height: number,
  classMap: Record<string, string>,
) {
  if (!Array.isArray(value)) {
    console.warn('[recognition] Roboflow output rejected', {
      reason: 'Expected a detection array',
      responseType: value === null ? 'null' : typeof value,
    });
    throw new Error('Invalid detection response.');
  }
  const predictions = value.map((prediction: unknown, index) => {
    if (
      typeof prediction !== 'object' ||
      prediction === null ||
      !('class' in prediction) ||
      typeof prediction.class !== 'string' ||
      !('bbox' in prediction) ||
      typeof prediction.bbox !== 'object' ||
      prediction.bbox === null ||
      !('confidence' in prediction)
    ) {
      console.warn('[recognition] Roboflow output rejected', {
        reason: 'Missing class, confidence or bounding box',
        predictionIndex: index,
      });
      throw new Error('Invalid detection response.');
    }
    return {
      ...prediction.bbox,
      class: classMap[prediction.class] ?? prediction.class,
      confidence: prediction.confidence,
    };
  });
  return detectionPredictions({ image: { width, height }, predictions });
}

export class RoboflowRecognizer implements TileRecognizer {
  constructor(
    private readonly settings: RoboflowSettings,
    private readonly timeoutMs: number,
  ) {}
  async recognize(input: Blob, options: { playerCount: 3 | 4; signal?: AbortSignal }) {
    if (!this.settings.publishableApiKey.trim())
      throw new Error(
        'Set the Roboflow Publishable API Key in config.json before recognizing photos.',
      );
    const { InferenceEngine } = await import('inferencejs');
    const engine = new InferenceEngine();
    const bitmap = await createImageBitmap(input);
    // inferencejs transfers the bitmap to its worker, detaching the original.
    const { width, height } = bitmap;
    let worker: string | undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel = () => {};
    const aborted = new Promise<never>((_resolve, reject) => {
      cancel = () => {
        cancelled = true;
        reject(new Error('Detection cancelled or timed out. Try a smaller image.'));
      };
      timer = setTimeout(cancel, this.timeoutMs);
      options.signal?.addEventListener('abort', cancel, { once: true });
      if (options.signal?.aborted) cancel();
    });
    const infer = async () => {
      worker = await engine.startWorker(
        this.settings.model,
        this.settings.version,
        this.settings.publishableApiKey.trim(),
      );
      if (cancelled) {
        await engine.stopWorker(worker);
        throw new Error('Detection cancelled.');
      }
      console.info('[recognition] Roboflow model ready');
      const result = await engine.infer(worker, bitmap);
      console.info('[recognition] Roboflow inference finished', {
        width,
        height,
        predictions: Array.isArray(result) ? result.length : null,
      });
      return {
        modelName: 'Roboflow browser',
        modelVersion: String(this.settings.version),
        predictions: roboflowPredictions(result, width, height, this.settings.classMap),
      };
    };
    try {
      return await Promise.race([infer(), aborted]);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      bitmap.close();
      if (worker) void engine.stopWorker(worker).catch(() => {});
    }
  }
}
