import type { InferenceEngine } from 'inferencejs';
import { detectionPredictions } from './api-recognizer';
import { type TileRecognizer, type RecognitionOptions, type RecognitionResult } from './recognizer';

export interface RoboflowSettings {
  model: string;
  version: number;
  publishableApiKey: string;
  classMap: Record<string, string>;
  ignoredClasses?: string[];
}

export function roboflowPredictions(
  value: unknown,
  width: number,
  height: number,
  classMap: Record<string, string>,
  ignoredClasses: readonly string[] = [],
) {
  if (!Array.isArray(value)) {
    console.warn('[recognition] Roboflow output rejected', {
      reason: 'Expected a detection array',
      responseType: value === null ? 'null' : typeof value,
    });
    throw new Error('Invalid detection response.');
  }
  const included = value.filter(
    (prediction: unknown) =>
      !(
        typeof prediction === 'object' &&
        prediction !== null &&
        'class' in prediction &&
        typeof prediction.class === 'string' &&
        ignoredClasses.includes(prediction.class)
      ),
  );
  const predictions = included.map((prediction: unknown, index) => {
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
  private session?: Promise<{ engine: InferenceEngine; worker: string }>;
  private queue: Promise<void> = Promise.resolve();

  private loadSession(): Promise<{ engine: InferenceEngine; worker: string }> {
    if (!this.session) {
      const startup = (async () => {
        const { InferenceEngine } = await import('inferencejs');
        const engine = new InferenceEngine();
        const worker = await engine.startWorker(
          this.settings.model,
          this.settings.version,
          this.settings.publishableApiKey.trim(),
        );
        console.info('[recognition] Roboflow model ready');
        return { engine, worker };
      })();
      this.session = startup;
      void startup.catch(() => {
        if (this.session === startup) this.session = undefined;
      });
    }
    return this.session;
  }

  /** Release failed or replaced models; successful inference keeps its worker warm. */
  dispose(): void {
    const session = this.session;
    this.session = undefined;
    if (session)
      void session.then(({ engine, worker }) => engine.stopWorker(worker)).catch(() => {});
  }

  constructor(
    private readonly settings: RoboflowSettings,
    private readonly timeoutMs: number,
  ) {}
  recognize(input: Blob, options: RecognitionOptions): Promise<RecognitionResult> {
    // A shared worker processes one image at a time, including requests from other dialogs.
    const result = this.queue.then(() => this.perform(input, options));
    this.queue = result.then(
      () => {},
      () => {},
    );
    return result;
  }

  private async perform(input: Blob, options: RecognitionOptions): Promise<RecognitionResult> {
    if (!this.settings.publishableApiKey.trim())
      throw new Error(
        'Set the Roboflow Publishable API Key in config.json before recognizing photos.',
      );
    if (options.signal?.aborted)
      throw new Error('Detection cancelled or timed out. Try a smaller image.');
    let bitmap: ImageBitmap | undefined;
    let cancelled = false;
    let cancel = () => {};
    const aborted = new Promise<never>((_resolve, reject) => {
      cancel = () => {
        cancelled = true;
        reject(new Error('Detection cancelled or timed out. Try a smaller image.'));
      };
    });
    const timer = setTimeout(cancel, this.timeoutMs);
    options.signal?.addEventListener('abort', cancel, { once: true });
    const infer = async (): Promise<RecognitionResult> => {
      const image = await createImageBitmap(input);
      if (cancelled) {
        image.close();
        throw new Error('Detection cancelled.');
      }
      bitmap = image;
      const { width, height } = image;
      const { engine, worker } = await this.loadSession();
      if (cancelled) throw new Error('Detection cancelled.');
      const result = await engine.infer(worker, image);
      if (cancelled) throw new Error('Detection cancelled.');
      console.info('[recognition] Roboflow inference finished', {
        width,
        height,
        predictions: Array.isArray(result) ? result.length : null,
      });
      return {
        modelName: this.settings.model,
        modelVersion: String(this.settings.version),
        predictions: roboflowPredictions(
          result,
          width,
          height,
          this.settings.classMap,
          this.settings.ignoredClasses,
        ),
      };
    };
    try {
      return await Promise.race([infer(), aborted]);
    } catch (error) {
      this.dispose();
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      bitmap?.close();
    }
  }
}
