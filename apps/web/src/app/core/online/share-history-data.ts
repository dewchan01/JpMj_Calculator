import type { ShareReceipt } from './online-api';

export interface SavedShare extends ShareReceipt {
  title: string;
  gameCount: number;
  createdAt: string;
}

export function parseShareHistory(text: string | null, now = Date.now()): SavedShare[] {
  try {
    const value: unknown = JSON.parse(text ?? '[]');
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is SavedShare =>
          item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          /^[a-f0-9]{64}$/.test(item.id) &&
          typeof item.deletionSecret === 'string' &&
          /^[a-f0-9]{64}$/.test(item.deletionSecret) &&
          typeof item.title === 'string' &&
          item.title.length <= 200 &&
          Number.isInteger(item.gameCount) &&
          item.gameCount > 0 &&
          item.gameCount <= 500 &&
          typeof item.createdAt === 'string' &&
          Number.isFinite(Date.parse(item.createdAt)) &&
          typeof item.expiresAt === 'string' &&
          Date.parse(item.expiresAt) > now,
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 100);
  } catch {
    return [];
  }
}
