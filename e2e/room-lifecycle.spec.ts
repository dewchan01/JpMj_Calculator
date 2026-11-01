import { test, expect, type APIRequestContext } from '@playwright/test';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { rankedRules } from '../packages/mahjong-rules/index';
import { balances, finishMatch, type Match } from '../packages/mahjong-core/ledger';
import { gameMenu, prompt } from './helpers/game';

test.use({ serviceWorkers: 'block' });
const api = process.env['RIICHI_API_TEST_URL']!;
const auth = (token: string) => ({ Authorization: 'Bearer ' + token });
function matchFixture(): Match {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    name: 'Lifecycle',
    createdAt: now,
    updatedAt: now,
    playerCount: 3,
    rules: rankedRules(3),
    live: { players: {}, dora: '7z', ura: '', calls: 0 },
    players: [0, 1, 2].map((i) => ({ id: 'p' + i, name: 'Player ' + (i + 1) })),
    initialBalances: { p0: 35000, p1: 35000, p2: 35000 },
    initialDealerId: 'p0',
    dealerId: 'p0',
    roundWind: 'east',
    handNumber: 1,
    honba: 0,
    gameLength: 'east',
    events: [
      {
        id: crypto.randomUUID(),
        type: 'riichiDeposit',
        timestamp: now,
        payments: [{ from: 'p0', to: 'table', amount: 1000, reason: 'Riichi deposit' }],
      },
    ],
    clock: { elapsedMs: 0, runningSince: now, handStartMs: 0 },
  };
}
async function create(request: APIRequestContext, match = matchFixture()) {
  const response = await request.post(api + '/api/rooms', {
    data: { playerCount: 3, hostSeat: 0, match, handKey: 'east:1:0' },
  });
  expect(response.ok()).toBeTruthy();
  return { ...(await response.json()), match } as {
    id: string;
    token: string;
    pin: string;
    match: Match;
  };
}
async function connect(id: string, token: string) {
  const hub = new HubConnectionBuilder()
    .withUrl(api + '/hubs/rooms')
    .configureLogging(LogLevel.None)
    .build();
  hub.on('Changed', () => {});
  hub.on('Presence', () => {});
  await hub.start();
  await hub.invoke('Join', id, token);
  return hub;
}

