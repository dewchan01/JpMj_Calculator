import { test, expect } from '@playwright/test';
import { gameMenu, playerAction, prompt } from './helpers/game';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
});

test('manual Yakuman stacks distinct hand types and saves their names', async ({ page }) => {
  await playerAction(page, 'Player 2');
  await prompt(page).getByRole('button', { name: 'Tsumo · self draw', exact: true }).click();
  await prompt(page)
    .getByRole('combobox', { name: 'Scoring type', exact: true })
    .selectOption({ label: 'Yakuman' });
  await prompt(page)
    .getByRole('checkbox', { name: 'Big three dragons (Daisangen)', exact: true })
    .check();
  await prompt(page).getByRole('checkbox', { name: 'All honors (Tsuuiisou)', exact: true }).check();
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(prompt(page)).not.toContainText('0 Fu');
  await prompt(page)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await expect(page.locator('app-final-results')).toBeVisible();
  await page
    .locator('app-final-results')
    .getByRole('button', { name: 'History', exact: true })
    .click();
  await expect(page.locator('.outcome-mark')).toContainText('Big three dragons');
  await expect(page.locator('.outcome-mark')).toContainText('All honors');
});

test('Riichi players start checked for an exhaustive draw and five Han hides Fu', async ({
  page,
}) => {
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 1' })
    .getByRole('button', { name: 'Riichi', exact: true })
    .click();
  await page.getByRole('button', { name: 'End this hand', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Record draw', exact: true }).click();
  await expect(prompt(page).getByRole('checkbox', { name: 'Player 1', exact: true })).toBeChecked();
  await expect(
    prompt(page).getByRole('checkbox', { name: 'Player 2', exact: true }),
  ).not.toBeChecked();
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await playerAction(page, 'Player 2');
  await prompt(page).getByRole('button', { name: 'Tsumo · self draw', exact: true }).click();
  await prompt(page)
    .getByRole('combobox', { name: 'Han', exact: true })
    .selectOption({ label: '5' });
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(prompt(page)).not.toContainText('40 Fu');
});

test('new games reuse player identities instead of creating same-name records', async ({
  page,
}) => {
  await gameMenu(page, 'End entire match');
  await prompt(page).getByRole('button', { name: 'End entire match', exact: true }).click();
  await expect(page.locator('app-final-results')).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await gameMenu(page, 'End entire match');
  await prompt(page).getByRole('button', { name: 'End entire match', exact: true }).click();
  await expect(page.locator('app-final-results')).toBeVisible();
  const count = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('riichi-table');
      request.onsuccess = () => resolve(request.result);
    });
    return await new Promise<number>((resolve) => {
      const request = db.transaction('matches').objectStore('matches').getAll();
      request.onsuccess = () => {
        resolve(
          new Set(
            request.result.flatMap((match) =>
              match.players.map((player: { profileId: string }) => player.profileId),
            ),
          ).size,
        );
        db.close();
      };
    });
  });
  expect(count).toBe(4);
});
