import { test, expect } from '@playwright/test';
import { openQuickScore } from './helpers/navigation';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 740 } });
for (const mode of ['indicator', 'collection'] as const) {
  test(`photo apply keeps ${mode} sheet open and scrolls to the filled tray`, async ({ page }) => {
    const count = mode === 'indicator' ? 1 : 3;
    await page.route('**/config.json', (route) =>
      route.fulfill({
        json: {
          backend: { apiUrl: '' },
          recognition: { provider: 'api', endpoint: 'https://detector.example/review' },
        },
      }),
    );
    await page.route('https://detector.example/review', (route) =>
      route.fulfill({
        json: {
          image: { width: 600, height: 300 },
          predictions: Array.from({ length: count }, (_, i) => ({
            class: '1z',
            confidence: 0.99,
            x: 100 + 90 * i,
            y: 100,
            width: 60,
            height: 90,
          })),
        },
      }),
    );
    await page.goto('/');
    if (mode === 'indicator') {
      await page.getByRole('button', { name: /Start match/ }).click();
      await page.getByRole('button', { name: 'Start game', exact: true }).click();
    } else {
      await openQuickScore(page);
      await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
    }
    const sheet = page.locator('app-tile-entry-dialog dialog[open]').first();
    const capture = sheet.locator('app-photo-capture');
    await capture
      .locator('input[type=file]')
      .first()
      .setInputFiles('apps/web/public/icons/icon-192.png');
    const apply = capture.getByRole('button', { name: 'Apply reviewed tiles', exact: true });
    await expect(apply).toBeEnabled();
    await apply.scrollIntoViewIfNeeded();
    await expect.poll(() => sheet.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await apply.click();
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.tile-entry-tray button.tile')).toHaveCount(count);
    await expect.poll(() => sheet.evaluate((element) => element.scrollTop)).toBeLessThan(2);
    const done = sheet.getByRole('button', { name: 'Done', exact: true });
    await expect(done).toBeEnabled();
    await done.click();
    await expect(sheet).not.toBeVisible();
  });
}
