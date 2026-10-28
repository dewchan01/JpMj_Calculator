import { beginWin, finishWin, gameMenu, prompt } from './helpers/game';
import { leaveGame, openQuickScore } from './helpers/navigation';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('dealer bonus in split Tsumo payments can be chosen and saved', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: '3 players', exact: true }).click();
  await page.getByRole('textbox', { name: 'Custom rule name', exact: true }).fill('Dealer split');
  await page
    .getByRole('combobox', { name: 'Tsumo payment', exact: true })
    .selectOption({ label: 'Split payment (keep dealer bonus)' });
  await page.getByRole('button', { name: 'Use these rules', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved and applied');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Tsumo payment', exact: true })).toHaveValue(
    /equal-dealer/,
  );
  await openQuickScore(page);
  await expect(page.locator('.rules-heading strong')).toHaveText('Dealer split');
  await expect(page.locator('.rules-summary details')).toHaveCount(0);
  await expect(
    page.locator('.rules-summary').getByRole('button', { name: 'Rules', exact: true }),
  ).toBeVisible();
});

for (const width of [390, 1280]) {
  test(`settings save separate 3P/4P rules, apply and preserve match snapshots at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await expect(page.getByRole('combobox', { name: 'Rule preset', exact: true })).toHaveCount(0);
    await leaveGame(page);
    await nav.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('.rule-library .segmented button')).toHaveText([
      '4 players',
      '3 players',
    ]);
    const firstHelp = page.locator('.setting-help').first();
    await firstHelp.locator('button').hover();
    await expect(firstHelp.getByRole('tooltip')).toBeHidden();
    await page.mouse.down();
    await expect(firstHelp.getByRole('tooltip')).toBeVisible();
    const field = await firstHelp.locator('..').boundingBox();
    const bubble = await firstHelp.getByRole('tooltip').boundingBox();
    expect(bubble!.x).toBeGreaterThanOrEqual(field!.x);
    expect(bubble!.x + bubble!.width).toBeLessThanOrEqual(field!.x + field!.width + 1);
    await page.screenshot({ path: `artifacts/settings-hint-${width}.png` });
    await page.mouse.up();
    await expect(firstHelp.getByRole('tooltip')).toBeHidden();
    await firstHelp.locator('button').focus();
    await page.keyboard.down('Space');
    await expect(firstHelp.getByRole('tooltip')).toBeVisible();
    await page.keyboard.up('Space');
    await expect(firstHelp.getByRole('tooltip')).toBeHidden();
    await page.getByRole('heading', { name: 'Settings', exact: true }).hover();
    await page.getByRole('textbox', { name: 'Custom rule name', exact: true }).fill('Four friends');
    await page.getByRole('spinbutton', { name: 'Starting points', exact: true }).fill('30000');
    await page.getByRole('button', { name: 'Use these rules', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved and applied');
    await page.getByRole('button', { name: '3 players', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Custom rule name', exact: true })
      .fill('Three friends');
    await page.getByRole('spinbutton', { name: 'Starting points', exact: true }).fill('45000');
    await page
      .getByRole('combobox', { name: 'Tsumo payment', exact: true })
      .selectOption({ label: 'Without Tsumo loss' });
    await page
      .getByRole('combobox', { name: 'No 100-point sticks', exact: true })
      .selectOption({ label: 'Round payments up to 1,000' });
    await page.getByRole('button', { name: 'Use these rules', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved and applied');
    await openQuickScore(page);
    await expect(page.locator('.rules-heading')).toContainText('Three friends');
    await expect(page.locator('.rules-summary details')).toHaveCount(0);
    await page
      .getByRole('combobox', { name: 'Rules', exact: true })
      .selectOption({ label: '4P · Yonma' });
    await expect(page.locator('.rules-heading')).toContainText('Four friends');
    await leaveGame(page);
    await nav.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: '4 players', exact: true }).click();
    await expect(
      page.getByRole('spinbutton', { name: 'Starting points', exact: true }),
    ).toHaveValue('30000');
    await page.getByRole('spinbutton', { name: 'Starting points', exact: true }).fill('31000');
    await page.getByRole('button', { name: 'Save custom rules', exact: true }).click();
    await openQuickScore(page);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('riichi-rule-library-v1')!).applied['4'].startingPoints,
      ),
    ).toBe(30000);
    await leaveGame(page);
    await nav.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: '4 players', exact: true }).click();
    await expect(
      page.getByRole('spinbutton', { name: 'Starting points', exact: true }),
    ).toHaveValue('31000');
    await page.getByRole('spinbutton', { name: 'Starting points', exact: true }).fill('30000');
    const help = page
      .locator('.setting-field')
      .filter({ has: page.getByRole('combobox', { name: 'End below zero', exact: true }) });
    await help.getByRole('button', { name: /What does this mean/ }).click();
    await expect(help).toContainText('not an additional bonus');
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({ path: `artifacts/settings-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Use these rules', exact: true }).click();
    await nav.getByRole('link', { name: 'My table', exact: true }).click();
    await page.getByRole('button', { name: /Start match/ }).click();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await expect(page).toHaveURL(/\/score\/[^/]+$/);
    const matchUrl = page.url();
    await expect(page.locator('.player-points')).toHaveText([
      '30,000',
      '30,000',
      '30,000',
      '30,000',
    ]);
    await leaveGame(page);
    await nav.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Starting points', exact: true }).fill('40000');
    await page.getByRole('button', { name: 'Use these rules', exact: true }).click();
    await nav.getByRole('link', { name: 'Records', exact: true }).click();
    await page.locator('.game-card h2 a').first().click();
    await expect(page).toHaveURL(matchUrl);
    await expect(page.locator('.player-points')).toHaveText([
      '30,000',
      '30,000',
      '30,000',
      '30,000',
    ]);

    await leaveGame(page);
    await nav.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole('spinbutton', { name: 'Starting points', exact: true }),
    ).toHaveValue('40000');
    await page.getByRole('button', { name: '3 players', exact: true }).click();
    await expect(
      page.getByRole('spinbutton', { name: 'Starting points', exact: true }),
    ).toHaveValue('45000');
  });
}

