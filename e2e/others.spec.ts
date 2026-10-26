import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1280]) {
  test(`Others consolidates information, theme and language at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const nav = page.locator('.app-navigation');
    await expect(nav.locator('a')).toHaveText(['My table', 'Settings', 'Records', 'Others']);
    if (width < 701) await expect(page.locator('.sticky-header')).toBeHidden();
    else await expect(page.locator('.sticky-header')).toBeVisible();
    await page.locator('.quick-score-link').click();
    await page.getByRole('button', { name: /Try an example hand/ }).click();
    await nav.getByRole('link', { name: 'Others', exact: true }).click();
    await expect(page.locator('.other-list a')).toHaveCount(7);
    await expect(page.locator('.option-group h2')).toHaveText([
      'Preferences',
      'Help and information',
      'Legal',
    ]);
    await expect(page.locator('.entry-mark svg')).toHaveCount(7);
    await expect(page.locator('footer')).toHaveCount(0);
    await expect(page.locator('app-storage-status')).toBeVisible();
    await expect(page.locator('.other-options')).toContainText('psbdwphotoshop@gmail.com');
    await expect(page.locator('.other-list').getByRole('link', { name: /Send email/ })).toHaveCount(
      0,
    );
    await page.getByRole('link', { name: 'Version', exact: true }).click();
    await expect(page.locator('.other-detail')).toContainText('v0.1.0');
    await nav.getByRole('link', { name: 'My table', exact: true }).click();
    await page.locator('.quick-score-link').click();
    await expect(page.locator('.hand-tiles > button.tile')).toHaveCount(14);
    await nav.getByRole('link', { name: 'Others', exact: true }).click();
    await page.getByRole('link', { name: 'Developer', exact: true }).click();
    await expect(page.locator('.other-detail')).toContainText('Riichi / table');
    await expect(page.getByRole('link', { name: /Send email/ })).toHaveAttribute(
      'href',
      'mailto:psbdwphotoshop@gmail.com',
    );
    await page.locator('.back-link').click();
    await page.getByRole('link', { name: 'Terms and conditions', exact: true }).click();
    await expect(page.locator('.other-detail')).toContainText('not been published');
    await page.locator('.back-link').click();
    await page.getByRole('link', { name: 'License', exact: true }).click();
    const license = await page.request.get('/3rdpartylicenses.txt');
    expect(license.ok()).toBe(true);
    expect(await license.text()).toContain('MIT');
    await page.locator('.back-link').click();
    await page.getByRole('link', { name: 'Theme', exact: true }).click();
    await page.locator('.theme-choices button').last().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.locator('.back-link').click();
    await page.getByRole('link', { name: 'Language', exact: true }).click();
    await page.locator('.other-detail select').selectOption('zh-TW');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.locator('.other-detail select').selectOption('en');
    await page.locator('.back-link').click();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/others-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Rules', exact: true }).click();
    await expect(page).toHaveURL(/\/others\/rules$/);
    await expect(page.locator('app-storage-status')).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(page.locator('.back-link')).toBeInViewport();
    expect((await page.locator('.back-link').boundingBox())!.y).toBeLessThan(
      width < 701 ? 32 : 120,
    );
    await expect(page.getByRole('heading', { name: 'What works', exact: true })).toBeVisible();
    await nav.getByRole('link', { name: 'My table', exact: true }).click();
    await page.locator('.quick-score-link').click();
    await expect(page.getByRole('heading', { name: 'Score a hand.', exact: true })).toBeVisible();
  });
}
