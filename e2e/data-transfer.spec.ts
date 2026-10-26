import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { presetRules } from '../packages/mahjong-rules/index';
import type { Match } from '../packages/mahjong-core/ledger';

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
      { id: 'a', name: player },
      { id: 'b', name: 'Bob' },
      { id: 'c', name: 'Carol' },
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
test('JSON archive filters whole games, round trips and skips duplicate IDs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto('/');
  await page.locator('.app-navigation a[href$="/records"]').click();
  await expect(page.locator('app-data-transfer')).toHaveCount(0);
  await page.locator('.app-navigation a[href$="/others"]').click();
  await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import JSON', exact: true });
  const matches = [
    game('first', '2026-10-01'),
    game('second', '2026-10-02', 'Dana'),
    game('third', '2026-10-03'),
  ];
  await dialog.getByLabel('Import JSON file', { exact: true }).setInputFiles({
    name: 'games.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'riichi-table',
        version: 1,
        exportedAt: new Date().toISOString(),
        matches,
      }),
    ),
  });
  await expect(dialog.locator('input[type=checkbox]')).toHaveCount(3);
  await dialog.getByLabel('From date', { exact: true }).fill('2026-10-02');
  await dialog.getByLabel('To date', { exact: true }).fill('2026-10-03');
  await dialog.getByRole('combobox', { name: 'Player', exact: true }).selectOption('Alice');
  await expect(dialog.locator('input[type=checkbox]')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Games imported.');
  await dialog.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('No new games to import.');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: 'artifacts/json-transfer-390.png' });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Export JSON', exact: true });
  await expect(exportDialog.getByLabel('Import JSON file', { exact: true })).toHaveCount(0);
  const downloadEvent = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: 'Export selected games', exact: true }).click();
  const download = await downloadEvent;
  const stream = (await download.createReadStream())!;
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.version).toBe(1);
  expect(exported.matches.map((match: Match) => match.id)).toEqual(['third']);
  await exportDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
  await dialog.getByLabel('Import JSON file', { exact: true }).setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":5}'),
  });
  await expect(dialog.getByRole('alert')).toHaveText('Invalid game archive.');
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