test('invalid settings stay beside Save, and money/chips appear at game end', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation');
  await nav.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('textbox', { name: 'Custom rule name', exact: true }).fill('Money test');
  await page.getByRole('spinbutton', { name: 'Uma: first', exact: true }).fill('20');
  await page.getByRole('button', { name: 'Save custom rules', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('total must be zero');
  await expect(page.getByRole('alert')).toBeFocused();
  await page.getByRole('spinbutton', { name: 'Uma: first', exact: true }).fill('0');
  await page.getByRole('spinbutton', { name: 'Starting points', exact: true }).fill('1000');
  await page.getByRole('spinbutton', { name: 'Return score', exact: true }).fill('1000');
  await page.getByRole('spinbutton', { name: 'Money per final score unit', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: 'Money per chip', exact: true }).fill('5');
  await page.getByRole('button', { name: 'Use these rules', exact: true }).click();
  await nav.getByRole('link', { name: 'My table', exact: true }).click();
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await beginWin(page);
  await finishWin(page, '123m456m789p234s50p');
  await expect(page.locator('app-final-results')).toBeVisible();
  const winner = page.locator('app-final-results tbody tr').filter({ hasText: 'Player 2' });
  await expect(winner).toContainText('9.00');
  await expect(winner).toContainText('Chip money 5.00');
  await gameMenu(page, 'History');
  await prompt(page).getByRole('button', { name: 'Undo last ledger event', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('app-final-results')).toHaveCount(0);
  await expect(page.locator('.player-points')).toHaveText(['1,000', '1,000', '1,000', '1,000']);
});
