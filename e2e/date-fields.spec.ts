import { test, expect } from '@playwright/test';

test('date filters fit their containers on phones and desktops', async ({ page }) => {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/records', '/records/player/Player%201', '/others/data/export']) {
      await page.goto(path);
      if (path !== '/others/data/export') {
        await page.getByRole('button', { name: 'Filter records', exact: true }).click();
      }
      const from = page.getByLabel('From date', { exact: true });
      const to = page.getByLabel('To date', { exact: true });
      await expect(from).toBeVisible();
      await from.fill('2026-01-02');
      await to.fill('2026-02-03');
      for (const input of [from, to]) {
        const bounds = await input.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
        expect(
          await input.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        ).toBe(true);
      }
      const [first, second] = await from.evaluate((element) =>
        Array.from(
          element.closest('.date-range-fields')!.querySelectorAll('input[type="date"]'),
        ).map((input) => {
          const bounds = input.getBoundingClientRect();
          return { y: bounds.y, height: bounds.height };
        }),
      );
      if (width < 600) expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
      else expect(second.y).toBeCloseTo(first.y, 0);
    }
  }
});

test('translated game date uses separate date and time fields without a browser at separator', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('riichi-language', 'zh-TW'));
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.locator('.record-only-button').click();
  const fields = page.locator('app-date-time-field');
  await expect(fields.locator('legend')).toHaveText('對局日期');
  await expect(fields.locator('input[type="datetime-local"]')).toHaveCount(0);
  await fields.getByLabel('日期', { exact: true }).fill('2026-01-02');
  await fields.getByLabel('時間', { exact: true }).fill('13:45');
  await expect(fields).not.toContainText(/\bat\b/);
  for (const input of await fields.locator('input').all()) {
    const bounds = (await input.boundingBox())!;
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
  }
});
