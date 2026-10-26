import { expect, type Page } from '@playwright/test';

export async function choosePlayer(page: Page, seat: string, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Choose player ' + seat, exact: true }).click();
  const dialog = page.locator('dialog[aria-labelledby="players-title"]');
  await dialog.getByRole('searchbox', { name: 'Search players', exact: true }).fill(name);
  await dialog.getByRole('button', { name, exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
