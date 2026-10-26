import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1280]) {
  test(`settings and Others preserve sticky padding at ${width}px, developer opens logs`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    await page.locator('.app-navigation a[href$="/settings"]').click();
    const settings = page.locator('.settings-sticky');
    await expect(settings.locator('.rule-library')).not.toHaveClass(/\bcard\b/);
    await expect(settings.locator('.rule-library')).toHaveCSS('border-bottom-width', '1px');
    await page.evaluate(() => scrollTo(0, 800));
    const top = await settings.evaluate((element) => parseFloat(getComputedStyle(element).top));
    expect((await settings.boundingBox())!.y).toBeCloseTo(top, 0);
    await expect(settings.getByRole('combobox')).toBeInViewport();
    await page.screenshot({ path: `artifacts/settings-sticky-${width}.png` });
    await page.locator('.app-navigation a[href$="/others"]').click();
    await page.evaluate(() => scrollTo(0, 400));
    const others = page.locator('.others-heading');
    expect((await others.boundingBox())!.y).toBeCloseTo(top, 0);
    await page.screenshot({ path: `artifacts/others-sticky-${width}.png` });
    await page.locator('.other-list a[href$="/others/developer"]').click();
    const name = page.locator('.developer-name');
    const logs = page.getByRole('dialog', { name: 'Logs', exact: true });
    await name.click();
    await name.click();
    await expect(name.locator('.button-ripple')).toHaveCount(0);
    await expect(logs).not.toBeVisible();
    await name.click();
    await expect(logs).toBeVisible();
    const clear = logs.getByRole('button', { name: 'Clear logs', exact: true });
    const close = logs.getByRole('button', { name: 'Close', exact: true });
    const clearBox = (await clear.boundingBox())!;
    const closeBox = (await close.boundingBox())!;
    expect(clearBox.y + clearBox.height / 2).toBeCloseTo(closeBox.y + closeBox.height / 2, 0);
    await expect(logs.locator('.dialog-header .hint')).toBeVisible();
    const box = (await logs.boundingBox())!;
    expect(box.y + box.height).toBeCloseTo(740, 0);
    await expect(logs).toContainText('Page: /others');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/diagnostic-logs-${width}.png` });
    await logs.getByRole('button', { name: 'Clear logs', exact: true }).click();
    await expect(logs).toContainText('No logs.');
    await logs.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(logs).not.toBeVisible();
  });
}
