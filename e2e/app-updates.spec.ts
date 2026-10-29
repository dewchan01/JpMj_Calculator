import { test, expect, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ serviceWorkers: 'block' });

test('version page offers a manual update check with busy, current and retry states', async ({
  page,
}) => {
  const version = { version: '1.0.0', commit: 'local-test', dirty: false };
  let check: Route | undefined;
  await page.route('**/version.json', (route) => {
    if (route.request().headers()['ngsw-bypass']) check = route;
    else void route.fulfill({ json: version });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/others/version');
  await expect(page.getByText('local-test', { exact: true })).toBeVisible();
  const button = page.getByRole('button', { name: /Check for updates|Checking for updates/ });
  await button.click();
  await expect(button).toBeDisabled();
  await expect.poll(() => !!check).toBe(true);
  await check!.fulfill({ json: version });
  await expect(page.getByRole('status')).toHaveText('You are using the latest version.');
  await expect(button).toBeEnabled();
  check = undefined;
  await button.click();
  await expect.poll(() => !!check).toBe(true);
  await check!.fulfill({ status: 503 });
  await expect(page.getByRole('alert')).toHaveText(
    'Could not check for updates. Check your connection and try again.',
  );
  await expect(button).toBeEnabled();
  check = undefined;
  await button.click();
  await expect.poll(() => !!check).toBe(true);
  await check!.fulfill({ json: version });
  await expect(page.getByRole('status')).toHaveText('You are using the latest version.');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await expect(page.locator('.other-detail .update-status')).toHaveCount(0);
  await page.evaluate(() => {
    const dialog = document.createElement('dialog');
    dialog.id = 'toast-modal-test';
    dialog.setAttribute('aria-label', 'Toast modal test');
    document.body.appendChild(dialog);
    dialog.showModal();
  });
  const modal = page.getByRole('dialog', { name: 'Toast modal test', exact: true });
  await expect(modal.locator('.toast:popover-open')).toBeVisible();
  await modal.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
  await expect(page.locator('.toast:popover-open')).toHaveCount(0);
  await modal.evaluate((element) => element.remove());
  check = undefined;
  await button.click();
  await expect.poll(() => !!check).toBe(true);
  await check!.fulfill({ json: version });
  await expect(page.locator('.toast:popover-open')).toBeVisible();
});
