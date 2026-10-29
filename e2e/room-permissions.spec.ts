import { test, expect } from '@playwright/test';
import { gameMenu, prompt, enterLiveTiles, playerAction } from './helpers/game';

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
  await host
    .locator('#host-setup-title')
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'Host game', exact: true })
    .click();
  const code = await host.getByRole('textbox', { name: 'Room code', exact: true }).inputValue();
  const pin = await host.getByRole('textbox', { name: 'Room PIN', exact: true }).inputValue();
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
    guest.getByText('Joined the room. Waiting for the host to start the game.', { exact: true }),
  ).toBeVisible();
  await expect(guest.locator('.game-shell')).toHaveCount(0);
  const myPlayer = guest
    .locator('app-online')
    .getByRole('combobox', { name: 'My player', exact: true });
  await expect(myPlayer.locator('option')).toHaveText([
    'Player 1',
    'Player 2',
    'Player 3',
    'Player 4',
  ]);
  await expect(myPlayer.locator('option[value="2"]')).toHaveAttribute('disabled', '');
  await myPlayer.selectOption('3');
  await expect(myPlayer).toBeEnabled();
  await expect
    .poll(() =>
      guest.evaluate((api) => JSON.parse(localStorage.getItem('riichi-room:' + api)!).seat, api),
    )
    .toBe(3);
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
  await prompt(host).getByRole('switch', { name: 'Edit shared indicators', exact: true }).check();
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
  await expect(prompt(host).getByRole('button', { name: 'Save game', exact: true })).toBeVisible();
  await expect(prompt(guest).getByRole('button', { name: 'Save game', exact: true })).toBeVisible();
  await prompt(host).getByRole('button', { name: 'Discard game', exact: true }).click();
  await expect(host.locator('.game-shell')).toHaveCount(0);
  await expect(prompt(guest).getByRole('button', { name: 'Save game', exact: true })).toBeVisible();
  await prompt(guest).getByRole('button', { name: 'Save game', exact: true }).click();
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
