import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { beginWin, finishWin, gameMenu, prompt } from './helpers/game';

test('final results offer table, list, history, statistics, PNG export, keep and discard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await expect(page).toHaveURL(/\/score\/[^/]+$/);
  const matchUrl = page.url();
  await beginWin(page);
  await finishWin(page, '123m456m789p234s50p');
  await expect(prompt(page)).not.toBeVisible();
  await gameMenu(page, 'End entire match');
  await prompt(page).getByRole('button', { name: 'End entire match', exact: true }).click();
  const results = page.locator('app-final-results');
  await expect(results.locator('tbody tr')).toHaveCount(4);
  expect(
    await results.locator('table').evaluate((table) => table.scrollWidth <= table.clientWidth),
  ).toBe(true);
  await results.getByRole('button', { name: 'List', exact: true }).click();
  await expect(results.locator('.standing-card')).toHaveCount(4);
  await results.getByRole('button', { name: 'Statistics', exact: true }).first().click();
  await expect(results.locator('.score-graph')).toBeVisible();
  await expect(results.locator('.standing-card')).toHaveCount(4);
  await expect(results).toContainText('Win rate');
  await expect(results).toContainText('Average winning streak');
  await expect(results.locator('.score-graph polyline')).toHaveCount(4);
  const image = page.waitForEvent('download');
  await results.getByRole('button', { name: 'Share image', exact: true }).click();
  const download = await image;
  expect(download.suggestedFilename()).toBe('mahjong-results.png');
  await download.saveAs('artifacts/results-share.png');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.screenshot({ path: 'artifacts/results-statistics.png' });
  await results.getByRole('button', { name: 'History', exact: true }).click();
  await expect(results.locator('.history-event')).toHaveCount(2);
  await results.locator('.history-event summary').last().click();
  await expect(results.locator('.history-event[open]')).toContainText('Player 2');
  await results.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page).toHaveURL(/\/records$/);
  await page.getByRole('link', { name: 'Details', exact: true }).click();
  await expect(page).toHaveURL(matchUrl);
  await page.getByRole('button', { name: 'Final results', exact: true }).click();
  await results.getByRole('button', { name: 'Discard game', exact: true }).click();
  await results.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.locator('.app-navigation a[href$="/records"]').click();
  await expect(page.locator('.game-card')).toHaveCount(0);
});

test('root backdrops close, nested prompts stay open, and reopening resumes the game', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page
    .locator('.indicator-bar')
    .getByRole('button', { name: 'Dora indicators', exact: true })
    .click();
  await page.mouse.click(2, 2);
  await expect(prompt(page)).not.toBeVisible();
  await page.locator('.floating-menu').click();
  await prompt(page).getByRole('button', { name: 'Help', exact: true }).click();
  await page.mouse.click(2, 2);
  await expect(prompt(page)).toBeVisible();
  await prompt(page).locator('.menu-back').click();
  await prompt(page).getByRole('button', { name: 'My table', exact: true }).click();
  await page.locator('.app-navigation a[href$="/records"]').click();
  await page.getByRole('link', { name: 'Open table', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Game timer', exact: true })).not.toContainText(
    'Paused',
  );
});
