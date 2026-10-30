import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { presetRules } from '../packages/mahjong-rules/index';
import { emptyLive } from '../packages/mahjong-core/live';
import { enterLiveTiles, gameMenu, prompt } from './helpers/game';

test.use({ serviceWorkers: 'block' });

test('changing lobby music starts playback during the selection event', async ({ page }) => {
  await page.addInitScript(() => {
    const starts: { source: string; event: string }[] = [];
    Object.defineProperty(window, 'musicStarts', { value: starts });
    Object.defineProperty(window, 'Audio', {
      value: class {
        paused = true;
        constructor(private source: string) {}
        play() {
          starts.push({ source: this.source, event: Reflect.get(window, 'event')?.type ?? '' });
          this.paused = false;
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
        }
      },
    });
  });
  await page.goto('/others/sound');
  const select = page.getByRole('combobox', { name: 'Lobby music', exact: true });
  for (const track of ['Lobby Winter', 'Lobby Autumn', 'Lobby']) {
    await select.selectOption(track);
    const latest = await page.evaluate(() => Reflect.get(window, 'musicStarts').at(-1));
    expect(latest.event).toBe('change');
    expect(latest.source).toContain(track.toLowerCase().replaceAll(' ', '-') + '.mp3');
  }
});

test('saved players and player picker expand to the top of the phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const name of ['Saved players', 'Choose player East']) {
    await page.getByRole('button', { name, exact: true }).click();
    const sheet = page.locator('dialog.player-sheet');
    await expect(sheet).toBeVisible();
    await expect.poll(async () => Math.round((await sheet.boundingBox())!.y)).toBe(0);
    expect(Math.round((await sheet.boundingBox())!.height)).toBe(844);
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(sheet).not.toBeVisible();
  }
});

test('autoplay restriction retries on the next interaction without a music error', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let attempts = 0;
    Object.defineProperty(window, 'musicAttempts', { get: () => attempts });
    Object.defineProperty(window, 'Audio', {
      value: class {
        paused = true;
        play() {
          attempts++;
          if (attempts === 1)
            return Promise.reject(new DOMException('User interaction required', 'NotAllowedError'));
          this.paused = false;
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
        }
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Music settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Music settings', exact: true });
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'musicAttempts'))).toBe(1);
  await expect(
    dialog.getByText('Could not play background music.', { exact: true }),
  ).not.toBeVisible();
  await dialog.getByRole('heading', { name: 'Sound effects', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'musicAttempts'))).toBe(2);
  await expect(
    dialog.getByText('Could not play background music.', { exact: true }),
  ).not.toBeVisible();
});

