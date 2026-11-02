import { test, expect } from '@playwright/test';
import { prompt } from './helpers/game';

test.use({ serviceWorkers: 'block' });
test('the central table button always opens the settlement choices', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page
      .locator('app-table-summary')
      .getByRole('button', { name: 'End this hand', exact: true })
      .click();
    await expect(prompt(page)).toBeVisible();
    for (const name of ['Win', 'Record draw', 'Nagashi Mangan', 'Chombo'])
      await expect(prompt(page).getByRole('button', { name, exact: true })).toBeVisible();
    await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(prompt(page)).toBeHidden();
  }
});
