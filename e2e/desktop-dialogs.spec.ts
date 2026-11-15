import { test, expect } from '@playwright/test';
import { prompt } from './helpers/game';

test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
test('Desktop nested tile dialogs stay centered', async ({ page }) => {
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
  await prompt(page).getByRole('button', { name: 'Chi', exact: true }).click();
  await fillTiles('Meld tiles', '123m');
  const picker = page.locator('app-tile-choice dialog[open]');
  await expect(picker).toBeVisible();
  const viewport = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }));
  for (const dialog of [prompt(page), picker]) {
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    // Native modal centering can reserve half a classic scrollbar gutter.
    expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(9);
    expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(2);
    expect(box!.height).toBeLessThanOrEqual(952);
  }
});
