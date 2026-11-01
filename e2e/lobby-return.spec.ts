import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'block' });
test('lobby host and guest remain online away at home and return to their seats', async ({
  page: host,
}) => {
  test.setTimeout(60000);
  const api = process.env['RIICHI_API_TEST_URL']!;
  test.skip(!api, 'Requires local API.');
  const configure = async (page: typeof host) =>
    page.route('**/config.json', (r) => r.fulfill({ json: { backend: { apiUrl: api } } }));
  await configure(host);
  await host.goto('/');
  await host.getByRole('button', { name: /Start match/ }).click();
  await host.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await host.getByRole('button', { name: 'Host game', exact: true }).click();
  const code = await host.getByRole('textbox', { name: 'Room code', exact: true }).inputValue();
  const pin = await host.getByRole('textbox', { name: 'Room PIN', exact: true }).inputValue();
  const access = await host.evaluate(
    (api) => JSON.parse(sessionStorage.getItem('riichi-room:' + api)!),
    api,
  );
  const guest = await host.context().newPage();
  try {
    await configure(guest);
    await guest.goto('/online?room=' + code + '&pin=' + pin);
    await guest.getByRole('combobox', { name: 'My player', exact: true }).selectOption('1');
    await expect(guest.getByRole('combobox', { name: 'My player', exact: true })).toBeEnabled();
    await guest.getByRole('button', { name: 'Return home', exact: true }).click();
    await expect(host.locator('app-player-presence [aria-label="Away"]')).toHaveCount(1);
    await host
      .locator('dialog.shared-game-dialog')
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    await expect(host.locator('dialog.shared-game-dialog')).toBeHidden();
    await expect
      .poll(async () => {
        const state = await (
          await host.request.get(api + '/api/rooms/' + code + '/game', {
            headers: { Authorization: 'Bearer ' + access.token },
          })
        ).json();
        return state.presence.awaySeats;
      })
      .toEqual([0, 1]);
    await host.waitForTimeout(33000);
    const room = await (
      await host.request.get(api + '/api/rooms/' + code, {
        headers: { Authorization: 'Bearer ' + access.token },
      })
    ).json();
    expect(room.closed).toBe(false);
    expect(room.host).toBe(true);
    expect(room.seats.sort()).toEqual([0, 1]);
    await host.getByRole('button', { name: /Ongoing games/ }).click();
    await host.locator('.ongoing-list a').click();
    await expect(host.getByRole('img', { name: 'Room QR code', exact: true })).toBeVisible();
    await expect(host.locator('app-player-presence [aria-label="Online"]')).toHaveCount(1);
    await expect(host.locator('app-player-presence [aria-label="Away"]')).toHaveCount(1);
    await guest.getByRole('button', { name: /Ongoing games/ }).click();
    await guest.locator('.ongoing-list a').click();
    await expect(guest.getByRole('combobox', { name: 'My player', exact: true })).toHaveValue('1');
    await expect(host.locator('app-player-presence [aria-label="Online"]')).toHaveCount(2);
    await expect(host.locator('app-player-presence [aria-label="Away"]')).toHaveCount(0);
  } finally {
    await guest.close();
  }
});
