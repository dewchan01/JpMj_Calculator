import { test, expect } from '@playwright/test';
test.use({ serviceWorkers: 'block' });
const api = 'http://localhost:5180',
  id = '527CD8F86E',
  key = 'riichi-room:' + api;
for (const status of [401, 404, 410]) {
  test('stale room ' + status + ' is checked once then forgotten', async ({ page }) => {
    let calls = 0;
    await page.route('**/config.json', (r) => r.fulfill({ json: { backend: { apiUrl: api } } }));
    await page.route(api + '/api/rooms/' + id, async (r) => {
      calls++;
      await r.fulfill({ status });
    });
    await page.goto('/');
    await page.evaluate(
      ({ key, id }) => {
        const access = JSON.stringify({ id, token: 'a'.repeat(64), host: false, seat: 1 });
        sessionStorage.setItem(key, access);
        localStorage.setItem(key, access);
        sessionStorage.setItem(key + ':' + id + ':pin', '123456');
      },
      { key, id },
    );
    await page.reload();
    await expect.poll(() => calls).toBe(1);
    await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), key)).toBeNull();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    expect(
      await page.evaluate(({ key, id }) => sessionStorage.getItem(key + ':' + id + ':pin'), {
        key,
        id,
      }),
    ).toBeNull();
    await page.reload();
    await page.getByRole('button', { name: /Ongoing games/ }).click();
    await expect(page.locator('.ongoing-list a')).toHaveCount(0);
    expect(calls).toBe(1);
  });
}
test('temporary room failure preserves reconnect credentials', async ({ page }) => {
  await page.route('**/config.json', (r) => r.fulfill({ json: { backend: { apiUrl: api } } }));
  let calls = 0;
  await page.route(api + '/api/rooms/' + id, (r) => {
    calls++;
    return r.fulfill({ status: 503 });
  });
  await page.goto('/');
  await page.evaluate(
    ({ key, id }) =>
      sessionStorage.setItem(
        key,
        JSON.stringify({ id, token: 'a'.repeat(64), host: false, seat: 1 }),
      ),
    { key, id },
  );
  await page.reload();
  await expect.poll(() => calls).toBe(1);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), key)).not.toBeNull();
});
