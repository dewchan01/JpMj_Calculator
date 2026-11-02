import { test, expect } from '@playwright/test';
import { gameMenu, prompt } from './helpers/game';

test.use({ serviceWorkers: 'block' });
test('auto-delete omits finished games until explicitly saved', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('riichi-advanced-scoring', 'true');
    localStorage.setItem('riichi-auto-delete-finished', 'true');
  });
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Game length', exact: true }).selectOption('south');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await gameMenu(page, 'End entire match');
  await prompt(page).getByRole('button', { name: 'End entire match', exact: true }).click();
  await expect(page.locator('app-final-results')).toBeVisible();
  const records = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('riichi-table');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const count = db.transaction('matches').objectStore('matches').count();
          count.onsuccess = () => {
            resolve(count.result);
            db.close();
          };
          count.onerror = () => reject(count.error);
        };
      }),
  );
  expect(records).toBe(0);
  await page
    .locator('app-final-results')
    .getByRole('button', { name: 'Save game', exact: true })
    .click();
  await page.goto('/');
  await page.goto('/records');
  await expect(page).toHaveURL('/records');
  await expect(page.locator('.game-card .eyebrow')).toContainText('East and South game');
  await expect(page.locator('.game-card .eyebrow')).not.toContainText('East-only game');
});
