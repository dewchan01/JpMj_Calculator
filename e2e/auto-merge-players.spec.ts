import { test, expect } from '@playwright/test';
import { gameMenu, prompt } from './helpers/game';

test.use({ serviceWorkers: 'block' });
for (const enabled of [true, false]) {
  test(`finished-game name matching follows the auto-merge switch (${enabled})`, async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
    await page.route('**/config.json', (route) =>
      route.fulfill({ json: { backend: { apiUrl: '' } } }),
    );
    await page.goto('/others/data-management');
    const toggle = page.getByRole('switch', {
      name: 'Automatically merge players by name after games end',
      exact: true,
    });
    await expect(toggle).toBeChecked();
    await toggle.setChecked(enabled);
    await page.reload();
    await expect(toggle).toBeChecked({ checked: enabled });
    await page.goto('/');
    await page.getByRole('button', { name: /Start match/ }).click();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await expect(page).toHaveURL(/\/score\//);
    const currentId = page.url().split('/').pop()!;
    await page.evaluate(async (id) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('riichi-table');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('matches', 'readwrite');
        const store = tx.objectStore('matches');
        const get = store.get(id);
        get.onsuccess = () => {
          const current = get.result;
          current.players[0].name = 'Alice';
          current.players[0].profileId = 'incoming';
          store.put(current);
          const older = structuredClone(current);
          older.id = 'older';
          older.ended = true;
          older.players[0].profileId = 'saved-alice';
          older.players[1].name = 'alice';
          older.players[1].profileId = 'lowercase';
          store.put(older);
          localStorage.setItem(
            'riichi-players-v1',
            JSON.stringify([{ id: 'incoming', name: 'Alice' }]),
          );
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Fixture transaction aborted'));
      });
      db.close();
    }, currentId);
    await page.reload();
    await gameMenu(page, 'End entire match');
    await prompt(page).getByRole('button', { name: 'End entire match', exact: true }).click();
    await expect(page.locator('app-final-results')).toBeVisible();
    const identity = () =>
      page.evaluate(
        (id) =>
          new Promise<string>((resolve, reject) => {
            const request = indexedDB.open('riichi-table');
            request.onsuccess = () => {
              const db = request.result;
              const get = db.transaction('matches').objectStore('matches').get(id);
              get.onsuccess = () => {
                resolve(get.result.players[0].profileId);
                db.close();
              };
              get.onerror = () => reject(get.error);
            };
            request.onerror = () => reject(request.error);
          }),
        currentId,
      );
    await expect.poll(identity).toBe(enabled ? 'saved-alice' : 'incoming');
    await page.reload();
    await expect.poll(identity).toBe(enabled ? 'saved-alice' : 'incoming');
  });
}
