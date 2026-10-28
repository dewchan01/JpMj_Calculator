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
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page).toHaveURL(/\/score\/[^/]+$/);
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
  await expect(results.locator('.comparison-table tbody tr')).toHaveCount(7);
  await expect(results.locator('.comparison-table tbody tr').last()).toContainText('Total score');
  await expect(results.locator('.comparison-table tbody tr').first()).toContainText('Rank');
  await expect(results.locator('.comparison-table thead')).not.toContainText('#1');
  await expect(results.locator('.comparison-table thead th')).toHaveCount(5);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await results
      .locator('.comparison-table')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: 'artifacts/results-comparison-320.png' });
  await page.setViewportSize({ width: 390, height: 740 });
  expect(
    await results
      .locator('.comparison-table')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await expect(results.getByRole('button', { name: 'All players', exact: true })).toHaveCount(0);
  await results.getByRole('button', { name: 'Details', exact: true }).first().click();
  const resultDialog = page.locator('dialog.results-prompt');
  await expect(resultDialog).toBeVisible();
  const selectedTab = results.locator('.result-tabs button.selected');
  await expect(selectedTab).toHaveText('Details');
  const selectedBackground = await selectedTab.evaluate(
    (button) => getComputedStyle(button).backgroundColor,
  );
  expect(selectedBackground).not.toBe(
    await results
      .locator('.result-tabs button')
      .first()
      .evaluate((button) => getComputedStyle(button).backgroundColor),
  );
  await resultDialog.locator('.prompt-body').evaluate((body) => {
    body.scrollTop = 400;
  });
  const headingBounds = await resultDialog.locator('.prompt-heading').boundingBox();
  const tabsBounds = await results.locator('.result-controls').boundingBox();
  expect(tabsBounds!.y).toBeGreaterThanOrEqual(headingBounds!.y + headingBounds!.height - 1);
  await resultDialog.locator('.prompt-body').evaluate((body) => {
    body.scrollTop = 0;
  });
  await expect(results.locator('.score-graph')).toBeVisible();
  await expect(results.locator('.metric-card')).toHaveCount(12);
  await expect(results).toContainText('Win rate');
  await expect(results).toContainText('Average winning streak');
  await expect(results.locator('.score-graph polyline')).toHaveCount(4);
  await results
    .locator('.graph-legend')
    .getByRole('button', { name: 'Player 1', exact: true })
    .click();
  await expect(results.locator('.metric-card')).toHaveCount(12);
  await expect(results.locator('.metric-card').first().locator('dl > div')).toHaveCount(1);
  await expect(results.locator('.metric-card').first()).toContainText('Player 1');
  await results
    .locator('.graph-legend')
    .getByRole('button', { name: 'All players', exact: true })
    .click();
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
  await expect(results.locator('.history-event > summary .event-mode')).toContainText([
    'Mahjong Soul',
    'Mahjong Soul',
  ]);
  await expect(results.locator('.history-event > summary .outcome-mark')).toContainText(['Ron']);
  await expect(results.locator('app-match-history > .card')).toHaveCount(0);
  await results.locator('.history-event > summary').last().click();
  await expect(results.locator('.history-event[open]')).toContainText('Player 2');
  await expect(results.locator('.history-event[open] .hand-player')).toHaveCount(4);
  await expect(
    results.locator('.history-event[open] .hand-player[aria-expanded="true"]'),
  ).toHaveCount(0);
  await results.locator('.history-event[open] .hand-player').first().click();
  await expect(results.locator('.history-event[open] .player-detail')).toContainText(
    'Winning method',
  );
  const playerPositions = await results
    .locator('.history-event[open] .hand-player')
    .evaluateAll((players) => players.map((player) => player.getBoundingClientRect().y));
  expect(new Set(playerPositions).size).toBe(1);
  await page.screenshot({ path: 'artifacts/history-compact-390.png' });
  await results.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page).toHaveURL(/\/records$/);
  await page.locator('.game-card-link').click();
  await expect(page).toHaveURL(/\/records\/[^/]+$/);
  await expect(results).toBeVisible();
  await expect(results.getByRole('button', { name: 'Save game', exact: true })).toHaveCount(0);
  await expect(results.getByRole('button', { name: 'Discard game', exact: true })).toHaveCount(0);
  await page
    .locator('.record-management')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Delete', exact: true })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.locator('.game-card')).toHaveCount(0);
});

