import { expect, test } from '@playwright/test';

test('storage usage updates and warns at 80% and 95%, including zh-TW', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'estimate', {
      value: async () => ({ usage: Number(localStorage.getItem('test-usage') ?? 20), quota: 100 }),
    });
  });
  await page.goto('/');
  await expect(page.locator('app-storage-status')).toHaveCount(0);
  await page.getByRole('link', { name: 'Rule coverage', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Browser storage', exact: true });
  await expect(panel.getByRole('meter')).toHaveAttribute('value', '20');
  await expect(panel.locator('.storage-warning')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('test-usage', '80'));
  await panel.getByRole('button', { name: 'Refresh storage usage' }).click();
  await expect(panel.getByText(/Storage is nearing its limit/)).toBeVisible();
  await page.evaluate(() => localStorage.setItem('test-usage', '95'));
  await panel.getByRole('button', { name: 'Refresh storage usage' }).click();
  await expect(panel.getByText(/Storage is almost full/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Language / 語言' }).selectOption('zh-TW');
  await expect(page.getByText(/儲存空間即將用盡/)).toBeVisible();
  await page.evaluate(() => localStorage.setItem('test-usage', '20'));
  await page.getByRole('button', { name: '更新儲存空間用量' }).click();
  await expect(page.locator('.storage-warning')).toHaveCount(0);
});

for (const scenario of ['rejected', 'missing-quota', 'zero-quota'] as const) {
  test(`storage estimates handle ${scenario} without claiming zero usage`, async ({ page }) => {
    await page.addInitScript((scenario) => {
      Object.defineProperty(navigator.storage, 'estimate', {
        value: async () => {
          if (scenario === 'rejected') throw new Error('Unavailable');
          return scenario === 'missing-quota' ? { usage: 10 } : { usage: 10, quota: 0 };
        },
      });
    }, scenario);
    await page.goto('/');
    await page.getByRole('link', { name: 'Rule coverage', exact: true }).click();
    await expect(
      page.getByText('Storage usage is unavailable in this browser. Saving may still work.'),
    ).toBeVisible();
    await expect(page.getByRole('meter')).toHaveCount(0);
    await page.getByRole('link', { name: 'My table', exact: true }).click();
    await expect(page.locator('app-storage-status')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Start match/ })).toBeEnabled();
  });
}
