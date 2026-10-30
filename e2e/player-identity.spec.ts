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
        name: identityLabel({ id: 'incoming-a', name: 'Alice' }),
        exact: true,
      })
      .locator('option:checked'),
  ).toHaveText('Keep as a separate player');
  await expect(
    page
      .getByRole('combobox', { name: identityLabel({ id: 'bob', name: 'Bob' }), exact: true })
      .locator('option:checked'),
  ).toHaveText('Use matching player ID');
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
