import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'block' });
test('lobby successor keeps QR, starts the original game and sees only live seats', async ({
  page: host,
}) => {
  const api = process.env['RIICHI_API_TEST_URL']!;
  test.skip(!api, 'Requires local API.');
  const config = async (page: typeof host) =>
    page.route('**/config.json', (r) => r.fulfill({ json: { backend: { apiUrl: api } } }));
  await config(host);
  await host.goto('/');
  await host.getByRole('button', { name: /Start match/ }).click();
  await host.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await host.getByRole('button', { name: 'Host game', exact: true }).click();
  const code = await host.getByRole('textbox', { name: 'Room code', exact: true }).inputValue();
  const pin = await host.getByRole('textbox', { name: 'Room PIN', exact: true }).inputValue();
  const guest = await host.context().newPage();
  try {
    await config(guest);
    await guest.goto('/online?room=' + code + '&pin=' + pin);
    await guest.getByRole('combobox', { name: 'My player', exact: true }).selectOption('1');
    await expect(guest.getByRole('combobox', { name: 'My player', exact: true })).toBeEnabled();
    await host
      .locator('app-online')
      .getByRole('button', { name: 'Leave room', exact: true })
      .click();
    await host
      .locator('app-online dialog[open]')
      .getByRole('button', { name: 'Exit room', exact: true })
      .click();
    await expect(guest.getByRole('img', { name: 'Room QR code', exact: true })).toBeVisible();
    await expect(guest.getByRole('textbox', { name: 'Room PIN', exact: true })).toHaveValue(pin);
    await expect(guest.getByRole('combobox', { name: 'Game', exact: true })).toHaveCount(0);
    await expect(guest.getByRole('button', { name: 'Attach game', exact: true })).toHaveCount(0);
    await expect(guest.locator('app-player-presence [role=status][aria-label=Online]')).toHaveCount(
      1,
    );
    await expect(
      guest.locator('app-player-presence [role=status][aria-label=Offline]'),
    ).toHaveCount(3);
    await guest.getByRole('button', { name: 'Start game', exact: true }).click();
    await expect(guest.locator('.seat-bottom h3')).toContainText('Player 2');
  } finally {
    await guest.close();
  }
});

test('host leaving an entirely unassigned lobby closes it and removes waiting players', async ({
  page: host,
}) => {
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
  const guest = await host.context().newPage();
  try {
    await configure(guest);
    await guest.goto('/online?room=' + code + '&pin=' + pin);
    await expect(guest.getByRole('combobox', { name: 'My player', exact: true })).toHaveValue('-1');
    const access = await guest.evaluate(
      (api) => JSON.parse(sessionStorage.getItem('riichi-room:' + api)!),
      api,
    );
    await host
      .locator('app-online')
      .getByRole('button', { name: 'Leave room', exact: true })
      .click();
    await host
      .locator('app-online dialog[open]')
      .getByRole('button', { name: 'Exit room', exact: true })
      .click();
    await expect(guest).toHaveURL('http://localhost:4300/');
    await host.getByRole('button', { name: /Ongoing games/ }).click();
    await expect(host.locator('.ongoing-list a')).toHaveCount(0);
    await expect(host.locator('.resume-shared')).toHaveCount(0);
    expect(
      await guest.evaluate((api) => sessionStorage.getItem('riichi-room:' + api), api),
    ).toBeNull();
    expect(
      (
        await guest.request.get(api + '/api/rooms/' + code, {
          headers: { Authorization: 'Bearer ' + access.token },
        })
      ).status(),
    ).toBe(401);
    expect(
      (await guest.request.post(api + '/api/rooms/' + code + '/join', { data: { pin } })).status(),
    ).toBe(410);
  } finally {
    await guest.close();
  }
});
