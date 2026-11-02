import { test, expect } from '@playwright/test';
import { gameMenu, prompt, enterLiveTiles, playerAction } from './helpers/game';
test.use({ serviceWorkers: 'block' });

test('unassigned members are visible to the host and cannot start or enter a table', async ({
  page: host,
  browser,
}) => {
  const api = process.env['RIICHI_API_TEST_URL']!;
  await host.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: api } } }),
  );
  await host.goto('/');
  await host.getByRole('button', { name: /Start match/ }).click();
  await host.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await host.getByRole('button', { name: 'Host game', exact: true }).click();
  await expect(host.getByRole('textbox', { name: 'Room code', exact: true })).toBeVisible();
  const code = await host.getByRole('textbox', { name: 'Room code', exact: true }).inputValue();
  const pin = await host.getByRole('textbox', { name: 'Room PIN', exact: true }).inputValue();
  const guestContext = await browser.newContext({ serviceWorkers: 'block' });
  const guest = await guestContext.newPage();
  await guest.route('**/api/rooms/*/game', async (route) => {
    const response = await route.fetch();
    if (response.ok() && response.status() !== 204) {
      const state = await response.json();
      if (state.match?.id)
        await guest.evaluate((match) => {
          localStorage.setItem(
            'riichi-view:' + match.id,
            JSON.stringify(match.players.map((player: { id: string }) => player.id)),
          );
        }, state.match);
    }
    await route.fulfill({ response });
  });
  await guest.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: api } } }),
  );
  await guest.goto(`http://localhost:4300/online?room=${code}&pin=${pin}`);
  const selection = guest.getByRole('combobox', { name: 'My player', exact: true });
  await expect(selection).toBeEnabled();
  await expect(selection).toHaveValue('-1');
  await expect(host.locator('.unassigned-count')).toHaveText('Unseated · 1');
  const extraJoin = await host.request.post(`${api}/api/rooms/${code}/join`, { data: { pin } });
  const extra = await extraJoin.json();
  await expect(host.locator('.unassigned-count')).toHaveText('Unseated · 2');
  await expect(host.locator('.presence-divider')).toHaveCount(0);
  await expect(host.locator('.room-credentials .lobby-format')).toHaveText(
    'Mahjong Soul · East-only game · 4P',
  );
  await host.setViewportSize({ width: 390, height: 850 });
  const countBox = (await host.locator('.unassigned-count').boundingBox())!;
  const firstChip = (await host.locator('.player-presence li').first().boundingBox())!;
  expect(countBox.y + countBox.height).toBeLessThanOrEqual(firstChip.y);
  await host.screenshot({ path: 'artifacts/host-lobby-compact.png', fullPage: true });
  await host.request.delete(`${api}/api/rooms/${code}/membership`, {
    headers: { Authorization: `Bearer ${extra.token}` },
  });
  await expect(host.locator('.unassigned-count')).toHaveText('Unseated · 1');
  await host.locator('app-online').getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(host.getByRole('alert')).toHaveText(
    'Assign all waiting players before starting the game.',
  );
  await expect(host.locator('.game-shell')).toHaveCount(0);
  await selection.selectOption('1');
  await expect(selection).toBeEnabled();
  await expect(host.locator('.unassigned-count')).toHaveText('Unseated · 0');
  await selection.selectOption('0');
  await expect(guest.getByRole('alert')).toHaveText('This seat is already occupied.');
  await expect(selection).toHaveValue('0');
  await expect(host.locator('.unassigned-count')).toHaveText('Unseated · 1');
  const credential = await guest.evaluate(
    (api) => JSON.parse(sessionStorage.getItem('riichi-room:' + api)!),
    api,
  );
  const membership = await guest.request.get(`${api}/api/rooms/${code}`, {
    headers: { Authorization: `Bearer ${credential.token}` },
  });
  expect((await membership.json()).ownSeat).toBeNull();
  await guest.goto(`http://localhost:4300/room/${code}`);
  await expect(guest.getByRole('alert')).toContainText(
    'Choose an available player before entering the table.',
  );
  await expect(guest.locator('.game-shell')).toHaveCount(0);
  await guest.goto(`http://localhost:4300/online?room=${code}&pin=${pin}`);
  await expect(selection).toBeEnabled();
  await selection.selectOption('1');
  await expect(selection).toBeEnabled();
  await expect(host.locator('.unassigned-count')).toHaveText('Unseated · 0');
  await host.locator('app-online').getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(host.locator('.game-shell')).toBeVisible();
  await expect(guest.locator('.game-shell')).toBeVisible();
  await expect(guest.locator('.seat-bottom h3')).toHaveText('Player 2');
  await guest.reload();
  await expect(guest.locator('.seat-bottom h3')).toHaveText('Player 2');
  await gameMenu(host, 'Information');
  await expect(prompt(host)).toContainText('Room code');
  await prompt(host).locator('.close-prompt').click();
  await host.locator('.floating-menu').click();
  await expect(
    prompt(host).getByRole('button', { name: 'Information', exact: true }).locator('svg'),
  ).toBeVisible();
  const lateJoin = await guest.request.post(`${api}/api/rooms/${code}/join`, { data: { pin } });
  expect(lateJoin.ok()).toBe(true);
  const late = await lateJoin.json();
  expect(late.seat).toBeNull();
  const lateHeaders = { Authorization: `Bearer ${late.token}` };
  const hiddenGame = await guest.request.get(`${api}/api/rooms/${code}/game`, {
    headers: lateHeaders,
  });
  const hidden = await hiddenGame.json();
  expect(hidden.hasGame).toBe(true);
  expect(hidden.match).toBeNull();
  expect(
    (
      await guest.request.delete(`${api}/api/rooms/${code}/membership`, { headers: lateHeaders })
    ).ok(),
  ).toBe(true);
  await guestContext.close();
});

