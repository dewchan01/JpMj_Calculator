import { test, expect } from '@playwright/test';

test('rule save uses the shared toast while validation remains beside the form', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');
  await page.getByRole('textbox', { name: 'Custom rule name', exact: true }).fill('Toast rule');
  await page.getByRole('button', { name: 'Use these rules', exact: true }).click();
  const toast = page.locator('.toast:popover-open');
  await expect(toast).toContainText('Saved and applied');
  await expect(page.locator('.settings-actions .banner.success')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/shared-toast-390.png' });
  await toast.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
  await expect(toast).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Starting points', exact: true }).fill('-1');
  await page.getByRole('button', { name: 'Save custom rules', exact: true }).click();
  await expect(page.locator('.settings-actions').getByRole('alert')).toBeVisible();
  await expect(toast).toHaveCount(0);
});
