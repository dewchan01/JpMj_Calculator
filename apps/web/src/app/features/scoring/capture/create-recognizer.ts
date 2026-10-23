import type { CaptureConfig } from './capture-settings';
import { ApiTileRecognizer } from './api-recognizer';
import { MockTileRecognizer, type TileRecognizer } from './recognizer';
import { RoboflowRecognizer } from './roboflow-recognizer';

export function createRecognizer(config: CaptureConfig): TileRecognizer {
  switch (config.provider) {
    case 'api':
      return new ApiTileRecognizer(config.endpoint, fetch, config.timeoutMs);
    case 'roboflow':
      return new RoboflowRecognizer(config.roboflow, config.timeoutMs);
    case 'mock':
      return new MockTileRecognizer();
  }
}