test('waiting lobby shows rule and length for both player counts beside connection status', async ({
  page,
  request,
}) => {
  const api = process.env['RIICHI_API_TEST_URL']!;
  await page.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: api } } }),
  );
  await page.addInitScript(() => localStorage.setItem('riichi-language', 'zh-TW'));
  for (const playerCount of [3, 4]) {
    for (const gameLength of ['east', 'south']) {
      const response = await request.post(`${api}/api/rooms`, {
        data: { playerCount, ruleLabel: 'Mahjong Soul', gameLength },
      });
      expect(response.ok()).toBe(true);
      const room = await response.json();
      await page.goto(`/online?room=${room.id}&pin=${room.pin}`);
      await expect(page.locator('.lobby-format')).toHaveText(
        `雀魂 · ${gameLength === 'east' ? '東風戰' : '東南戰'} · ${playerCount}P`,
        { timeout: 15000 },
      );
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 850 });
        await expect(page.locator('.guest-connection > .waiting-message')).toHaveText(
          '等待房主開始對局。',
        );
        const status = (await page
          .locator('.guest-connection app-connection-status')
          .boundingBox())!;
        const waiting = (await page.locator('.guest-connection > .waiting-message').boundingBox())!;
        const format = (await page.locator('.guest-connection > .lobby-format').boundingBox())!;
        expect(format.y).toBeLessThan(status.y + status.height);
        expect(waiting.x).toBeGreaterThanOrEqual(status.x + status.width);
        expect(waiting.y).toBeLessThan(status.y + status.height);
      }
      await request.delete(`${api}/api/rooms/${room.id}`, {
        headers: { Authorization: `Bearer ${room.token}` },
      });
    }
  }
});

