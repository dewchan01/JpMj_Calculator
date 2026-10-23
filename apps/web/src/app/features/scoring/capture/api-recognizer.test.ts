import { describe, expect, it, vi } from 'vitest';
import { ApiTileRecognizer, detectionEndpoint, detectionPredictions } from './api-recognizer';
import { tileLabel } from '../../../../../../../packages/mahjong-core/index';

const response = () => ({
  image: { width: 1600, height: 324 },
  predictions: [
    { class: '7z', confidence: 0.94, x: 1400, y: 160, width: 100, height: 140 },
    { class: '0m', confidence: 0.95, x: 200, y: 160, width: 100, height: 140 },
  ],
});
describe('configurable tile detection API', () => {
  it('maps red fives and honors, normalizes center boxes, and sorts left to right', () => {
    const result = detectionPredictions(response());
    expect(
      result.map((prediction) =>
        tileLabel({
          id: '',
          kind: prediction.candidates[0].tile,
          isRed: prediction.candidates[0].isRed,
        }),
      ),
    ).toEqual(['0m', 'C']);
    expect(result[0].box.x).toBe(150 / 1600);
    expect(result[0].box.y).toBe(90 / 324);
  });
  it('accepts an empty result but rejects invalid dimensions, classes and confidence', () => {
    expect(detectionPredictions({ image: { width: 1, height: 1 }, predictions: [] })).toEqual([]);
    expect(() => detectionPredictions({})).toThrow();
    expect(() =>
      detectionPredictions({ ...response(), image: { width: 0, height: 10 } }),
    ).toThrow();
    for (const override of [{ class: '8z' }, { confidence: 2 }, { width: -1 }, { x: NaN }]) {
      expect(() =>
        detectionPredictions({
          ...response(),
          predictions: [{ ...response().predictions[0], ...override }],
        }),
      ).toThrow();
    }
  });
  it('allows HTTPS and local HTTP but rejects insecure remote endpoints and credentials', () => {
    expect(detectionEndpoint('http://localhost:8000/detect')).toContain('localhost');
    for (const endpoint of [
      'http://remote.test/detect',
      'https://user:secret@remote.test',
      'javascript:alert(1)',
    ])
      expect(() => detectionEndpoint(endpoint)).toThrow();
  });
  it('posts raw base64 JSON to the configured endpoint without cookies', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(response())));
    await new ApiTileRecognizer('https://detector.example/api', request).recognize(
      new Blob(['test']),
      { playerCount: 4 },
    );
    expect(request).toHaveBeenCalledWith(
      'https://detector.example/api',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ image: 'dGVzdA==' }),
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  it('reports HTTP and network errors without falling back to fake suggestions', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 }));
    await expect(
      new ApiTileRecognizer('https://detector.example', request).recognize(new Blob(['x']), {
        playerCount: 4,
      }),
    ).rejects.toThrow('HTTP 429');
    request.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      new ApiTileRecognizer('https://detector.example', request).recognize(new Blob(['x']), {
        playerCount: 4,
      }),
    ).rejects.toThrow('CORS');
  });
  it('aborts timed-out requests', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    await expect(
      new ApiTileRecognizer('https://detector.example', request, 5).recognize(new Blob(['x']), {
        playerCount: 4,
      }),
    ).rejects.toThrow('timed out');
  });
});
