import { openQuickScore } from './helpers/navigation';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('one manual collection assigns Pon and Kan afterward and returns groups', async ({ page }) => {
  await page.goto('/');
  await openQuickScore(page);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  const white = page.getByRole('button', { name: 'P: Add white dragon', exact: true });
  await white.click();
  await white.click();
  await white.click();
  for (let index = 0; index < 4; index++)
    await page.getByRole('button', { name: 'N: Add north wind', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const tiles = page.locator('.hand-tray > .hand-tiles > button.tile');
  await expect(tiles).toHaveCount(7);
  for (let index = 0; index < 3; index++) await tiles.nth(index).click();
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Assign selected tiles', exact: true })
    .click();
  await expect(page.locator('.meld-row')).toHaveCount(1);
  for (let index = 0; index < 4; index++) await tiles.nth(index).click();
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await page.getByRole('combobox', { name: 'Assign as', exact: true }).selectOption('ankan');
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await expect(page.locator('.meld-row')).toHaveCount(2);
  await expect(tiles).toHaveCount(0);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByRole('button', { name: 'Undo tile edit' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.meld-row')).toHaveCount(1);
  await expect(tiles).toHaveCount(4);
  await page.getByRole('button', { name: 'Return to tile collection', exact: true }).click();
  await expect(tiles).toHaveCount(7);
  await expect(page.locator('.meld-row')).toHaveCount(0);
});

test('provider and publishable key settings are not exposed to users', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('riichi-roboflow-publishable-key', 'obsolete-browser-key'),
  );
  await page.goto('/');
  await openQuickScore(page);
  await expect(page.getByRole('textbox', { name: 'Publishable API Key', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('textbox', { name: 'Detection API endpoint' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use Roboflow', exact: true })).toHaveCount(0);
});

test('tiles from one entered hand can be grouped into Pon with undo', async ({ page }) => {
  await page.goto('/');
  await openQuickScore(page);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByText('Type compact tile notation', { exact: true }).click();
  await page
    .getByRole('textbox', { name: 'All tiles, including melds and North', exact: true })
    .fill('555z123m');
  await page.getByRole('button', { name: 'Replace tile collection', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const tiles = page.locator(
    '.hand-tray[aria-label="Concealed tiles including winning tile"] > .hand-tiles > button.tile',
  );
  await tiles.nth(0).click();
  await tiles.nth(1).click();
  await tiles.nth(2).click();
  await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Assign selected tiles', exact: true })
    .click();
  await expect(page.locator('.meld-row')).toHaveCount(1);
  await expect(tiles).toHaveCount(3);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByRole('button', { name: 'Undo tile edit' }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.meld-row')).toHaveCount(0);
  await expect(tiles).toHaveCount(6);
});

test('meld, Dora and Ura fields use image pickers and removable previews', async ({ page }) => {
  await page.goto('/');
  await openQuickScore(page);
  for (const label of ['Dora indicators', 'Ura indicators']) {
    const input = page.locator(`app-tile-input[data-label="${label}"]`);
    const entry = input.getByRole('button', { name: 'Enter ' + label, exact: true });
    const entryOffset = () =>
      entry.evaluate((button) => {
        const field = button.closest('.indicator-editor')!.getBoundingClientRect();
        const bounds = button.getBoundingClientRect();
        return { x: bounds.x - field.x, y: bounds.y - field.y };
      });
    const emptyOffset = await entryOffset();
    await input.getByRole('button', { name: 'Enter ' + label, exact: true }).click();
    await expect(input.locator('.picker')).toHaveJSProperty('open', true);
    await input.getByRole('button', { name: '2p: Add 2 pin', exact: true }).click();
    expect(await entryOffset()).toEqual(emptyOffset);
    await input.getByText('Type tile notation instead', { exact: true }).click();
    await expect(
      input.getByRole('textbox', { name: label, exact: true }),
    ).toHaveAccessibleDescription(/Example: 4p 1z/);
    await expect(input.locator('dialog[open] .selected-tiles app-tile-art')).toHaveCount(1);
    await expect(
      page.locator(
        '.hand-tray[aria-label="Concealed tiles including winning tile"] > .hand-tiles > button.tile',
      ),
    ).toHaveCount(0);
    await input
      .locator('dialog[open]')
      .getByRole('button', { name: 'Remove 2 pin', exact: true })
      .click();
    await expect(input.locator('.selected-tiles app-tile-art')).toHaveCount(0);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  }
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
});
