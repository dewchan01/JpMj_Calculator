import { expect, test } from '@playwright/test';
import { enterLiveTiles, prompt } from './helpers/game';

test('rolling dice uses the bundled Myinstants recording', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & { playedSounds: string[] };
    state.playedSounds = [];
    HTMLMediaElement.prototype.play = function () {
      if (!this.src.includes('/sounds/music/')) state.playedSounds.push(this.src);
      return Promise.resolve();
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Dice', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Dice', exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as Window & { playedSounds: string[] }).playedSounds))
    .toEqual([expect.stringContaining('/sounds/rolling-dice.mp3')]);
  const response = await page.request.get('/sounds/rolling-dice.mp3');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('audio/mpeg');
  expect((await response.body()).byteLength).toBeGreaterThan(1000);
});

test('table dice identify the second roller from East as one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await enterLiveTiles(page, 'Dora indicators', '1m');
  await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
  await page.getByRole('button', { name: 'Dice', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Dice', exact: true });
  await expect(dialog.locator('.next-roller')).toBeVisible();
  const dice = await dialog
    .locator('.die[data-result]')
    .evaluateAll((elements) =>
      elements.map((element) => Number(element.getAttribute('data-result'))),
    );
  const offset = (dice[0] + dice[1] - 1) % 4;
  await expect(dialog.locator('.next-roller')).toContainText(`Player ${offset + 1}`);
  await expect(dialog.locator('.next-roller')).toContainText(
    ['East', 'South', 'West', 'North'][offset],
  );
});
