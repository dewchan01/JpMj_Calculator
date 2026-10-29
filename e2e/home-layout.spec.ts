import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`home match name spans its row and decorative tiles match the theme at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem('riichi-theme', 'dark'));
    await page.goto('/');
    const field = page.getByRole('textbox', { name: 'Match name', exact: true });
    await expect(field).toBeVisible();
    const row = (await page.locator('.setup-fields').boundingBox())!;
    const bounds = (await field.boundingBox())!;
    expect(Math.abs(bounds.x - row.x)).toBeLessThan(1);
    expect(Math.abs(bounds.width - row.width)).toBeLessThan(1);
    const faces = page.locator('.tile-still-life > span');
    await expect(faces).toHaveCount(3);
    await expect(faces.first()).toHaveCSS('background-color', 'rgb(17, 17, 17)');
    await expect(faces.nth(1).locator('img')).toHaveAttribute('src', /tiles\/Black\/Hatsu.svg/);
    if (width === 1280)
      await page.screenshot({
        path: 'artifacts/home-dark-tiles.png',
        fullPage: true,
        animations: 'disabled',
      });
  });
}
