import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ serviceWorkers: 'block' });

test('one photo supplies concealed tiles, Pon and North before assignment', async ({ page }) => {
  const endpoint = 'https://detector.example/detect';
  let requests = 0;
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { recognition: { provider: 'api', endpoint, timeoutMs: 30000 } } }),
  );
  await page.route(endpoint, (route) => {
    requests++;
    return route.fulfill({
      json: {
        image: { width: 1000, height: 200 },
        predictions: ['5z', '5z', '5z', '4z', '4z', '1p', '2p', '3p'].map((tile, index) => ({
          class: tile,
          confidence: 0.95,
          x: 50 + index * 100,
          y: 100,
          width: 80,
          height: 150,
        })),
      },
    });
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Quick score', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Rules', exact: true })
    .selectOption({ label: '3P · Sanma' });
  await expect(page.getByRole('combobox', { name: 'Assign as', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  const capture = page.locator('app-photo-capture').first();
  await capture
    .locator('input[type="file"]:not([capture])')
    .setInputFiles('apps/web/public/icons/icon-192.png');
  await expect(capture.locator('.review-tile')).toHaveCount(8);
  await capture.getByRole('button', { name: 'Apply reviewed tiles' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const tiles = page.locator('.hand-tray > .hand-tiles > button.tile');
  for (let index = 0; index < 3; index++) await tiles.nth(index).click();
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await expect(page.locator('.meld-row')).toHaveCount(1);
  await tiles.nth(0).click();
  await tiles.nth(1).click();
  await page.getByRole('combobox', { name: 'Assign as', exact: true }).selectOption('kita');
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await expect(page.getByText('Extracted North · 2', { exact: true })).toBeVisible();
  await expect(tiles).toHaveCount(3);
  await tiles.nth(0).click();
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('only North');
  await expect(tiles).toHaveCount(3);
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Keep concealed', exact: true }).click();
  await page.getByRole('button', { name: 'Return North to tile collection', exact: true }).click();
  await expect(tiles).toHaveCount(5);
});
