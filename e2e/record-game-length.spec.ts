import { test, expect } from '@playwright/test';
import { gameMenu, prompt } from './helpers/game';

test.use({ serviceWorkers: 'block' });
test('an East-and-South game ended during East keeps its original length in records', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
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
  await page.goto('/');
  await page.goto('/records');
  await expect(page).toHaveURL('/records');
  await expect(page.locator('.game-card .eyebrow')).toContainText('East and South game');
  await expect(page.locator('.game-card .eyebrow')).not.toContainText('East-only game');
});
