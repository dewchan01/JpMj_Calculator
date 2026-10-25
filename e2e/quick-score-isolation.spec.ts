import { playerAction, gameMenu, prompt } from './helpers/game';
import { openQuickScore } from './helpers/navigation';
import { test, expect } from '@playwright/test';
import { applyPreset, expectApplied } from './helpers/settings';

test('Quick score stays independent of an ongoing match and its saved draft', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Match name', exact: true }).fill('Isolation table');
  await applyPreset(page, 'tenhou');
  await page.getByRole('button', { name: /Start match/ }).click();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'My table', exact: true })).toHaveClass('active');
  await playerAction(page, 'Player 2');
  await prompt(page)
    .getByRole('button', { name: /^Declare Riichi/, exact: true })
    .click();
  await expect(page.locator('app-table-summary .table-pot strong')).toHaveText('1,000');
  const balances = await page.locator('app-table-summary .player-points').allTextContents();
  await openQuickScore(page);
  await expect(nav.getByRole('link', { name: 'My table', exact: true })).toHaveClass('active');
  await expect(page.locator('app-table-summary')).toHaveCount(0);
  await expect(page.locator('.hand-tiles > button.tile')).toHaveCount(0);
  await page
    .getByRole('combobox', { name: 'Rules', exact: true })
    .selectOption({ label: '3P · Sanma' });
  await page.getByRole('button', { name: /Try an example hand/ }).click();
  await page.getByRole('combobox', { name: 'Win method', exact: true }).selectOption('tsumo');
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.score-total > span')).toBeVisible();
  await expect(page.getByRole('button', { name: /Confirm & save settlement/ })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Records', exact: true }).click();
  await expect(page.locator('.game-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Isolation table', exact: true }).click();
  await expect(page.locator('.game-shell')).toBeVisible();
  await expectApplied(page, 'tenhou');
  await expect(page.locator('app-table-summary .player-seat')).toHaveCount(4);
  await expect(page.locator('app-table-summary .table-pot strong')).toHaveText('1,000');
  expect(await page.locator('app-table-summary .player-points').allTextContents()).toEqual(
    balances,
  );
  await gameMenu(page, 'History');
  await expect(page.locator('.history-event')).toHaveCount(1);
});
