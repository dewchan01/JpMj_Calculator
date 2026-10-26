import { beginWin, finishWin, gameMenu, prompt } from './helpers/game';
import { setLanguage, openRules } from './helpers/navigation';
import { expect, test } from '@playwright/test';
import { choosePlayer } from './helpers/players';

test('zh-TW table history persists offline and preserves user names', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() =>
    localStorage.setItem('riichi-players-v1', JSON.stringify([{ id: 'east-name', name: 'East' }])),
  );
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Match name', exact: true }).fill('My table name');
  await choosePlayer(page, 'South', 'East');
  await page.getByRole('button', { name: /Start match/ }).click();
  await beginWin(page, 'East');
  await finishWin(page);
  await setLanguage(page, 'zh-TW');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await gameMenu(page, 'History');
  await expect(page.locator('.history-event > summary')).toContainText('East');
  await prompt(page).locator('.close-prompt').click();
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
  await expect(page.getByRole('heading', { name: 'My table name', exact: true })).toBeVisible();
  await gameMenu(page, 'History');
  await expect(page.locator('.history-event')).toHaveCount(1);
});
test('English defaults in a Chinese browser, selected language, validation and storage fallback', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'zh-TW' });
  const page = await context.newPage();
  await page.goto('http://localhost:4300/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await setLanguage(page, 'zh-TW');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await page.getByRole('link', { name: '快速計分', exact: true }).click();
  await page.getByRole('button', { name: /計算點數/ }).click();
  await expect(page.getByText('暗手應有 14 張牌（含和牌張）。')).toBeVisible();
  await openRules(page);
  await expect(page.getByRole('heading', { name: '目前限制' })).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage disabled');
    };
    Storage.prototype.getItem = () => {
      throw new DOMException('Storage disabled');
    };
  });
  await setLanguage(page, 'en');
  await expect(page.getByRole('heading', { name: 'Explicit limits' })).toBeVisible();
  await context.close();
});
