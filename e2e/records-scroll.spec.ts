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
            events: [
              {
                id: 'draw',
                type: 'exhaustiveDraw',
                timestamp: '2026-11-01T13:00:00Z',
                payments: [],
                before: { dealerId: 'a', roundWind: 'east', handNumber: 1, honba: 0 },
                after: { dealerId: 'b', roundWind: 'east', handNumber: 2, honba: 1 },
              },
            ],
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
  const results = page.locator('app-final-results');
  await results.getByRole('button', { name: 'List', exact: true }).click();
  await results.getByRole('button', { name: 'History', exact: true }).click();
  await page.locator('details.history-event > summary').click();
  await results.getByRole('button', { name: 'Details', exact: true }).click();
  await page.locator('details.score-data > summary').click();
  await results.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('details.history-event')).toHaveAttribute('open', '');
  await results.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.locator('details.score-data')).toHaveAttribute('open', '');
  await results.getByRole('button', { name: 'Result', exact: true }).click();
  await expect(results.getByRole('button', { name: 'List', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(top - 5);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(top + 5);
  await page.goBack();
  await expect(page.locator('app-final-results')).toBeVisible();
  await expect(results.getByRole('button', { name: 'Result', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(results.getByRole('button', { name: 'Table', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await results.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.locator('details.history-event')).not.toHaveAttribute('open');
  await results.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.locator('details.score-data')).not.toHaveAttribute('open');
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
  await page.locator('.player-profile-link').first().click();
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  const comparison = page.getByRole('combobox', { name: 'Compare with', exact: true });
  await comparison.selectOption({ index: 1 });
  const comparisonValue = await comparison.inputValue();
  await page.locator('details.metric-definitions > summary').click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(comparison).toHaveValue(comparisonValue);
  await expect(page.locator('details.metric-definitions')).toHaveAttribute('open', '');
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page.locator('.player-profile-link').first()).toBeVisible();
  await page.locator('.player-profile-link').first().click();
  await expect(page.getByRole('button', { name: 'Overview', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(comparison).toHaveValue('');
  await expect(page.locator('details.metric-definitions')).not.toHaveAttribute('open');
});
