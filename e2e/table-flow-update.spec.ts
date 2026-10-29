import { test, expect } from '@playwright/test';
import { enterLiveTiles, playerAction, prompt } from './helpers/game';

test.beforeEach(async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'false'));
});

test('selected player is below, rotation is local, and a Kan needs its new indicator before saving', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'My player', exact: true }).selectOption('1');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page.locator('.seat-bottom h3')).toHaveText('Player 2');
  await page.getByRole('button', { name: 'Game menu', exact: true }).click();
  await expect(prompt(page).getByRole('button', { name: 'Change seats', exact: true })).toHaveCount(
    0,
  );
  const menuLabels = await prompt(page).locator('.menu-list > button').allTextContents();
  const adjustIndex = menuLabels.findIndex((label) => label.includes('Adjust view'));
  expect(menuLabels[adjustIndex + 1]).toContain('In-game settings');
  await prompt(page).getByRole('button', { name: 'Adjust view', exact: true }).click();
  await page.getByRole('button', { name: 'Rotate clockwise', exact: true }).click();
  await expect(page.locator('.seat-bottom h3')).toHaveText('Player 3');
  await expect(page.locator('.player-seat.dealer h3')).toHaveText('Player 1');
  await expect(
    prompt(page).getByRole('heading', { name: 'Adjust view', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Rotate counterclockwise', exact: true }).click();
  await expect(
    prompt(page).getByRole('heading', { name: 'Adjust view', exact: true }),
  ).toBeVisible();
  await prompt(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(prompt(page).getByRole('heading', { name: 'Game menu', exact: true })).toBeVisible();
  await prompt(page).locator('.close-prompt').click();
  await playerAction(page, 'Player 2');
  const doubleRiichi = prompt(page).getByRole('button', { name: 'Double Riichi', exact: true });
  await expect(doubleRiichi).toHaveCount(1);
  const doubleBounds = (await doubleRiichi.boundingBox())!;
  const ankanBounds = (await prompt(page)
    .getByRole('button', { name: 'Concealed Kan', exact: true })
    .boundingBox())!;
  expect(doubleBounds.y).toBeGreaterThanOrEqual(ankanBounds.y + ankanBounds.height);
  expect(Math.abs(doubleBounds.x - ankanBounds.x)).toBeLessThan(1);
  await expect(
    prompt(page).locator('p.hint').filter({ hasText: 'Confirm Double Riichi' }),
  ).toHaveCount(0);
  await prompt(page).locator('.close-prompt').click();
  const seat = page.locator('.player-seat').filter({ hasText: 'Player 2' });
  await seat.getByRole('button', { name: 'Call', exact: true }).click();
  await expect(
    prompt(page).getByRole('button', { name: 'Double Riichi', exact: true }),
  ).toHaveCount(0);
  await prompt(page).locator('.close-prompt').click();
  await seat.getByRole('button', { name: 'Concealed Kan', exact: true }).click();
  await expect(
    prompt(page).getByRole('button', { name: 'Save indicators', exact: true }),
  ).toBeDisabled();
  await enterLiveTiles(page, 'Dora indicators', '7z');
  await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
  await enterLiveTiles(page, 'Meld tiles', '5p');
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  await expect(
    prompt(page).getByRole('button', { name: 'Save indicators', exact: true }),
  ).toBeDisabled();
  await expect(seat.getByRole('button', { name: 'Concealed Kan', exact: true })).not.toContainText(
    '1',
  );
  await enterLiveTiles(page, 'Dora indicators', '7z6z');
  await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
  await expect(seat.getByRole('button', { name: 'Concealed Kan', exact: true })).toContainText('1');
  await playerAction(page, 'Player 2');
  await prompt(page).getByRole('button', { name: 'Tsumo · self draw', exact: true }).click();
  await expect(prompt(page).locator('.winning-recorded')).toContainText('Ankan');
  await enterLiveTiles(page, 'The winning hand', '123m789s234p55s');
  await expect(prompt(page).getByRole('button', { name: 'Winning tile', exact: true })).toHaveText(
    'Select',
  );
  await prompt(page).getByRole('button', { name: 'Winning tile', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Choose winning tile', exact: true }),
  ).toBeVisible();
  await page.locator('.winning-picker-tiles button').first().click();
  await expect(page.getByRole('dialog', { name: 'Choose winning tile', exact: true })).toBeHidden();
  await expect(prompt(page).locator('.winning-tile-editor .tile app-tile-art')).toBeVisible();
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(prompt(page).locator('app-tile-input[data-label="Ura indicators"]')).toHaveCount(0);
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(
    prompt(page).getByRole('button', { name: 'Confirm & save settlement', exact: true }),
  ).toBeVisible();
});