test('re-entry requires host approval and only the current host can transfer ownership', async ({
  request,
  page,
}) => {
  test.skip(!api, 'Requires local API.');
  const room = await create(request),
    base = api + '/api/rooms/' + room.id;
  const hostHub = await connect(room.id, room.token);
  const joined = await request.post(base + '/join', { data: { pin: room.pin, seat: 1 } });
  let guest = await joined.json();
  let guestHub = await connect(room.id, guest.token);
  const guestPage = await page
    .context()
    .browser()!
    .newPage({ baseURL: 'http://localhost:4300', serviceWorkers: 'block' });
  try {
    const choose = () =>
      request.put(base + '/player', { headers: auth(guest.token), data: { seat: 1 } });
    expect((await choose()).status()).toBe(202);
    expect(
      (await (await request.get(base + '/game', { headers: auth(guest.token) })).json()).match,
    ).toBeNull();
    await page.route('**/config.json', (r) => r.fulfill({ json: { backend: { apiUrl: api } } }));
    await page.goto('/');
    await page.evaluate(
      ({ api, room }) =>
        sessionStorage.setItem(
          'riichi-room:' + api,
          JSON.stringify({ id: room.id, token: room.token, host: true, seat: 0 }),
        ),
      { api, room },
    );
    await page.goto('/room/' + room.id);
    await expect(prompt(page)).toContainText('Seat requests');
    await prompt(page).getByRole('button', { name: 'Reject', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await (await request.get(base, { headers: auth(guest.token) })).json()).assignment,
      )
      .toBe('rejected');
    expect((await choose()).status()).toBe(202);
    await expect(prompt(page)).toContainText('Seat requests');
    await prompt(page).getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(prompt(page)).toBeHidden();
    await expect
      .poll(
        async () =>
          (await (await request.get(base, { headers: auth(guest.token) })).json()).ownSeat,
      )
      .toBe(1);
    await guestHub.stop();
    expect((await request.post(base + '/leave', { headers: auth(guest.token) })).ok()).toBeTruthy();
    guest = await (await request.post(base + '/join', { data: { pin: room.pin } })).json();
    guestHub = await connect(room.id, guest.token);
    await guestPage.route('**/config.json', (r) =>
      r.fulfill({ json: { backend: { apiUrl: api } } }),
    );
    await guestPage.goto('/');
    await guestPage.evaluate(
      ({ api, room, guest }) =>
        sessionStorage.setItem(
          'riichi-room:' + api,
          JSON.stringify({ id: room.id, token: guest.token, host: false, seat: null }),
        ),
      { api, room, guest },
    );
    await guestPage.goto('/online');
    await guestPage.getByRole('combobox', { name: 'My player', exact: true }).selectOption('1');
    await expect(
      guestPage.getByRole('button', {
        name: 'Waiting for the host to approve your seat.',
        exact: true,
      }),
    ).toBeDisabled();
    await prompt(page).getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(prompt(page)).toBeHidden();
    await expect(
      guestPage.getByRole('button', { name: 'Open room table', exact: true }),
    ).toBeEnabled();
    await guestPage.getByRole('combobox', { name: 'My player', exact: true }).selectOption('1');
    await expect(
      guestPage.getByRole('button', {
        name: 'Waiting for the host to approve your seat.',
        exact: true,
      }),
    ).toBeDisabled();
    await expect(prompt(page)).toContainText('Seat requests');
    await prompt(page).getByRole('button', { name: 'Accept', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await (await request.get(base, { headers: auth(guest.token) })).json()).ownSeat,
      )
      .toBe(1);
    expect(
      (
        await request.post(base + '/host', { headers: auth(guest.token), data: { seat: 0 } })
      ).status(),
    ).toBe(403);
    await expect(guestPage).toHaveURL(new RegExp('/room/' + room.id));
    await expect(guestPage.locator('.seat-bottom h3')).toHaveText('Player 2');
    await expect(guestPage.locator('app-table-summary [role="status"]')).toHaveCount(3);
    await guestHub.stop();
    await gameMenu(guestPage, 'Return home');
    await expect(page.locator('app-table-summary [role="status"][aria-label="Away"]')).toHaveCount(
      1,
    );
    await guestPage.getByRole('button', { name: /Ongoing games/ }).click();
    await guestPage.locator('.ongoing-list a').click();
    await expect(guestPage.locator('app-table-summary [role="status"]')).toHaveCount(3);
    await expect(page.locator('app-table-summary [role="status"][aria-label="Away"]')).toHaveCount(
      0,
    );
    await gameMenu(page, 'Player permissions');
    await prompt(page).getByRole('combobox').selectOption('1');
    await prompt(page).getByRole('button', { name: 'Transfer host', exact: true }).click();
    await expect
      .poll(
        async () => (await (await request.get(base, { headers: auth(guest.token) })).json()).host,
      )
      .toBe(true);
    expect(
      (
        await request.post(base + '/host', { headers: auth(room.token), data: { seat: 0 } })
      ).status(),
    ).toBe(403);
    expect((await request.post(base + '/leave', { headers: auth(guest.token) })).ok()).toBeTruthy();
    await expect
      .poll(
        async () => (await (await request.get(base, { headers: auth(room.token) })).json()).host,
      )
      .toBe(true);
  } finally {
    await hostHub.stop();
    await guestHub.stop();
    await guestPage.close();
  }
});

