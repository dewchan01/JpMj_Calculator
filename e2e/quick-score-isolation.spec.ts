import { test, expect } from '@playwright/test';

test('Quick score stays independent of an ongoing match and its saved draft', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Match name', exact: true }).fill('Isolation table');
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption('tenhou');
  await page.getByRole('button', { name: /Start match/ }).click();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'My table', exact: true })).toHaveClass('active');
  await expect(nav.getByRole('link', { name: 'Quick score', exact: true })).not.toHaveClass(
    'active',
  );
  await page.getByRole('button', { name: /Try an example hand/ }).click();
  await page.locator('.escrow > summary').click();
  await page.getByRole('button', { name: 'Deposit 1,000', exact: true }).click();
  await expect(page.locator('app-table-summary .table-pot strong')).toHaveText('1,000');
  const balances = await page.locator('app-table-summary .player-points').allTextContents();
  await nav.getByRole('link', { name: 'Quick score', exact: true }).click();
  await expect(nav.getByRole('link', { name: 'Quick score', exact: true })).toHaveClass('active');
  await expect(nav.getByRole('link', { name: 'My table', exact: true })).not.toHaveClass('active');
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
  await nav.getByRole('link', { name: 'My table', exact: true }).click();
  await expect(page.locator('.saved-match')).toHaveCount(1);
  await page.locator('.saved-match a').filter({ hasText: 'Isolation table' }).click();
  await expect(page.locator('.hand-tiles > button.tile')).toHaveCount(14);
  await expect(page.getByRole('combobox', { name: 'Win method', exact: true })).toHaveValue('ron');
  await expect(page.getByRole('combobox', { name: 'Rule preset', exact: true })).toHaveValue(
    'tenhou',
  );
  await expect(page.locator('app-table-summary .player-seat')).toHaveCount(4);
  await expect(page.locator('app-table-summary .table-pot strong')).toHaveText('1,000');
  expect(await page.locator('app-table-summary .player-points').allTextContents()).toEqual(
    balances,
  );
  await page.getByRole('button', { name: /History/ }).click();
  await expect(page.locator('.history-event')).toHaveCount(1);
});
