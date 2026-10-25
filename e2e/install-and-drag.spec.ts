import { openQuickScore } from './helpers/navigation';
import { test, expect } from '@playwright/test';
test.use({ storageState: { cookies: [], origins: [] } });

for (const width of [390, 1280]) {
  test(`shared collection reorders without deleting tiles at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Next time', exact: true }).click();
    await openQuickScore(page);
    await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
    for (const rank of [1, 2, 3])
      await page.getByRole('button', { name: `${rank}m: Add ${rank} man`, exact: true }).click();
    const tiles = page.locator('.entry-preview [data-tile-index]');
    await tiles.nth(0).scrollIntoViewIfNeeded();
    await page.getByRole('dialog').evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    const first = await tiles.nth(0).getAttribute('aria-label');
    const from = (await tiles.nth(0).boundingBox())!;
    const to = (await tiles.nth(2).boundingBox())!;
    const checkPreview = async () => {
      const preview = page.locator('.tile-drag-preview');
      await expect(preview).toBeVisible();
      await expect(preview).toHaveAttribute('aria-label', first!);
      await expect(preview.locator('img')).toBeVisible();
      await expect(preview).toHaveCSS('opacity', '1');
      expect(await preview.evaluate((element) => element.matches(':popover-open'))).toBe(true);
      const bounds = (await preview.boundingBox())!;
      expect(Math.abs(bounds.x - to.x)).toBeLessThan(2);
      expect(Math.abs(bounds.y - to.y)).toBeLessThan(2);
      await page.screenshot({ path: `artifacts/tile-drag-preview-${width}.png` });
    };
    if (width === 390) {
      const session = await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: from.x + 10, y: from.y + 10 }],
      });
      for (let step = 1; step <= 6; step++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              x: from.x + 10 + ((to.x - from.x) * step) / 6,
              y: from.y + 10 + ((to.y - from.y) * step) / 6,
            },
          ],
        });
        await page.evaluate(() => new Promise(requestAnimationFrame));
      }
      await checkPreview();
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(from.x + 10, from.y + 10);
      await page.mouse.down();
      await page.mouse.move(to.x + 10, to.y + 10, { steps: 8 });
      await checkPreview();
      await page.mouse.up();
    }
    await expect(page.locator('.tile-drag-preview')).toHaveCount(0);
    await expect(tiles).toHaveCount(3);
    await expect(tiles.nth(2)).toHaveAttribute('aria-label', first!);
    await tiles.nth(2).focus();
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(tiles.nth(1)).toHaveAttribute('aria-label', first!);
    await tiles.nth(1).click();
    await expect(tiles).toHaveCount(2);
    await page.getByRole('button', { name: 'Undo tile edit' }).click();
    await expect(tiles).toHaveCount(3);
  });
}

test('home offers installation, hides in standalone mode, and shows configured support', async ({
  page,
}) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({
      json: { supportEmail: 'support@example.com', recognition: { provider: 'mock' } },
    }),
  );
  await page.route('**/version.json', (route) =>
    route.fulfill({ json: { version: '1.2.3', commit: 'abcdef12', dirty: false } }),
  );
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Install app', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next time', exact: true }).click();
  await expect(page.locator('footer')).toContainText('v1.2.3 · Commit abcdef12');
  await expect(page.getByRole('link', { name: 'Support: support@example.com' })).toHaveAttribute(
    'href',
    'mailto:support@example.com',
  );
  await expect(page.locator('.local-badge')).toHaveCount(0);
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = original(query);
      if (query === '(display-mode: standalone)')
        Object.defineProperty(result, 'matches', { value: true });
      return result;
    };
  });
  await page.reload();
  await expect(page.locator('.install-banner')).toHaveCount(0);
});

test('installation prompt failures stay inside the banner', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.install-banner')).toBeVisible();
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: () => Promise.reject(new Error('Unavailable')),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    window.dispatchEvent(event);
  });
  const banner = page.locator('.install-banner');
  await banner.getByRole('button', { name: 'Install app', exact: true }).click();
  await expect(banner.getByRole('alert')).toContainText('Installation could not start');
  await banner.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(banner).toHaveCount(0);
});
