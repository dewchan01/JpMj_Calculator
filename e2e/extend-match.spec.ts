import { test, expect } from '@playwright/test';
import { presetRules } from '../packages/mahjong-rules/index';
import { settleRound, type Match } from '../packages/mahjong-core/ledger';
import { gamesCsv } from '../apps/web/src/app/features/records/data-transfer/data-csv';

test.use({ serviceWorkers: 'block' });
test('finished East game extends to South and persists the resumed state', async ({ page }) => {
  const rules = presetRules('mahjong-soul', 4);
  const base: Match = {
    id: 'extend-browser',
    schemaVersion: 1,
    name: 'Extend test',
    createdAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    playerCount: 4,
    rules,
    players: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, name: `P${i}` })),
    initialBalances: { p0: 40000, p1: 10000, p2: 25000, p3: 25000 },
    initialDealerId: 'p0',
    dealerId: 'p3',
    roundWind: 'east',
    handNumber: 4,
    honba: 0,
    gameLength: 'east',
    events: [],
  };
  const finished = settleRound(
    base,
    {
      id: 'draw',
      timestamp: '2026-11-02T01:00:00.000Z',
      type: 'exhaustiveDraw',
      payments: [],
      drawInput: {
        rules,
        players: base.players,
        dealerId: 'p3',
        honba: 0,
        type: 'exhaustive',
        tenpaiIds: [],
        nagashiIds: [],
        circumstancesConfirmed: true,
      },
    },
    {
      isValid: true,
      errors: [],
      outcome: 'exhaustiveDraw',
      payments: [],
      playerDeltas: {},
      winnerIds: [],
      dealerRepeats: false,
      results: [],
    },
  );
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  await page.goto('/others/data/import');
  await page.getByLabel('Import CSV file', { exact: true }).setInputFiles({
    name: 'finished.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(gamesCsv([finished])),
  });
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Games imported.');
  await page.goto('/score/' + finished.id);
  const dialog = page.locator('dialog.game-prompt[open]');
  await dialog.getByRole('button', { name: 'Extend to East and South', exact: true }).click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog.locator('app-final-results')).toBeVisible();
  await dialog.getByRole('button', { name: 'Extend to East and South', exact: true }).click();
  await dialog.getByRole('button', { name: 'Extend to East and South', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.locator('app-table-summary')).toBeVisible();
  await expect(page.locator('app-final-results')).toHaveCount(0);
});