test('joining an invitation in another tab keeps guest and host identities separate', async ({
  page: host,
  context,
}) => {
  const api = process.env['RIICHI_API_TEST_URL']!;
  await context.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: api } } }),
  );
  await host.goto('/');
  await host.getByRole('button', { name: /Start match/ }).click();
  await host.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await host.getByRole('button', { name: 'Host game', exact: true }).click();
  const codeField = host.getByRole('textbox', { name: 'Room code', exact: true });
  await expect(codeField).toBeVisible();
  const code = await codeField.inputValue();
  const pin = await host.getByRole('textbox', { name: 'Room PIN', exact: true }).inputValue();
  const guest = await context.newPage();
  await guest.goto(`/online?room=${code}&pin=${pin}`);
  await expect(
    guest.getByText('Waiting for the host to start the game.', { exact: true }),
  ).toBeVisible();
  await expect(guest.getByRole('combobox', { name: 'My player', exact: true })).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Close room', exact: true })).toHaveCount(0);
  await expect(guest.getByRole('img', { name: 'Room QR code', exact: true })).toHaveCount(0);
  await expect(host.getByRole('img', { name: 'Room QR code', exact: true })).toBeVisible();
  const guestSelection = guest.getByRole('combobox', { name: 'My player', exact: true });
  await guestSelection.selectOption('1');
  await expect(guestSelection).toBeEnabled();
  await expect(host.locator('.unassigned-count')).toHaveText('Unseated · 0');
  await host.locator('app-online').getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(host.locator('.game-shell')).toBeVisible();
  await expect(guest.locator('.game-shell')).toBeVisible();
  await gameMenu(host, 'Player permissions');
  await expect(prompt(host).getByRole('switch')).toHaveCount(8);
  await guest.reload();
  await expect(guest.locator('.game-shell')).toBeVisible();
  await guest.locator('.floating-menu').click();
  await expect(
    prompt(guest).getByRole('button', { name: 'Player permissions', exact: true }),
  ).toHaveCount(0);
  const token = await host.evaluate(
    (api) => JSON.parse(sessionStorage.getItem('riichi-room:' + api)!).token,
    api,
  );
  expect(
    (
      await host.request.delete(`${api}/api/rooms/${code}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).ok(),
  ).toBe(true);
});

test('host permissions synchronize and final choices affect only each local copy', async ({
  page: host,
  browser,
}) => {
  const api = process.env['RIICHI_API_TEST_URL']!;
  await host.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: api } } }),
  );
  await host.goto('/');
  await host.getByRole('combobox', { name: 'My player', exact: true }).selectOption('2');
  await host.getByRole('button', { name: /Start match/ }).click();
  await host.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await host.getByRole('button', { name: 'Host game', exact: true }).click();
  await expect(host.getByRole('textbox', { name: 'Room code', exact: true })).toBeVisible();
  const { id: code, pin } = await host.evaluate((api) => {
    const access = JSON.parse(localStorage.getItem('riichi-room:' + api)!);
    return {
      id: access.id,
      pin: sessionStorage.getItem('riichi-room:' + api + ':' + access.id + ':pin')!,
    };
  }, api);
  for (const width of [320, 390, 1280]) {
    await host.setViewportSize({ width, height: 900 });
    const players = host.locator('app-player-presence li');
    await expect(players).toHaveCount(4);
    const bounds = await players.evaluateAll((items) =>
      items.map((item) => {
        const rect = item.getBoundingClientRect();
        return { top: rect.top, right: rect.right };
      }),
    );
    expect(
      Math.max(...bounds.map((item) => item.top)) - Math.min(...bounds.map((item) => item.top)),
    ).toBeLessThan(1);
    const list = (await host.locator('.player-presence').boundingBox())!;
    expect(bounds.at(-1)!.right).toBeLessThanOrEqual(list.x + list.width + 1);
  }
  const guestContext = await browser.newContext({ serviceWorkers: 'block' });
  const guest = await guestContext.newPage();
  await guest.route('**/config.json', (route) =>
    route.fulfill({ json: { backend: { apiUrl: api } } }),
  );
  await guest.goto('http://localhost:4300/');
  await guest.getByRole('button', { name: /Start match/ }).click();
  await guest.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await guest.getByRole('button', { name: 'Join game', exact: true }).click();
  await guest.getByRole('textbox', { name: 'Room code', exact: true }).fill(code);
  await guest.getByRole('textbox', { name: 'Room PIN', exact: true }).fill(pin);
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(
    guest.getByText('Waiting for the host to start the game.', { exact: true }),
  ).toBeVisible();
  await expect(guest.locator('.game-shell')).toHaveCount(0);
  await expect(guest.locator('.lobby-format')).toHaveText('Mahjong Soul · East-only game · 4P');
  const connection = await guest.locator('.guest-connection app-connection-status').boundingBox();
  const waiting = await guest.locator('.guest-connection > .waiting-message').boundingBox();
  expect(waiting!.x).toBeGreaterThanOrEqual(connection!.x + connection!.width);
  expect(waiting!.y).toBeLessThan(connection!.y + connection!.height);
  await expect(guest.getByRole('img', { name: 'Room QR code', exact: true })).toHaveCount(0);
  await expect(guest.getByRole('textbox', { name: 'Room code', exact: true })).toHaveCount(0);
  await expect(guest.getByRole('textbox', { name: 'Room PIN', exact: true })).toHaveCount(0);
  await expect(host.getByRole('img', { name: 'Room QR code', exact: true })).toBeVisible();
  await expect(host.getByRole('textbox', { name: 'Room code', exact: true })).toHaveValue(code);
  await expect(host.getByRole('textbox', { name: 'Room PIN', exact: true })).toHaveValue(pin);
  const myPlayer = guest
    .locator('app-online')
    .getByRole('combobox', { name: 'My player', exact: true });
  await expect(myPlayer.locator('option')).toHaveText([
    'Unassigned',
    'Player 1',
    'Player 2',
    'Player 3',
    'Player 4',
  ]);
  await expect(myPlayer.locator('option[value="2"]')).toBeEnabled();
  await myPlayer.selectOption('2');
  await expect(guest.getByRole('alert')).toHaveText('This seat is already occupied.');
  await expect(myPlayer).toHaveValue('2');
  await expect(guest.locator('.game-shell')).toHaveCount(0);
  await myPlayer.selectOption('3');
  await expect(myPlayer).toBeEnabled();
  await expect
    .poll(() =>
      guest.evaluate((api) => JSON.parse(localStorage.getItem('riichi-room:' + api)!).seat, api),
    )
    .toBe(3);
  const membership = await guest.evaluate(
    (api) => JSON.parse(localStorage.getItem('riichi-room:' + api)!),
    api,
  );
  const headers = { Authorization: `Bearer ${membership.token}` };
  await guest.goto(`http://localhost:4300/online?room=${code}&pin=${pin}`);
  await expect(myPlayer).toHaveValue('3');
  await expect(myPlayer).toBeEnabled();
  expect(
    await guest.evaluate(
      (api) => JSON.parse(localStorage.getItem('riichi-room:' + api)!).token,
      api,
    ),
  ).toBe(membership.token);
  const denied = await guest.request.delete(`${api}/api/rooms/${code}/seats/2`, { headers });
  expect(denied.status()).toBe(401);
  await guest.getByRole('button', { name: 'Leave room', exact: true }).click();
  await expect(guest.locator('app-online')).toHaveCount(0);
  const hostAccess = await host.evaluate(
    (api) => JSON.parse(localStorage.getItem('riichi-room:' + api)!),
    api,
  );
  const released = await host.request.get(`${api}/api/rooms/${code}`, {
    headers: { Authorization: `Bearer ${hostAccess.token}` },
  });
  expect((await released.json()).seats).not.toContain(3);
  await guest.goto(`http://localhost:4300/online?room=${code}&pin=${pin}`);
  await expect(myPlayer).toBeEnabled();
  await myPlayer.selectOption('2');
  await expect(guest.getByRole('alert')).toHaveText('This seat is already occupied.');
  await expect(myPlayer).toBeEnabled();
  await host.locator('app-online').getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(host.getByRole('alert')).toHaveText(
    'Assign all waiting players before starting the game.',
  );
  await expect(myPlayer).toHaveValue('2');
  await expect(guest.locator('.game-shell')).toHaveCount(0);
  await myPlayer.selectOption('3');
  await expect(myPlayer).toBeEnabled();
  await expect(host.locator('.unassigned-count')).toHaveText('Unseated · 0');
  await host.locator('app-online').getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(guest.locator('.game-shell')).toBeVisible();

  await expect(host.locator('.seat-bottom h3')).toHaveText('Player 3');
  const ownPresence = host
    .locator('.seat-bottom h3')
    .getByRole('status', { name: 'Online', exact: true });
  await expect(ownPresence).toHaveClass(/connected/);
  await expect(host.locator('.player-seat h3 .connecting')).toHaveCount(0);
  await expect(guest.locator('.seat-bottom h3')).toHaveText('Player 4');
  const headingBounds = (await host.locator('.game-heading').boundingBox())!;
  const roomBounds = (await host.locator('.room-status').boundingBox())!;
  expect(roomBounds.y).toBeGreaterThanOrEqual(headingBounds.y + headingBounds.height);
  await guest.locator('.floating-menu').click();
  await expect(
    prompt(guest).getByRole('button', { name: 'Player permissions', exact: true }),
  ).toHaveCount(0);
  await prompt(guest).locator('.close-prompt').click();
  await gameMenu(guest, 'Information');
  await expect(prompt(guest).getByRole('textbox', { name: 'Room code', exact: true })).toHaveValue(
    code,
  );
  await expect(prompt(guest).getByRole('textbox', { name: 'Room PIN', exact: true })).toHaveValue(
    pin,
  );
  await expect(prompt(guest).getByRole('img', { name: 'Room QR code', exact: true })).toBeVisible();
  await expect(
    prompt(guest).getByRole('textbox', { name: 'Match name', exact: true }),
  ).toHaveAttribute('readonly', '');
  await prompt(guest).locator('.close-prompt').click();
  await gameMenu(host, 'Player permissions');
  await expect(prompt(host).getByRole('switch')).toHaveCount(8);
  await playerAction(guest, 'Player 4');
  await expect(prompt(guest).getByRole('button', { name: 'Record draw', exact: true })).toHaveCount(
    0,
  );
  await expect(prompt(guest).getByRole('button', { name: 'Pon', exact: true })).toHaveCount(0);
  await prompt(host).getByRole('switch', { name: 'Record draws', exact: true }).check();
  await prompt(guest).getByRole('button', { name: 'Record draw', exact: true }).click();
  await prompt(guest).getByRole('button', { name: 'Review settlement', exact: true }).click();
  await prompt(guest)
    .getByRole('button', { name: 'Confirm & save settlement', exact: true })
    .click();
  await expect(prompt(guest)).toBeHidden();
  await expect(host.locator('.table-honba strong')).toHaveText('1');
  await prompt(host).getByRole('switch', { name: 'Record draws', exact: true }).uncheck();
  const permissionRow = prompt(host).locator('.permission-item').first();
  const description = await permissionRow.locator('span').boundingBox();
  const toggle = await permissionRow.getByRole('switch').boundingBox();
  expect(description!.x + description!.width).toBeLessThanOrEqual(toggle!.x);
  expect(
    Math.abs(description!.y + description!.height / 2 - toggle!.y - toggle!.height / 2),
  ).toBeLessThan(2);
  await prompt(host)
    .getByRole('switch', { name: 'Declare or cancel own Riichi', exact: true })
    .uncheck();
  await expect(
    guest.locator('.seat-bottom').getByRole('button', { name: 'Riichi', exact: true }),
  ).toBeDisabled();
  await expect(
    prompt(host).getByRole('switch', { name: 'Edit shared indicators', exact: true }),
  ).toBeChecked();
  await expect(
    prompt(host).getByRole('switch', { name: 'Edit shared indicators', exact: true }),
  ).toBeEnabled();
  await prompt(host).locator('.close-prompt').click();
  await guest.getByRole('button', { name: 'Dora indicators', exact: true }).click();
  await enterLiveTiles(guest, 'Dora indicators', '7z');
  await expect(host.locator('.indicator-preview app-tile-art')).toHaveCount(1);
  const guestPresence = host.locator('.player-seat h3').filter({ hasText: 'Player 4' });
  await expect(guestPresence.getByRole('status', { name: 'Online', exact: true })).toBeVisible();
  await host.evaluate(() => window.scrollTo(0, 0));
  await host.screenshot({ path: 'artifacts/shared-table-presence.png', fullPage: true });
  await guest.goto('http://localhost:4300/');
  await expect(guestPresence.getByRole('status', { name: 'Offline', exact: true })).toBeVisible();
  await guest.goto(`http://localhost:4300/room/${code}`);
  await expect(guestPresence.getByRole('status', { name: 'Online', exact: true })).toBeVisible();
  await expect(guest.locator('app-player-presence')).toHaveCount(0);
  await gameMenu(host, 'End entire match');
  await prompt(host).getByRole('button', { name: 'End entire match', exact: true }).click();
  await expect(prompt(host).getByRole('button', { name: 'Save game', exact: true })).toHaveCount(0);
  await expect(prompt(guest).getByRole('button', { name: 'Save game', exact: true })).toHaveCount(
    0,
  );
  await prompt(host).getByRole('button', { name: 'Discard game', exact: true }).click();
  await expect(host.locator('.game-shell')).toHaveCount(0);
  await expect(prompt(guest).getByRole('button', { name: 'Save game', exact: true })).toHaveCount(
    0,
  );
  await guest.goto('/records');
  await expect(guest).toHaveURL(/records/);
  const access = await host.evaluate(
    (apiUrl) => JSON.parse(localStorage.getItem(`riichi-room:${apiUrl}`)!),
    api,
  );
  expect(
    (
      await host.request.get(`${api}/api/rooms/${code}`, {
        headers: { Authorization: `Bearer ${access.token}` },
      })
    ).ok(),
  ).toBe(true);
  await guestContext.close();
});
