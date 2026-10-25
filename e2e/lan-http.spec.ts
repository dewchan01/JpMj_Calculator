import { openQuickScore } from './helpers/navigation';
import { test, expect } from '@playwright/test';

test('manual scoring and matches work without the secure-context UUID API', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await openQuickScore(page);
  await expect(page.getByRole('button', { name: 'Enter tiles', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Try an example hand/ }).click();
  await expect(page.locator('.hand-tiles > button.tile')).toHaveCount(14);
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.score-total > span')).toBeVisible();
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Enter tiles', exact: true });
  await dialog.getByRole('button', { name: '2p: Add 2 pin', exact: true }).click();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.hand-tiles > button.tile')).toHaveCount(15);
  const dora = page.locator('app-tile-input[data-label="Dora indicators"]');
  await dora.getByRole('button', { name: 'Enter Dora indicators', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '2p: Add 2 pin', exact: true })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  await expect(dora.locator('.indicator-editor > .selected-tiles app-tile-art')).toHaveCount(1);
  await page.getByRole('navigation').getByRole('link', { name: 'My table', exact: true }).click();
  await page.getByRole('button', { name: /Start match/ }).click();
  await expect(page).toHaveURL(/\/score\/[0-9a-f-]+$/);
  await expect(page.locator('app-table-summary')).toBeVisible();
  expect(errors).toEqual([]);
});
