import { expect, test } from '@playwright/test';

test('route navigation and browser back use the router top policy', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Records', exact: true }).click();
  await expect(page).toHaveURL(/\/records$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
