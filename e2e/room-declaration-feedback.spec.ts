import { test, expect } from '@playwright/test';
import { presetRules } from '../packages/mahjong-rules';
import { emptyLive } from '../packages/mahjong-core/live';
import {
  roomHandKey,
  settleRoomWins,
  type RoomAction,
} from '../packages/mahjong-core/room-actions';
import type { Match } from '../packages/mahjong-core/ledger';
import { defaultRoomPermissions } from '../apps/web/src/app/core/online/room-permissions';
import { prompt } from './helpers/game';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
test('declaration permission is checked before entry, waiting stays on seats, settlement closes old forms', async ({
  page,
}) => {
  const api = 'http://localhost:5180',
    id = '527CD8F86E';
  let match: Match = {
    id: 'declaration-feedback',
    schemaVersion: 1,
    name: 'Shared game',
    playerCount: 3,
    rules: presetRules('mahjong-soul', 3),
    players: [0, 1, 2].map((i) => ({
      id: `p${i}`,
      name: `Player ${i + 1}`,
      profileId: `profile-${i}`,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    initialBalances: { p0: 35000, p1: 35000, p2: 35000 },
    initialDealerId: 'p0',
    dealerId: 'p0',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    gameLength: 'east',
    events: [],
    live: emptyLive(),
    clock: { elapsedMs: 0, handStartMs: 0, runningSince: new Date().toISOString() },
  };
  let permissions = { ...defaultRoomPermissions, win: false, declareAny: false };
  let revision = 1;
  let actions: RoomAction[] = [];
  let pendingWinSeats: number[] = [2];
  await page.addInitScript(
    ({ api, id }) => {
      localStorage.setItem('riichi-advanced-scoring', 'true');
      sessionStorage.setItem(
        `riichi-room:${api}`,
        JSON.stringify({ id, token: 'a'.repeat(64), host: false, seat: 1 }),
      );
    },
    { api, id },
  );
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: api } } }),
  );
  await page.route(api + '/hubs/**', (route) => route.fulfill({ status: 503 }));
  await page.route(api + '/api/rooms/' + id, (route) =>
    route.fulfill({
      json: {
        id,
        host: false,
        ownSeat: 1,
        playerCount: 3,
        revision,
        seats: [0, 1, 2],
        started: true,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    }),
  );
  await page.route(new RegExp('/api/rooms/' + id + '/game(?:\\?.*)?$'), (route) =>
    route.fulfill({
      json: {
        host: false,
        ownSeat: 1,
        hasGame: true,
        revision,
        handKey: roomHandKey(match),
        match,
        actions,
        permissions,
        pendingWinSeats,
      },
    }),
  );
  await page.route(api + '/api/rooms/' + id + '/game/actions', async (route) => {
    const body = route.request().postDataJSON();
    actions = [{ ...body, status: 'pending', error: '', createdAt: Date.now() }];
    pendingWinSeats = body.kind === 'win' ? [body.seat] : [];
    revision++;
    await route.fulfill({ json: { id: body.id, status: 'pending', error: '' } });
  });
  await page.goto('/room/' + id);
  await expect(page.locator('.game-shell')).toBeVisible();
  const other = page.getByRole('button', { name: 'Player actions Player 1', exact: true });
  await expect(other).toBeDisabled();
  await expect(page.locator('.pending-declaration')).toHaveCount(0);
  await expect(prompt(page)).not.toBeVisible();
  permissions = { ...permissions, win: false, declareAny: true };
  revision++;
  await expect(other).toBeEnabled({ timeout: 10000 });
  await page.getByRole('button', { name: 'End this hand', exact: true }).click();
  await expect(prompt(page).getByRole('button', { name: 'Win', exact: true })).toBeEnabled();
  await prompt(page).getByRole('button', { name: 'Double Riichi', exact: true }).click();
  await expect(prompt(page).getByRole('button', { name: 'Player 1', exact: true })).toBeEnabled();
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  for (const [label, kind] of [
    ['Riichi', 'riichi'],
    ['Call', 'call'],
  ] as const) {
    const submitted = page.waitForRequest(
      (request) => request.url().endsWith('/game/actions') && request.method() === 'POST',
    );
    await page
      .locator('.seat-actions')
      .first()
      .getByRole('button', { name: label, exact: true })
      .click();
    const body = (await submitted).postDataJSON();
    expect(body.kind).toBe(kind);
    expect(body.seat).toBe(0);
  }
  await other.click();
  await prompt(page).getByRole('button', { name: 'Tsumo · self draw', exact: true }).click();
  await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await prompt(page)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await expect(prompt(page)).not.toBeVisible();
  const waiting = page.getByRole('dialog', { name: 'Winning declarations', exact: true });
  await expect(waiting).toContainText('Waiting for the host');
  await expect(waiting.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(waiting).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(waiting).toBeVisible();
  match = settleRoomWins(match, actions, () => 'host-settlement');
  actions = actions.map((action) => ({ ...action, status: 'accepted' }));
  pendingWinSeats = [];
  revision++;
  await expect(waiting).not.toBeVisible({ timeout: 10000 });
  await expect(prompt(page)).not.toBeVisible({ timeout: 10000 });
  await expect(page.locator('.pending-declaration')).toHaveCount(0);
  permissions = { ...permissions, settle: true };
  actions = actions.map((action) => ({
    ...action,
    id: 'next-declaration',
    handKey: roomHandKey(match),
    status: 'pending',
  }));
  pendingWinSeats = [0];
  revision++;
  await expect(
    prompt(page).getByRole('heading', { name: 'Winning declarations', exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.player-status button.pending-declaration')).toHaveCount(0);
  await expect(prompt(page).getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  await expect(prompt(page)).toBeVisible();
  actions = [];
  pendingWinSeats = [];
  revision++;
  await expect(prompt(page)).not.toBeVisible({ timeout: 10000 });
});
