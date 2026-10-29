import { expect, test } from '@playwright/test';
import { enterLiveTiles, playerAction, prompt, gameMenu } from './helpers/game';
import { leaveGame, openQuickScore } from './helpers/navigation';

test('manual Yakuman uses an explicit responsibility share and renders its limit', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await playerAction(page, 'Player 2');
  await prompt(page).getByRole('button', { name: 'Ron · discard', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await prompt(page)
    .getByRole('combobox', { name: 'Scoring type', exact: true })
    .selectOption({ label: '2 × Yakuman' });
  await prompt(page)
    .getByRole('combobox', { name: 'Responsibility player', exact: true })
    .selectOption({ label: 'Player 3' });
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(prompt(page).locator('.payment-list')).toContainText('32,000');
  await expect(prompt(page).locator('.payment-list')).toContainText('16,000');
  await expect(prompt(page).locator('summary')).toContainText('Yakuman');
  await expect(prompt(page).locator('summary')).not.toContainText('0 Han');
});

test('advanced preference persists; Riichi, calls, manual Ron and historical edits work without a concealed hand', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto('/');
  await page.locator('.app-navigation a[href$="/others"]').click();
  await expect(page.getByRole('radio', { name: 'Manual Han entry', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Scoring mode', exact: true }).click();
  const toggle = page.getByRole('radio', { name: 'Manual Han entry', exact: true });
  await expect(page.locator('.other-detail .scoring-mode-options')).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.reload();
  await expect(toggle).toBeChecked();
  await page
    .locator('.scoring-mode-options')
    .screenshot({ path: 'artifacts/advanced-mode-switch.png' });
  await page.locator('.app-navigation a').first().click();
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 2' })
    .getByRole('button', { name: 'Riichi', exact: true })
    .click();
  await playerAction(page, 'Player 3');
  await prompt(page).getByRole('button', { name: 'Pon', exact: true }).click();
  await enterLiveTiles(page, 'Meld tiles', '1z');
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  await playerAction(page, 'Player 4');
  await prompt(page).getByRole('button', { name: 'Concealed Kan', exact: true }).click();
  await enterLiveTiles(page, 'Meld tiles', '1m');
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  await expect(prompt(page)).not.toBeVisible();
  await playerAction(page, 'Player 2');
  await prompt(page).getByRole('button', { name: 'Ron · discard', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(prompt(page).locator('app-tile-input')).toHaveCount(0);
  await prompt(page).screenshot({ path: 'artifacts/advanced-manual-entry.png' });
  await prompt(page).getByRole('spinbutton', { name: 'Han', exact: true }).fill('3');
  await prompt(page)
    .getByRole('combobox', { name: 'Fu', exact: true })
    .selectOption({ label: '40' });
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(prompt(page).locator('.payment-list')).toContainText('5,200');
  await expect(prompt(page).locator('.payment-list')).toContainText('1,000');
  await prompt(page)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await expect(page.locator('.table-pot strong')).toHaveText('0');
  await gameMenu(page, 'History');
  await prompt(page).getByRole('button', { name: 'Edit hand', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Win', exact: true }).click();
  await prompt(page).getByRole('checkbox', { name: 'Player 2', exact: true }).check();
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(prompt(page).getByRole('spinbutton', { name: 'Han', exact: true })).toHaveValue('3');
  await prompt(page).getByRole('spinbutton', { name: 'Han', exact: true }).fill('4');
  await prompt(page)
    .getByRole('combobox', { name: 'Fu', exact: true })
    .selectOption({ label: '30' });
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await prompt(page)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await expect(prompt(page)).toContainText('4 Han');
  await leaveGame(page);
  await page.locator('.app-navigation a[href$="/others"]').click();
  await page.getByRole('link', { name: 'Scoring mode', exact: true }).click();
  await page.getByRole('radio', { name: 'Assisted scoring', exact: true }).check();
  await page.reload();
  await expect(
    page.getByRole('radio', { name: 'Manual Han entry', exact: true }),
  ).not.toBeChecked();
});

test('advanced Tsumo validates Han/Fu and settles Sanma without tiles', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: /3 players/ }).click();
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await playerAction(page, 'Player 2');
  await prompt(page).getByRole('button', { name: 'Tsumo · self draw', exact: true }).click();
  await prompt(page).getByRole('spinbutton', { name: 'Han', exact: true }).fill('1');
  await prompt(page)
    .getByRole('combobox', { name: 'Fu', exact: true })
    .selectOption({ label: '20' });
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(prompt(page).getByRole('alert')).toContainText('This Han/Fu combination');
  await prompt(page).getByRole('spinbutton', { name: 'Han', exact: true }).fill('3');
  await prompt(page)
    .getByRole('combobox', { name: 'Fu', exact: true })
    .selectOption({ label: '40' });
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(prompt(page).locator('.payment-list')).toContainText('2,600');
  await expect(prompt(page).locator('.payment-list')).toContainText('1,300');
  await prompt(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(prompt(page).getByRole('spinbutton', { name: 'Han', exact: true })).toHaveValue('3');
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(prompt(page).locator('.payment-list')).toContainText('2,600');
  await prompt(page)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await expect(prompt(page)).not.toBeVisible();
});

test('advanced multiple Ron collects independent Han/Fu for each winner', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.getByRole('button', { name: 'End this hand', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Win', exact: true }).click();
  for (const name of ['Player 2', 'Player 3'])
    await prompt(page).getByRole('checkbox', { name, exact: true }).check();
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(prompt(page)).toContainText('Player 3');
  await prompt(page).getByRole('spinbutton', { name: 'Han', exact: true }).fill('2');
  await prompt(page)
    .getByRole('combobox', { name: 'Fu', exact: true })
    .selectOption({ label: '30' });
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(prompt(page).locator('.payment-list')).toContainText('5,200');
  await expect(prompt(page).locator('.payment-list')).toContainText('2,000');
  await prompt(page)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await expect(prompt(page)).not.toBeVisible();
});

test('quick score supports manual Han/Fu and normal tile entry returns when disabled', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
  await page.goto('/');
  await openQuickScore(page);
  await expect(page.getByRole('button', { name: 'Enter tiles', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.result-column')).toContainText('5,200');
  await page.locator('.app-navigation a[href$="/others"]').click();
  await page.getByRole('link', { name: 'Scoring mode', exact: true }).click();
  await page.getByRole('radio', { name: 'Assisted scoring', exact: true }).check();
  await openQuickScore(page);
  await expect(page.getByRole('button', { name: 'Enter tiles', exact: true })).toBeVisible();
});
