import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { presetRules } from '../packages/mahjong-rules/index';
import QRCode from 'qrcode';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: '' } } }),
  );
});

test('start choices stack and close without creating a game', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Game length', exact: true })).toHaveValue(
    'east',
  );
  await page.getByRole('button', { name: /Start match/ }).click();
  await expect(page.getByRole('button', { name: 'Host game', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Start shared game', exact: true }).click();
  const choice = page.getByRole('dialog', { name: 'Start shared game', exact: true });
  await expect(choice.getByRole('combobox')).toHaveCount(0);
  await choice.getByRole('button', { name: 'Host game', exact: true }).click();
  const host = page.getByRole('dialog', { name: 'Host game', exact: true });
  await expect(host).toBeVisible();
  await expect(host.getByRole('combobox', { name: 'Game length', exact: true })).toHaveValue(
    'east',
  );
  await host.getByRole('button', { name: 'Back', exact: true }).click();
  const roles = page.getByRole('dialog', { name: 'Start shared game', exact: true });
  await expect(roles).toBeVisible();
  await roles.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page.locator('.game-shell')).toBeVisible();
});

test('online service is optional and room form is accessible on phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await page.getByRole('button', { name: 'Join game', exact: true }).click();
  await expect(page.getByText('Online service is not configured.', { exact: true })).toBeVisible();
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: 'https://api.example.test' } } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await page.getByRole('button', { name: 'Join game', exact: true }).click();
  await page.getByLabel('Room code', { exact: true }).fill('ABCDEF1234');
  await page.locator('input[type=file]').setInputFiles({
    name: 'room.png',
    mimeType: 'image/png',
    buffer: await QRCode.toBuffer('FEDCBA4321'),
  });
  await expect(page.getByLabel('Room code', { exact: true })).toHaveValue('FEDCBA4321');
  await page.getByLabel('Room code', { exact: true }).fill('ABCDEF1234');
  await page.getByLabel('Room PIN', { exact: true }).fill('123456');
  await expect(page.getByRole('button', { name: 'Join room', exact: true })).toBeEnabled();
  await page.route('https://api.example.test/api/rooms/ABCDEF1234/join', (route) =>
    route.fulfill({ status: 401 }),
  );
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Room credentials are incorrect or expired.');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/online-room-390.png' });
});

test('shared data requires preview and imports without duplicating games', async ({ page }) => {
  const id = 'a'.repeat(64);
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: 'https://api.example.test' } } }),
  );
  await page.route(`https://api.example.test/api/shares/${id}`, (route) =>
    route.fulfill({
      json: {
        format: 'riichi-table',
        version: 1,
        exportedAt: new Date().toISOString(),
        matches: [
          {
            id: 'online-shared-game',
            schemaVersion: 1,
            name: 'Shared Sunday game',
            createdAt: '2026-10-01T12:00:00Z',
            updatedAt: '2026-10-01T12:00:00Z',
            playerCount: 3,
            rules: presetRules('custom', 3),
            players: [
              { id: 'a', name: 'Alice' },
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
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await page.evaluate((share) => {
    history.pushState(null, '', `/online?share=${share}`);
    dispatchEvent(new PopStateEvent('popstate'));
  }, id);
  await expect(page.getByText('Shared Sunday game', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Games imported.');
  await page.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('No new games to import.');
});

test('a new join ignores the previous room credential', async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: 'https://api.example.test' } } }),
  );
  await page.addInitScript(() =>
    localStorage.setItem(
      'riichi-room:https://api.example.test',
      JSON.stringify({
        id: 'ABCDEF1234',
        token: 'a'.repeat(64),
        host: false,
        seat: 1,
      }),
    ),
  );
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/rooms/')) reads.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await page.getByRole('button', { name: 'Join game', exact: true }).click();
  await expect(page.getByLabel('Room code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Room code', { exact: true })).toHaveValue('');
  expect(reads).toEqual([]);
});

test('rule help opens on a click and dismisses on another click or Escape', async ({ page }) => {
  await page.goto('/settings');
  const button = page.locator('.help-button').first();
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.setting-help.open .help-bubble')).toBeVisible();
  await page.locator('h1').click();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
});
