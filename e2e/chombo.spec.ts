import { test, expect } from '@playwright/test';
import { gameMenu, prompt, enterLiveTiles } from './helpers/game';

test.use({ serviceWorkers: 'block' });
test('Nagashi has a direct entry and Chombo records selected payment and progression', async ({
  page,
}) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await enterLiveTiles(page, 'Dora indicators', '7z');
  await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
  await gameMenu(page, 'End this hand');
  await prompt(page).getByRole('button', { name: 'Nagashi Mangan', exact: true }).click();
  await expect(prompt(page).getByRole('combobox', { name: 'Draw type', exact: true })).toHaveValue(
    'nagashi',
  );
  await gameMenu(page, 'End this hand');
  await prompt(page).getByRole('button', { name: 'Chombo', exact: true }).click();
  await prompt(page)
    .getByRole('combobox', { name: 'Penalty payer', exact: true })
    .selectOption('p1');
  await prompt(page)
    .getByRole('combobox', { name: 'Penalty payment', exact: true })
    .selectOption('other');
  await prompt(page).getByLabel('Amount per recipient', { exact: true }).fill('1000');
  await prompt(page)
    .getByRole('combobox', { name: 'Hand progression', exact: true })
    .selectOption('continue');
  await prompt(page).getByRole('button', { name: 'Confirm penalty', exact: true }).click();
  await expect(prompt(page)).toBeHidden();
  await gameMenu(page, 'History');
  await expect(prompt(page).locator('.event-type-chip')).toHaveText('Chombo');
  await expect(prompt(page).locator('.event-changes')).toContainText('Player 2 -3,000');
  await prompt(page).getByRole('button', { name: 'Undo last ledger event', exact: true }).click();
  await expect(prompt(page).locator('.history-row')).toHaveCount(0);
});
