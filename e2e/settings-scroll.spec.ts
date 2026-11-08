import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
test('three and four player settings each restore their own scroll position', async ({ page }) => {
  await page.goto('/settings?players=4');
  const four = page.getByRole('button', { name: '4 players', exact: true });
  const three = page.getByRole('button', { name: '3 players', exact: true });
  await expect(four).toHaveClass(/selected/);
  await page.evaluate(() => window.scrollTo(0, 900));
  await three.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await four.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(900);
  await three.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500);
});
