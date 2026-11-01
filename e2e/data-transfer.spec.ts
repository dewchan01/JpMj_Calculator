import {
  gamesCsv,
  parseGamesCsv,
} from '../apps/web/src/app/features/records/data-transfer/data-csv';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { presetRules } from '../packages/mahjong-rules/index';
import type { Match } from '../packages/mahjong-core/ledger';
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
});

test('revoking a saved share closes its prompt and restores mobile Close styling', async ({
  page,
}) => {
  const api = 'http://localhost:4300';
  const id = 'b'.repeat(64);
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: api } } }),
  );
  await page.addInitScript(
    ({ api, id }) =>
      localStorage.setItem(
        `riichi-share-history:${api}`,
        JSON.stringify([
          {
            id,
            deletionSecret: 'c'.repeat(64),
            title: 'Saved transfer',
            gameCount: 1,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        ]),
      ),
    { api, id },
  );
  let revoked = false;
  await page.route(`${api}/api/shares/${id}`, (route) => {
    if (route.request().method() === 'DELETE') revoked = true;
    return route.fulfill({
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Deletion-Secret',
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/others/data/share-history');
  await page.locator('.history-entry').click();
  const share = page.getByRole('dialog', { name: 'Share selected games', exact: true });
  await expect(share.getByRole('img', { name: 'Share QR code', exact: true })).toBeVisible();
  const close = share.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toHaveCSS('border-top-color', 'rgb(222, 223, 213)');
  await close.focus();
  await expect(close).toHaveCSS('outline-style', 'none');
  await share.getByRole('button', { name: 'Revoke share', exact: true }).click();
  await expect(share).not.toBeVisible();
  await expect(page.locator('.history-entry')).toHaveCount(0);
  expect(revoked).toBe(true);
});

function game(id: string, day: string, player = 'Alice'): Match {
  return {
    id,
    name: id,
    schemaVersion: 1,
    createdAt: `${day}T12:00:00`,
    updatedAt: `${day}T12:00:00`,
    playerCount: 3,
    rules: presetRules('custom', 3),
    players: [
      { id: 'a', name: player, profileId: player },
      { id: 'b', name: 'Bob', profileId: 'Bob' },
      { id: 'c', name: 'Carol', profileId: 'Carol' },
    ],
    initialBalances: { a: 35000, b: 35000, c: 35000 },
    initialDealerId: 'a',
    dealerId: 'a',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    events: [],
    ended: true,
  };
}

test('a completed shared game can replace an unfinished local copy explicitly', async ({
  page,
}) => {
  const completed = game('unfinished-shared-copy', '2026-11-01');
  const unfinished = { ...completed, ended: false };
  const shareId = 'e'.repeat(64);
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: 'http://localhost:4300' } } }),
  );
  await page.route('**/api/shares/' + shareId, (route) =>
    route.fulfill({
      json: {
        format: 'riichi-table',
        version: 1,
        exportedAt: new Date().toISOString(),
        matches: [completed],
      },
    }),
  );
  await page.goto('/others/data/import');
  await page.getByLabel('Import CSV file', { exact: true }).setInputFiles({
    name: 'unfinished.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(gamesCsv([unfinished])),
  });
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Games imported.');
  await page.goto('/records');
  await expect(page.getByText('No games match these filters.', { exact: true })).toBeVisible();
  await page.goto('/others/data/import?share=' + shareId);
  await expect(page.getByText('Already saved on this device', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Update existing games/ })).not.toBeChecked();
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Selected games already exist');
  await page.getByRole('checkbox', { name: /Update existing games/ }).check();
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Games imported.');
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Selected games already match');
  await page.goto('/records');
  await expect(page.getByText(completed.name, { exact: true })).toBeVisible();
});

