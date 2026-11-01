import { test, expect } from '@playwright/test';
import { gameMenu, prompt, enterLiveTiles } from './helpers/game';
test.use({ serviceWorkers: 'block' });
test('shared game can return home and resume without leaving the room', async ({ page }) => {
  test.setTimeout(60000);
  const api = process.env['RIICHI_API_TEST_URL']!;
  test.skip(!api, 'Requires local API.');
  await page.route('**/config.json', (r) => r.fulfill({ json: { backend: { apiUrl: api } } }));
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await page.getByRole('button', { name: 'Host game', exact: true }).click();
  await page.locator('app-online').getByRole('button', { name: 'Start game', exact: true }).click();
  await enterLiveTiles(page, 'Dora indicators', '7z');
  await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
  const roomUrl = page.url();
  const access = await page.evaluate(
    (api) => JSON.parse(sessionStorage.getItem('riichi-room:' + api)!),
    api,
  );
  await gameMenu(page, 'Return home');
  await expect(page).toHaveURL('http://localhost:4300/');
  await expect(page.locator('.resume-shared')).toHaveCount(0);
  await page.getByRole('button', { name: /Ongoing games/ }).click();
  await expect(page.locator('.ongoing-list a')).toHaveCount(1);
  await expect(page.locator('.ongoing-list a')).toHaveAttribute('href', new URL(roomUrl).pathname);
  await page.locator('dialog[open]').getByRole('button', { name: 'Close', exact: true }).click();
  // Going home must not trigger the thirty-second disconnected-host departure.
  await page.waitForTimeout(33000);
  const state = await (
    await page.request.get(api + '/api/rooms/' + access.id + '/game', {
      headers: { Authorization: 'Bearer ' + access.token },
    })
  ).json();
  expect(state.closed).toBe(false);
  await page.getByRole('button', { name: /Ongoing games/ }).click();
  await page.locator('.ongoing-list a').click();
  await expect(page).toHaveURL(roomUrl);
  await expect(page.locator('.game-shell')).toBeVisible();
  await expect(page.locator('.seat-bottom h3')).toContainText('Player 1');
});
