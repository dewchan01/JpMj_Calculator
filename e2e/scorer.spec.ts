import { expect, test } from '@playwright/test';
test('mobile match, draft, verified settlement, escrow, history, reload and offline', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your next round/ })).toBeVisible();
  await page.screenshot({ path: 'artifacts/home-mobile.png', fullPage: true });
  await page.getByLabel('Match name').fill('Test table');
  await page.getByRole('button', { name: /Start match/ }).click();
  await expect(page.getByRole('heading', { name: 'Test table' })).toBeVisible();
  await page.getByRole('button', { name: /Try an example hand/ }).click();
  await expect(page.getByText('14 concealed · expected 14')).toBeVisible();
  await page.reload();
  await expect(page.getByText('14 concealed · expected 14')).toBeVisible();
  await page.getByRole('button', { name: 'I have checked these tiles', exact: false }).click();
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.getByText('1 Han · 30 Fu', { exact: true })).toBeVisible();
  await page.getByText('Record a Riichi deposit', { exact: false }).click();
  await page.getByRole('button', { name: 'Deposit 1,000' }).click();
  await expect(page.getByRole('status')).toContainText('escrow');
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.getByText('Riichi escrow award')).toBeVisible();
  await page.screenshot({ path: 'artifacts/scorer-mobile.png', fullPage: true });
  await page.getByRole('button', { name: /Confirm & save settlement/ }).click();
  await expect(page.getByRole('heading', { name: 'Auditable hand history' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /History/ }).click();
  await expect(page.getByText('Win · Player 2')).toBeVisible();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    return !!registration.active;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Test table' })).toBeVisible();
  await page.getByRole('button', { name: /History/ }).click();
  await expect(page.getByText('Win · Player 2')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('quick score rejects incomplete hands, supports Sanma and manual camera fallback', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Quick score', exact: true }).click();
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.getByText(/Expected 14 concealed tiles/)).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Rules', exact: true })
    .selectOption({ label: '3P · Sanma' });
  await page.getByRole('button', { name: /Try an example hand/ }).click();
  await page.getByLabel('Win method').selectOption('tsumo');
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.getByText('2 Han · 20 Fu', { exact: true })).toBeVisible();
  await page.getByText('Optional photo demo').click();
  await expect(page.locator('input[capture="environment"]')).toHaveAttribute('accept', 'image/*');
  await expect(page.locator('input[type="file"]:not([capture])')).toBeVisible();
  await page
    .locator('input[type="file"]:not([capture])')
    .setInputFiles('apps/web/public/icons/icon-192.png');
  await expect(page.getByText('Fixed mock suggestions', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Add 1p', exact: true }).click();
  await expect(page.getByText('15 concealed · expected 14')).toBeVisible();
  await page.getByRole('button', { name: 'Remove 1 pin' }).first().click();
  await expect(page.getByText('14 concealed · expected 14')).toBeVisible();
  await page.screenshot({ path: 'artifacts/scorer-desktop.png', fullPage: true });
});
