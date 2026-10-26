import { test, expect, type Page } from '@playwright/test';
import { gameMenu, prompt, recordDraw, finishWin } from './helpers/game';
import type { Match } from '../packages/mahjong-core/ledger';

async function stored(page: Page): Promise<Match> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('riichi-table');
      request.onsuccess = () => resolve(request.result);
    });
    const games = await new Promise<Match[]>((resolve) => {
      const request = db.transaction('matches').objectStore('matches').getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return games[0];
  });
}
async function editFirst(page: Page) {
  await gameMenu(page, 'History');
  const row = page.locator('.history-event').last();
  await row.locator(':scope > summary').click();
  await row.getByRole('button', { name: 'Edit hand', exact: true }).click();
  await expect(prompt(page).locator('.hand-edit-banner')).toBeVisible();
}

test('edit an earlier draw, replay later hands, cancel drafts, then replace it with a winning hand', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await recordDraw(page, ['Player 1']);
  await recordDraw(page, ['Player 1']);
  const original = await stored(page);
  await editFirst(page);
  await prompt(page).getByRole('button', { name: 'Record draw', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await prompt(page)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await expect(prompt(page).locator('.hand-edit-banner')).toHaveCount(0);
  const revised = await stored(page);
  expect(revised.events.map((event) => event.id)).toEqual(original.events.map((event) => event.id));
  expect(revised.events[0].revisions).toHaveLength(1);
  expect(revised.events[1].before?.dealerId).toBe(revised.players[1].id);
  expect(revised.handNumber).toBe(3);
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await editFirst(page);
  await prompt(page).getByRole('button', { name: 'Player 3', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Double Riichi', exact: true }).click();
  expect(await stored(page)).toEqual(revised);
  await prompt(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await stored(page)).toEqual(revised);
  await editFirst(page);
  await prompt(page).getByRole('button', { name: 'Player 2', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Ron · discard', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await finishWin(page);
  const winning = await stored(page);
  expect(winning.events).toHaveLength(2);
  expect(winning.events[0].type).toBe('win');
  expect(winning.events[0].revisions).toHaveLength(2);
  expect(winning.events[0].result?.isValid).toBe(true);
  await page.reload();
  expect((await stored(page)).events[0].type).toBe('win');
  await gameMenu(page, 'End entire match');
  await prompt(page).getByRole('button', { name: 'End entire match', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await editFirst(page);
  await prompt(page).getByRole('button', { name: 'Record draw', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await prompt(page)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  const finished = await stored(page);
  expect(finished.ended).toBe(true);
  expect(finished.events).toHaveLength(3);
  expect(finished.events.at(-1)?.type).toBe('matchEnd');
  expect(finished.events[0].revisions).toHaveLength(3);
  expect(finished.clock?.runningSince).toBeNull();
});

test('indicator buttons open the tile sheet directly; Done saves, Escape discards', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page
    .locator('.indicator-bar')
    .getByRole('button', { name: 'Dora indicators', exact: true })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Enter Dora indicators', exact: true });
  await expect(sheet).toBeVisible();
  await expect(prompt(page)).not.toBeVisible();
  await sheet.getByRole('button', { name: '1p: Add 1 pin', exact: true }).click();
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect.poll(async () => (await stored(page)).live?.dora).toBe('1p');
  await page
    .locator('.indicator-bar')
    .getByRole('button', { name: 'Dora indicators', exact: true })
    .click();
  await sheet.getByRole('button', { name: '2p: Add 2 pin', exact: true }).click();
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(prompt(page).getByRole('alert')).toContainText('Indicators cannot exceed');
  expect((await stored(page)).live?.dora).toBe('1p');
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await page
    .locator('.indicator-bar')
    .getByRole('button', { name: 'Ura indicators', exact: true })
    .click();
  const ura = page.getByRole('dialog', { name: 'Enter Ura indicators', exact: true });
  await ura.getByRole('button', { name: '2p: Add 2 pin', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(ura).not.toBeVisible();
  expect((await stored(page)).live?.ura).toBe('');
});
