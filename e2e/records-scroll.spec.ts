import { test, expect } from '@playwright/test';
import { presetRules } from '../packages/mahjong-rules/index';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
test('records restore list position after details and reset when switching tabs', async ({
  page,
}) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/records');
  await expect(page.getByRole('button', { name: 'Games', exact: true })).toBeVisible();
  await page.evaluate(
    async (rules) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('riichi-table');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('matches', 'readwrite');
        for (let i = 0; i < 20; i++)
          tx.objectStore('matches').put({
            id: `scroll-${i}`,
            schemaVersion: 1,
            name: `Scroll game ${i}`,
            createdAt: '2026-11-01T12:00:00Z',
            updatedAt: '2026-11-01T13:00:00Z',
            playerCount: 3,
            rules,
            players: ['a', 'b', 'c'].map((id) => ({ id, name: id })),
            initialBalances: { a: 35000, b: 35000, c: 35000 },
            initialDealerId: 'a',
            dealerId: 'a',
            roundWind: 'east',
            handNumber: 1,
            honba: 0,
            gameLength: 'east',
            ended: true,
            events: [],
          });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    },
    presetRules('mahjong-soul', 3),
  );
  await page.reload();
  const link = page.locator('.game-card-link').nth(10);
  await link.scrollIntoViewIfNeeded();
  const top = await page.evaluate(() => window.scrollY);
  expect(top).toBeGreaterThan(500);
  await link.click();
  await expect(page.locator('app-final-results')).toBeVisible();
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(top - 5);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(top + 5);
  await page.goBack();
  await expect(page.locator('app-final-results')).toBeVisible();
  await page.goForward();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(top - 5);
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 150));
  const playerTop = await page.evaluate(() => window.scrollY);
  await page.getByRole('button', { name: 'Games', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(top - 5);
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(playerTop);
});
