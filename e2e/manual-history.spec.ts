import { test, expect } from '@playwright/test';
import { fixture } from '../packages/mahjong-fixtures';
import { score } from '../packages/mahjong-scoring';
import type { Match } from '../packages/mahjong-core/ledger';
import { gamesCsv } from '../apps/web/src/app/features/records/data-transfer/data-csv';
import { gameMenu, prompt } from './helpers/game';

test.use({ serviceWorkers: 'block' });
test('manual mode edits a tile-scored historical win without entering any tiles or indicators', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('riichi-advanced-scoring', 'true'));
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
  const input = fixture();
  const result = score(input);
  const before = {
    dealerId: input.dealerId,
    roundWind: input.roundWind,
    handNumber: 1,
    honba: 0,
    ended: false,
  };
  const match: Match = {
    id: 'manual-history-regression',
    schemaVersion: 1,
    name: 'Manual history',
    createdAt: '2026-11-02T00:00:00Z',
    updatedAt: '2026-11-02T01:00:00Z',
    playerCount: 4,
    rules: input.rules,
    players: input.players,
    initialBalances: Object.fromEntries(input.players.map((player) => [player.id, 25000])),
    initialDealerId: input.dealerId,
    ...before,
    gameLength: 'east',
    events: [
      {
        id: 'old-win',
        timestamp: '2026-11-02T01:00:00Z',
        type: 'win',
        before,
        payments: result.payments,
        win: input.win,
        hand: input.hand,
        result,
        scoringInput: input,
        winnerIds: [input.win.winnerId],
      },
    ],
  };
  await page.goto('/others/data/import');
  await page.getByLabel('Import CSV file', { exact: true }).setInputFiles({
    name: 'old.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(gamesCsv([match])),
  });
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Games imported.');
  await page.goto('/score/' + match.id);
  await gameMenu(page, 'History');
  await prompt(page).getByRole('button', { name: 'Edit hand', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Win', exact: true }).click();
  await prompt(page)
    .getByRole('checkbox', {
      name: input.players.find((player) => player.id === input.win.winnerId)!.name,
      exact: true,
    })
    .check();
  await prompt(page).locator('input[name=discarder][value="a"]').check();
  await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(prompt(page).locator('app-tile-input')).toHaveCount(0);
  await prompt(page)
    .getByRole('combobox', { name: 'Han', exact: true })
    .selectOption({ label: '3' });
  await prompt(page)
    .getByRole('combobox', { name: 'Fu', exact: true })
    .selectOption({ label: '40' });
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await expect(prompt(page).locator('app-tile-input')).toHaveCount(0);
  await prompt(page)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await expect(prompt(page).locator('.history-event')).toHaveCount(1);
  await expect(prompt(page).locator('.outcome-mark')).toContainText('3 Han');
});
