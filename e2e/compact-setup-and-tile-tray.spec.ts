import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [360, 390]) {
  test(`setup fits a short phone at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 667 });
    await page.goto('/');
    const ruleField = (await page.locator('.rule-field').boundingBox())!;
    const ruleButton = (await page.locator('.rule-field button').boundingBox())!;
    expect(Math.abs(ruleButton.width - ruleField.width)).toBeLessThan(1);
    for (const count of [4, 3]) {
      await page.getByRole('button', { name: `${count} players`, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
        true,
      );
      const start = (await page.getByRole('button', { name: /Start match/ }).boundingBox())!;
      const nav = (await page.locator('.app-navigation').boundingBox())!;
      expect(start.y + start.height).toBeLessThanOrEqual(nav.y);
    }
    await page.screenshot({ path: `artifacts/compact-setup-${width}.png` });
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  });
}

test('indicator tray reserves empty space and accepts dragged palette tiles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page
    .locator('.indicator-bar')
    .getByRole('button', { name: 'Dora indicators', exact: true })
    .click();
  const editor = page.getByRole('dialog', { name: 'Enter Dora indicators', exact: true });
  const tray = editor.locator('.tile-input-tray');
  await expect(tray.locator('.tile')).toHaveCount(0);
  expect((await tray.boundingBox())!.height).toBeGreaterThanOrEqual(64);
  const tile = editor.locator('.palette-tile').first();
  const from = (await tile.boundingBox())!,
    to = (await tray.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(tray.locator('.tile')).toHaveCount(1);
  await tile.click();
  await expect(tray.locator('.tile')).toHaveCount(2);
  const secondTile = editor.locator('.palette-tile').nth(1);
  const source = (await secondTile.boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: source.x + source.width / 2, y: source.y + source.height / 2, id: 1 }],
  });
  for (let step = 1; step <= 10; step++)
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x:
            source.x +
            source.width / 2 +
            ((to.x + to.width / 2 - source.x - source.width / 2) * step) / 10,
          y:
            source.y +
            source.height / 2 +
            ((to.y + to.height / 2 - source.y - source.height / 2) * step) / 10,
          id: 1,
        },
      ],
    });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(tray.locator('.tile')).toHaveCount(3);
  const lastLabel = await tray.locator('.tile').last().getAttribute('aria-label');
  await tray.locator('.tile').last().focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(tray.locator('.tile').nth(1)).toHaveAttribute('aria-label', lastLabel!);
  await page.screenshot({ path: 'artifacts/indicator-tile-tray.png' });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
