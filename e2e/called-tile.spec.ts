import { test, expect } from '@playwright/test';
import { enterLiveTiles, playerAction, prompt } from './helpers/game';
import type { Match } from '../packages/mahjong-core/ledger';

for (const width of [390, 1280]) {
  test(`called tile is selected from entered tiles and preserves the red five at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: /Start match/ }).click();
    await page.getByRole('button', { name: 'Start game', exact: true }).click();
    await playerAction(page, 'Player 2');
    await expect(prompt(page).getByRole('button', { name: 'Chi', exact: true })).toHaveCount(0);
    await expect(prompt(page).getByRole('button', { name: 'Pon', exact: true })).toHaveCount(0);
    await prompt(page).locator('.close-prompt').click();
    await page
      .locator('.player-seat')
      .filter({ hasText: 'Player 2' })
      .getByRole('button', { name: 'Call', exact: true })
      .click();
    await prompt(page).getByRole('button', { name: 'Chi', exact: true }).click();
    await enterLiveTiles(page, 'Meld tiles', '406p');
    const field = prompt(page).locator('app-tile-choice');
    const first = await field.locator('.tile-choice-editor img').getAttribute('src');
    await field.getByRole('button', { name: 'Called tile', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Choose called tile', exact: true });
    await expect(picker.locator('.tile-choice-options button')).toHaveCount(3);
    await expect(picker.locator('input, app-tile-picker')).toHaveCount(0);
    await picker.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(picker).toBeHidden();
    await expect(field.locator('.tile-choice-editor img')).toHaveAttribute('src', first!);
    await field.getByRole('button', { name: 'Called tile', exact: true }).click();
    const red = await picker
      .locator('.tile-choice-options button')
      .nth(1)
      .locator('img')
      .getAttribute('src');
    await picker.locator('.tile-choice-options button').nth(1).click();
    await expect(picker).toBeHidden();
    await expect(field.locator('.tile-choice-editor img')).toHaveAttribute('src', red!);
    await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
    await expect(prompt(page)).toBeHidden();
    const id = page.url().split('/').at(-1)!;
    const calledIsRed = await page.evaluate(
      (id) =>
        new Promise<boolean>((resolve, reject) => {
          const open = indexedDB.open('riichi-table');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const request = db.transaction('matches').objectStore('matches').get(id);
            request.onerror = () => {
              db.close();
              reject(request.error);
            };
            request.onsuccess = () => {
              const match = request.result as Match;
              const meld = match.live!.players['p1'].melds[0];
              const called = meld.tiles.find((tile) => tile.id === meld.calledTileId);
              db.close();
              resolve(called?.isRed === true);
            };
          };
        }),
      id,
    );
    expect(calledIsRed).toBe(true);
  });
}
