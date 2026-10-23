import type { CaptureConfig } from './capture-settings';
import { ApiTileRecognizer } from './api-recognizer';
import { MockTileRecognizer, type TileRecognizer } from './recognizer';
import { RoboflowRecognizer } from './roboflow-recognizer';

let cachedRoboflow: { signature: string; recognizer: RoboflowRecognizer } | undefined;

export function createRecognizer(config: CaptureConfig): TileRecognizer {
  const signature = config.provider === 'roboflow' ? JSON.stringify(config) : '';
  if (cachedRoboflow && cachedRoboflow.signature !== signature) {
    cachedRoboflow.recognizer.dispose();
    cachedRoboflow = undefined;
  }
  switch (config.provider) {
    case 'api':
      return new ApiTileRecognizer(config.endpoint, fetch, config.timeoutMs);
    case 'roboflow':
      if (!cachedRoboflow)
        cachedRoboflow = {
          signature,
          recognizer: new RoboflowRecognizer(config.roboflow, config.timeoutMs),
        };
      return cachedRoboflow.recognizer;
    case 'mock':
      return new MockTileRecognizer();
  }
}
