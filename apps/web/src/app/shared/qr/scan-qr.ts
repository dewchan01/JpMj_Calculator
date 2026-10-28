export async function scanQrImage(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Archive must be smaller than 20 MiB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No QR code found.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const { default: jsQR } = await import('jsqr');
    const result = jsQR(pixels.data, pixels.width, pixels.height);
    if (!result) throw new Error('No QR code found.');
    return result.data.trim();
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
