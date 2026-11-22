import { test, expect } from '@playwright/test';
import { beginWin, prompt } from './helpers/game';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 740 } });
for (const type of ['Pon', 'Chi'] as const) {
  test(`${type} confirms valid manual tiles after removing an extra tile`, async ({ page }) => {
    await page.route('**/config.json', (r) => r.fulfill({ json: { backend: { apiUrl: '' } } }));
    await page.goto('/');
    await page.getByRole('button', { name: /Start match/ }).click();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await page.locator('app-tile-entry-dialog dialog[open] app-tile-picker button').first().click();
    await expect(page.locator('app-tile-entry-dialog dialog[open]')).toHaveCount(0);
    await page
      .locator('.player-seat')
      .filter({ hasText: 'Player 2' })
      .getByRole('button', { name: 'Call', exact: true })
      .click();
    await prompt(page).getByRole('button', { name: type, exact: true }).click();
    const input = page.locator('app-tile-input[data-label="Meld tiles"]');
    const sheet = input.locator('dialog[open]');
    await expect(sheet).toBeVisible();
    await sheet.getByText('Type tile notation instead', { exact: true }).click();
    await sheet
      .getByRole('textbox', { name: 'Meld tiles', exact: true })
      .fill(type === 'Pon' ? '12m' : '1234p');
    await sheet.getByRole('button', { name: 'Apply notation', exact: true }).click();
    await expect(
      sheet.getByRole('alert').filter({
        hasText:
          type === 'Pon'
            ? 'Choose one tile for automatic matching'
            : 'Chi requires three consecutive',
      }),
    ).toBeVisible();
    await sheet.locator('.tile-entry-tray button.tile').first().click();
    await expect(sheet).toHaveCount(0);
    await expect(input.locator('.selected-tiles').first().locator('img').first()).toHaveAttribute(
      'src',
      type === 'Pon' ? /Man2\.svg/ : /Pin2\.svg/,
    );
    if (type === 'Chi') {
      const choice = page.getByRole('dialog', { name: 'Choose called tile', exact: true });
      await expect(choice).toBeVisible();
      await choice.locator('.tile-choice-options button').nth(1).click();
      await expect(prompt(page).locator('app-tile-choice .tile-choice-editor img')).toHaveAttribute(
        'src',
        /Pin3\.svg/,
      );
    }
    await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
    await expect(prompt(page)).not.toBeVisible();
  });
}

test('removing an extra winning-hand tile opens the winning-tile selector', async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.locator('app-tile-entry-dialog dialog[open] app-tile-picker button').first().click();
  await expect(page.locator('app-tile-entry-dialog dialog[open]')).toHaveCount(0);
  await beginWin(page);
  const sheet = page.locator('app-tile-input[data-label="The winning hand"] dialog[open]');
  await sheet.getByText('Type tile notation instead', { exact: true }).click();
  await sheet
    .getByRole('textbox', { name: 'The winning hand', exact: true })
    .fill('7z123m456m789p234s55p');
  await sheet.getByRole('button', { name: 'Apply notation', exact: true }).click();
  await expect(sheet.locator('.tile-entry-tray button.tile')).toHaveCount(15);
  await sheet.locator('.tile-entry-tray button.tile').first().click();
  await expect(sheet).toHaveCount(0);
  const winning = page.getByRole('dialog', { name: 'Choose winning tile', exact: true });
  await expect(winning).toBeVisible();
  await expect(winning.locator('.tile-choice-options button')).toHaveCount(14);
  await winning.locator('.tile-choice-options button').first().click();
  await expect(prompt(page).locator('app-tile-choice .tile-choice-editor img')).toHaveAttribute(
    'src',
    /Man1\.svg/,
  );
});
