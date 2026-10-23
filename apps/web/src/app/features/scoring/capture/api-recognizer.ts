import { parseTiles } from '../../../../../../../packages/mahjong-core/index';
import {
  type TilePrediction,
  type TileRecognizer,
  type RecognitionOptions,
  type RecognitionResult,
} from './recognizer';

export const DETECTION_TIMEOUT_MS = 30_000;

export function detectionEndpoint(value: string): string {
  const url = new URL(value.trim());
  if (
    url.username ||
    url.password ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
  )
    throw new Error('Use an HTTPS detection endpoint, or HTTP on localhost.');
  return url.href;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function number(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** The API supplies pixel boxes with x/y at the center. UI boxes use normalized top-left coordinates. */
export function detectionPredictions(value: unknown): TilePrediction[] {
  if (!record(value) || !record(value['image']) || !Array.isArray(value['predictions']))
    throw new Error('Invalid detection response.');
  const width = value['image']['width'];
  const height = value['image']['height'];
  if (
    !number(width) ||
    width <= 0 ||
    !number(height) ||
    height <= 0 ||
    value['predictions'].length > 1000
  )
    throw new Error('Invalid detection response.');
  return value['predictions']
    .map((prediction: unknown): TilePrediction => {
      if (!record(prediction)) throw new Error('Invalid detection response.');
      const { class: label, confidence, x, y, width: boxWidth, height: boxHeight } = prediction;
      if (
        typeof label !== 'string' ||
        !/^(?:[0-9][mps]|[1-7]z)$/.test(label) ||
        !number(confidence) ||
        confidence < 0 ||
        confidence > 1 ||
        !number(x) ||
        !number(y) ||
        !number(boxWidth) ||
        boxWidth <= 0 ||
        !number(boxHeight) ||
        boxHeight <= 0
      )
        throw new Error('Invalid tile prediction in detection response.');
      const tile = parseTiles(label, 'detected')[0];
      const left = Math.max(0, x - boxWidth / 2);
      const top = Math.max(0, y - boxHeight / 2);
      const right = Math.min(width, x + boxWidth / 2);
      const bottom = Math.min(height, y + boxHeight / 2);
      if (right <= left || bottom <= top)
        throw new Error('Invalid tile prediction in detection response.');
      return {
        box: {
          x: left / width,
          y: top / height,
          width: (right - left) / width,
          height: (bottom - top) / height,
        },
        candidates: [{ tile: tile.kind, isRed: tile.isRed, confidence }],
      };
    })
    .sort((a, b) => a.box.x - b.box.x);
}

export class ApiTileRecognizer implements TileRecognizer {
  constructor(
    private readonly endpoint: string,
    private readonly request: typeof fetch = fetch,
    private readonly timeoutMs = DETECTION_TIMEOUT_MS,
  ) {}

  async recognize(input: Blob, options: RecognitionOptions): Promise<RecognitionResult> {
    const endpoint = detectionEndpoint(this.endpoint);
    const bytes = new Uint8Array(await input.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192)
      binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(cancel, this.timeoutMs);
    try {
      // Call fetch as a function; binding it to the recognizer is illegal in browsers.
      const request = this.request;
      const response = await request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: btoa(binary) }),
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw new Error(`Detection server returned HTTP ${response.status}.`);
      const body: unknown = await response.json();
      return {
        modelName: 'Detection API',
        modelVersion: '1',
        predictions: detectionPredictions(body),
      };
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error('Detection cancelled or timed out. Try a smaller image.');
      if (error instanceof TypeError)
        throw new Error(
          'Detection request failed. Check your connection and endpoint CORS settings.',
        );
      throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', cancel);
    }
  }
}
