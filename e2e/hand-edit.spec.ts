import { test, expect, type Page } from '@playwright/test';
import { gameMenu, prompt, recordDraw, finishWin } from './helpers/game';
import type { Match } from '../packages/mahjong-core/ledger';
import { settleRound } from '../packages/mahjong-core/ledger';
import { presetRules } from '../packages/mahjong-rules/index';
import { drawSettlement, type DrawInput } from '../packages/mahjong-scoring/rounds';
import { gamesCsv } from '../apps/web/src/app/features/records/data-transfer/data-csv';

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
  const row = page.locator('.history-row').first();
  await expect(row.locator('.history-event')).toHaveJSProperty('open', false);
  await expect(
    row.getByRole('button', { name: 'Edit hand', exact: true }).locator('svg'),
  ).toHaveCount(1);
  await row.getByRole('button', { name: 'Edit hand', exact: true }).click();
  await expect(prompt(page).locator('.hand-edit-banner')).toBeVisible();
}

test('back from editing restores the original history without reopening the page', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
  const rules = presetRules('mahjong-soul', 4);
  let seeded: Match = {
    id: 'back-edit',
    schemaVersion: 1,
    name: 'Back test',
    createdAt: '2026-11-02T00:00:00Z',
    updatedAt: '2026-11-02T00:00:00Z',
    playerCount: 4,
    rules,
    players: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, name: `Player ${i + 1}` })),
    initialBalances: { p0: 25000, p1: 25000, p2: 25000, p3: 25000 },
    initialDealerId: 'p0',
    dealerId: 'p0',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    gameLength: 'east',
    events: [],
  };
  for (let i = 0; i < 2; i++) {
    const drawInput: DrawInput = {
      rules,
      players: seeded.players,
      dealerId: seeded.dealerId,
      honba: seeded.honba,
      type: 'exhaustive',
      tenpaiIds: [`p${i}`],
      nagashiIds: [],
      circumstancesConfirmed: true,
    };
    seeded = settleRound(
      seeded,
      {
        id: `draw-${i}`,
        type: 'exhaustiveDraw',
        timestamp: `2026-11-02T01:0${i}:00Z`,
        payments: [],
        drawInput,
      },
      drawSettlement(drawInput),
    );
  }
  await page.goto('/others/data/import');
  await page.getByLabel('Import CSV file', { exact: true }).setInputFiles({
    name: 'back.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(gamesCsv([seeded])),
  });
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Games imported.');
  await page.goto('/score/' + seeded.id);
  await expect.poll(async () => !!(await stored(page)).clock).toBe(true);
  const original = await stored(page);
  await gameMenu(page, 'History');
  const titles = await prompt(page).locator('.event-title').allTextContents();
  const changes = await prompt(page).locator('.event-changes').allTextContents();
  await prompt(page).getByRole('button', { name: 'Edit hand', exact: true }).first().click();
  await expect(prompt(page).locator('.hand-edit-banner')).toBeVisible();
  await prompt(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(prompt(page).locator('.hand-edit-banner')).toHaveCount(0);
  await expect(prompt(page).locator('.history-row')).toHaveCount(2);
  expect(await prompt(page).locator('.event-title').allTextContents()).toEqual(titles);
  expect(await prompt(page).locator('.event-changes').allTextContents()).toEqual(changes);
  expect(await stored(page)).toEqual(original);
  await prompt(page).getByRole('button', { name: 'Edit hand', exact: true }).first().click();
  await prompt(page).getByRole('button', { name: 'Record draw', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(prompt(page).locator('.hand-edit-banner')).toBeVisible();
  await prompt(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(prompt(page).locator('.history-row')).toHaveCount(2);
  expect(await stored(page)).toEqual(original);
});

test('edit an earlier draw, replay later hands, cancel drafts, then replace it with a winning hand', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
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
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
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
    .getByRole('button', { name: 'Dora indicators', exact: true })
    .click();
  const ura = page.getByRole('dialog', { name: 'Enter Dora indicators', exact: true });
  await ura.getByRole('button', { name: '2p: Add 2 pin', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(ura).not.toBeVisible();
  expect((await stored(page)).live?.ura).toBe('');
});
