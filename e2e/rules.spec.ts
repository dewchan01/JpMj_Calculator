import { beginWin, finishWin, gameMenu, prompt, recordDraw, enterLiveTiles } from './helpers/game';
import { openQuickScore, leaveGame } from './helpers/navigation';
import { setSavedRound } from './helpers/match-state';
import { applyPreset, expectApplied } from './helpers/settings';
import { expect, test, type Page } from '@playwright/test';

async function enter(page: Page, notation: string): Promise<void> {
  await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
  await page.getByText('Type compact tile notation', { exact: true }).click();
  await page
    .getByRole('textbox', { name: 'All tiles, including melds and North', exact: true })
    .fill(notation);
  await page.getByRole('button', { name: 'Replace tile collection', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}

test('M.League is four-player only and persists its match profile', async ({ page }) => {
  await page.goto('/');
  await applyPreset(page, 'm-league');
  await expectApplied(page, 'm-league');
  await expect(page.getByRole('combobox', { name: 'Game length', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.waitForURL('**/score/*');
  await expectApplied(page, 'm-league');
  await page.reload();
  await expectApplied(page, 'm-league');
  await leaveGame(page);
  await page.getByRole('button', { name: /3 players/ }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: '3 players', exact: true }).click();
  await expect(page.locator('option[value="m-league"]')).toHaveJSProperty('disabled', true);
});
test('presets explain differences, change Yakuman score, and expose custom settings', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await openQuickScore(page);
  await enter(page, '222m333p444s11155z');
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.getByText('Single-wait concealed triplets (Suuankou tanki)')).toBeVisible();
  await expect(page.locator('.score-total>span')).toHaveText('64,000');
  await applyPreset(page, 'tenhou');
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.score-total>span')).toHaveText('32,000');
  await page.getByRole('navigation').getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Double Yakuman for special forms', exact: true }),
  ).not.toBeChecked();
  await page.getByRole('combobox', { name: 'Rule preset', exact: true }).selectOption('custom');
  await page
    .getByRole('checkbox', { name: 'Double Yakuman for special forms', exact: true })
    .uncheck();
  await page.getByRole('checkbox', { name: 'Red fives enabled', exact: true }).uncheck();
  await page
    .getByRole('textbox', { name: 'Custom rule name', exact: true })
    .fill('Custom low Yakuman');
  await page.getByRole('button', { name: 'Use these rules', exact: true }).click();
  await openQuickScore(page);
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.score-total>span')).toHaveText('32,000');
  await expect(page.getByRole('button', { name: /Add Red 5 man/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('chosen rules persist, draws advance the round, and undo restores it', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await applyPreset(page, 'tenhou');
  await page.getByRole('combobox', { name: 'Game length', exact: true }).selectOption('east');
  await page.getByRole('button', { name: /Start match/ }).click();
  await recordDraw(page, ['Player 2']);
  await expect(page.locator('.table-round')).toHaveText('east 2');
  await page.reload();
  await expectApplied(page, 'tenhou');
  await gameMenu(page, 'History');
  await prompt(page).getByRole('button', { name: 'Undo last ledger event', exact: true }).click();
  await expect(page.locator('.table-round')).toHaveText('east 1');
});
test('double Ron queue settles both hands and stores the explanations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'End this hand', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Win', exact: true }).click();
  await prompt(page).getByRole('checkbox', { name: 'Player 1', exact: true }).check();
  await prompt(page).getByRole('checkbox', { name: 'Player 2', exact: true }).check();
  await prompt(page).locator('input[type="radio"][name="discarder"][value="p3"]').check();
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  for (const notation of ['123456789m123p44z', '123456789p123s44z']) {
    await enterLiveTiles(page, 'The winning hand', notation);
    await prompt(page)
      .getByRole('combobox', { name: 'Winning tile', exact: true })
      .selectOption({ index: 14 });
    await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
    await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  }
  await expect(prompt(page).locator('details')).toHaveCount(2);
  await prompt(page)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await gameMenu(page, 'History');
  await expect(page.locator('.history-event')).toHaveCount(1);
});
test('exposed Daisangen uses original call order and selected Pao policy', async ({ page }) => {
  await page.goto('/');
  await openQuickScore(page);
  await enter(page, '11122z555666777z');
  for (const source of ['p0', 'p0', 'p3']) {
    const tiles = page.locator('.hand-tray > .hand-tiles > button.tile');
    for (let index = 5; index < 8; index++) await tiles.nth(index).click();
    await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
    await page.getByRole('combobox', { name: 'Called from', exact: true }).selectOption(source);
    await page.getByRole('button', { name: 'Assign selected tiles', exact: true }).click();
  }
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.score-total>span')).toHaveText('64,000');
  await expect(page.getByText('Responsibility: half of Ron', { exact: true })).toBeVisible();
  await expect(page.locator('.payment-row')).toHaveCount(3);
  await applyPreset(page, 'tenhou');
  await page.getByRole('button', { name: /Calculate score/ }).click();
  await expect(page.locator('.payment-row')).toHaveCount(2);
  await expect(page.locator('.payment-row>strong')).toHaveText(['32,000', '32,000']);
});

test('last-hand finish ends the match and undo reopens it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await setSavedRound(page, { dealerId: 'p3', roundWind: 'south', handNumber: 4, honba: 0 });
  await page.reload();
  await beginWin(page);
  await finishWin(page, '123456789m123m11m', 13);
  await expect(page.locator('app-final-results')).toBeVisible();
  await gameMenu(page, 'History');
  await prompt(page).getByRole('button', { name: 'Undo last ledger event', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'End this hand', exact: true })).toBeVisible();
});
