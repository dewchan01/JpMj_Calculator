import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gamesCsv } from '../apps/web/src/app/features/records/data-transfer/data-csv';
import { identityLabel } from '../apps/web/src/app/features/records/player-identity';
import { presetRules } from '../packages/mahjong-rules/index';
import type { Match } from '../packages/mahjong-core/ledger';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
function game(id: string, profileId: string, name: string): Match {
  return {
    id,
    name: id,
    schemaVersion: 1,
    createdAt: '2026-10-01T12:00:00',
    updatedAt: id === 'third' ? '2026-10-03T12:00:00' : '2026-10-01T12:00:00',
    playerCount: 3,
    rules: presetRules('custom', 3),
    ended: true,
    gameLength: 'east',
    players: [
      { id: 'p0', name, profileId },
      { id: 'p1', name: 'Bob', profileId: 'bob' },
      { id: 'p2', name: 'Carol', profileId: 'carol' },
    ],
    initialBalances: { p0: 35000, p1: 35000, p2: 35000 },
    initialDealerId: 'p0',
    dealerId: 'p0',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    events: [],
  };
}
test('import keeps same-name IDs separate and explicitly merges a renamed player without merging seats', async ({
  page,
}) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/others/data/import');
  const upload = async (match: Match) => {
    await page.getByLabel('Import CSV file', { exact: true }).setInputFiles({
      name: 'game.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(gamesCsv([match])),
    });
    await expect(page.locator('.player-mapping')).toBeVisible();
  };
  const commit = () =>
    page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await upload(game('first', 'existing-alice', 'Alice'));
  await commit();
  await expect(page.locator('.player-mapping')).toHaveCount(0);
  await upload(game('second', 'incoming-a', 'Alice'));
  await expect(
    page
      .getByRole('combobox', {
        name: 'Alice (1)',
        exact: true,
      })
      .locator('option:checked'),
  ).toHaveText('Do not merge · create player');
  await expect(
    page
      .getByRole('combobox', { name: identityLabel({ id: 'bob', name: 'Bob' }), exact: true })
      .locator('option:checked'),
  ).toHaveText('Use existing player');
  await commit();
  await expect(page.locator('.player-mapping')).toHaveCount(0);
  await page.goto('/records');
  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(page.locator('.player-record-row')).toHaveCount(4);
  await expect(page.locator('a[href*="/records/player/existing-alice"]')).toHaveCount(1);
  await expect(page.locator('a[href*="/records/player/incoming-a"]')).toHaveCount(1);
  await page.goto('/others/data/import');
  await upload(game('third', 'incoming-b', 'Alicia'));
  const mapping = page.getByRole('combobox', {
    name: identityLabel({ id: 'incoming-b', name: 'Alicia' }),
    exact: true,
  });
  await mapping.selectOption({ label: identityLabel({ id: 'bob', name: 'Bob' }) });
  await commit();
  await expect(page.getByRole('alert')).toHaveText(
    'Two players in one game cannot share an identity.',
  );
  await mapping.selectOption({ label: identityLabel({ id: 'existing-alice', name: 'Alice' }) });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: 'artifacts/import-player-mapping-390.png' });
  await commit();
  await expect(page.locator('.player-mapping')).toHaveCount(0);
  await page.goto('/records/player/existing-alice');
  await expect(page.locator('.profile-sample')).toContainText('2 completed games');
  await page.goto('/records/player/incoming-a');
  await expect(page.locator('.profile-sample')).toContainText('1 completed games');
});

test('auto merge by name saves players and rename preserves their identity and records', async ({
  page,
}) => {
  await page.goto('/others/data/import');
  await page.evaluate(() =>
    localStorage.setItem('riichi-players-v1', JSON.stringify([{ id: 'existing', name: 'Alice' }])),
  );
  await page.reload();
  await page.getByLabel('Import CSV file', { exact: true }).setInputFiles({
    name: 'game.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(gamesCsv([game('merged', 'new-alice', 'Alice')])),
  });
  await page.getByRole('button', { name: 'Auto merge by name', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Alice (1)', exact: true }).locator('option:checked'),
  ).toHaveText('Alice');
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.player-mapping')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('riichi-players-v1')!))).toEqual(
    expect.arrayContaining([
      { id: 'existing', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
      { id: 'carol', name: 'Carol' },
    ]),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Saved players', exact: true }).click();
  await page.getByRole('button', { name: 'Rename player Alice', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename player', exact: true });
  await dialog.getByRole('textbox', { name: 'Player name', exact: true }).fill('Alicia');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('riichi-players-v1')!).find(
          (player: { id: string }) => player.id === 'existing',
        ).name,
    ),
  ).toBe('Alicia');
  await page.goto('/records/player/existing');
  await expect(page.getByRole('heading', { name: 'Alicia', exact: true })).toBeVisible();
  await expect(page.locator('.profile-sample')).toContainText('1 completed games');
});

for (const mode of ['records', 'all']) {
  test(`clearing ${mode} needs confirmation and deletes only the selected local data`, async ({
    page,
  }) => {
    await page.goto('/others/data/import');
    await page.getByLabel('Import CSV file', { exact: true }).setInputFiles({
      name: 'game.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(gamesCsv([game('clear-me', 'alice', 'Alice')])),
    });
    await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
    await expect(page.locator('.player-mapping')).toHaveCount(0);
    await page.evaluate(() => {
      localStorage.setItem('riichi-sound', 'off');
      localStorage.setItem('unrelated-app', 'keep');
      sessionStorage.setItem('riichi-room:test:pin', '1234');
    });
    await page.goto('/others');
    await page.getByRole('link', { name: 'Manage local data', exact: true }).click();
    const label = mode === 'all' ? 'Clear all data' : 'Clear all records';
    await page.getByRole('button', { name: label, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: label, exact: true });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('riichi-players-v1'))).not.toBeNull();
    await page.getByRole('button', { name: label, exact: true }).click();
    await Promise.all([
      page.waitForEvent('load'),
      dialog.getByRole('button', { name: 'Confirm delete', exact: true }).click(),
    ]);
    const stored = await page.evaluate(() => ({
      players: localStorage.getItem('riichi-players-v1'),
      sound: localStorage.getItem('riichi-sound'),
      other: localStorage.getItem('unrelated-app'),
      pin: sessionStorage.getItem('riichi-room:test:pin'),
    }));
    expect(stored.other).toBe('keep');
    if (mode === 'all') {
      expect(stored.players).toBeNull();
      expect(stored.sound).toBeNull();
      expect(stored.pin).toBeNull();
    } else {
      expect(stored.players).not.toBeNull();
      expect(stored.sound).toBe('off');
      expect(stored.pin).toBe('1234');
    }
    await page.goto('/records');
    await expect(page.locator('.game-card-link')).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const request = indexedDB.open('riichi-table');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const count = db.transaction('matches').objectStore('matches').count();
              count.onsuccess = () => {
                db.close();
                resolve(count.result);
              };
            };
          }),
      ),
    ).toBe(0);
  });
}

test.describe('mobile long press', () => {
  test.use({ hasTouch: true });
  test('suppresses long-press menus on the interface and keeps input editing available', async ({
    page,
  }) => {
    await page.goto('/');
    const contextAllowed = await page
      .locator('h1')
      .first()
      .evaluate((element) =>
        element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
      );
    expect(contextAllowed).toBe(false);
    const input = page.locator('input').first();
    expect(
      await input.evaluate((element) =>
        element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
      ),
    ).toBe(true);
    await expect(input).toHaveCSS('user-select', 'text');
  });
});
