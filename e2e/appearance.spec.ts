import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('dark theme and Simplified Chinese persist, and both tile sets render', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect
    .poll(() =>
      page.locator('.sticky-header').evaluate((header) => header.getBoundingClientRect().top),
    )
    .toBe(0);
  await expect(page.getByRole('navigation')).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const homeAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(homeAxe.violations).toEqual([]);
  await page.getByRole('combobox', { name: 'Language / 語言' }).selectOption('zh-CN');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('heading', { name: '开设牌桌' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await page.getByRole('link', { name: '快速计分', exact: true }).click();
  await page.getByRole('button', { name: '输入牌张', exact: true }).click();
  const image = page.locator('app-tile-art img').first();
  await expect(image).toHaveAttribute('src', /tiles\/Black\//);
  await expect
    .poll(() =>
      page
        .locator('app-tile-art img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  const scoreAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(scoreAxe.violations).toEqual([]);
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('button', { name: '深色模式', exact: true }).click();
  await page.getByRole('button', { name: '输入牌张', exact: true }).click();
  await expect(image).toHaveAttribute('src', /tiles\/Regular\//);
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('combobox', { name: 'Language / 語言' }).selectOption('en');
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await page.getByRole('link', { name: 'My table', exact: true }).click();
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: /Try an example hand/ }).click();
  await page.getByRole('button', { name: /Calculate score/ }).click();
  const matchAxe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    matchAxe.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
});

test('system dark preference is used without a saved theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
