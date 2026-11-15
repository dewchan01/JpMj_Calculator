import { test, expect } from '@playwright/test';
import { prompt } from './helpers/game';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
test('Pon does not require selecting a called tile', async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  const fillTiles = async (label: string, value: string) => {
    const editor = page.locator(`app-tile-input[data-label="${label}"] dialog[open]`);
    await editor.getByText('Type tile notation instead', { exact: true }).click();
    await editor.getByRole('textbox', { name: label, exact: true }).fill(value);
    await editor.getByRole('button', { name: 'Apply notation', exact: true }).click();
    await expect(editor).toHaveCount(0);
  };
  await fillTiles('Dora indicators', '7z');
  await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 2' })
    .getByRole('button', { name: 'Call', exact: true })
    .click();
  await prompt(page).getByRole('button', { name: 'Pon', exact: true }).click();
  await fillTiles('Meld tiles', '111m');
  await expect(prompt(page).locator('app-tile-choice')).toHaveCount(0);
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  await expect(prompt(page)).not.toBeVisible();
});
