import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
test('game sync checks updates without reloading and asks before applying', async ({ page }) => {
  let versionRequests = 0;
  let update = false;
  let release: (() => void) | undefined;
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.route('**/version.json', async (route) => {
    versionRequests++;
    if (update)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({
      json: { version: '1.0.0', commit: update ? 'new' : 'old', dirty: false },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect.poll(() => versionRequests).toBeGreaterThan(0);
  const originalUrl = page.url();
  const sync = page.getByRole('button', { name: 'Sync and check for updates', exact: true });
  update = true;
  await sync.click();
  await expect(sync).toBeDisabled();
  await expect(sync).toHaveAttribute('aria-busy', 'true');
  await expect.poll(() => !!release).toBe(true);
  release!();
  const dialog = page.getByRole('dialog', { name: 'Update available', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(originalUrl);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(sync).toBeEnabled();
  expect(versionRequests).toBe(2);
});
