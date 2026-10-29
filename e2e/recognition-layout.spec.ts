import { test, expect } from '@playwright/test';
import { openQuickScore } from './helpers/navigation';
import AxeBuilder from '@axe-core/playwright';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

function predictions() {
  const items: Array<{
    class: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  function row(labels: string[], x: number, y: number, sideways = -1) {
    labels.forEach((label, index) => {
      const width = index === sideways ? 60 : 40;
      items.push({
        class: label,
        confidence: 0.95,
        x: x + width / 2,
        y,
        width,
        height: index === sideways ? 40 : 60,
      });
      x += width + 5;
    });
  }
  row(['1m', '2m', '3m', '4p', '5p', '6p', '1z', '1z'], 20, 100);
  row(['0p', '5p', '5p'], 800, 100, 0);
  row(['4s', '4s', '4s', '4s'], 20, 350);
  return items;
}

test.beforeEach(async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({
      json: {
        recognition: {
          provider: 'api',
          endpoint: 'https://detector.example/layout',
          timeoutMs: 30000,
        },
      },
    }),
  );
  await page.route('https://detector.example/layout', (route) =>
    route.fulfill({
      json: {
        image: { width: 1200, height: 600 },
        predictions: predictions(),
      },
    }),
  );
  await page.goto('/');
  await openQuickScore(page);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page
    .locator('app-photo-capture')
    .first()
    .locator('input[type=file]')
    .first()
    .setInputFiles('apps/web/public/icons/icon-192.png');
});

test('suggests separated Pon, keeps upright Kan optional, and applies reviewed groups atomically', async ({
  page,
}) => {
  const capture = page.locator('app-photo-capture').first();
  const groups = capture.locator('.layout-group');
  await expect(groups).toHaveCount(2);
  const pon = groups.filter({ hasText: '· Pon' });
  const kan = groups.filter({ hasText: '· Kan' });
  await expect(pon.getByRole('checkbox')).toBeChecked();
  await expect(kan.getByRole('checkbox')).not.toBeChecked();
  const apply = capture.getByRole('button', { name: 'Apply reviewed tiles', exact: true });
  await expect(apply).toBeDisabled();
  await pon
    .getByRole('combobox', { name: 'Called from', exact: true })
    .selectOption({ label: 'Player 1' });
  await expect(apply).toBeEnabled();
  await kan.getByRole('checkbox').check();
  await expect(kan.getByRole('combobox', { name: 'Meld type', exact: true })).toHaveValue('ankan');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: 'artifacts/recognition-layout-390.png', fullPage: true });
  await apply.click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.hand-tray > .hand-tiles > button.tile')).toHaveCount(8);
  await expect(page.locator('.meld-row')).toHaveCount(2);
  const recordedPon = page.locator('.meld-row').filter({ hasText: 'from Player 1' });
  await expect(recordedPon.locator('.mini-tiles > span')).toHaveCount(3);
  await expect(recordedPon.locator('.mini-tiles > span.called.red-ink')).toHaveCount(1);
  await recordedPon.getByRole('button', { name: 'Return to tile collection', exact: true }).click();
  await expect(page.locator('.hand-tray > .hand-tiles > button.tile')).toHaveCount(11);
  await expect(page.locator('.meld-row')).toHaveCount(1);
});

test('manual notation replaces geometric suggestions instead of applying stale assignments', async ({
  page,
}) => {
  const capture = page.locator('app-photo-capture').first();
  await expect(capture.locator('.layout-group')).toHaveCount(2);
  await capture
    .getByRole('textbox', { name: 'Edit preview tiles', exact: true })
    .fill('123m456p789s11z');
  await capture.getByRole('button', { name: 'Update preview', exact: true }).click();
  await expect(capture.locator('.layout-group')).toHaveCount(0);
  await capture.getByRole('button', { name: 'Apply reviewed tiles', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.hand-tray > .hand-tiles > button.tile')).toHaveCount(11);
  await expect(page.locator('.meld-row')).toHaveCount(0);
});
