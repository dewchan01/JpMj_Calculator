import { expect, test } from '@playwright/test';

test('zh-TW switches current results, persists offline and preserves user names', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Language / 語言' }).selectOption('zh-TW');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await expect(page.getByRole('heading', { name: '開設牌桌' })).toBeVisible();
  await page.getByRole('textbox', { name: '對局名稱' }).fill('My table name');
  await page.getByRole('textbox', { name: '南家玩家名稱' }).fill('East');
  await page.getByRole('button', { name: /開始對局/ }).click();
  await page.getByRole('button', { name: /試用範例手牌/ }).click();
  await page.getByRole('button', { name: /計算點數/ }).click();
  await expect(page.getByText('平和', { exact: true })).toBeVisible();
  await expect(page.getByText('1 番・30 符', { exact: true })).toBeVisible();
  await expect(page.getByText('East 獲得的點數')).toBeVisible();
  await page.getByRole('combobox', { name: 'Language / 語言' }).selectOption('en');
  await expect(page.getByText('No-points hand (Pinfu)')).toBeVisible();
  await expect(page.getByText('1 Han · 30 Fu', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Language / 語言' }).selectOption('zh-TW');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'My table name' })).toBeVisible();
  await expect(page.getByText('暗手 14 張・應有 14 張')).toBeVisible();
  await page.getByRole('checkbox', { name: /我已核對牌張/ }).check();
  await page.getByRole('button', { name: /計算點數/ }).click();
  await page.getByRole('button', { name: '確認並儲存結算' }).click();
  await expect(page.locator('.history-event summary')).toContainText('和牌・East');
  expect(errors).toEqual([]);
  await page.locator('.history-event summary').click();
  expect(errors).toEqual([]);
  await expect(page.getByText('平和', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/zh-tw-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await page.getByRole('button', { name: /牌局紀錄/ }).click();
  await expect(page.locator('.history-event summary')).toContainText('和牌・East');
  expect(errors).toEqual([]);
});

test('English defaults in a Chinese browser, selected language, validation and storage fallback', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'zh-TW' });
  const page = await context.newPage();
  await page.goto('http://localhost:4300/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('combobox', { name: 'Language / 語言' }).selectOption('zh-TW');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await page.getByRole('link', { name: '快速計分', exact: true }).click();
  await page.getByRole('button', { name: /計算點數/ }).click();
  await expect(page.getByText('暗手應有 14 張牌（含和牌張）。')).toBeVisible();
  await page.getByRole('link', { name: '規則與支援範圍', exact: true }).click();
  await expect(page.getByRole('heading', { name: '目前限制' })).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage disabled');
    };
    Storage.prototype.getItem = () => {
      throw new DOMException('Storage disabled');
    };
  });
  await page.getByRole('combobox', { name: 'Language / 語言' }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Explicit limits' })).toBeVisible();
  await context.close();
});
