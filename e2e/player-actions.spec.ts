import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { playerAction, prompt, enterLiveTiles } from './helpers/game';

test('quick Riichi deposits directly, double declaration is explicit, and calls have trash actions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  const seat = page.locator('.player-seat').filter({ hasText: 'Player 2' });
  await seat.getByRole('button', { name: 'Riichi', exact: true }).click();
  await expect(prompt(page)).not.toBeVisible();
  await expect(page.locator('.table-pot strong')).toHaveText('1,000');
  await expect(seat.locator('.player-points')).toHaveText('24,000');
  await playerAction(page, 'Player 3');
  await expect(prompt(page).getByRole('button', { name: /Declare Riichi/ })).toHaveCount(0);
  const kanBox = (await prompt(page)
    .getByRole('button', { name: 'Open Kan', exact: true })
    .boundingBox())!;
  const doubleBox = (await prompt(page)
    .getByRole('button', { name: 'Double Riichi', exact: true })
    .boundingBox())!;
  expect(doubleBox.x).toBeCloseTo(kanBox.x, 0);
  expect(doubleBox.y).toBeGreaterThan(kanBox.y);
  await expect(
    prompt(page).getByRole('checkbox', { name: 'Double Riichi', exact: true }),
  ).toHaveCount(0);
  await prompt(page).getByRole('button', { name: 'Double Riichi', exact: true }).click();
  await expect(prompt(page)).not.toBeVisible();
  await expect(page.locator('.table-pot strong')).toHaveText('2,000');
  await expect(page.getByRole('img', { name: 'Double Riichi', exact: true })).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('img', { name: 'Double Riichi', exact: true })).toHaveCount(1);
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 3' })
    .getByRole('button', { name: 'Riichi', exact: true })
    .click();
  await expect(prompt(page)).not.toBeVisible();
  await expect(page.locator('.table-pot strong')).toHaveText('1,000');
  await expect(page.getByRole('img', { name: 'Double Riichi', exact: true })).toHaveCount(0);
  await playerAction(page, 'Player 1');
  await prompt(page).getByRole('button', { name: 'Pon', exact: true }).click();
  await enterLiveTiles(page, 'Meld tiles', '1z');
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  await expect(prompt(page)).not.toBeVisible();
  await playerAction(page, 'Player 4');
  await expect(
    prompt(page).getByRole('button', { name: 'Double Riichi', exact: true }),
  ).toBeEnabled();
  await prompt(page).getByRole('button', { name: 'Double Riichi', exact: true }).click();
  await expect(prompt(page)).not.toBeVisible();
  await expect(page.locator('.table-pot strong')).toHaveText('2,000');
  await playerAction(page, 'Player 4');
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await playerAction(page, 'Player 1');
  const remove = prompt(page).locator('.recorded-call .action-delete');
  await expect(
    prompt(page).getByRole('button', { name: 'Double Riichi', exact: true }),
  ).toBeDisabled();
  await expect(remove.locator('svg')).toHaveCount(1);
  await expect(remove).toHaveAttribute('aria-label', 'Remove pon');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: 'artifacts/player-actions-390.png' });
  await remove.click();
  await expect(prompt(page).locator('.recorded-call')).toHaveCount(0);
});

test('player Ron and Tsumo actions preselect the winner and keep hand validation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await playerAction(page, 'Player 2');
  await prompt(page).getByRole('button', { name: 'Ron · discard', exact: true }).click();
  await expect(prompt(page).getByRole('combobox', { name: 'Win method', exact: true })).toHaveValue(
    'ron',
  );
  await expect(prompt(page).getByRole('checkbox', { name: 'Player 2', exact: true })).toHaveCount(
    0,
  );
  await expect(prompt(page).getByText('Who won this hand?', { exact: true })).toHaveCount(0);
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    prompt(page).getByRole('heading', { name: 'The winning hand', exact: true, level: 2 }),
  ).toBeVisible();
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await playerAction(page, 'Player 3');
  await prompt(page).getByRole('button', { name: 'Tsumo · self draw', exact: true }).click();
  await expect(
    prompt(page).getByRole('heading', { name: 'The winning hand', exact: true, level: 2 }),
  ).toBeVisible();
  await expect(prompt(page)).toContainText('Player 3');
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(prompt(page).getByRole('alert')).toContainText('Enter the concealed hand');
});
