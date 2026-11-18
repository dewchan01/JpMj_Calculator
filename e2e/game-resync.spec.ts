import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
test('game refresh reloads the current game without a manual update check', async ({ page }) => {
  let checks = 0;
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.route('**/version.json', (route) => {
    if (route.request().headers()['ngsw-bypass']) checks++;
    return route.fulfill({ json: { version: '1.0.0', commit: 'same', dirty: false } });
  });
  await page.goto('/');
  await expect.poll(() => checks).toBe(1);
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page).toHaveURL(/\/score\//);
  const url = page.url();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Refresh page', exact: true }).click(),
  ]);
  await expect(page).toHaveURL(url);
  await expect(page.locator('.game-shell')).toBeVisible();
  await expect.poll(() => checks).toBe(2);
  await expect(page.getByRole('button', { name: 'Refresh page', exact: true })).toBeEnabled();
});
