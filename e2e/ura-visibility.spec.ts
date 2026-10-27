import { test, expect } from '@playwright/test';
import { beginWin, enterLiveTiles, playerAction, prompt } from './helpers/game';

for (const method of ['ron', 'tsumo'] as const) {
  test(`Ura is hidden on the table and available only for a declared Riichi ${method} winner`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Start match/ }).click();
    const uraOnTable = page
      .locator('.indicator-bar')
      .getByRole('button', { name: 'Ura indicators', exact: true });
    await expect(uraOnTable).toHaveCount(0);
    await page
      .locator('.indicator-bar')
      .getByRole('button', { name: 'Dora indicators', exact: true })
      .click();
    await enterLiveTiles(page, 'Dora indicators', '1z');
    if (method === 'ron') {
      await page
        .locator('.player-seat')
        .filter({ hasText: 'Player 2' })
        .getByRole('button', { name: 'Riichi', exact: true })
        .click();
    } else {
      await playerAction(page, 'Player 2');
      await prompt(page).getByRole('button', { name: 'Double Riichi', exact: true }).click();
    }
    await expect(uraOnTable).toHaveCount(0);
    await beginWin(page, 'Player 2', method);
    await enterLiveTiles(page, 'The winning hand', '123m456m789p234s55p');
    await prompt(page)
      .getByRole('combobox', { name: 'Winning tile', exact: true })
      .selectOption({ index: 12 });
    await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
    await expect(prompt(page).locator('app-tile-input[data-label="Ura indicators"]')).toBeVisible();
    await prompt(page).getByRole('button', { name: 'Enter Ura indicators', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Enter Ura indicators', exact: true });
    await expect(sheet.locator('.palette-row')).toHaveCount(5);
    await sheet.locator('.palette-row').last().getByRole('button', { name: /^0s:/ }).click();
    await sheet.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(sheet).not.toBeVisible();
    await expect(
      prompt(page).locator('app-tile-input[data-label="Ura indicators"] app-tile-art'),
    ).toHaveCount(1);
    await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
    await expect(
      prompt(page).getByRole('button', { name: 'Confirm & save settlement', exact: true }),
    ).toBeVisible();
    await prompt(page)
      .getByRole('button', { name: 'Confirm & save settlement', exact: true })
      .click();
    await expect(prompt(page)).not.toBeVisible();
    await expect(uraOnTable).toHaveCount(0);
  });
}

test('non-Riichi winning conditions do not offer Ura even when another player declared Riichi', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 1' })
    .getByRole('button', { name: 'Riichi', exact: true })
    .click();
  await beginWin(page);
  await enterLiveTiles(page, 'The winning hand', '123m456m789p234s55p');
  await prompt(page)
    .getByRole('combobox', { name: 'Winning tile', exact: true })
    .selectOption({ index: 12 });
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(prompt(page).locator('app-tile-input[data-label="Ura indicators"]')).toHaveCount(0);
});
