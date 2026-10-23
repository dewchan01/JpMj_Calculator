import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ serviceWorkers: 'block' });

test('file configuration, editable capture preview, and independent tile targets', async ({
  page,
}) => {
  const endpoint = 'https://detector.example/detect';
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { recognition: { provider: 'api', endpoint, timeoutMs: 30000 } } }),
  );
  let received = false;
  await page.route(endpoint, async (route) => {
    expect((route.request().postDataJSON() as { image: string }).image).toMatch(
      /^[A-Za-z0-9+/]+=*$/,
    );
    received = true;
    await route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: {
        image: { width: 1600, height: 324 },
        predictions: [
          { class: '7z', confidence: 0.94, x: 1400, y: 160, width: 100, height: 140 },
          { class: '2m', confidence: 0.95, x: 200, y: 160, width: 100, height: 140 },
        ],
      },
    });
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Quick score', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Detection API endpoint' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  const capture = page.locator('app-photo-capture').first();
  const file = capture.locator('input[type="file"]:not([capture])');
  await expect(file).toBeVisible();
  await expect(file).not.toHaveAttribute('capture', /.*/);
  await file.setInputFiles('apps/web/public/icons/icon-192.png');
  await expect(capture.locator('details')).toHaveJSProperty('open', true);
  await expect(capture.locator('.review-tile')).toHaveCount(2);
  await expect(capture.locator('.preview-tile-face').first()).toHaveCSS('border-top-width', '1px');
  await expect(capture.locator('.preview-tile-face img').first()).toHaveAttribute(
    'loading',
    'eager',
  );
  expect(received).toBe(true);
  await expect(page.locator('.hand-tray > .hand-tiles > button.tile app-tile-art')).toHaveCount(0);
  await capture.getByRole('button', { name: 'Move tile left' }).nth(1).click();
  await expect(capture.getByRole('textbox', { name: 'Edit preview tiles' })).toHaveValue('7z2m');
  await capture.getByRole('button', { name: 'Remove preview tile' }).first().click();
  await capture.getByRole('textbox', { name: 'Edit preview tiles' }).fill('123p');
  await expect(capture.getByRole('button', { name: 'Apply reviewed tiles' })).toBeDisabled();
  await capture.getByRole('button', { name: 'Update preview' }).click();
  await capture.getByRole('button', { name: 'Apply reviewed tiles' }).click();
  await expect(page.locator('.hand-tray > .hand-tiles > button.tile app-tile-art')).toHaveCount(3);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByRole('button', { name: 'Undo tile edit' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.hand-tray > .hand-tiles > button.tile app-tile-art')).toHaveCount(0);
  for (const [target, notation] of [
    ['Dora indicators', '4p'],
    ['Ura indicators', '6s'],
  ]) {
    await page.getByRole('button', { name: 'Enter ' + target, exact: true }).click();
    const panel = page.locator('dialog[open] app-photo-capture');
    await expect(panel.locator('input[type="file"]:not([capture])')).toBeVisible();
    await panel.locator('summary').click();
    await panel.getByRole('textbox', { name: 'Edit preview tiles' }).fill(notation);
    await panel.getByRole('button', { name: 'Update preview' }).click();
    await panel.getByRole('button', { name: 'Apply reviewed tiles' }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(
      page.locator('app-tile-input[data-label="' + target + '"] .selected-tiles app-tile-art'),
    ).toHaveCount(1);
  }
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.unroute(endpoint);
  await page.route(endpoint, (route) =>
    route.fulfill({ status: 503, body: '', headers: { 'access-control-allow-origin': '*' } }),
  );
  await file.setInputFiles('apps/web/public/icons/icon-192.png');
  await expect(capture.getByRole('alert')).toContainText('HTTP 503');
  await expect(capture.locator('.review-tile')).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('invalid configuration disables uploads without preventing manual previews', async ({
  page,
}) => {
  await page.route('**/config.json', (route) => route.fulfill({ json: {} }));
  await page.goto('/');
  await page.getByRole('link', { name: 'Quick score', exact: true }).click();
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  const capture = page.locator('app-photo-capture').first();
  await capture.locator('summary').click();
  await expect(capture.getByRole('alert')).toContainText('config.json');
  await expect(capture.locator('input[type="file"]').first()).toBeDisabled();
  await capture.getByRole('textbox', { name: 'Edit preview tiles' }).fill('123m');
  await capture.getByRole('button', { name: 'Update preview' }).click();
  await capture.getByRole('button', { name: 'Apply reviewed tiles' }).click();
  await expect(page.locator('.hand-tray > .hand-tiles > button.tile app-tile-art')).toHaveCount(3);
});

for (const dark of [false, true]) {
  test(`preview tile frames remain visible on mobile in ${dark ? 'dark' : 'light'} mode`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.route('**/config.json', (route) =>
      route.fulfill({ json: { recognition: { provider: 'mock' } } }),
    );
    await page.goto('/');
    if (dark) await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await page.getByRole('link', { name: 'Quick score', exact: true }).click();
    await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
    const capture = page.locator('app-photo-capture').first();
    await capture.locator('summary').click();
    await capture.getByRole('textbox', { name: 'Edit preview tiles' }).fill('5z6s7z');
    await capture.getByRole('button', { name: 'Update preview' }).click();
    const frames = capture.locator('.preview-tile-face');
    await expect(frames).toHaveCount(3);
    await expect(frames.first()).toHaveCSS('border-top-width', '1px');
    await expect
      .poll(() =>
        frames
          .locator('img')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await capture
      .locator('.review-tray')
      .screenshot({ path: `artifacts/preview-frames-${dark ? 'dark' : 'light'}.png` });
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
  });
}
