import { test, expect, type Page } from '@playwright/test';
import { playerAction, prompt, enterLiveTiles } from './helpers/game';

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
    await page.route('**/backend.json', (route) => route.fulfill({ json: { apiUrl: api } }));
    await page.addInitScript(() => {
      localStorage.setItem('riichi-advanced-scoring', 'true');
      localStorage.setItem('riichi-install-reminder-hidden', 'true');
    });
  }
  await prepare(host);
  await host.goto('/');
  await host.getByRole('button', { name: /Start match/ }).click();
  await host.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await host.getByRole('button', { name: 'Host game', exact: true }).click();
  await expect(host.locator('.credential-row').first()).toBeVisible();
  const code = (await host.locator('.credential-row').first().innerText())
    .split('\n')
    .at(-1)!
    .trim();
  const pin = (
    await host
      .locator('p')
      .filter({ hasText: /Room PIN/ })
      .locator('strong')
      .innerText()
  ).trim();
  await expect(host.getByRole('img', { name: 'Room QR code', exact: true })).toBeVisible();
  await expect(host.getByLabel('Room link', { exact: true })).toHaveCount(0);
  await expect(host.getByRole('button', { name: 'Copy room details' })).toBeVisible();
  await expect(host.getByRole('link', { name: 'Open room table', exact: true })).toBeVisible();

  await host.request.post(api + '/api/rooms/' + code + '/join', { data: { pin, seat: 0 } });
  const guestContext = await browser.newContext({ serviceWorkers: 'block' });
  const guest = await guestContext.newPage();
  await prepare(guest);
  await guest.goto('http://localhost:4300/');
  await guest.getByRole('button', { name: /Start match/ }).click();
  await guest.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await guest.getByRole('button', { name: 'Join game', exact: true }).click();
  await guest.getByLabel('Room code', { exact: true }).fill(code);
  await guest.getByLabel('Room PIN', { exact: true }).fill(pin);

  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await guest.getByRole('link', { name: 'Open room table', exact: true }).click();
  await host.getByRole('link', { name: 'Open room table', exact: true }).click();
  const guestSeat = guest.locator('.player-seat').filter({ hasText: 'Player 2' });
  const hostSeat = host.locator('.player-seat').filter({ hasText: 'Player 2' });
  await expect(guestSeat).toBeVisible();
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
    host.getByRole('heading', { name: 'Pending winning declarations', exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await host.getByRole('button', { name: 'Settle pending wins', exact: true }).click();
  await expect(host.locator('.table-round b')).toHaveText('2', { timeout: 15000 });
  await expect(guest.locator('.table-round b')).toHaveText('2');
  await expect(guest.locator('.table-pot strong')).toHaveText('0');
  // When the host leaves, declarations persist and are processed after it returns.
  await host.goto('/');
  await guestSeat.getByRole('button', { name: 'Riichi', exact: true }).click();
  await expect(guest.getByRole('status')).toContainText('Waiting for the host');
  await expect(guest.locator('.table-pot strong')).toHaveText('0');
  await host.getByRole('button', { name: /Start match/ }).click();
  await host.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await host.getByRole('button', { name: 'Join game', exact: true }).click();
  await host.getByRole('link', { name: 'Open room table', exact: true }).click();
  await expect(guest.locator('.table-pot strong')).toHaveText('1,000', { timeout: 15000 });
  for (const [page, name] of [
    [guest, 'Player 2'],
    [host, 'Player 4'],
  ] as const) {
    await playerAction(page, name);
    await prompt(page).getByRole('button', { name: 'Ron · discard', exact: true }).click();
    await prompt(page).getByRole('button', { name: 'Next', exact: true }).click();
    await prompt(page).getByRole('button', { name: 'Review settlement', exact: true }).click();
    await prompt(page)
      .getByRole('button', { name: 'Confirm & save settlement', exact: true })
      .click();
  }
  await expect(host.locator('.pending-win')).toHaveCount(2);
  await host.getByRole('button', { name: 'Settle pending wins', exact: true }).click();
  await expect(guest.locator('.table-honba strong')).toHaveText('1', { timeout: 15000 });
  await expect(guest.locator('.table-pot strong')).toHaveText('0');
  await guest.screenshot({ path: 'artifacts/online-live-guest.png' });
  await host.goto('/');
  await host.locator('.app-navigation a[href$="/others"]').click();
  await host.getByRole('button', { name: 'Export data', exact: true }).click();
  const exportDialog = host.getByRole('dialog', { name: 'Export data', exact: true });
  await exportDialog.getByRole('button', { name: 'Share selected games', exact: true }).click();
  await expect(exportDialog.getByRole('img', { name: 'Share QR code', exact: true })).toBeVisible();
  const shareLink = await exportDialog.getByLabel('Share link', { exact: true }).inputValue();
  await guest.goto('http://localhost:4300/');
  await guest.evaluate((url) => {
    history.pushState(null, '', url);
    dispatchEvent(new PopStateEvent('popstate'));
  }, shareLink);
  await guest.getByRole('button', { name: 'Import selected games', exact: true }).click();
  await expect(guest.getByRole('status')).toHaveText('Games imported.');
  await exportDialog.getByRole('button', { name: 'Revoke share', exact: true }).click();
  await expect(exportDialog.getByRole('img', { name: 'Share QR code', exact: true })).toHaveCount(
    0,
  );
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
  await page.route('**/backend.json', (route) => route.fulfill({ json: { apiUrl: api } }));
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Players', exact: true })
    .selectOption({ label: '3 players' });
  await page.getByRole('button', { name: 'Host game', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open room table', exact: true })).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'Host game', exact: true });
  await expect(dialog.locator('li')).toHaveCount(0);
  await expect(dialog.locator('.connection-chip')).toHaveText('Connected');
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
  const code = (await dialog.locator('.credential-row').first().innerText())
    .split('\n')
    .at(-1)!
    .trim();
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
