import { toggleTheme } from './helpers/navigation';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ storageState: { cookies: [], origins: [] } });

for (const width of [390, 1280]) {
  test(`install popup choices and accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const popup = page.getByRole('dialog', { name: 'Install app', exact: true });
    await expect(popup).toBeVisible();
    await expect
      .poll(async () =>
        popup.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return Math.max(
            Math.abs(rect.x + rect.width / 2 - innerWidth / 2),
            Math.abs(rect.y + rect.height / 2 - innerHeight / 2),
          );
        }),
      )
      .toBeLessThan(1);
    const light = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(light.violations).toEqual([]);
    await popup.screenshot({ path: `artifacts/install-popup-${width}.png` });
    await popup.getByRole('button', { name: 'Next time', exact: true }).click();
    await expect(popup).toHaveCount(0);
    await toggleTheme(page);
    await page.reload();
    await expect(popup).toBeVisible();
    await popup.evaluate(async (element) => {
      await Promise.all(
        element.getAnimations({ subtree: true }).map((animation) => animation.finished),
      );
    });
    const dark = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(dark.violations).toEqual([]);
    await popup.screenshot({ path: `artifacts/install-popup-${width}-dark.png` });
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    await page.reload();
    await expect(popup).toBeVisible();
    await popup.getByRole('button', { name: 'Close', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Set the table', exact: true })).toBeVisible();
    await expect(popup).toHaveCount(0);
  });
}
