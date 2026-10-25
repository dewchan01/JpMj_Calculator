import type { Page } from '@playwright/test';
import type { Match } from '../../packages/mahjong-core/ledger';

/** Seed a late-round fixture without exposing editable game context in the product. */
export async function setSavedRound(
  page: Page,
  round: Pick<Match, 'dealerId' | 'roundWind' | 'handNumber' | 'honba'>,
): Promise<void> {
  await page.evaluate(async (state) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('riichi-table');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('matches', 'readwrite');
      const store = transaction.objectStore('matches');
      const records = store.getAll();
      records.onsuccess = () => {
        const match = records.result[0] as Record<string, unknown> | undefined;
        if (!match) {
          transaction.abort();
          return;
        }
        store.put({ ...match, ...state });
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Match fixture unavailable'));
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, round);
}
