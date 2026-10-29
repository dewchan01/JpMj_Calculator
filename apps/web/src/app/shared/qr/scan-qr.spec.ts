import { afterEach, describe, expect, it, vi } from 'vitest';
import { scanQrImage } from './scan-qr';

const decode = vi.hoisted(() => vi.fn());
vi.mock('jsqr', () => ({ default: decode }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

function image() {
  const bitmap = { width: 4000, height: 3000, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn((_: number, __: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(4),
      width,
      height,
    })),
  };
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  });
  return bitmap;
}

describe('QR image scanning', () => {
  it('uses native QR detection when available and releases the image', async () => {
    const bitmap = image();
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        async detect() {
          return [{ rawValue: ' https://example.com/#/online?room=1234567890&pin=123456 ' }];
        }
      },
    );
    await expect(scanQrImage({ size: 10 } as File)).resolves.toContain('pin=123456');
    expect(decode).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('falls back after unsupported native detection and retries at different resolutions', async () => {
    const bitmap = image();
    vi.stubGlobal(
      'BarcodeDetector',
      class {
        async detect() {
          throw new Error('Unsupported');
        }
      },
    );
    decode.mockReturnValueOnce(null).mockReturnValueOnce({ data: '1234567890' });
    await expect(scanQrImage({ size: 10 } as File)).resolves.toBe('1234567890');
    expect(decode.mock.calls.map((call) => call.slice(1, 3))).toEqual([
      [3200, 2400],
      [1600, 1200],
    ]);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('reports no QR only after all resolutions fail and releases the image', async () => {
    const bitmap = image();
    vi.stubGlobal('BarcodeDetector', undefined);
    decode.mockReturnValue(null);
    await expect(scanQrImage({ size: 10 } as File)).rejects.toThrow('No QR code found.');
    expect(decode).toHaveBeenCalledTimes(3);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