test('record results without playing, correct points, persist ranks, and audit the correction', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await expect(page.locator('.setup-card .record-only-button')).toHaveCount(0);
  const recordButton = await page
    .getByRole('button', { name: 'Record results only', exact: true })
    .boundingBox();
  const ongoingButton = await page.getByRole('button', { name: /Ongoing games/ }).boundingBox();
  expect(Math.abs(recordButton!.y - ongoingButton!.y)).toBeLessThan(1);
  const setup = await page.locator('.setup-card').boundingBox();
  expect(recordButton!.y).toBeGreaterThanOrEqual(setup!.y + setup!.height);
  await page.screenshot({ path: 'artifacts/home-record-actions-390.png' });
  await page.getByRole('button', { name: /Ongoing games/ }).click();
  await expect(page.getByRole('dialog', { name: 'Ongoing games', exact: true })).toContainText(
    'No ongoing games.',
  );
  await page
    .getByRole('dialog', { name: 'Ongoing games', exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await page.getByRole('button', { name: 'Record results only', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record results only', exact: true });
  await dialog.getByLabel('Game date', { exact: true }).fill('2026-01-02T10:30');
  expect(
    await dialog
      .getByRole('button', { name: 'Close', exact: true })
      .evaluate(
        (button) =>
          getComputedStyle(button).backgroundColor ===
          getComputedStyle(button.closest('dialog')!).backgroundColor,
      ),
  ).toBe(true);
  await page.screenshot({ path: 'artifacts/record-results-prompt-390.png' });
  await dialog.getByLabel('Player 1', { exact: true }).fill('40000');
  await dialog.getByLabel('Player 2', { exact: true }).fill('30000');
  await dialog.getByLabel('Player 3', { exact: true }).fill('20000');
  await dialog.getByLabel('Player 4', { exact: true }).fill('10001');
  await dialog.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Total points must match');
  await dialog.getByLabel('Player 4', { exact: true }).fill('10000');
  await dialog.getByRole('button', { name: 'Save game', exact: true }).click();
  await expect(page).toHaveURL(/\/records\/[^/]+$/);
  const resultUrl = page.url();
  const results = page.locator('app-final-results');
  await expect(results.locator('.result-tabs.segmented')).toBeVisible();
  await expect(
    results.getByRole('button', { name: 'Share image', exact: true }).locator('svg'),
  ).toHaveCount(1);
  await expect(results.getByRole('button', { name: 'Save game', exact: true })).toHaveCount(0);
  await expect(results.getByRole('button', { name: 'Discard game', exact: true })).toHaveCount(0);
  await expect(results.locator('tbody tr').first()).toContainText('40,000');
  await page.getByRole('button', { name: 'Edit scores', exact: true }).click();
  const scoreDialog = page.getByRole('dialog', { name: 'Edit scores', exact: true });
  await expect(scoreDialog).toBeVisible();
  await expect(scoreDialog.getByLabel('Game date', { exact: true })).toHaveValue(
    '2026-01-02T10:30',
  );
  await scoreDialog.getByLabel('Game date', { exact: true }).fill('2026-01-03T11:30');
  await page.screenshot({ path: 'artifacts/edit-score-prompt-390.png' });
  await results.getByLabel('Player 1', { exact: true }).fill('10000');
  await results.getByLabel('Player 4', { exact: true }).fill('40000');
  await results.getByRole('button', { name: 'Save scores', exact: true }).click();
  await expect(results.locator('.score-editor')).not.toBeVisible();
  await expect(results.locator('tbody tr').first()).toContainText('Player 4');
  await page.reload();
  await expect(results.locator('tbody tr').first()).toContainText('Player 4');
  await page.getByRole('button', { name: 'Edit scores', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Edit scores', exact: true })
      .getByLabel('Game date', { exact: true }),
  ).toHaveValue('2026-01-03T11:30');
  await page
    .getByRole('dialog', { name: 'Edit scores', exact: true })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await results.getByRole('button', { name: 'History', exact: true }).click();
  await expect(results.locator('.history-event')).toHaveCount(2);
  await results.locator('.history-event > summary').first().click();
  await expect(results.locator('.history-event[open]')).toContainText('40,000');
  await results.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(results.locator('.metric-card')).toHaveCount(12);
  await page.evaluate(() => scrollTo(0, 650));
  await expect(results.locator('.result-controls')).toHaveCSS('position', 'sticky');
  expect((await results.locator('.result-controls').boundingBox())!.y).toBeCloseTo(16, 0);
  await expect(page.locator('.record-result-heading')).toBeInViewport();
  await expect(results.locator('.result-tabs')).toBeInViewport();
  await expect(results.locator('.graph-legend')).toBeInViewport();
  await page.screenshot({ path: 'artifacts/results-sticky-390.png' });
  await page.evaluate(() => scrollTo(0, 0));
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: 'artifacts/results-metrics-390.png', fullPage: true });
  await page.locator('.app-navigation a[href$="/records"]').click();
  await expect(page.locator('.game-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Open table', exact: true })).toHaveCount(0);
  await page.locator('.game-card').click();
  await expect(page).toHaveURL(resultUrl);
  await expect(results.locator('.result-table')).toBeVisible();
});

test('root backdrops close, nested prompts stay open, and reopening resumes the game', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page
    .locator('.indicator-bar')
    .getByRole('button', { name: 'Dora indicators', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Enter Dora indicators', exact: true }),
  ).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(
    page.getByRole('dialog', { name: 'Enter Dora indicators', exact: true }),
  ).not.toBeVisible();
  await expect(prompt(page)).not.toBeVisible();
  await page.locator('.floating-menu').click();
  await prompt(page).getByRole('button', { name: 'Help', exact: true }).click();
  await page.mouse.click(2, 2);
  await expect(prompt(page)).toBeVisible();
  await prompt(page).locator('.menu-back').click();
  await prompt(page).getByRole('button', { name: 'My table', exact: true }).click();
  await page.getByRole('button', { name: /Ongoing games/ }).click();
  await page.getByRole('link', { name: /Resume game/ }).click();
  await expect(page.getByRole('button', { name: 'Game timer', exact: true })).not.toContainText(
    'Paused',
  );
});
