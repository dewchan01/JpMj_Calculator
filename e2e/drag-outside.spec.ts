import { test, expect, type Page, type Locator } from '@playwright/test';
import { openQuickScore } from './helpers/navigation';

test('home uses real tile art and dragging left makes room before committing the order', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const art = page.locator('.tile-still-life img');
  await expect(art).toHaveCount(3);
  for (const [index, name] of ['Man1', 'Hatsu', 'Sou9'].entries()) {
    await expect(art.nth(index)).toHaveAttribute('src', new RegExp(name + '\\.svg$'));
    await expect
      .poll(() => art.nth(index).evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  }
  await page.locator('.tile-still-life').screenshot({ path: 'artifacts/home-real-tiles.png' });
  await openQuickScore(page);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Enter tiles', exact: true });
  for (const rank of [1, 2, 3])
    await sheet.getByRole('button', { name: `${rank}m: Add ${rank} man`, exact: true }).click();
  const tiles = sheet.locator('.entry-preview > [data-tile-index]');
  const left = (await tiles.first().boundingBox())!;
  const right = (await tiles.last().boundingBox())!;
  const last = await tiles.last().getAttribute('aria-label');
  await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2);
  await page.mouse.down();
  await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2, { steps: 8 });
  await expect
    .poll(async () => (await tiles.first().boundingBox())!.x)
    .toBeGreaterThan(left.x + left.width / 2);
  await expect(tiles.last()).toHaveCSS('opacity', '0');
  await page.mouse.up();
  await expect(tiles.first()).toHaveAttribute('aria-label', last!);
  await expect(sheet.locator('.tile-reorder-shift')).toHaveCount(0);
});

async function outside(page: Page, tile: Locator) {
  await tile.scrollIntoViewIfNeeded();
  const bounds = (await tile.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y - 20, { steps: 6 });
  await expect(page.locator('.tile-drag-preview')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.tile-drag-preview')).toHaveCount(0);
}

test('dragging a selected collection tile outside removes it and Undo restores it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await openQuickScore(page);
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Enter tiles', exact: true });
  for (const rank of [1, 2, 3])
    await sheet.getByRole('button', { name: `${rank}m: Add ${rank} man`, exact: true }).click();
  const tiles = sheet.locator('.entry-preview > .tile');
  await outside(page, tiles.first());
  await expect(tiles).toHaveCount(2);
  await sheet.press('Control+z');
  await expect(tiles).toHaveCount(3);
});

test('shared indicator entry removes selected tiles dragged outside without removing palette tiles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page
    .locator('.indicator-bar')
    .getByRole('button', { name: 'Dora indicators', exact: true })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Enter Dora indicators', exact: true });
  const palette = sheet.locator('.palette-row').first().locator('button');
  await expect(palette).toHaveCount(9);
  const count = await palette.count();
  await outside(page, palette.first());
  await expect(palette).toHaveCount(count);
  await sheet.getByRole('button', { name: '1p: Add 1 pin', exact: true }).click();
  const selected = sheet.locator('.tile-input-tray .selected-tiles > .tile');
  await expect(selected).toHaveCount(1);
  await outside(page, selected.first());
  await expect(selected).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.indicator-preview app-tile-art')).toHaveCount(0);
});
