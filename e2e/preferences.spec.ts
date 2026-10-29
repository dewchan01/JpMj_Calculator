import { test, expect } from '@playwright/test';
import { gameMenu, prompt } from './helpers/game';

test.beforeEach(async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
});

test('M.League shows a locked East + South schedule and creates that game length', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await page.getByRole('button', { name: 'M.League', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Game length', exact: true })).toHaveValue(
    'East + South',
  );
  await expect(page.getByRole('textbox', { name: 'Game length', exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await gameMenu(page, 'In-game settings');
  await expect(prompt(page)).toContainText('East and South game');
});

test('desktop speaker control persists and shares the sound preference', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mute sound effects', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Unmute sound effects', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Unmute sound effects', exact: true }),
  ).toBeVisible();
  await page.locator('.app-navigation a[href$="/others"]').click();
  await page.getByRole('link', { name: 'Sound effects', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Sound effects', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Unmute sound effects', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Sound effects', exact: true })).toBeChecked();
});

test('scoring preference uses explicit assisted and manual Han choices', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/others/advanced');
  await expect(page.getByRole('radio', { name: 'Assisted scoring', exact: true })).toBeChecked();
  for (const option of await page.locator('.scoring-mode-option').all()) {
    const description = (await option.locator('.scoring-mode-description').boundingBox())!;
    const radio = option.getByRole('radio');
    await expect(radio).toHaveCSS('width', '18px');
    const bounds = (await radio.boundingBox())!;
    expect(bounds.x).toBeGreaterThan(description.x + description.width);
    expect(
      Math.abs(bounds.y + bounds.height / 2 - description.y - description.height / 2),
    ).toBeLessThan(1);
  }
  await page.getByRole('radio', { name: 'Manual Han entry', exact: true }).check();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Manual Han entry', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Assisted scoring', exact: true }).check();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Assisted scoring', exact: true })).toBeChecked();
});
