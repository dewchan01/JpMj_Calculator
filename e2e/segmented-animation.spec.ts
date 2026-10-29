import { expect, test } from '@playwright/test';

test('segmented selection slides both ways and respects reduced motion', async ({ page }) => {
  await page.goto('/settings');
  const control = page.locator('.settings-sticky .segmented');
  await expect(control).toBeVisible();
  const selection = () =>
    control.evaluate((element) => {
      const style = getComputedStyle(element, '::before');
      return {
        x: new DOMMatrixReadOnly(style.transform).m41,
        width: parseFloat(style.width),
        duration: style.transitionDuration,
      };
    });
  await expect.poll(async () => (await selection()).x).toBe(0);
  await control.getByRole('button', { name: '3 players', exact: true }).click();
  await expect
    .poll(async () => {
      const indicator = await selection();
      return Math.abs(indicator.x - indicator.width - 5);
    })
    .toBeLessThan(1);
  expect((await selection()).duration).toBe('0.22s');
  await page.screenshot({ path: 'artifacts/segmented-slide.png' });
  await control.getByRole('button', { name: '4 players', exact: true }).click();
  await expect.poll(async () => (await selection()).x).toBe(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await selection()).duration).toBe('0s');
});
