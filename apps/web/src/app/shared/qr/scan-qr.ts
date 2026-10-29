interface NativeQrDetector {
  detect(image: ImageBitmap): Promise<Array<{ rawValue: string }>>;
}

export async function scanQrImage(file: File, thorough = true): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Archive must be smaller than 20 MiB.');
  const bitmap = await createImageBitmap(file);
  try {
    const Detector = (
      globalThis as typeof globalThis & {
        BarcodeDetector?: new (options: { formats: string[] }) => NativeQrDetector;
      }
    ).BarcodeDetector;
    if (Detector) {
      try {
        const codes = await new Detector({ formats: ['qr_code'] }).detect(bitmap);
        const value = codes.find((code) => code.rawValue.trim())?.rawValue.trim();
        if (value) return value;
      } catch {
        // Some browsers expose the detector without supporting QR codes.
      }
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No QR code found.');
    const { default: jsQR } = await import('jsqr');
    const sizes = new Set(
      [3200, 1600, 1000].map((limit) => Math.min(limit, Math.max(bitmap.width, bitmap.height))),
    );
    for (const size of sizes) {
      const scale = size / Math.max(bitmap.width, bitmap.height);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(pixels.data, pixels.width, pixels.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (result?.data.trim()) return result.data.trim();
    }
    if (thorough) {
      // Preserve small QR details instead of shrinking the entire camera photo.
      const regions = [
        [0.15, 0.15],
        [0, 0],
        [0.3, 0],
        [0, 0.3],
        [0.3, 0.3],
      ];
      for (const [x, y] of regions) {
        const width = bitmap.width * 0.7;
        const height = bitmap.height * 0.7;
        const scale = Math.min(1, 2000 / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        context.drawImage(
          bitmap,
          bitmap.width * x,
          bitmap.height * y,
          width,
          height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        for (const enhance of [false, true]) {
          if (enhance) {
            let low = 255;
            let high = 0;
            for (let i = 0; i < pixels.data.length; i += 4) {
              const gray = Math.round(
                0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2],
              );
              pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = gray;
              low = Math.min(low, gray);
              high = Math.max(high, gray);
            }
            for (let i = 0; i < pixels.data.length; i += 4) {
              const value =
                high > low ? ((pixels.data[i] - low) * 255) / (high - low) : pixels.data[i];
              pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
            }
          }
          const result = jsQR(pixels.data, pixels.width, pixels.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (result?.data.trim()) return result.data.trim();
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    throw new Error('No QR code found.');
  } finally {
    bitmap.close();
  }
}

export function transferId(text: string): string {
  let id = text.trim();
  try {
    const value: unknown = JSON.parse(id);
    if (
      value &&
      typeof value === 'object' &&
      'format' in value &&
      value.format === 'riichi-share' &&
      'version' in value &&
      value.version === 1 &&
      'id' in value &&
      typeof value.id === 'string'
    )
      id = value.id;
  } catch {
    /* Raw transfer IDs and older QR URLs remain valid. */
  }
  if (!/^[a-f0-9]{64}$/.test(id)) {
    try {
      const url = new URL(id);
      id =
        url.searchParams.get('share') ??
        new URLSearchParams(url.hash.split('?')[1]).get('share') ??
        '';
    } catch {
      id = '';
    }
  }
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid transfer code.');
  return id;
}
