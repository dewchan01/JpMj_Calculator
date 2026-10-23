import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1280]) {
  test(`shared tile entry and individual deletion at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('link', { name: 'Quick score', exact: true }).click();
    await expect(page.locator('app-storage-status')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete a tile', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Clear', exact: true })).toHaveCount(0);
    await expect(page.locator('.hand-controls')).toHaveCount(0);
    await expect(page.locator('.meld-card .step')).toHaveText('02');
    await expect(page.locator('.hand-tray > app-tile-entry-dialog > button')).toHaveText(
      'Enter tiles',
    );
    await page.screenshot({ path: `artifacts/hand-empty-${width}.png`, fullPage: true });
    await expect(page.getByRole('combobox', { name: 'Meld type', exact: true })).toHaveCount(0);
    const trigger = page.getByRole('button', { name: 'Enter tiles', exact: true });
    const entryOffset = () =>
      trigger.evaluate((button) => {
        const tray = button.closest('.hand-tray')!.getBoundingClientRect();
        const bounds = button.getBoundingClientRect();
        return { x: bounds.x - tray.x, y: bounds.y - tray.y };
      });
    const emptyOffset = await entryOffset();
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Enter tiles', exact: true });
    await dialog.getByRole('button', { name: '2p: Add 2 pin', exact: true }).click();
    await dialog.getByText('Type compact tile notation', { exact: true }).click();
    await expect(
      dialog.getByRole('textbox', { name: 'All tiles, including melds and North' }),
    ).toBeVisible();
    await expect(dialog.locator('input[type="file"]:not([capture])')).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    if (width === 390) expect(Math.abs(box!.y + box!.height - 900)).toBeLessThan(2);
    else {
      expect(box!.width).toBeLessThan(900);
      expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThan(2);
      expect(Math.abs(box!.y + box!.height / 2 - 450)).toBeLessThan(2);
    }
    await page.screenshot({ path: `artifacts/tile-entry-${width}.png` });
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await entryOffset()).toEqual(emptyOffset);
    await expect(page.locator('.hand-controls')).toBeVisible();
    await page.getByRole('button', { name: 'Delete a tile', exact: true }).click();
    await page.locator('.hand-tray > .hand-tiles > button.tile').click();
    await expect(page.locator('.hand-tray > .hand-tiles > button.tile')).toHaveCount(0);
    await expect(page.locator('.hand-controls')).toHaveCount(0);
    await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
    await page.getByRole('button', { name: 'Undo tile edit' }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.hand-tray > .hand-tiles > button.tile')).toHaveCount(1);
    await trigger.click();
    await expect(page.getByRole('dialog').locator('.entry-preview app-tile-art')).toHaveCount(1);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Remove 2 pin/ })
      .click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.hand-tray > .hand-tiles > button.tile')).toHaveCount(0);
  });
}
