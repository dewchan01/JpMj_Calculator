import { test, expect } from '@playwright/test';

test('dice show six real faces and rotate through 3D transforms before settling', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Dice', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Dice', exact: true });
  await expect(dialog.locator('.die-face')).toHaveCount(12);
  const die = dialog.locator('.die').first();
  await expect(die).toHaveCSS('transform-style', 'preserve-3d');
  const initial = await die.evaluate((element) => getComputedStyle(element).transform);
  await expect
    .poll(() => die.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(initial);
  await page.screenshot({ path: 'artifacts/dice-3d-rolling.png' });
  await expect(dialog.getByRole('status')).toHaveText(/[1-6] \+ [1-6] = (?:[2-9]|1[0-2])/);
  for (const cube of await dialog.locator('.die').all()) {
    const value = Number(await cube.getAttribute('data-result'));
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
    for (let face = 1; face <= 6; face++)
      await expect(cube.locator(`[data-face="${face}"] .visible`)).toHaveCount(face);
  }
  await page.screenshot({ path: 'artifacts/dice-3d-settled.png' });
});
