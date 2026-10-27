import { test, expect } from '@playwright/test';
import { openQuickScore } from './helpers/navigation';

for (const width of [390, 1280]) {
  test(`quick score uses standard tile entry and applicable win options at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await openQuickScore(page);
    await expect(page.getByRole('checkbox', { name: 'Rinshan', exact: true })).toHaveCount(0);
    await expect(page.locator('app-tile-input[data-label="Ura indicators"]')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Double Riichi', exact: true }).check();
    await expect(page.getByRole('checkbox', { name: 'Riichi', exact: true })).toBeChecked();
    await expect(page.locator('app-tile-input[data-label="Ura indicators"]')).toBeVisible();
    await page.getByRole('combobox', { name: 'Win method', exact: true }).selectOption('tsumo');
    await expect(page.getByRole('checkbox', { name: 'Chankan', exact: true })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Discarder', exact: true })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Haitei', exact: true }).check();
    await page.getByRole('combobox', { name: 'Win method', exact: true }).selectOption('ron');
    await expect(page.getByRole('checkbox', { name: 'Haitei', exact: true })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Win method', exact: true }).selectOption('tsumo');
    await expect(page.getByRole('checkbox', { name: 'Haitei', exact: true })).not.toBeChecked();
    await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Enter tiles', exact: true });
    await expect(sheet.locator('.tile-entry-tray')).toBeVisible();
    await expect(sheet.locator('.picker')).toHaveJSProperty('open', true);
    await expect(sheet).not.toContainText('Drag tiles to reorder');
    expect(
      await sheet
        .locator('.notation')
        .evaluate((element) => !!element.previousElementSibling?.classList.contains('picker')),
    ).toBe(true);
    await expect(sheet).toHaveCSS('scrollbar-width', 'auto');
    expect(
      await sheet.evaluate(
        (element) => getComputedStyle(element, '::-webkit-scrollbar-button').display,
      ),
    ).toBe('none');
    await expect(sheet.getByRole('button', { name: 'Undo tile edit', exact: true })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Redo tile edit', exact: true })).toHaveCount(0);
    await sheet.getByText('Type compact tile notation', { exact: true }).click();
    await sheet
      .getByRole('textbox', { name: 'All tiles, including melds and North', exact: true })
      .fill('111m456m789p234s55p');
    await sheet.getByRole('button', { name: 'Replace tile collection', exact: true }).click();
    await sheet.screenshot({ path: `artifacts/quick-score-entry-${width}.png` });
    await sheet.getByRole('button', { name: 'Done', exact: true }).click();
    const remove = page.getByRole('button', { name: 'Delete a tile', exact: true });
    await expect(remove).toHaveAttribute('aria-pressed', 'false');
    const inactive = await remove.evaluate((element) => getComputedStyle(element).backgroundColor);
    await remove.click();
    await expect(remove).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() => remove.evaluate((element) => getComputedStyle(element).backgroundColor))
      .not.toBe(inactive);
    await page.screenshot({
      path: `artifacts/quick-score-active-delete-${width}.png`,
      fullPage: true,
    });
    await remove.click();
    const tiles = page.locator('.hand-tiles > [data-tile-index]');
    for (let i = 0; i < 3; i++) await tiles.nth(i).click();
    await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Assign selected tiles', exact: true })
      .getByRole('button', { name: 'Assign selected tiles', exact: true })
      .click();
    await expect(page.getByRole('checkbox', { name: 'Riichi', exact: true })).toHaveCount(0);
    await expect(page.locator('app-tile-input[data-label="Ura indicators"]')).toHaveCount(0);
  });
}
