import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('game menu has icons and subdialogs return directly to the menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await expect(page.locator('.segmented small')).toHaveCount(0);
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  for (const label of ['Dora indicators']) {
    await page.locator('.indicator-bar').getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('.game-prompt .menu-back')).toHaveCount(0);
    await page
      .getByRole('dialog', { name: 'Enter ' + label, exact: true })
      .getByRole('button', { name: 'Done', exact: true })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Enter ' + label, exact: true }),
    ).not.toBeVisible();
  }
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 2' })
    .getByRole('button', { name: 'Riichi', exact: true })
    .click();
  await expect(page.locator('.game-prompt .menu-back')).toHaveCount(0);
  await expect(page.locator('.game-prompt')).not.toBeVisible();
  await page.getByRole('button', { name: 'End this hand', exact: true }).click();
  await page.locator('.game-prompt').getByRole('button', { name: 'Win', exact: true }).click();
  await page.locator('.menu-back').click();
  await expect(
    page.locator('.game-prompt').getByRole('button', { name: 'Win', exact: true }),
  ).toBeVisible();
  await page.locator('.close-prompt').click();
  await page.locator('.floating-menu').click();
  const dialog = page.locator('.game-prompt');
  await expect(dialog.locator('.close-prompt')).toHaveCSS('border-top-style', 'solid');
  const buttons = dialog.locator('.menu-list button');
  await expect(buttons).toHaveCount(10);
  expect(await buttons.locator('svg').count()).toBe(await buttons.count());
  for (const label of [
    'History',
    'Edit game info',
    'In-game settings',
    'Change seats',
    'Help',
    'End entire match',
    'End this hand',
  ]) {
    await dialog.getByRole('button', { name: new RegExp('^' + label) }).click();
    await expect(dialog.locator('.menu-back')).toBeVisible();
    await dialog.locator('.menu-back').click();
    await expect(dialog.getByRole('heading', { name: 'Game menu', exact: true })).toBeVisible();
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: 'artifacts/game-menu-icons.png' });
});

test('touch hints disappear on release and cancellation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page
    .locator('.app-navigation')
    .getByRole('link', { name: 'Settings', exact: true })
    .click();
  const help = page.locator('.setting-help').first();
  const button = help.locator('button');
  const bounds = (await button.boundingBox())!;
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  for (const type of ['touchEnd', 'touchCancel'] as const) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await expect(help.getByRole('tooltip')).toBeVisible();
    await client.send('Input.dispatchTouchEvent', { type, touchPoints: [] });
    await expect(help.getByRole('tooltip')).toBeHidden();
  }
});
