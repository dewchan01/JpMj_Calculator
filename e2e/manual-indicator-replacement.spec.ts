import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 740 }, serviceWorkers: 'block' });
test('manually replacing a dora indicator saves the newly selected tile', async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const sheet = page.locator('app-tile-entry-dialog dialog[open]');
  await sheet.locator('app-tile-picker button').first().click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.game-prompt[open]')).toHaveCount(0);
  const dora = page.locator('.indicator-bar button').first();
  await expect(dora.locator('img')).toHaveAttribute('src', /Man1\.svg/);
  for (const index of [1, 2, 3]) {
    await dora.click();
    await sheet.locator('.tile-entry-tray button.tile').click();
    await sheet.locator('app-tile-picker button').nth(index).click();
    await expect(sheet).toHaveCount(0);
    await expect(dora.locator('app-tile-art')).toHaveCount(1);
    await expect(dora.locator('img')).toHaveAttribute('src', new RegExp(`Man${index + 1}\\.svg`));
  }
  await page.reload();
  await expect(dora.locator('img')).toHaveAttribute('src', /Man4\.svg/);
});
