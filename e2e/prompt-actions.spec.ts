import { test, expect, type Locator } from '@playwright/test';
import { gameMenu, prompt } from './helpers/game';

async function expectRightAligned(button: Locator): Promise<void> {
  await expect(button).toBeVisible();
  const distance = await button.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const row = element.parentElement!.getBoundingClientRect();
    return row.right - bounds.right;
  });
  expect(Math.abs(distance)).toBeLessThan(2);
}

test('single save and filter actions align right on phones and desktops', async ({ page }) => {
  await page.goto('/');
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Record results only', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Record results only', exact: true });
    await expectRightAligned(dialog.getByRole('button', { name: 'Save game', exact: true }));
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await gameMenu(page, 'Edit game info');
  await expectRightAligned(prompt(page).getByRole('button', { name: 'Save', exact: true }));
  await prompt(page).locator('.close-prompt').click();
  await page.goto('/records');
  await page.getByRole('button', { name: 'Filter records', exact: true }).click();
  const actions = page.locator('.filter-dialog-actions');
  await expect(actions).toHaveCSS('justify-content', 'flex-end');
  const buttons = actions.getByRole('button');
  const first = (await buttons.first().boundingBox())!;
  const last = (await buttons.last().boundingBox())!;
  expect(first.x).toBeLessThan(last.x);
});
