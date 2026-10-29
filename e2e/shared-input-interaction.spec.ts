import { expect, test } from '@playwright/test';

test('shared indicator palette is click-only while selected tiles remain draggable', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page
    .locator('.indicator-bar')
    .getByRole('button', { name: 'Dora indicators', exact: true })
    .click();
  const editor = page.getByRole('dialog', { name: 'Enter Dora indicators', exact: true });
  await expect(editor).toBeVisible();
  const palette = editor.locator('app-tile-picker');
  await expect(palette.locator('[data-tile-index]')).toHaveCount(0);
  await expect(palette.locator('img').first()).toHaveAttribute('draggable', 'false');
  await palette.getByRole('button').first().click();
  const selected = editor.locator('.tile-entry-tray [data-tile-index]');
  await expect(selected).toHaveCount(1);
  const bounds = (await selected.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 15, bounds.y + bounds.height / 2, {
    steps: 3,
  });
  await expect(page.locator('.tile-drag-preview')).toBeVisible();
  await page.mouse.up();
});