test('last host departure settles escrow once and permanently closes the match', async ({
  request,
  page,
}) => {
  test.skip(!api, 'Requires local API.');
  const room = await create(request),
    base = api + '/api/rooms/' + room.id;
  await page.route('**/config.json', (r) => r.fulfill({ json: { backend: { apiUrl: api } } }));
  await page.goto('/');
  await page.evaluate(
    ({ api, room }) =>
      sessionStorage.setItem(
        'riichi-room:' + api,
        JSON.stringify({ id: room.id, token: room.token, host: true, seat: 0 }),
      ),
    { api, room },
  );
  await page.goto('/room/' + room.id);
  await expect(page.locator('.game-shell')).toBeVisible();
  await gameMenu(page, 'Information');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const copy = prompt(page).getByRole('button', {
    name: 'Copy room details - Room code',
    exact: true,
  });
  await copy.click();
  await expect(copy).toHaveAttribute('data-copied', 'true');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(room.id);
  await prompt(page).getByRole('button', { name: 'Close', exact: true }).click();
  await gameMenu(page, 'Exit room');
  await expect(prompt(page)).toContainText('Leave this room?');
  await prompt(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(
    (await (await request.get(base + '/game', { headers: auth(room.token) })).json()).closed,
  ).toBe(false);
  await gameMenu(page, 'Exit room');
  await prompt(page).getByRole('button', { name: 'Exit room', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/score/' + room.match.id));
  const receipt = await (await request.get(base + '/game', { headers: auth(room.token) })).json();
  expect(receipt.closed).toBe(true);
  expect(receipt.match.ended).toBe(true);
  expect(balances(receipt.match)).toEqual(balances(finishMatch(room.match, 'expected')));
  expect(receipt.match.clock.runningSince).toBeNull();
  const again = await (await request.post(base + '/leave', { headers: auth(room.token) })).json();
  expect(again.match.events.filter((e: { type: string }) => e.type === 'matchEnd')).toHaveLength(1);
  expect((await request.post(base + '/join', { data: { pin: room.pin } })).status()).toBe(410);
  expect(
    (
      await request.put(base + '/game', {
        headers: auth(room.token),
        data: { revision: 0, handKey: 'east:1:0', match: room.match, decisions: [] },
      })
    ).status(),
  ).toBe(410);
});

test('host disconnect retains ownership briefly then hands over after thirty seconds', async ({
  request,
}) => {
  test.setTimeout(90000);
  test.skip(!api, 'Requires local API.');
  const room = await create(request),
    base = api + '/api/rooms/' + room.id;
  const hostHub = await connect(room.id, room.token);
  const guest = await (await request.post(base + '/join', { data: { pin: room.pin } })).json();
  const guestHub = await connect(room.id, guest.token);
  try {
    await request.put(base + '/player', { headers: auth(guest.token), data: { seat: 1 } });
    const state = await (await request.get(base + '/game', { headers: auth(room.token) })).json();
    await request.post(base + '/assignments/' + state.seatRequests[0].id, {
      headers: auth(room.token),
      data: { accept: true },
    });
    await hostHub.stop();
    await hostHub.start();
    await hostHub.invoke('Join', room.id, room.token);
    expect((await (await request.get(base, { headers: auth(room.token) })).json()).host).toBe(true);
    await hostHub.stop();
    expect((await (await request.get(base, { headers: auth(guest.token) })).json()).host).toBe(
      false,
    );
    await expect
      .poll(
        async () => (await (await request.get(base, { headers: auth(guest.token) })).json()).host,
        { timeout: 40000, intervals: [2000] },
      )
      .toBe(true);
    expect(
      (await (await request.get(base + '/game', { headers: auth(guest.token) })).json()).closed,
    ).toBe(false);
    await guestHub.stop();
    await expect
      .poll(
        async () =>
          (await (await request.get(base + '/game', { headers: auth(guest.token) })).json()).closed,
        { timeout: 40000, intervals: [2000] },
      )
      .toBe(true);
  } finally {
    await hostHub.stop();
    await guestHub.stop();
  }
});

test('abandoned settlement matches ledger split-top and yakitori rules', async ({ request }) => {
  test.skip(!api, 'Requires local API.');
  for (const split of [false, true]) {
    const match = matchFixture();
    match.rules = {
      ...match.rules,
      table: {
        finalRiichiReceiver: split ? 'split-top' : 'first',
        yakitoriPenalty: 1000,
      } as NonNullable<Match['rules']['table']>,
    };
    match.events.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'scoreAdjustment',
      payments: [{ from: 'p1', to: 'p0', amount: 1000, reason: 'Adjustment' }],
    });
    const room = await create(request, match);
    const response = await request.post(api + '/api/rooms/' + room.id + '/leave', {
      headers: auth(room.token),
    });
    expect(response.ok()).toBeTruthy();
    expect(balances((await response.json()).match)).toEqual(
      balances(finishMatch(match, 'expected')),
    );
  }
});
