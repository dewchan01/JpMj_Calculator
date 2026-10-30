import { test, expect } from '@playwright/test';
import { enterLiveTiles, prompt } from './helpers/game';

for (const width of [390, 1280]) {
  test(`indicator entry enforces the displayed tile count at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: /Start match/ }).click();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await page
      .locator('app-tile-input[data-label="Dora indicators"]')
      .getByRole('button', { name: 'Enter Dora indicators', exact: true })
      .click();
    const editor = page.getByRole('dialog', { name: 'Enter Dora indicators', exact: true });
    const done = editor.getByRole('button', { name: 'Done', exact: true });
    await expect(editor.getByText('Required tiles: 1', { exact: true })).toBeVisible();
    await expect(done).toBeDisabled();
    await editor.getByText('Type tile notation instead', { exact: true }).click();
    const notation = editor.getByRole('textbox', { name: 'Dora indicators', exact: true });
    await notation.fill('1z2z');
    await editor.getByRole('button', { name: 'Apply notation', exact: true }).click();
    await expect(editor.getByRole('alert')).toContainText('Required tiles: 1 (Selected tiles: 2)');
    await expect(editor.getByText('Required tiles: 1', { exact: true })).toHaveCount(0);
    await expect(done).toBeDisabled();
    await notation.fill('7z');
    await editor.getByRole('button', { name: 'Apply notation', exact: true }).click();
    await expect(editor.getByRole('alert')).toHaveCount(0);
    await expect(editor.getByText('Required tiles: 1', { exact: true })).toBeVisible();
    await expect(done).toBeEnabled();
    await done.click();
    await expect(editor).not.toBeVisible();
  });
  test(`meld guidance is replaced by errors and restored after correction at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: /Start match/ }).click();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await enterLiveTiles(page, 'Dora indicators', '7z');
    await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
    await page
      .locator('.player-seat')
      .filter({ hasText: 'Player 2' })
      .getByRole('button', { name: 'Call', exact: true })
      .click();
    await prompt(page).getByRole('button', { name: 'Pon', exact: true }).click();
    await page
      .locator('app-tile-input[data-label="Meld tiles"]')
      .getByRole('button', { name: 'Enter Meld tiles', exact: true })
      .click();
    const editor = page.getByRole('dialog', { name: 'Enter Meld tiles', exact: true });
    const hint = editor.getByText(
      'Choose one tile; matching tiles are filled automatically. Select a red five if the set contains one.',
      { exact: true },
    );
    await expect(hint).toBeVisible();
    await expect(editor.getByRole('alert')).toHaveCount(0);
    await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeDisabled();
    await editor.getByText('Type tile notation instead', { exact: true }).click();
    const notation = editor.getByRole('textbox', { name: 'Meld tiles', exact: true });
    await notation.fill('55p');
    await editor.getByRole('button', { name: 'Apply notation', exact: true }).click();
    await expect(editor.getByRole('alert')).toContainText('Choose one tile for automatic matching');
    await expect(hint).toHaveCount(0);
    await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeDisabled();
    await editor.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(editor).not.toBeVisible();
    await expect(prompt(page)).toBeVisible();
    await page
      .locator('app-tile-input[data-label="Meld tiles"]')
      .getByRole('button', { name: 'Enter Meld tiles', exact: true })
      .click();
    await expect(editor.getByRole('alert')).toContainText('Choose one tile for automatic matching');
    await editor.getByText('Type tile notation instead', { exact: true }).click();
    await expect(notation).toHaveValue('55p');
    await notation.fill('5p');
    await editor.getByRole('button', { name: 'Apply notation', exact: true }).click();
    await expect(editor.getByRole('alert')).toHaveCount(0);
    await expect(hint).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Done', exact: true })).toBeEnabled();
    await notation.fill('invalid');
    await editor.getByRole('button', { name: 'Apply notation', exact: true }).click();
    await expect(editor.getByRole('alert')).toContainText('Invalid review notation');
    await expect(hint).toHaveCount(0);
    await expect(editor.locator('p[id^="notation-hint-"]')).toHaveCount(0);
    await expect(notation).not.toHaveAttribute('aria-describedby');
    await notation.fill('5p');
    await editor.getByRole('button', { name: 'Apply notation', exact: true }).click();
    await expect(editor.getByRole('alert')).toHaveCount(0);
    await expect(editor.locator('p[id^="notation-hint-"]')).toBeVisible();
  });
}
