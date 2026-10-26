import { describe, expect, it } from 'vitest';
import { parseCaptureConfig } from './capture-settings';
import { createRecognizer } from './create-recognizer';
import { ApiTileRecognizer } from './api-recognizer';
import { RoboflowRecognizer } from './roboflow-recognizer';
import { MockTileRecognizer } from './recognizer';

const roboflow = {
  model: 'test-model',
  version: 1,
  publishableApiKey: 'public-test-key',
  classMap: { EW: '1z' },
};
describe('config.json recognition provider selection', () => {
  it('reuses Roboflow across dialogs and replaces it when the model configuration changes', () => {
    const config = parseCaptureConfig({ recognition: { provider: 'roboflow', roboflow } });
    const first = createRecognizer(config);
    expect(createRecognizer(structuredClone(config))).toBe(first);
    const replacement = createRecognizer(
      parseCaptureConfig({
        recognition: { provider: 'roboflow', roboflow: { ...roboflow, version: 2 } },
      }),
    );
    expect(replacement).not.toBe(first);
  });
  it('switches providers while retaining both settings without loading a model', () => {
    const settings = {
      provider: 'api',
      endpoint: 'https://detector.example/detect',
      timeoutMs: 45000,
      roboflow,
    };
    expect(createRecognizer(parseCaptureConfig({ recognition: settings }))).toBeInstanceOf(
      ApiTileRecognizer,
    );
    expect(
      createRecognizer(parseCaptureConfig({ recognition: { ...settings, provider: 'roboflow' } })),
    ).toBeInstanceOf(RoboflowRecognizer);
    expect(
      createRecognizer(parseCaptureConfig({ recognition: { ...settings, provider: 'mock' } })),
    ).toBeInstanceOf(MockTileRecognizer);
  });
  it('ignores unfinished inactive providers and does not require an HTTP endpoint for Roboflow', () => {
    expect(
      parseCaptureConfig({
        recognition: { provider: 'roboflow', endpoint: 'not-a-url', roboflow },
      }),
    ).toEqual({ provider: 'roboflow', timeoutMs: 30000, roboflow });
    expect(
      parseCaptureConfig({
        recognition: {
          provider: 'api',
          endpoint: 'https://detector.example',
          roboflow: { version: 'unfinished' },
        },
      }).provider,
    ).toBe('api');
    expect(parseCaptureConfig({ recognition: { provider: 'mock' } }).provider).toBe('mock');
  });
  it('validates active provider settings and rejects unknown providers', () => {
    for (const recognition of [
      { provider: 'unknown' },
      { provider: 'api' },
      { provider: 'api', endpoint: 'http://remote.example' },
      { provider: 'roboflow' },
      { provider: 'roboflow', roboflow: { ...roboflow, model: '' } },
      { provider: 'roboflow', roboflow: { ...roboflow, version: 0 } },
      { provider: 'roboflow', roboflow: { ...roboflow, classMap: [] } },
      { provider: 'roboflow', roboflow: { ...roboflow, classMap: { EW: 1 } } },
    ])
      expect(() => parseCaptureConfig({ recognition })).toThrow();
  });
  it('defaults to direct class labels and trims browser settings', () => {
    const parsed = parseCaptureConfig({
      recognition: {
        provider: 'roboflow',
        roboflow: { model: ' test ', version: 2, publishableApiKey: ' public ' },
      },
    });
    expect(parsed).toMatchObject({
      roboflow: { model: 'test', version: 2, publishableApiKey: 'public', classMap: {} },
    });
  });
  it('accepts explicit ignored labels and rejects malformed exclusion lists', () => {
    const recognition = { provider: 'roboflow', roboflow: { ...roboflow, ignoredClasses: ['0z'] } };
    expect(parseCaptureConfig({ recognition })).toMatchObject({
      roboflow: { ignoredClasses: ['0z'] },
    });
    for (const ignoredClasses of ['0z', [1], [''], null]) {
      expect(() =>
        parseCaptureConfig({
          recognition: { ...recognition, roboflow: { ...roboflow, ignoredClasses } },
        }),
      ).toThrow();
    }
  });
  it.each([0, 999, 120001, 1.5, '30000', null])('rejects invalid timeout %s', (timeoutMs) => {
    expect(() => parseCaptureConfig({ recognition: { provider: 'mock', timeoutMs } })).toThrow();
  });
});
