import { expect, test } from '@playwright/test';

test('rolling dice uses the bundled Myinstants recording', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & { playedSounds: string[] };
    state.playedSounds = [];
    HTMLMediaElement.prototype.play = function () {
      state.playedSounds.push(this.src);
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