test('successful retry of the same music clears its previous playback error', async ({ page }) => {
  await page.addInitScript(() => {
    let failed = false;
    Object.defineProperty(window, 'Audio', {
      value: class {
        paused = true;
        volume = 1;
        loop = false;
        play() {
          if (!failed) {
            failed = true;
            return Promise.reject(new Error('Temporary playback failure'));
          }
          this.paused = false;
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
        }
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Music settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Music settings', exact: true });
  await expect(dialog.getByText('Could not play background music.', { exact: true })).toBeVisible();
  await dialog.getByRole('slider', { name: 'Music volume', exact: true }).fill('0.5');
  await expect(
    dialog.getByText('Could not play background music.', { exact: true }),
  ).not.toBeVisible();
});

test('lobby and game share track choices, volume and mute without leaving the table', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const log: string[] = [];
    Object.defineProperty(window, 'playedMusic', { value: log });
    Object.defineProperty(window, 'Audio', {
      value: class {
        paused = true;
        volume = 1;
        loop = false;
        constructor(private src: string) {}
        play() {
          this.paused = false;
          if (this.src.includes('/sounds/music/')) log.push(new URL(this.src).pathname);
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
        }
      },
    });
  });
  const latest = () =>
    page.evaluate(() => (window as unknown as { playedMusic: string[] }).playedMusic.at(-1));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Music settings', exact: true }).click();
  const lobby = page.getByRole('dialog', { name: 'Music settings', exact: true });
  await lobby
    .getByRole('combobox', { name: 'Lobby music', exact: true })
    .selectOption('Lobby Winter');
  await lobby
    .getByRole('combobox', { name: 'Game music', exact: true })
    .selectOption('Game Master');
  await lobby
    .getByRole('combobox', { name: 'Riichi music', exact: true })
    .selectOption('Liqi Chuzhen');
  await lobby.getByRole('slider', { name: 'Music volume', exact: true }).fill('0.4');
  await expect.poll(latest).toBe('/sounds/music/lobby-winter.mp3');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'artifacts/music-settings-lobby-desktop.png' });
  await lobby.getByRole('button', { name: 'Close', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Music settings', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await enterLiveTiles(page, 'Dora indicators', '1m');
  await prompt(page).getByRole('button', { name: 'Save indicators', exact: true }).click();
  await expect.poll(latest).toBe('/sounds/music/game-master.mp3');
  await gameMenu(page, 'Music settings');
  await expect(prompt(page).getByRole('slider', { name: 'Music volume', exact: true })).toHaveValue(
    '0.4',
  );
  await prompt(page)
    .getByRole('combobox', { name: 'Game music', exact: true })
    .selectOption('23ex Duiju3');
  await expect.poll(latest).toBe('/sounds/music/23ex-duiju3.mp3');
  await prompt(page)
    .getByRole('combobox', { name: 'Riichi music', exact: true })
    .selectOption('Yichujifa');
  await prompt(page).locator('.audio-mute:not(.audio-effects-mute)').click();
  await expect(prompt(page).getByRole('slider', { name: 'Music volume', exact: true })).toHaveValue(
    '0',
  );
  await prompt(page).locator('.audio-mute:not(.audio-effects-mute)').click();
  await expect(prompt(page).getByRole('slider', { name: 'Music volume', exact: true })).toHaveValue(
    '0.4',
  );
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await page
    .locator('.player-seat')
    .filter({ hasText: 'Player 2' })
    .getByRole('button', { name: 'Riichi', exact: true })
    .click();
  await expect.poll(latest).toBe('/sounds/music/yichujifa.mp3');
  await page.reload();
  await gameMenu(page, 'Music settings');
  await expect(prompt(page).getByRole('combobox', { name: 'Game music', exact: true })).toHaveValue(
    '23ex Duiju3',
  );
  await expect(
    prompt(page).getByRole('combobox', { name: 'Riichi music', exact: true }),
  ).toHaveValue('Yichujifa');
  await expect(
    prompt(page).getByRole('combobox', { name: 'Lobby music', exact: true }),
  ).toHaveValue('Lobby Winter');
});

test('room guests can change their music with all game permissions disabled', async ({ page }) => {
  const api = 'http://localhost:4300';
  const now = new Date().toISOString();
  const match = {
    id: 'music-room-game',
    schemaVersion: 1,
    name: 'Music room',
    createdAt: now,
    updatedAt: now,
    playerCount: 4,
    rules: presetRules('mahjong-soul', 4),
    players: ['Alice', 'Bob', 'Carol', 'David'].map((name, index) => ({ id: 'p' + index, name })),
    initialBalances: { p0: 25000, p1: 25000, p2: 25000, p3: 25000 },
    initialDealerId: 'p0',
    dealerId: 'p0',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    events: [],
    live: emptyLive(),
  };
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: api } } }),
  );
  await page.addInitScript(() =>
    localStorage.setItem(
      'riichi-room:http://localhost:4300',
      JSON.stringify({ id: 'ABCDEF1234', token: 'a'.repeat(64), host: false, seat: 1 }),
    ),
  );
  await page.route(api + '/hubs/**', (route) => route.abort());
  const writes: string[] = [];
  await page.route(api + '/api/rooms/**', (route) => {
    if (route.request().method() !== 'GET') writes.push(route.request().method());
    return route.fulfill({
      json: {
        revision: 1,
        handKey: '',
        match,
        actions: [],
        permissions: {
          calls: false,
          riichi: false,
          win: false,
          indicators: false,
          settle: false,
          finish: false,
        },
      },
    });
  });
  await page.goto('/room/ABCDEF1234');
  await expect(page.getByRole('heading', { name: 'Music room', exact: true })).toBeVisible();
  await gameMenu(page, 'Music settings');
  await prompt(page)
    .getByRole('combobox', { name: 'Game music', exact: true })
    .selectOption('Game');
  await prompt(page).getByRole('slider', { name: 'Music volume', exact: true }).fill('0.3');
  await prompt(page).locator('.audio-mute:not(.audio-effects-mute)').click();
  await expect(prompt(page).getByRole('slider', { name: 'Music volume', exact: true })).toHaveValue(
    '0',
  );
  expect(writes).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('room waiting area exposes the same music settings to guests', async ({ page }) => {
  const api = 'http://localhost:4300';
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: api } } }),
  );
  await page.route(api + '/hubs/**', (route) => route.abort());
  await page.route(api + '/api/rooms/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/join')
      ? { id: 'ABCDEF1234', token: 'a'.repeat(64), host: false, seat: 1 }
      : path.endsWith('/game')
        ? { revision: 0, handKey: '', match: null, actions: [] }
        : {
            id: 'ABCDEF1234',
            playerCount: 4,
            revision: 0,
            seats: [0, 1],
            playerNames: ['Alice', 'Bob', 'Carol', 'David'],
            expiresAt: '2099-01-01T00:00:00Z',
          };
    return route.fulfill({ json });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/online?room=ABCDEF1234&pin=123456');
  await expect(
    page.getByText('Joined the room. Waiting for the host to start the game.', { exact: true }),
  ).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Music settings' }).click();
  await page.getByRole('combobox', { name: 'Game music', exact: true }).selectOption('23ex Duiju2');
  await page
    .getByRole('combobox', { name: 'Lobby music', exact: true })
    .selectOption('Lobby Autumn');
  await page.locator('.audio-mute:not(.audio-effects-mute)').click();
  await expect(page.getByRole('slider', { name: 'Music volume', exact: true })).toHaveValue('0');
});
