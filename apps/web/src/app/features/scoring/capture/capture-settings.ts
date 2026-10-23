import { detectionEndpoint } from './api-recognizer';
import type { RoboflowSettings } from './roboflow-recognizer';

export type CaptureConfig = { timeoutMs: number } & (
  | { provider: 'api'; endpoint: string }
  | { provider: 'roboflow'; roboflow: RoboflowSettings }
  | { provider: 'mock' }
);

/** Validate the selected provider only, so inactive settings can remain in the file. */
export function parseCaptureConfig(value: unknown): CaptureConfig {
  const invalid = () => new Error('Photo recognition configuration is invalid.');
  if (typeof value !== 'object' || value === null || !('recognition' in value)) throw invalid();
  const settings = value.recognition;
  if (typeof settings !== 'object' || settings === null || !('provider' in settings))
    throw invalid();
  const timeoutMs = 'timeoutMs' in settings ? settings.timeoutMs : 30000;
  if (
    typeof timeoutMs !== 'number' ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1000 ||
    timeoutMs > 120000
  )
    throw invalid();
  switch (settings.provider) {
    case 'mock':
      return { provider: 'mock', timeoutMs };
    case 'api': {
      if (!('endpoint' in settings) || typeof settings.endpoint !== 'string') throw invalid();
      return { provider: 'api', timeoutMs, endpoint: detectionEndpoint(settings.endpoint) };
    }
    case 'roboflow': {
      if (!('roboflow' in settings)) throw invalid();
      const model = settings.roboflow;
      if (
        typeof model !== 'object' ||
        model === null ||
        !('model' in model) ||
        typeof model.model !== 'string' ||
        !model.model.trim() ||
        !('version' in model) ||
        typeof model.version !== 'number' ||
        !Number.isInteger(model.version) ||
        model.version < 1 ||
        !('publishableApiKey' in model) ||
        typeof model.publishableApiKey !== 'string'
      )
        throw invalid();
      const classMap = 'classMap' in model ? model.classMap : {};
      if (
        typeof classMap !== 'object' ||
        classMap === null ||
        Array.isArray(classMap) ||
        Object.values(classMap).some((value) => typeof value !== 'string')
      )
        throw invalid();
      return {
        provider: 'roboflow',
        timeoutMs,
        roboflow: {
          model: model.model.trim(),
          version: model.version,
          publishableApiKey: model.publishableApiKey.trim(),
          classMap: classMap as Record<string, string>,
        },
      };
    }
    default:
      throw invalid();
  }
}
