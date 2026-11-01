import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'block' });
test('new and copied tabs join independently and cannot select the same player', async ({
  page: host,
}) => {
  const api = process.env['RIICHI_API_TEST_URL']!;
  test.skip(!api, 'Requires local API.');
  const configure = async (page: typeof host) =>
    page.route('**/config.json', (route) => route.fulfill({ json: { backend: { apiUrl: api } } }));
  await configure(host);
  await host.goto('/');
  await host.getByRole('button', { name: /Start match/ }).click();
  await host.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await host.getByRole('button', { name: 'Host game', exact: true }).click();
  const code = await host.getByRole('textbox', { name: 'Room code', exact: true }).inputValue();
  const pin = await host.getByRole('textbox', { name: 'Room PIN', exact: true }).inputValue();
  const first = await host.context().newPage(),
    second = await host.context().newPage();
  try {
    await configure(first);
    await configure(second);
    await first.goto('/online?room=' + code + '&pin=' + pin);
    const selection = first.getByRole('combobox', { name: 'My player', exact: true });
    await selection.selectOption('1');
    await expect(selection).toBeEnabled();
    const credential = await first.evaluate(
      (api) => JSON.parse(sessionStorage.getItem('riichi-room:' + api)!),
      api,
    );
    await second.addInitScript(
      ({ api, credential }) => {
        if (!sessionStorage.getItem('cloned-for-test')) {
          sessionStorage.setItem('riichi-room:' + api, JSON.stringify(credential));
          sessionStorage.setItem('cloned-for-test', 'true');
        }
      },
      { api, credential },
    );
    await second.goto('/online?room=' + code + '&pin=' + pin);
    const another = second.getByRole('combobox', { name: 'My player', exact: true });
    await expect(another).toHaveValue('-1');
    const secondCredential = await second.evaluate(
      (api) => JSON.parse(sessionStorage.getItem('riichi-room:' + api)!),
      api,
    );
    expect(secondCredential.token).not.toBe(credential.token);
    await another.selectOption('1');
    await expect(second.getByRole('alert')).toHaveText('This seat is already occupied.');
    await expect(another).toHaveValue('1');
    await expect(host.getByRole('button', { name: 'Transfer host', exact: true })).toHaveCount(0);
    await host
      .locator('app-online')
      .getByRole('button', { name: 'Start game', exact: true })
      .click();
    await expect(host.getByRole('alert')).toHaveText(
      'Assign all waiting players before starting the game.',
    );
    await another.selectOption('2');
    await expect(another).toBeEnabled();
    await expect(host.locator('.unassigned-count')).toHaveText('Unseated \u00b7 0');
    await host
      .locator('app-online')
      .getByRole('button', { name: 'Start game', exact: true })
      .click();
    await expect(first.locator('.seat-bottom h3')).toHaveText('Player 2');
    await expect(second.locator('.seat-bottom h3')).toHaveText('Player 3');
    await first.reload();
    await expect(first.locator('.seat-bottom h3')).toHaveText('Player 2');
    expect(
      await first.evaluate(
        (api) => JSON.parse(sessionStorage.getItem('riichi-room:' + api)!).token,
        api,
      ),
    ).toBe(credential.token);
  } finally {
    await first.close();
    await second.close();
  }
});

test('full lobby shows a room-full error instead of admitting another player', async ({
  page: host,
}) => {
  const api = process.env['RIICHI_API_TEST_URL']!;
  test.skip(!api, 'Requires local API.');
  await host.route('**/config.json', (r) => r.fulfill({ json: { backend: { apiUrl: api } } }));
  await host.goto('/');
  await host.getByRole('button', { name: /Start match/ }).click();
  await host.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await host.getByRole('button', { name: 'Host game', exact: true }).click();
  const code = await host.getByRole('textbox', { name: 'Room code', exact: true }).inputValue();
  const pin = await host.getByRole('textbox', { name: 'Room PIN', exact: true }).inputValue();
  for (const seat of [1, 2, 3])
    expect(
      (await host.request.post(api + '/api/rooms/' + code + '/join', { data: { pin, seat } })).ok(),
    ).toBe(true);
  const guest = await host.context().newPage();
  try {
    await guest.route('**/config.json', (r) => r.fulfill({ json: { backend: { apiUrl: api } } }));
    await guest.goto('/online?room=' + code + '&pin=' + pin);
    await expect(guest.getByRole('alert')).toHaveText('This room is full.');
    await expect(guest.getByRole('combobox', { name: 'My player', exact: true })).toHaveCount(0);
    expect(
      await guest.evaluate((api) => sessionStorage.getItem('riichi-room:' + api), api),
    ).toBeNull();
  } finally {
    await guest.close();
  }
});
