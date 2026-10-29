import { test, expect, type Page } from '@playwright/test';
import { playerAction, prompt, enterLiveTiles } from './helpers/game';
import AxeBuilder from '@axe-core/playwright';

test.skip(
  !process.env['RIICHI_API_TEST_URL'],
  'Run with playwright.online.config.ts for the real API.',
);

test('host and guest synchronize Riichi, Kan and a winning declaration through the real API', async ({
  page: host,
  browser,
}) => {
  const api = process.env['RIICHI_API_TEST_URL']!;
  async function prepare(page: Page) {
    await page.route('**/config.json', (route) =>
      route.fulfill({ json: { backend: { apiUrl: api } } }),
    );
    await page.addInitScript(() => {
      const testWindow = window as typeof window & { roomSockets: WebSocket[] };
      testWindow.roomSockets = [];
      const NativeWebSocket = WebSocket;
      testWindow.WebSocket = class extends NativeWebSocket {
        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          testWindow.roomSockets.push(this);
        }
      };
      localStorage.setItem('riichi-advanced-scoring', 'true');
      localStorage.setItem('riichi-install-reminder-hidden', 'true');
    });
  }
  await prepare(host);
  await host.goto('/');
  await host.getByRole('button', { name: /Start match/ }).click();
  await host.getByRole('button', { name: 'Start shared game', exact: true }).click();
  let startupReads = 0;
  const trackStartup = (request: import('@playwright/test').Request) => {
    if (request.method() === 'GET' && request.url().includes('/api/rooms/')) startupReads++;
  };
  host.on('request', trackStartup);
  await host.getByRole('button', { name: 'Host game', exact: true }).click();
  await host
    .locator('#host-setup-title')
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'Host game', exact: true })
    .click();
  await expect(host.locator('.credential-row').first()).toBeVisible({ timeout: 20000 });
  host.off('request', trackStartup);
  expect(startupReads).toBe(0);
  await expect(
    host.getByText('The host has not attached a game yet.', { exact: true }),
  ).toHaveCount(0);
  const code = await host.getByRole('textbox', { name: 'Room code', exact: true }).inputValue();
  const pin = await host.getByRole('textbox', { name: 'Room PIN', exact: true }).inputValue();
  await expect(host.getByRole('img', { name: 'Room QR code', exact: true })).toBeVisible();
  const hint = host.locator('.room-qr-hint');
  expect(
    await hint.evaluate(
      (element) =>
        parseFloat(getComputedStyle(element).fontSize) /
        parseFloat(getComputedStyle(document.documentElement).fontSize),
    ),
  ).toBeCloseTo(0.7, 2);
  expect((await hint.boundingBox())!.y).toBeLessThan(
    (await host.locator('.room-qr').boundingBox())!.y,
  );
  await expect(host.getByLabel('Room link', { exact: true })).toHaveCount(0);
  await expect(host.getByRole('button', { name: 'Copy room details', exact: true })).toBeVisible();
  await expect(
    host.locator('app-online').getByRole('button', { name: 'Start game', exact: true }),
  ).toBeVisible();

  await host.request.post(api + '/api/rooms/' + code + '/join', { data: { pin, seat: 0 } });
  const guestContext = await browser.newContext({ serviceWorkers: 'block' });
  const guest = await guestContext.newPage();
  await prepare(guest);
  await guest.goto('http://localhost:4300/');
  await guest.getByRole('button', { name: /Start match/ }).click();
  await guest.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await guest.getByRole('button', { name: 'Join game', exact: true }).click();
  const roomQR = await host
    .getByRole('img', { name: 'Room QR code', exact: true })
    .getAttribute('src');
  await guest.locator('input[type=file]').setInputFiles({
    name: 'room-invitation.png',
    mimeType: 'image/png',
    buffer: Buffer.from(roomQR!.split(',')[1], 'base64'),
  });
  await expect(
    guest.getByText('Joined the room. Waiting for the host to start the game.', { exact: true }),
  ).toBeVisible();
  const cameraContext = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const cameraGuest = await cameraContext.newPage();
    await prepare(cameraGuest);
    await cameraGuest.goto(`http://localhost:4300/online?room=${code}&pin=${pin}`);
    await expect(
      cameraGuest.getByText('Joined the room. Waiting for the host to start the game.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(cameraGuest.locator('.game-shell')).toHaveCount(0);
  } finally {
    await cameraContext.close();
  }
  await host.locator('app-online').getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(guest.locator('.game-shell')).toBeVisible();
  const guestSeat = guest.locator('.player-seat').filter({ hasText: 'Player 2' });
  const hostSeat = host.locator('.player-seat').filter({ hasText: 'Player 2' });
  await expect(guestSeat).toBeVisible();
  await expect(guest.locator('.app-navigation')).toBeHidden();
  await expect(host.locator('.app-navigation')).toBeHidden();
  const local = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    serviceWorkers: 'block',
  });
  try {
    await local.route('**/config.json', (route) =>
      route.fulfill({ json: { backend: { apiUrl: '' } } }),
    );
    await local.goto('http://localhost:4300/');
    await local.getByRole('button', { name: '4 players', exact: true }).click();
    await local.getByRole('button', { name: /Start match/ }).click();
    await local.getByRole('button', { name: 'Start game', exact: true }).click();
    await expect(local.locator('.game-shell')).toBeVisible();
    await guest.setViewportSize({ width: 1920, height: 1080 });
    const localBoard = (await local.locator('.table-summary').boundingBox())!;
    const sharedBoard = (await guest.locator('.table-summary').boundingBox())!;
    expect(sharedBoard.height).toBeGreaterThanOrEqual(localBoard.height - 60);
    const localSeat = (await local.locator('.player-seat.seat-bottom').boundingBox())!;
    const sharedSeat = (await guest.locator('.player-seat.seat-bottom').boundingBox())!;
    expect(Math.abs(localSeat.width - sharedSeat.width)).toBeLessThan(1);
    await guest.screenshot({ path: 'artifacts/shared-table-desktop-size.png' });
  } finally {
    await local.close();
  }
  // After startup settles, a healthy hub must not issue periodic game requests.
  await guest.waitForTimeout(1000);
  let idleReads = 0;
  const countRead = (request: import('@playwright/test').Request) => {
    if (request.method() === 'GET' && /\/game(?:\?|$)/.test(request.url())) idleReads++;
  };
  guest.on('request', countRead);
  await guest.waitForTimeout(3200);
  guest.off('request', countRead);
  expect(idleReads).toBe(0);
  guest.on('request', countRead);
  try {
    await guest.context().setOffline(true);
    await guest.evaluate(() => {
      const testWindow = window as typeof window & { roomSockets: WebSocket[] };
      testWindow.roomSockets.forEach((socket) => socket.close());
    });
    await expect.poll(() => idleReads, { timeout: 10000 }).toBeGreaterThan(0);
  } finally {
    await guest.context().setOffline(false);
    guest.off('request', countRead);
  }
  for (const width of [1280, 390]) {
    await guest.setViewportSize({ width, height: 844 });
    const clipped = await guest.locator('.table-summary').evaluate((table) => {
      const bounds = table.getBoundingClientRect();
      return [...table.querySelectorAll('.seat-actions button')]
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return (
            rect.top < bounds.top ||
            rect.bottom > bounds.bottom ||
            rect.left < bounds.left ||
            rect.right > bounds.right
          );
        })
        .map((button) => ({
          text: button.textContent,
          rect: button.getBoundingClientRect().toJSON(),
          bounds: bounds.toJSON(),
          layout: getComputedStyle(table.querySelector('.table-layout')!).minHeight,
        }));
    });
    expect(clipped, `Player controls fit at ${width}px`).toEqual([]);
  }
  await guest.screenshot({ path: 'artifacts/shared-table-mobile.png' });
  await guest.setViewportSize({ width: 1280, height: 844 });
  await guestSeat.getByRole('button', { name: 'Riichi', exact: true }).click();
  await expect(host.locator('.table-pot strong')).toHaveText('1,000', { timeout: 15000 });
  await expect(guest.locator('.table-pot strong')).toHaveText('1,000');
  await guestSeat.getByRole('button', { name: 'Concealed Kan', exact: true }).click();
  await enterLiveTiles(guest, 'Meld tiles', '5p');
  await prompt(guest).getByRole('button', { name: 'Record action', exact: true }).click();
  await expect(hostSeat.getByRole('button', { name: 'Concealed Kan', exact: true })).toContainText(
    '1',
    { timeout: 15000 },
  );
  await playerAction(guest, 'Player 2');
  await prompt(guest).getByRole('button', { name: 'Tsumo · self draw', exact: true }).click();
  await prompt(guest).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await prompt(guest)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await expect(
    host.getByRole('heading', { name: 'Winning declarations', exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await host.getByRole('button', { name: 'Settle pending wins', exact: true }).click();
  await expect(host.locator('.table-round b')).toHaveText('2', { timeout: 15000 });
  await expect(guest.locator('.table-round b')).toHaveText('2');
  await expect(guest.locator('.table-pot strong')).toHaveText('0');
  // When the host leaves, declarations persist and are processed after it returns.
  await host.goto('/');
  await guestSeat.getByRole('button', { name: 'Riichi', exact: true }).click();
  await expect(guest.locator('.room-status p[role=status]')).toHaveCount(0);
  await expect(guest.locator('.table-pot strong')).toHaveText('0');
  await host.evaluate((code) => {
    history.pushState(null, '', '/room/' + code);
    dispatchEvent(new PopStateEvent('popstate'));
  }, code);
  await expect(guest.locator('.table-pot strong')).toHaveText('1,000', { timeout: 15000 });
  for (const [page, name] of [
    [guest, 'Player 2'],
    [host, 'Player 4'],
  ] as const) {
    if (page === host) {
      await expect(
        host.getByRole('heading', { name: 'Winning declarations', exact: true }),
      ).toBeVisible();
    }
    await playerAction(page, name);
    await prompt(page).getByRole('button', { name: 'Ron · discard', exact: true }).click();
    await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
    await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
    await prompt(page)
      .getByRole('button', { name: 'Confirm & save settlement', exact: true })
      .click();
  }
  // The host's own confirmation settles its win together with the pending guest Ron.
  await expect(guest.locator('.table-honba strong')).toHaveText('1', { timeout: 15000 });
  await expect(guest.locator('.table-pot strong')).toHaveText('0');
  await guest.screenshot({ path: 'artifacts/online-live-guest.png' });
  await host.goto('/');
  await host.locator('.app-navigation a[href$="/others"]').click();
  await host.getByRole('link', { name: 'Export data', exact: true }).click();
  const exportDialog = host.getByRole('region', { name: 'Export data', exact: true });
  await host.setViewportSize({ width: 390, height: 844 });
  await exportDialog.locator('.transfer-actions').scrollIntoViewIfNeeded();
  const actionTops = await exportDialog
    .locator('.transfer-actions button')
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().top));
  expect(actionTops).toHaveLength(2);
  expect(Math.max(...actionTops) - Math.min(...actionTops)).toBeLessThan(1);
  await host.screenshot({ path: 'artifacts/export-page-390.png' });
  await exportDialog.getByRole('button', { name: 'Share selected games', exact: true }).click();
  const shareDialog = host.getByRole('dialog', { name: 'Share selected games', exact: true });
  await expect(shareDialog.getByRole('img', { name: 'Share QR code', exact: true })).toBeVisible();
  await host.setViewportSize({ width: 390, height: 844 });
  expect(
    (await new AxeBuilder({ page: host }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await host.screenshot({ path: 'artifacts/share-transfer-390.png' });
  await expect(shareDialog.getByLabel('Share link')).toHaveCount(0);
  const qr = await shareDialog
    .getByRole('img', { name: 'Share QR code', exact: true })
    .getAttribute('src');
  const shareId = await shareDialog.getByRole('textbox').inputValue();
  await shareDialog.getByRole('button', { name: 'Back', exact: true }).click();
  await exportDialog.getByRole('link', { name: 'Back', exact: true }).click();
  // A full reload must retain this device's active share and regenerate its QR.
  await host.goto('/');
  await host.locator('.app-navigation a[href$="/others"]').click();
  await host.getByRole('link', { name: 'Share history', exact: true }).click();
  const historyPage = host.getByRole('region', { name: 'Share history', exact: true });
  await expect(historyPage.locator('.history-entry')).toHaveCount(1);
  await host.screenshot({ path: 'artifacts/share-history-390.png' });
  await historyPage.locator('.history-entry').click();
  await expect(shareDialog.getByRole('textbox')).toHaveValue(shareId);
  await expect(shareDialog.getByRole('img', { name: 'Share QR code', exact: true })).toBeVisible();
  await guest.goto('http://localhost:4300/');
  await guest.locator('.app-navigation a[href$="/others"]').click();
  await guest.getByRole('link', { name: 'Import data', exact: true }).click();
  const importDialog = guest.getByRole('region', { name: 'Import data', exact: true });
  await importDialog.locator('input[type=file][accept="image/*"]').setInputFiles({
    name: 'transfer.png',
    mimeType: 'image/png',
    buffer: Buffer.from(qr!.split(',')[1], 'base64'),
  });
  await expect(importDialog.locator('input[type=checkbox]')).toHaveCount(1);
  await importDialog.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(importDialog.getByRole('status')).toHaveText('Games imported.');
  await importDialog.getByLabel('Transfer ID', { exact: true }).fill(shareId);
  await importDialog.getByRole('button', { name: 'Load shared games', exact: true }).click();
  await expect(importDialog.locator('input[type=checkbox]')).toHaveCount(1);
  expect((await host.request.get(api + '/api/shares/' + shareId)).status()).toBe(200);
  await shareDialog.getByRole('button', { name: 'Revoke share', exact: true }).click();
  await expect(shareDialog.getByRole('img', { name: 'Share QR code', exact: true })).toHaveCount(0);
  await shareDialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(historyPage).toBeVisible();
  await expect(historyPage.locator('.history-entry')).toHaveCount(0);
  await guestContext.close();
  const credential = await host.evaluate(
    (apiUrl) => JSON.parse(localStorage.getItem(`riichi-room:${apiUrl}`)!),
    api,
  );
  await host.request.delete(`${api}/api/rooms/${code}`, {
    headers: { Authorization: `Bearer ${credential.token}` },
  });
});

test('host can select three players and room header stays visible', async ({ page }) => {
  const api = process.env['RIICHI_API_TEST_URL']!;
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: api } } }),
  );
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await page.getByRole('button', { name: 'Host game', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Players', exact: true })
    .selectOption({ label: '3 players' });
  await page
    .locator('#host-setup-title')
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'Host game', exact: true })
    .click();
  await expect(
    page.locator('app-online').getByRole('button', { name: 'Start game', exact: true }),
  ).toBeVisible();
  const dialog = page.locator('dialog.shared-game-dialog');
  await expect(dialog.locator('app-player-presence li')).toHaveCount(3);
  await expect(dialog.locator('.connection-row .connection-chip')).toHaveAttribute(
    'aria-label',
    'Connected',
  );
  await expect(dialog.locator('.connection-row .connection-chip')).toHaveText('Connected');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });
  const copy = dialog.getByRole('button', { name: 'Copy room details', exact: true });
  await copy.click();
  await expect(copy).toHaveAttribute('data-copied', 'true');
  await expect(dialog.getByText('Room details copied.', { exact: true })).toHaveCount(0);
  await expect(copy).toHaveAttribute('data-copied', 'false');
  const code = await dialog.getByRole('textbox', { name: 'Room code', exact: true }).inputValue();
  const access = await page.evaluate(
    (api) => JSON.parse(localStorage.getItem('riichi-room:' + api)!),
    api,
  );
  const state = await page.request.get(api + '/api/rooms/' + code, {
    headers: { Authorization: 'Bearer ' + access.token },
  });
  expect((await state.json()).playerCount).toBe(3);
  await expect(dialog.getByLabel('Room link')).toHaveCount(0);
  await dialog.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
  await dialog.evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({ path: 'artifacts/room-redesign.png' });
  await dialog.getByRole('button', { name: 'Close room', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText('This room or share has expired or was removed.', { exact: true }),
  ).toHaveCount(0);
});
