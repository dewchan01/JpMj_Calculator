import { test, expect } from '@playwright/test';
import { playerAction, enterLiveTiles, prompt } from './helpers/game';

test('five Kans automatically include one red tile for open, concealed and added Kan', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await playerAction(page, 'Player 3');
  await prompt(page).getByRole('button', { name: 'Pon', exact: true }).click();
  await enterLiveTiles(page, 'Meld tiles', '5p');
  await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
  for (const [label, field, tiles] of [
    ['Added Kan', 'Fourth tile', '5p'],
    ['Open Kan', 'Meld tiles', '5m'],
    ['Concealed Kan', 'Meld tiles', '5s'],
  ]) {
    await playerAction(page, 'Player 3');
    await prompt(page).getByRole('button', { name: label, exact: true }).click();
    await enterLiveTiles(page, field, tiles);
    await prompt(page).getByRole('button', { name: 'Record action', exact: true }).click();
    await expect(
      prompt(page).getByRole('heading', { name: 'Dora indicators', level: 2, exact: true }),
    ).toBeVisible();
    await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  }
  await page.reload();
  const kans = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('riichi-table');
      request.onsuccess = () => resolve(request.result);
    });
    const matches = await new Promise<import('../packages/mahjong-core/ledger').Match[]>(
      (resolve) => {
        const request = db.transaction('matches').objectStore('matches').getAll();
        request.onsuccess = () => resolve(request.result);
      },
    );
    db.close();
    return Object.values(matches[0].live!.players)
      .flatMap((player) => player.melds)
      .map((meld) => ({
        type: meld.type,
        red: meld.tiles.filter((tile) => tile.isRed).length,
        size: meld.tiles.length,
        originalRed: meld.originalPon?.tiles.filter((tile) => tile.isRed).length,
      }));
  });
  expect(kans).toEqual([
    { type: 'kakan', red: 1, size: 4, originalRed: 0 },
    { type: 'daiminkan', red: 1, size: 4, originalRed: undefined },
    { type: 'ankan', red: 1, size: 4, originalRed: undefined },
  ]);
});