test('share import restores a game deleted in another tab without refreshing the import page', async ({
  page,
  context,
}) => {
  const matches = [game('restore-first', '2026-10-01'), game('restore-second', '2026-10-02')];
  const shareId = 'd'.repeat(64);
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: 'http://localhost:4300' } } }),
  );
  await page.route('**/api/shares/' + shareId, (route) =>
    route.fulfill({
      json: {
        format: 'riichi-table',
        version: 1,
        exportedAt: new Date().toISOString(),
        matches,
      },
    }),
  );
  await page.goto('/others/data/import');
  await page.getByLabel('Import CSV file', { exact: true }).setInputFiles({
    name: 'restore.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(gamesCsv(matches)),
  });
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Games imported.');
  await page.goto('/others/data/import?share=' + shareId);
  await expect(page.locator('.transfer-game input[type=checkbox]')).toHaveCount(2);
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('riichi-table');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('matches', 'readwrite');
          tx.objectStore('matches').delete('restore-second');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
  await other.close();
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Games imported.');
  const ids = await page.evaluate(
    () =>
      new Promise<IDBValidKey[]>((resolve, reject) => {
        const request = indexedDB.open('riichi-table');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction('matches').objectStore('matches').getAllKeys();
          read.onsuccess = () => {
            db.close();
            resolve(read.result);
          };
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
        };
      }),
  );
  expect(ids.sort()).toEqual(['restore-first', 'restore-second']);
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast')).toContainText(
    'Selected games already exist on this device, including unfinished games. Enable Update existing games to replace them.',
  );
});
test('CSV archive filters whole games, round trips and skips duplicate IDs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.locator('.app-navigation a[href$="/records"]').click();
  await expect(page.locator('app-data-transfer')).toHaveCount(0);
  await page.locator('.app-navigation a[href$="/others"]').click();
  await page.getByRole('link', { name: 'Import data', exact: true }).click();
  const dialog = page.getByRole('region', { name: 'Import data', exact: true });
  const matches = [
    game('first', '2026-10-01'),
    game('second', '2026-10-02', 'Dana'),
    game('third', '2026-10-03'),
  ];
  await dialog.getByLabel('Import CSV file', { exact: true }).setInputFiles({
    name: 'games.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(gamesCsv(matches)),
  });
  await expect(dialog.locator('.transfer-game input[type=checkbox]')).toHaveCount(3);
  const selectAll = dialog.getByRole('checkbox', { name: 'Select all', exact: true });
  const importButton = dialog.getByRole('button', { name: 'Import selected games', exact: true });
  await expect(selectAll).toBeChecked();
  await selectAll.uncheck();
  await expect(importButton).toBeDisabled();
  await selectAll.check();
  await dialog.locator('.transfer-game input').first().uncheck();
  await expect(selectAll).toBeChecked({ indeterminate: true });
  await dialog.getByLabel('From date', { exact: true }).fill('2026-10-02');
  await dialog.getByLabel('To date', { exact: true }).fill('2026-10-03');
  await dialog.getByRole('combobox', { name: 'Player', exact: true }).selectOption('Alice');
  await expect(dialog.locator('.transfer-game input[type=checkbox]')).toHaveCount(1);
  await selectAll.uncheck();
  await expect(importButton).toBeDisabled();
  await dialog.getByLabel('From date', { exact: true }).fill('');
  await dialog.getByLabel('To date', { exact: true }).fill('');
  await dialog.getByRole('combobox', { name: 'Player', exact: true }).selectOption('');
  await expect(dialog.locator('.transfer-game input').nth(0)).not.toBeChecked();
  await expect(dialog.locator('.transfer-game input').nth(1)).toBeChecked();
  await expect(dialog.locator('.transfer-game input').nth(2)).not.toBeChecked();
  await selectAll.check();
  await dialog.getByLabel('From date', { exact: true }).fill('2026-10-02');
  await dialog.getByLabel('To date', { exact: true }).fill('2026-10-03');
  await dialog.getByRole('combobox', { name: 'Player', exact: true }).selectOption('Alice');
  await dialog.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast[role="status"]')).toHaveText('Games imported.');
  await dialog.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast[role="status"]')).toHaveText(
    'Selected games already exist on this device, including unfinished games. Enable Update existing games to replace them.',
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: 'artifacts/csv-transfer-390.png' });
  await dialog.getByRole('link', { name: 'Back', exact: true }).click();
  await page.getByRole('link', { name: 'Export data', exact: true }).click();
  const exportDialog = page.getByRole('region', { name: 'Export data', exact: true });
  await expect(exportDialog.getByLabel('Import CSV file', { exact: true })).toHaveCount(0);
  const exportAll = exportDialog.getByRole('checkbox', { name: 'Select all', exact: true });
  await exportAll.uncheck();
  await expect(
    exportDialog.getByRole('button', { name: 'Export selected games', exact: true }),
  ).toBeDisabled();
  await exportAll.check();
  const downloadEvent = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Export selected games', exact: true }).click();
  const download = await downloadEvent;
  const stream = (await download.createReadStream())!;
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = parseGamesCsv(Buffer.concat(chunks).toString());
  expect(exported.version).toBe(1);
  expect(exported.matches.map((match: Match) => match.id)).toEqual(['third']);
  await exportDialog.getByRole('link', { name: 'Back', exact: true }).click();
  await page.getByRole('link', { name: 'Import data', exact: true }).click();
  await dialog.getByLabel('Import CSV file', { exact: true }).setInputFiles({
    name: 'invalid.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('{"version":5}'),
  });
  await expect(dialog.getByRole('alert')).toHaveText('Invalid CSV file.');
});

test('buttons ripple for pointer and keyboard activation and respect reduced motion', async ({
  page,
}) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Random positions', exact: true });
  await button.hover();
  await page.mouse.down();
  await expect(button.locator('.button-ripple')).toHaveCount(1);
  await page.mouse.up();
  await expect(button.locator('.button-ripple')).toHaveCount(0);
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button.locator('.button-ripple')).toHaveCount(1);
  await expect(button.locator('.button-ripple')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await button.click();
  await expect(button.locator('.button-ripple')).toHaveCount(0);
});
